import { execFile as execFileCallback } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { getRawHeader } from '@electron/asar';
import {
  exceedsSizeRegressionThreshold,
  measureFileCompressionBytes,
  measurePathBytes,
} from './build-size-metrics.mjs';

export const SIZE_REPORT_SCHEMA_VERSION = 1;

const execFile = promisify(execFileCallback);
const MEASURED_ASSET_EXTENSIONS = new Set(['.css', '.html', '.js']);
const GROUP_METRIC_LIMIT = 10;

function createOptionalMetric(id, bytes) {
  return { bytes, id };
}

function getPackageValue(packageJson, section, name) {
  const values = packageJson[section];
  if (typeof values !== 'object' || values === null) {
    return null;
  }

  const value = values[name];
  return typeof value === 'string' ? value.replace(/^[~^]/, '') : null;
}

function getPackageVersion(packageJson, name) {
  return getPackageValue(packageJson, 'dependencies', name) ?? getPackageValue(packageJson, 'devDependencies', name);
}

function getProductName(packageJson) {
  const productName = packageJson.build?.productName;
  return typeof productName === 'string' ? productName : 'GPT-Voice';
}

function metricSegment(value) {
  return value
    .toLowerCase()
    .replaceAll(/[\\/]+/g, '.')
    .replaceAll(/[^a-z0-9.-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

function toAsarGroup(pathParts) {
  if (pathParts[0] !== 'node_modules') {
    return pathParts[0] ?? 'root';
  }

  if (pathParts[1]?.startsWith('@')) {
    return `${pathParts[1]}-${pathParts[2] ?? 'root'}`;
  }

  return pathParts[1] ?? 'root';
}

function collectAsarGroups(files, pathParts = [], groups = new Map()) {
  for (const [name, entry] of Object.entries(files)) {
    const nextPathParts = [...pathParts, name];
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    if ('files' in entry && typeof entry.files === 'object' && entry.files !== null) {
      collectAsarGroups(entry.files, nextPathParts, groups);
      continue;
    }

    if ('size' in entry && typeof entry.size === 'number') {
      const group = toAsarGroup(nextPathParts);
      groups.set(group, (groups.get(group) ?? 0) + entry.size);
    }
  }

  return groups;
}

function getLargestGroups(groups) {
  return [...groups.entries()]
    .map(([name, bytes]) => ({ bytes, name }))
    .toSorted((left, right) => right.bytes - left.bytes || left.name.localeCompare(right.name, 'en'))
    .slice(0, GROUP_METRIC_LIMIT);
}

async function listFiles(rootDir, relativeDir = '') {
  const directoryPath = path.join(rootDir, relativeDir);
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name, 'en'))) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFiles(rootDir, relativePath)));
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }

    return files;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if ((await measurePathBytes(candidate)) !== null) {
      return candidate;
    }
  }

  return null;
}

async function getChildGroups(rootDir) {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const groups = [];

    for (const entry of entries) {
      const bytes = await measurePathBytes(path.join(rootDir, entry.name));
      if (bytes !== null) {
        groups.push({ bytes, name: entry.name });
      }
    }

    return getLargestGroups(new Map(groups.map((group) => [group.name, group.bytes])));
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function getRuntimeLayout(rootDir, platform, arch) {
  const releaseDir = path.join(rootDir, 'release');
  const macAppDirectories =
    arch === 'arm64'
      ? [path.join(releaseDir, 'mac-arm64', 'GPT-Voice.app'), path.join(releaseDir, 'mac-universal', 'GPT-Voice.app')]
      : [path.join(releaseDir, 'mac', 'GPT-Voice.app'), path.join(releaseDir, 'mac-universal', 'GPT-Voice.app')];

  if (platform === 'linux') {
    const unpackedDirectory = path.join(releaseDir, 'linux-unpacked');
    return {
      asar: [path.join(unpackedDirectory, 'resources', 'app.asar')],
      locales: [path.join(unpackedDirectory, 'locales')],
      runtime: [path.join(unpackedDirectory, 'resources', 'cloakbrowser')],
      unpacked: [unpackedDirectory],
    };
  }

  if (platform === 'win32') {
    const unpackedDirectory = path.join(releaseDir, 'win-unpacked');
    return {
      asar: [path.join(unpackedDirectory, 'resources', 'app.asar')],
      locales: [path.join(unpackedDirectory, 'locales')],
      runtime: [path.join(unpackedDirectory, 'resources', 'cloakbrowser')],
      unpacked: [unpackedDirectory],
    };
  }

  if (platform === 'darwin') {
    return {
      asar: macAppDirectories.map((appDirectory) => path.join(appDirectory, 'Contents', 'Resources', 'app.asar')),
      locales: macAppDirectories.map((appDirectory) =>
        path.join(appDirectory, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Resources'),
      ),
      runtime: macAppDirectories.map((appDirectory) =>
        path.join(appDirectory, 'Contents', 'Resources', 'cloakbrowser'),
      ),
      unpacked: macAppDirectories,
    };
  }

  throw new Error(`Unsupported measurement platform: ${platform}`);
}

function getInstallerCandidates(rootDir, platform, packageJson) {
  const releaseDir = path.join(rootDir, 'release');
  const productName = getProductName(packageJson);
  const packageName = typeof packageJson.name === 'string' ? packageJson.name : 'gpt-voice';
  const version = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';

  if (platform === 'linux') {
    return [
      ['installer.appimage', path.join(releaseDir, `${productName}-${version}.AppImage`)],
      ['installer.deb', path.join(releaseDir, `${packageName}_${version}_amd64.deb`)],
      ['installer.rpm', path.join(releaseDir, `${packageName}-${version}.x86_64.rpm`)],
    ];
  }

  if (platform === 'win32') {
    return [['installer.nsis', path.join(releaseDir, `${productName} Setup ${version}.exe`)]];
  }

  return [['installer.dmg', path.join(releaseDir, `${productName}-${version}.dmg`)]];
}

async function getGitCommit(rootDir) {
  try {
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: rootDir });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function readProjectPackageJson(rootDir) {
  return JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function collectToolVersions(rootDir, packageJson) {
  return {
    cloakbrowser: getPackageVersion(packageJson, 'cloakbrowser'),
    electron: getPackageVersion(packageJson, 'electron'),
    electronBuilder: getPackageVersion(packageJson, 'electron-builder'),
    node: process.version,
    webpack: getPackageVersion(packageJson, 'webpack'),
  };
}

export async function collectSizeReport({ arch, commit, packageJson, platform, rootDir, toolVersions }) {
  const metrics = [];
  const distDirectory = path.join(rootDir, 'dist');
  const distFiles = await listFiles(distDirectory);

  for (const relativePath of distFiles) {
    if (!MEASURED_ASSET_EXTENSIONS.has(path.extname(relativePath))) {
      continue;
    }

    const assetPath = path.join(distDirectory, relativePath);
    const compressed = await measureFileCompressionBytes(assetPath);
    const rawBytes = await measurePathBytes(assetPath);
    const metricBase = `dist.${metricSegment(relativePath)}`;
    metrics.push(createOptionalMetric(`${metricBase}.raw`, rawBytes));
    metrics.push(createOptionalMetric(`${metricBase}.gzip`, compressed?.gzipBytes ?? null));
    metrics.push(createOptionalMetric(`${metricBase}.brotli`, compressed?.brotliBytes ?? null));
  }

  const layout = getRuntimeLayout(rootDir, platform, arch);
  const asarPath = await firstExistingPath(layout.asar);
  const unpackedPath = await firstExistingPath(layout.unpacked);
  const localesPath = await firstExistingPath(layout.locales);
  const runtimePath = await firstExistingPath(layout.runtime);
  const asarBytes = asarPath ? await measurePathBytes(asarPath) : null;
  metrics.push(createOptionalMetric('app.asar', asarBytes));
  metrics.push(createOptionalMetric('electron.locales', localesPath ? await measurePathBytes(localesPath) : null));
  metrics.push(createOptionalMetric('cloakbrowser.runtime', runtimePath ? await measurePathBytes(runtimePath) : null));
  metrics.push(createOptionalMetric('unpacked.app', unpackedPath ? await measurePathBytes(unpackedPath) : null));

  if (asarPath) {
    const asarHeader = getRawHeader(asarPath).header;
    for (const group of getLargestGroups(collectAsarGroups(asarHeader.files))) {
      metrics.push(createOptionalMetric(`app.asar.group.${metricSegment(group.name)}`, group.bytes));
    }
  }

  if (runtimePath) {
    for (const group of await getChildGroups(runtimePath)) {
      metrics.push(createOptionalMetric(`cloakbrowser.group.${metricSegment(group.name)}`, group.bytes));
    }
  }

  for (const [id, installerPath] of getInstallerCandidates(rootDir, platform, packageJson)) {
    metrics.push(createOptionalMetric(id, await measurePathBytes(installerPath)));
  }

  return {
    metadata: {
      appVersion: typeof packageJson.version === 'string' ? packageJson.version : null,
      arch,
      commit,
      platform,
      toolVersions,
    },
    metrics: metrics.toSorted((left, right) => left.id.localeCompare(right.id, 'en')),
    schemaVersion: SIZE_REPORT_SCHEMA_VERSION,
  };
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function assertString(value, description) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${description} must be a non-empty string`);
  }
}

function assertMetric(metric, knownIds) {
  if (!isObject(metric)) {
    throw new TypeError('Size report metrics must be objects');
  }

  assertString(metric.id, 'Size metric id');
  if (knownIds.has(metric.id)) {
    throw new TypeError(`Size report contains duplicate metric id: ${metric.id}`);
  }

  if (metric.bytes !== null && (!Number.isSafeInteger(metric.bytes) || metric.bytes < 0)) {
    throw new TypeError(`Size metric ${metric.id} must use non-negative integer bytes or null`);
  }

  knownIds.add(metric.id);
}

export function validateSizeReport(report) {
  if (!isObject(report)) {
    throw new TypeError('Size report must be an object');
  }

  if (report.schemaVersion !== SIZE_REPORT_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported size report schema version: ${report.schemaVersion}`);
  }

  if (!isObject(report.metadata)) {
    throw new TypeError('Size report metadata must be an object');
  }

  assertString(report.metadata.platform, 'Size report platform');
  assertString(report.metadata.arch, 'Size report architecture');
  if (!Array.isArray(report.metrics)) {
    throw new TypeError('Size report metrics must be an array');
  }

  const knownIds = new Set();
  for (const metric of report.metrics) {
    assertMetric(metric, knownIds);
  }
}

export function compareSizeReports(report, baseline) {
  validateSizeReport(report);
  validateSizeReport(baseline);

  if (report.metadata.platform !== baseline.metadata.platform) {
    throw new TypeError('Size report platform must match the baseline platform');
  }

  if (report.metadata.arch !== baseline.metadata.arch) {
    throw new TypeError('Size report architecture must match the baseline architecture');
  }

  const baselineById = new Map(baseline.metrics.map((metric) => [metric.id, metric.bytes]));
  const regressions = [];
  let comparedMetricCount = 0;

  for (const metric of report.metrics) {
    const baselineBytes = baselineById.get(metric.id);
    if (metric.bytes === null || baselineBytes === null || baselineBytes === undefined) {
      continue;
    }

    if (baselineBytes <= 0) {
      throw new TypeError(`Baseline metric ${metric.id} must use positive integer bytes`);
    }

    comparedMetricCount += 1;
    if (exceedsSizeRegressionThreshold(metric.bytes, baselineBytes)) {
      regressions.push({ baselineBytes, currentBytes: metric.bytes, id: metric.id });
    }
  }

  return { comparedMetricCount, regressions };
}

function formatBytes(bytes) {
  return bytes === null ? 'missing' : `${bytes.toLocaleString('en-US')} bytes`;
}

export function formatSizeReportSummary(report) {
  const metricById = new Map(report.metrics.map((metric) => [metric.id, metric.bytes]));
  const lines = [
    `Size report: ${report.metadata.platform}/${report.metadata.arch}`,
    `Version: ${report.metadata.appVersion ?? 'unknown'}; commit: ${report.metadata.commit ?? 'unknown'}`,
  ];

  for (const [label, id] of [
    ['App ASAR', 'app.asar'],
    ['Electron locales', 'electron.locales'],
    ['CloakBrowser runtime', 'cloakbrowser.runtime'],
    ['Unpacked app', 'unpacked.app'],
  ]) {
    lines.push(`${label}: ${formatBytes(metricById.get(id) ?? null)}`);
  }

  return lines.join('\n');
}

function formatSizeVerificationSummary(report, comparison) {
  const lines = [
    `Size verification: ${report.metadata.platform}/${report.metadata.arch}`,
    `Compared metrics: ${comparison.comparedMetricCount}`,
  ];

  if (comparison.regressions.length === 0) {
    lines.push('No size regressions detected');
    return lines.join('\n');
  }

  lines.push(`Size regressions: ${comparison.regressions.length}`);
  for (const regression of comparison.regressions) {
    lines.push(`${regression.id}: ${formatBytes(regression.baselineBytes)} -> ${formatBytes(regression.currentBytes)}`);
  }

  return lines.join('\n');
}

function parseMeasureArguments(args) {
  const options = {
    arch: process.arch,
    output: null,
    platform: process.platform,
  };

  for (const argument of args) {
    const [name, value] = argument.split('=', 2);
    if (name === '--platform' && value) {
      options.platform = value;
    } else if (name === '--arch' && value) {
      options.arch = value;
    } else if (name === '--output' && value) {
      options.output = value;
    } else {
      throw new Error(`Unsupported measure:size argument: ${argument}`);
    }
  }

  return options;
}

function parseVerifyArguments(args) {
  const options = { baseline: null, report: null };

  for (const argument of args) {
    const [name, value] = argument.split('=', 2);
    if (name === '--baseline' && value) {
      options.baseline = value;
    } else if (name === '--report' && value) {
      options.report = value;
    } else {
      throw new Error(`Unsupported verify:size argument: ${argument}`);
    }
  }

  if (!options.baseline || !options.report) {
    throw new Error('Usage: node scripts/build-size-cli.mjs verify --report=<path> --baseline=<path>');
  }

  return options;
}

export async function runMeasureSizeCommand(args, rootDir = process.cwd()) {
  const options = parseMeasureArguments(args);
  const packageJson = await readProjectPackageJson(rootDir);
  const report = await collectSizeReport({
    arch: options.arch,
    commit: await getGitCommit(rootDir),
    packageJson,
    platform: options.platform,
    rootDir,
    toolVersions: await collectToolVersions(rootDir, packageJson),
  });
  const outputPath = path.resolve(
    rootDir,
    options.output ?? path.join('release-artifacts', `size-${options.platform}-${options.arch}.json`),
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export async function runVerifySizeCommand(args, rootDir = process.cwd()) {
  const options = parseVerifyArguments(args);
  const report = await readJsonFile(path.resolve(rootDir, options.report));
  const baseline = await readJsonFile(path.resolve(rootDir, options.baseline));
  const comparison = compareSizeReports(report, baseline);

  return { comparison, report };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'measure') {
    const report = await runMeasureSizeCommand(args);
    console.log(formatSizeReportSummary(report));
  } else if (command === 'verify') {
    const { comparison, report } = await runVerifySizeCommand(args);
    const summary = formatSizeVerificationSummary(report, comparison);
    if (comparison.regressions.length > 0) {
      throw new Error(summary);
    }

    console.log(summary);
  } else {
    throw new Error('Usage: node scripts/build-size-cli.mjs <measure|verify> [options]');
  }
}
