import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createPackage } from '@electron/asar';

interface SizeMetric {
  bytes: number | null;
  id: string;
}

interface SizeReport {
  metadata: {
    appVersion: string;
    arch: string;
    commit: string | null;
    platform: string;
    toolVersions: Record<string, string | null>;
  };
  metrics: SizeMetric[];
  schemaVersion: number;
}

interface BuildSizeCliModule {
  collectSizeReport: (input: {
    arch: string;
    commit: string | null;
    packageJson: Record<string, unknown>;
    platform: string;
    rootDir: string;
    toolVersions: Record<string, string | null>;
  }) => Promise<SizeReport>;
  formatSizeReportSummary: (report: SizeReport) => string;
}

const execFile = promisify(execFileCallback);
const projectRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.join(projectRoot, 'scripts', 'build-size-cli.mjs');
let buildSizeCli: BuildSizeCliModule;

function getMetric(report: SizeReport, id: string): number | null {
  const metric = report.metrics.find((candidate) => candidate.id === id);
  assert.ok(metric, `Expected report metric ${id}`);
  return metric.bytes;
}

function isBuildSizeCliModule(value: unknown): value is BuildSizeCliModule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const module = value as Record<string, unknown>;
  return typeof module.collectSizeReport === 'function' && typeof module.formatSizeReportSummary === 'function';
}

async function writeFixturePackage(rootDir: string): Promise<void> {
  const asarSource = path.join(rootDir, 'asar-source');
  const asarPath = path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'app.asar');

  await mkdir(path.join(asarSource, 'node_modules', 'react'), { recursive: true });
  await writeFile(path.join(asarSource, 'node_modules', 'react', 'index.js'), 'react');
  await writeFile(path.join(asarSource, 'main.js'), 'main');
  await mkdir(path.dirname(asarPath), { recursive: true });
  await createPackage(asarSource, asarPath);

  await mkdir(path.join(rootDir, 'dist'), { recursive: true });
  await writeFile(path.join(rootDir, 'dist', 'renderer.js'), 'console.log("renderer");');
  await writeFile(path.join(rootDir, 'dist', 'window.css'), 'body { color: white; }');
  await writeFile(path.join(rootDir, 'dist', 'index.html'), '<!doctype html>');

  await mkdir(path.join(rootDir, 'release', 'linux-unpacked', 'locales'), { recursive: true });
  await writeFile(path.join(rootDir, 'release', 'linux-unpacked', 'locales', 'en-US.pak'), 'locale');
  await mkdir(path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'cloakbrowser', 'locales'), {
    recursive: true,
  });
  await writeFile(path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'cloakbrowser', 'chrome'), 'browser');
  await writeFile(
    path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'cloakbrowser', 'locales', 'en-US.pak'),
    'browser-locale',
  );
  await writeFile(path.join(rootDir, 'release', 'GPT-Voice-1.4.0.AppImage'), 'appimage');
  await writeFile(path.join(rootDir, 'release', 'gpt-voice_1.4.0_amd64.deb'), 'deb');
  await writeFile(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      dependencies: { cloakbrowser: '0.4.10' },
      devDependencies: { electron: '43.0.0', 'electron-builder': '26.15.3', webpack: '5.108.3' },
      name: 'gpt-voice',
      version: '1.4.0',
    }),
  );
}

describe('build size CLI', () => {
  it('collects a stable, relative-path-only report with explicit missing metrics', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gpt-voice-size-cli-'));

    try {
      await writeFixturePackage(temporaryDirectory);
      const packageJson = JSON.parse(await readFile(path.join(temporaryDirectory, 'package.json'), 'utf8')) as Record<
        string,
        unknown
      >;
      const importedModule: unknown = await import(pathToFileURL(scriptPath).href);
      assert.ok(isBuildSizeCliModule(importedModule));
      buildSizeCli = importedModule;

      const report = await buildSizeCli.collectSizeReport({
        arch: 'x64',
        commit: 'abc123',
        packageJson,
        platform: 'linux',
        rootDir: temporaryDirectory,
        toolVersions: {
          cloakbrowser: '0.4.10',
          electron: '43.0.0',
          electronBuilder: '26.15.3',
          node: 'v24.14.0',
          webpack: '5.108.3',
        },
      });

      assert.deepEqual(report.metadata, {
        appVersion: '1.4.0',
        arch: 'x64',
        commit: 'abc123',
        platform: 'linux',
        toolVersions: {
          cloakbrowser: '0.4.10',
          electron: '43.0.0',
          electronBuilder: '26.15.3',
          node: 'v24.14.0',
          webpack: '5.108.3',
        },
      });
      assert.equal(report.schemaVersion, 1);
      assert.equal(getMetric(report, 'app.asar.group.react'), 5);
      assert.equal(getMetric(report, 'app.asar.group.main.js'), 4);
      assert.equal(getMetric(report, 'electron.locales'), 6);
      assert.equal(getMetric(report, 'installer.appimage'), 8);
      assert.equal(getMetric(report, 'installer.deb'), 3);
      assert.equal(getMetric(report, 'installer.rpm'), null);
      assert.ok(getMetric(report, 'dist.renderer.js.gzip'));
      assert.ok(getMetric(report, 'dist.renderer.js.brotli'));
      assert.deepEqual(
        report.metrics.map((metric) => metric.id),
        Array.from(report.metrics, (metric) => metric.id).sort(),
      );
      assert.equal(JSON.stringify(report).includes(temporaryDirectory), false);
      assert.match(buildSizeCli.formatSizeReportSummary(report), /Size report: linux\/x64/);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('writes stable JSON and a concise summary through the measure command', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gpt-voice-size-cli-'));

    try {
      await writeFixturePackage(temporaryDirectory);
      const outputPath = path.join(temporaryDirectory, 'reports', 'size.json');
      const { stdout } = await execFile(
        process.execPath,
        [scriptPath, 'measure', '--platform=linux', '--arch=x64', `--output=${outputPath}`],
        { cwd: temporaryDirectory },
      );
      const report = JSON.parse(await readFile(outputPath, 'utf8')) as SizeReport;

      assert.equal(report.metadata.platform, 'linux');
      assert.equal(report.metadata.arch, 'x64');
      assert.equal(getMetric(report, 'installer.rpm'), null);
      assert.match(stdout, /Size report: linux\/x64/);
      assert.equal(stdout.includes(temporaryDirectory), false);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
