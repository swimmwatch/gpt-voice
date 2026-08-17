import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, open, readdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import {
  PackageAttestationInputPolicy,
  PACKAGE_ATTESTATION_SUBJECT_NAMES,
  type PackageAttestationPlatform,
  type PackageAttestationSubjectName,
} from './packageAttestationPolicy';
import { canonicalArtifactSecurityJson } from './applicationArtifactSecurity';
import { withVerifiedRegularFile } from './verifiedRegularFile';

const workspaceRoot = path.resolve(__dirname, '..', '..');
const MAXIMUM_EVIDENCE_BYTES = 256 * 1024;
const MAXIMUM_PACKAGE_BYTES = 4 * 1024 * 1024 * 1024;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;
const REPOSITORY = /^\w[\w.-]{0,99}\/\w[\w.-]{0,99}$/u;
const SAFE_RELATIVE_PATH = /^[a-z\d][a-z\d._/-]{0,255}$/u;

function fail(code: string): never {
  throw new Error(`PACKAGE_ATTESTATION_${code}`);
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

function platform(value: string): PackageAttestationPlatform {
  if (value !== 'linux' && value !== 'win32') fail('ARGUMENT_INVALID');
  return value;
}

function packageFormat(value: PackageAttestationPlatform): 'appimage' | 'nsis' {
  return value === 'linux' ? 'appimage' : 'nsis';
}

function safeOutputDirectory(value: string): string {
  if (!SAFE_RELATIVE_PATH.test(value)) fail('ARGUMENT_INVALID');
  const resolved = path.resolve(workspaceRoot, value);
  const relative = path.relative(workspaceRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('ARGUMENT_INVALID');
  return resolved;
}

async function readBounded(filePath: string, maximumBytes: number, code: string): Promise<Buffer> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail(code),
      maximumBytes,
      minimumBytes: 1,
      unavailable: () => fail(code),
    },
    async (file, expectedSize) => {
      const bytes = await file.readFile().catch(() => fail(code));
      if (bytes.byteLength !== expectedSize) fail(code);
      return bytes;
    },
  );
}

async function hashFile(filePath: string): Promise<string> {
  return await withVerifiedRegularFile(
    {
      filePath,
      invalid: () => fail('SUBJECT_INVALID'),
      maximumBytes: MAXIMUM_PACKAGE_BYTES,
      minimumBytes: 1,
      unavailable: () => fail('SUBJECT_UNAVAILABLE'),
    },
    async (file, expectedSize) => {
      const hash = createHash('sha256');
      let byteLength = 0;
      for await (const chunk of file.createReadStream({ autoClose: false })) {
        const bytes = Buffer.from(chunk);
        byteLength += bytes.byteLength;
        if (byteLength > expectedSize) fail('SUBJECT_INVALID');
        hash.update(bytes);
      }
      if (byteLength !== expectedSize) fail('SUBJECT_INVALID');
      return hash.digest('hex');
    },
  );
}

function parseCanonicalJson(bytes: Buffer, code: string): unknown {
  let text: string;
  let value: unknown;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    value = JSON.parse(text) as unknown;
  } catch {
    fail(code);
  }
  if (`${canonicalArtifactSecurityJson(value)}\n` !== text) fail(code);
  return value;
}

async function onePackagePath(platform_: PackageAttestationPlatform): Promise<string> {
  const releaseDirectory = path.join(workspaceRoot, 'release');
  const extension = platform_ === 'linux' ? '.AppImage' : '.exe';
  const packages = (await readdir(releaseDirectory, { withFileTypes: true }).catch(() => fail('SUBJECT_UNAVAILABLE')))
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(extension))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (packages.length !== 1) fail('SUBJECT_AMBIGUOUS');
  return path.join(releaseDirectory, packages[0] ?? '');
}

async function createEmptyDirectory(directory: string): Promise<void> {
  const relative = path.relative(workspaceRoot, directory);
  const parent = path.dirname(directory);
  if (relative.startsWith('..') || path.isAbsolute(relative) || parent === workspaceRoot) fail('ARGUMENT_INVALID');
  const parentMetadata = await lstat(parent).catch(() => fail('OUTPUT_INVALID'));
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) fail('OUTPUT_INVALID');
  await mkdir(directory).catch(() => fail('OUTPUT_INVALID'));
}

async function copySubject(source: string, target: string): Promise<void> {
  const sourceHandle = await open(source, 'r').catch(() => fail('SUBJECT_UNAVAILABLE'));
  try {
    const metadata = await sourceHandle.stat().catch(() => fail('SUBJECT_UNAVAILABLE'));
    if (!metadata.isFile() || metadata.size < 1 || metadata.size > MAXIMUM_PACKAGE_BYTES) fail('SUBJECT_INVALID');
  } finally {
    await sourceHandle.close().catch(() => undefined);
  }
  await copyFile(source, target).catch(() => fail('OUTPUT_INVALID'));
}

async function main(): Promise<void> {
  const platform_ = platform(requiredOption('platform'));
  const sourceCommit = requiredOption('source-commit');
  const repository = requiredOption('repository');
  const invocation = requiredOption('invocation');
  const workflowPath = option('workflow-path') ?? '.github/workflows/pr-checks.yml';
  if (!SOURCE_COMMIT.test(sourceCommit) || !REPOSITORY.test(repository)) fail('ARGUMENT_INVALID');
  const outputDirectory = safeOutputDirectory(requiredOption('output-directory'));
  await createEmptyDirectory(outputDirectory);
  const subjectDirectory = path.join(outputDirectory, 'subject');
  await mkdir(subjectDirectory).catch(() => fail('OUTPUT_INVALID'));

  const format = packageFormat(platform_);
  const securityDirectory = path.join(workspaceRoot, 'release-artifacts', `application-security-${platform_}`);
  const packagePath = await onePackagePath(platform_);
  const checksumPath = path.join(securityDirectory, `SHA256SUMS-application-security-${platform_}.txt`);
  const sbomPath = path.join(securityDirectory, `application-sbom-${platform_}-${format}.cdx.json`);
  const scannerPath = path.join(securityDirectory, `application-artifact-security-${platform_}-${format}.json`);
  const checksumBytes = await readBounded(checksumPath, MAXIMUM_EVIDENCE_BYTES, 'SUBJECT_UNAVAILABLE');
  const sbomBytes = await readBounded(sbomPath, MAXIMUM_EVIDENCE_BYTES, 'SUBJECT_UNAVAILABLE');
  const scannerBytes = await readBounded(scannerPath, MAXIMUM_EVIDENCE_BYTES, 'SUBJECT_UNAVAILABLE');
  const sbom = parseCanonicalJson(sbomBytes, 'SUBJECT_INVALID');
  const scannerRecord = parseCanonicalJson(scannerBytes, 'SUBJECT_INVALID');
  const packageSha256 = await hashFile(packagePath);
  const checksumSha256 = createHash('sha256').update(checksumBytes).digest('hex');
  const expectedSubjectDigests: Readonly<Record<Exclude<PackageAttestationSubjectName, 'smoke'>, string>> = {
    checksum: checksumSha256,
    package: packageSha256,
    sbom: createHash('sha256').update(sbomBytes).digest('hex'),
    scanner: createHash('sha256').update(scannerBytes).digest('hex'),
  };
  new PackageAttestationInputPolicy().verifyArtifactSecurityDigestBinding({
    checksumSha256,
    packageFormat: format,
    packageSha256,
    platform: platform_,
    record: scannerRecord,
    sbom,
    sourceCommit,
  });
  const smokeBytes = Buffer.from(
    `${canonicalArtifactSecurityJson({ invocation, platform: platform_, sourceCommit, status: 'success' })}\n`,
    'utf8',
  );
  const sourceFiles: Readonly<Record<Exclude<PackageAttestationSubjectName, 'smoke'>, string>> = {
    checksum: checksumPath,
    package: packagePath,
    sbom: sbomPath,
    scanner: scannerPath,
  };
  for (const name of PACKAGE_ATTESTATION_SUBJECT_NAMES) {
    const target = path.join(subjectDirectory, name);
    if (name === 'smoke') {
      await writeFile(target, smokeBytes, { flag: 'wx' }).catch(() => fail('OUTPUT_INVALID'));
    } else {
      await copySubject(sourceFiles[name], target);
    }
  }
  const subjectDigests = Object.fromEntries(
    await Promise.all(
      PACKAGE_ATTESTATION_SUBJECT_NAMES.map(
        async (name) => [name, { sha256: await hashFile(path.join(subjectDirectory, name)) }] as const,
      ),
    ),
  ) as Record<PackageAttestationSubjectName, { readonly sha256: string }>;
  for (const name of Object.keys(expectedSubjectDigests) as Array<Exclude<PackageAttestationSubjectName, 'smoke'>>) {
    if (subjectDigests[name].sha256 !== expectedSubjectDigests[name]) fail('BINDING_INVALID');
  }
  const input = new PackageAttestationInputPolicy().createFromDigests({
    invocation,
    platform: platform_,
    repository,
    sourceCommit,
    subjects: subjectDigests,
    workflowPath: workflowPath as '.github/workflows/pr-checks.yml' | '.github/workflows/release-builds.yml',
  });
  await writeFile(
    path.join(outputDirectory, 'attestation-input.json'),
    new PackageAttestationInputPolicy().serialize(input),
    {
      encoding: 'utf8',
      flag: 'wx',
    },
  ).catch(() => fail('OUTPUT_INVALID'));
  process.stdout.write(`Package attestation input prepared for ${platform_}\n`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error && /^PACKAGE_ATTESTATION_[A-Z_]+$/u.test(error.message)
      ? error.message
      : 'PACKAGE_ATTESTATION_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
