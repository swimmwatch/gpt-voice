import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  APPLICATION_SECURITY_SCANNER,
  ApplicationSbomGenerator,
  applicationSecurityFormats,
  ArtifactVulnerabilityPolicy,
  canonicalArtifactSecurityJson,
  type ApplicationPackageFormat,
  type ApplicationSecurityPlatform,
} from './applicationArtifactSecurity';
import { withVerifiedRegularFile } from './verifiedRegularFile';
import { MAXIMUM_TRIVY_DATABASE_PAYLOAD_BYTES, trivyDatabaseIdentity } from './trivyDatabaseIdentity';

const workspaceRoot = path.resolve(
  process.env.APPLICATION_ARTIFACT_SECURITY_WORKSPACE ?? path.resolve(__dirname, '..', '..'),
);
const MAXIMUM_SCANNER_OUTPUT_BYTES = 512 * 1024;
const MAXIMUM_VERSION_OUTPUT_BYTES = 4096;
const MAXIMUM_PACKAGE_BYTES = 4 * 1024 * 1024 * 1024;
const MAXIMUM_PACKAGE_METADATA_BYTES = 64 * 1024;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;
const SAFE_OUTPUT_DIRECTORY = /^[\w./-]+$/u;
const SAFE_PACKAGE_NAME = /^[a-z\d][a-z\d._-]{0,127}$/u;
const SAFE_PRODUCT_NAME = /^\w[\w .-]{0,127}$/u;
const SAFE_VERSION = /^[\w.+-]{1,128}$/u;

interface PackageMetadata {
  readonly name: string;
  readonly productName: string;
  readonly version: string;
}

function fail(code: string): never {
  throw new Error(`APPLICATION_ARTIFACT_SECURITY_${code}`);
}

function option(name: string): string | null {
  const prefix = `--${name}=`;
  const values = process.argv.filter((argument_) => argument_.startsWith(prefix));
  if (values.length > 1) fail('ARGUMENT_INVALID');
  return values.length === 1 ? (values[0]?.slice(prefix.length) ?? null) : null;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) fail('ARGUMENT_INVALID');
  return value;
}

function platform(value: string): ApplicationSecurityPlatform {
  if (value !== 'linux' && value !== 'win32') fail('ARGUMENT_INVALID');
  return value;
}

function safeWorkspacePath(value: string): string {
  if (!SAFE_OUTPUT_DIRECTORY.test(value)) fail('ARGUMENT_INVALID');
  const resolved = path.resolve(workspaceRoot, value);
  const relative = path.relative(workspaceRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail('ARGUMENT_INVALID');
  }
  return resolved;
}

function scannerTarget(value: string): string {
  const relative = path.relative(workspaceRoot, value);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('SCAN_TARGET_INVALID');
  const normalized = relative.split(path.sep).join('/');
  if (!SAFE_OUTPUT_DIRECTORY.test(normalized) || normalized.includes('..')) fail('SCAN_TARGET_INVALID');
  return normalized;
}

async function createEmptyOutputDirectory(outputDirectory: string): Promise<void> {
  const relative = path.relative(workspaceRoot, outputDirectory);
  const segments = relative.split(path.sep);
  let current = workspaceRoot;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const metadata = await lstat(current).catch(async (error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        await mkdir(current);
        return lstat(current);
      }
      fail('OUTPUT_DIRECTORY_INVALID');
    });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail('OUTPUT_DIRECTORY_INVALID');
  }
  const existing = await lstat(outputDirectory).then(
    () => true,
    (error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false;
      fail('OUTPUT_DIRECTORY_INVALID');
    },
  );
  if (existing) fail('OUTPUT_DIRECTORY_EXISTS');
  await mkdir(outputDirectory).catch(() => fail('OUTPUT_DIRECTORY_INVALID'));
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function sha256File(filePath: string): Promise<string> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail('PACKAGE_INVALID'),
      maximumBytes: MAXIMUM_PACKAGE_BYTES,
      minimumBytes: 1,
      unavailable: () => fail('PACKAGE_UNAVAILABLE'),
    },
    async (file, expectedSize) => {
      const digest = createHash('sha256');
      let byteLength = 0;
      try {
        for await (const chunk of file.createReadStream({ autoClose: false })) {
          const bytes = Buffer.from(chunk);
          byteLength += bytes.byteLength;
          if (byteLength > expectedSize) fail('PACKAGE_INVALID');
          digest.update(bytes);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'APPLICATION_ARTIFACT_SECURITY_PACKAGE_INVALID') throw error;
        fail('PACKAGE_UNAVAILABLE');
      }
      if (byteLength !== expectedSize) fail('PACKAGE_INVALID');
      return digest.digest('hex');
    },
  );
}

async function readBoundedJsonFile(
  filePath: string,
  input: { readonly invalid: string; readonly maximumBytes: number; readonly unavailable: string },
): Promise<unknown> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail(input.invalid),
      maximumBytes: input.maximumBytes,
      minimumBytes: 1,
      unavailable: () => fail(input.unavailable),
    },
    async (file, expectedSize) => {
      const bytes = await file.readFile().catch(() => fail(input.unavailable));
      if (bytes.byteLength !== expectedSize) fail(input.invalid);
      return parseJson(bytes, input.invalid);
    },
  );
}

function parseJson(bytes: Buffer, code: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    fail(code);
  }
}

async function metadata(): Promise<PackageMetadata> {
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  const value = await readBoundedJsonFile(packageJsonPath, {
    invalid: 'PACKAGE_METADATA_INVALID',
    maximumBytes: MAXIMUM_PACKAGE_METADATA_BYTES,
    unavailable: 'PACKAGE_METADATA_INVALID',
  });
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('PACKAGE_METADATA_INVALID');
  }
  const packageJson = value as Record<string, unknown>;
  if (
    typeof packageJson.name !== 'string' ||
    !SAFE_PACKAGE_NAME.test(packageJson.name) ||
    typeof packageJson.version !== 'string' ||
    !SAFE_VERSION.test(packageJson.version) ||
    typeof packageJson.build !== 'object' ||
    packageJson.build === null ||
    Array.isArray(packageJson.build) ||
    typeof (packageJson.build as Record<string, unknown>).productName !== 'string' ||
    !SAFE_PRODUCT_NAME.test((packageJson.build as Record<string, unknown>).productName as string)
  ) {
    fail('PACKAGE_METADATA_INVALID');
  }
  return Object.freeze({
    name: packageJson.name,
    productName: (packageJson.build as Record<string, unknown>).productName as string,
    version: packageJson.version,
  });
}

async function packageFiles(
  platform_: ApplicationSecurityPlatform,
  packageMetadata: PackageMetadata,
): Promise<ReadonlyMap<Exclude<ApplicationPackageFormat, 'unpacked'>, string>> {
  const releaseRoot = path.join(workspaceRoot, 'release');
  if (platform_ === 'linux') {
    return new Map([
      ['appimage', path.join(releaseRoot, `${packageMetadata.productName}-${packageMetadata.version}.AppImage`)],
      ['deb', path.join(releaseRoot, `${packageMetadata.name}_${packageMetadata.version}_amd64.deb`)],
      ['rpm', path.join(releaseRoot, `${packageMetadata.name}-${packageMetadata.version}.x86_64.rpm`)],
    ]);
  }
  const installers = (await readdir(releaseRoot, { withFileTypes: true }).catch(() => fail('PACKAGE_UNAVAILABLE')))
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.exe'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (installers.length !== 1) fail('PACKAGE_AMBIGUOUS');
  return new Map([['nsis', path.join(releaseRoot, installers[0] ?? '')]]);
}

function unpackedRoot(platform_: ApplicationSecurityPlatform): string {
  return path.join(workspaceRoot, 'release', platform_ === 'linux' ? 'linux-unpacked' : 'win-unpacked');
}

async function scannerVersion(scanner: string): Promise<void> {
  const output = await runProcess(scanner, ['version'], MAXIMUM_VERSION_OUTPUT_BYTES);
  if (!output.includes(`Version: ${APPLICATION_SECURITY_SCANNER.version}`)) fail('SCANNER_IDENTITY_INVALID');
}

function runProcess(command: string, arguments_: readonly string[], maximumBytes: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let byteLength = 0;
    let settled = false;
    const rejectOnce = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const resolveOnce = (output: string): void => {
      if (settled) return;
      settled = true;
      resolve(output);
    };
    child.stdout.on('data', (chunk: Buffer | string) => {
      const bytes = Buffer.from(chunk);
      byteLength += bytes.byteLength;
      if (byteLength > maximumBytes) {
        child.kill();
        rejectOnce(new Error('output-limit'));
        return;
      }
      chunks.push(bytes);
    });
    child.once('error', () => rejectOnce(new Error('process-error')));
    child.once('close', (code) =>
      code === 0 ? resolveOnce(Buffer.concat(chunks).toString('utf8')) : rejectOnce(new Error('process-failed')),
    );
  }).catch(() => fail('SCANNER_UNAVAILABLE'));
}

async function prepareDatabase(scanner: string): Promise<void> {
  await runProcess(scanner, ['image', '--download-db-only', '--quiet'], MAXIMUM_VERSION_OUTPUT_BYTES);
}

async function runTrivyScan(input: {
  readonly outputPath: string;
  readonly scanner: string;
  readonly target: string;
  readonly type: 'filesystem' | 'sbom';
}): Promise<unknown> {
  const subcommand = input.type === 'filesystem' ? 'fs' : 'sbom';
  const arguments_ = [
    subcommand,
    '--quiet',
    '--format',
    'json',
    '--scanners',
    'vuln',
    '--severity',
    'HIGH,CRITICAL',
    '--ignore-unfixed=false',
    '--skip-db-update',
    '--skip-java-db-update',
    '--output',
    input.outputPath,
    input.target,
  ];
  await runProcess(input.scanner, arguments_, MAXIMUM_VERSION_OUTPUT_BYTES);
  return await readBoundedJsonFile(input.outputPath, {
    invalid: 'SCAN_MALFORMED',
    maximumBytes: MAXIMUM_SCANNER_OUTPUT_BYTES,
    unavailable: 'SCANNER_UNAVAILABLE',
  });
}

async function regularFileDigest(
  filePath: string,
  maximumBytes: number,
): Promise<{ readonly sha256: string; readonly size: number }> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail('DATABASE_INVALID'),
      maximumBytes,
      minimumBytes: 1,
      unavailable: () => fail('DATABASE_UNAVAILABLE'),
    },
    async (file, expectedSize) => {
      const digest = createHash('sha256');
      const chunk = Buffer.allocUnsafe(64 * 1024);
      let offset = 0;
      while (offset < expectedSize) {
        const length = Math.min(chunk.byteLength, expectedSize - offset);
        const result = await file.read(chunk, 0, length, offset).catch(() => fail('DATABASE_UNAVAILABLE'));
        if (result.bytesRead !== length) fail('DATABASE_INVALID');
        digest.update(chunk.subarray(0, length));
        offset += length;
      }
      return Object.freeze({ sha256: digest.digest('hex'), size: expectedSize });
    },
  );
}

async function databaseEvidence(cacheDirectory: string): Promise<{ readonly sha256: string; readonly value: unknown }> {
  const metadataPath = path.join(cacheDirectory, 'db', 'metadata.json');
  const metadata = await withVerifiedRegularFile(
    {
      filePath: metadataPath,
      invalid: () => fail('DATABASE_INVALID'),
      maximumBytes: MAXIMUM_SCANNER_OUTPUT_BYTES,
      minimumBytes: 1,
      unavailable: () => fail('DATABASE_UNAVAILABLE'),
    },
    async (file, expectedSize) => {
      const bytes = await file.readFile().catch(() => fail('DATABASE_UNAVAILABLE'));
      if (bytes.byteLength !== expectedSize) fail('DATABASE_INVALID');
      return Object.freeze({
        sha256: sha256(bytes),
        size: expectedSize,
        value: parseJson(bytes, 'DATABASE_INVALID'),
      });
    },
  );
  const payload = await regularFileDigest(
    path.join(cacheDirectory, 'db', 'trivy.db'),
    MAXIMUM_TRIVY_DATABASE_PAYLOAD_BYTES,
  );
  return Object.freeze({ sha256: trivyDatabaseIdentity(metadata, payload), value: metadata.value });
}

function sourceCommit(value: string): string {
  if (!SOURCE_COMMIT.test(value)) fail('ARGUMENT_INVALID');
  return value;
}

async function main(): Promise<void> {
  const platform_ = platform(requiredOption('platform'));
  const outputDirectory = safeWorkspacePath(requiredOption('output-directory'));
  let outputCreated = false;
  try {
    await createEmptyOutputDirectory(outputDirectory);
    outputCreated = true;
    const source = sourceCommit(requiredOption('source-commit'));
    const scanner = option('scanner') ?? 'trivy';
    if (scanner !== 'trivy') fail('ARGUMENT_INVALID');
    const cacheDirectory = option('database-directory') ?? process.env.TRIVY_CACHE_DIR;
    if (!cacheDirectory) fail('DATABASE_UNAVAILABLE');
    const resolvedCacheDirectory = path.resolve(cacheDirectory);
    const packageMetadata = await metadata();
    const root = unpackedRoot(platform_);
    const filesystemTarget = scannerTarget(root);
    const generator = new ApplicationSbomGenerator();
    const formats = applicationSecurityFormats(platform_);
    const first = await generator.generate({
      packageFormat: formats[0] ?? fail('FORMAT_INVALID'),
      packageSha256: '0'.repeat(64),
      platform: platform_,
      sourceCommit: source,
      unpackedRoot: root,
      workspaceRoot,
    });
    const packages = await packageFiles(platform_, packageMetadata);
    const packageDigests = new Map<ApplicationPackageFormat, string>();
    for (const format of formats) {
      if (format === 'unpacked') {
        packageDigests.set(format, first.unpackedRootSha256);
        continue;
      }
      const packagePath = packages.get(format);
      if (!packagePath) fail('PACKAGE_UNAVAILABLE');
      packageDigests.set(format, await sha256File(packagePath));
    }
    const checksums = formats
      .map((format) => `${packageDigests.get(format) ?? fail('PACKAGE_UNAVAILABLE')}  ${format}`)
      .join('\n');
    const checksumBytes = Buffer.from(`${checksums}\n`, 'utf8');
    const checksumSha256 = sha256(checksumBytes);
    await scannerVersion(scanner);
    await prepareDatabase(scanner);
    const database = await databaseEvidence(resolvedCacheDirectory);
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-artifact-security-'));
    try {
      const filesystemReport = await runTrivyScan({
        outputPath: path.join(temporaryRoot, 'filesystem.json'),
        scanner,
        target: filesystemTarget,
        type: 'filesystem',
      });
      const policy = new ArtifactVulnerabilityPolicy();
      for (const format of formats) {
        const packageSha256 = packageDigests.get(format);
        if (!packageSha256) fail('PACKAGE_UNAVAILABLE');
        const sbom = await generator.generate({
          packageFormat: format,
          packageSha256,
          platform: platform_,
          sourceCommit: source,
          unpackedRoot: root,
          workspaceRoot,
        });
        const sbomPath = path.join(outputDirectory, `application-sbom-${platform_}-${format}.cdx.json`);
        const sbomTarget = scannerTarget(sbomPath);
        await writeFile(sbomPath, `${canonicalArtifactSecurityJson(sbom.document)}\n`, 'utf8');
        const sbomReport = await runTrivyScan({
          outputPath: path.join(temporaryRoot, `sbom-${format}.json`),
          scanner,
          target: sbomTarget,
          type: 'sbom',
        });
        const record = policy.createRecord({
          checksumSha256,
          database: database.value,
          databaseSha256: database.sha256,
          filesystemReport,
          filesystemTarget,
          now: new Date(),
          packageFormat: format,
          packageSha256,
          platform: platform_,
          sbomReport,
          sbomSha256: sbom.sha256,
          sbomTarget,
          sourceCommit: source,
          unpackedRootSha256: sbom.unpackedRootSha256,
        });
        policy.verifyBinding({
          checksumSha256,
          packageFormat: format,
          packageSha256,
          platform: platform_,
          record,
          sbom: sbom.document,
          sourceCommit: source,
          unpackedRootSha256: sbom.unpackedRootSha256,
        });
        await writeFile(
          path.join(outputDirectory, `application-artifact-security-${platform_}-${format}.json`),
          `${canonicalArtifactSecurityJson(record)}\n`,
          'utf8',
        );
      }
      await writeFile(
        path.join(outputDirectory, `SHA256SUMS-application-security-${platform_}.txt`),
        checksumBytes,
        'utf8',
      );
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  } catch (error) {
    if (outputCreated) await rm(outputDirectory, { force: true, recursive: true });
    throw error;
  }
  process.stdout.write(`Application artifact security evidence verified for ${platform_}\n`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error && /^APPLICATION_ARTIFACT_SECURITY_[A-Z_]+$/u.test(error.message)
      ? error.message
      : 'APPLICATION_ARTIFACT_SECURITY_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
