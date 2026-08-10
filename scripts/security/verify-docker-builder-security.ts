import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { DockerBuilderPolicy, HADOLINT_IMAGE, SECURITY_BUILDER_TAG, TRIVY_IMAGE } from './dockerBuilderPolicy';

const workspaceRoot = path.resolve(__dirname, '..', '..');
const builderDirectory = path.join(workspaceRoot, 'build', 'fedora-release');
const dockerfilePath = path.join(builderDirectory, 'Dockerfile');
const evidencePath = path.join(workspaceRoot, 'release-artifacts', 'repository-security-builder-evidence.json');

interface DockerCommandResult {
  readonly exitCode: number;
  readonly output: string;
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function runDocker(arguments_: readonly string[]): Promise<DockerCommandResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', arguments_, {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.resume();
    child.once('error', () => resolve({ exitCode: 1, output: '' }));
    child.once('close', (code) => resolve({ exitCode: code ?? 1, output }));
  });
}

function parseScanReport(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new Error('Docker builder policy violation: scanner report malformed (non-JSON output)');
  }
}

function reportShape(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'non-object root';
  const report = value as Record<string, unknown>;
  const resultShape = Array.isArray(report.Results) ? `array(${report.Results.length})` : typeof report.Results;
  return `schema=${typeof report.SchemaVersion},results=${resultShape}`;
}

async function scannerArguments(cacheDirectory: string): Promise<readonly string[]> {
  const userId = process.getuid?.();
  const groupId = process.getgid?.();
  let dockerSocketGroupId: number;
  try {
    dockerSocketGroupId = (await stat('/var/run/docker.sock')).gid;
  } catch {
    throw new Error('Docker builder policy violation: Docker socket identity unavailable');
  }
  if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(groupId) || !Number.isSafeInteger(dockerSocketGroupId)) {
    throw new Error('Docker builder policy violation: Docker socket identity unavailable');
  }
  return [
    'run',
    '--rm',
    '--user',
    `${userId}:${groupId}`,
    '--group-add',
    String(dockerSocketGroupId),
    '--volume',
    `${cacheDirectory}:/cache`,
    '--volume',
    '/var/run/docker.sock:/var/run/docker.sock',
    TRIVY_IMAGE,
    'image',
    '--quiet',
    '--cache-dir',
    '/cache',
    '--format',
    'json',
    '--scanners',
    'vuln',
    '--pkg-types',
    'os,library',
    '--severity',
    'HIGH,CRITICAL',
    '--ignore-unfixed=false',
    SECURITY_BUILDER_TAG,
  ];
}

async function main(): Promise<void> {
  const policy = new DockerBuilderPolicy();
  policy.verifyDockerfile(await readFile(dockerfilePath, 'utf8'));
  const hadolint = await runDocker([
    'run',
    '--rm',
    '--volume',
    `${dockerfilePath}:/Dockerfile:ro`,
    HADOLINT_IMAGE,
    'hadolint',
    '--failure-threshold',
    'error',
    '/Dockerfile',
  ]);
  if (hadolint.exitCode !== 0)
    throw new Error('Docker builder policy violation: Hadolint evidence unavailable or unsafe');
  const build = await runDocker([
    'build',
    '--file',
    dockerfilePath,
    '--load',
    '--tag',
    SECURITY_BUILDER_TAG,
    builderDirectory,
  ]);
  if (build.exitCode !== 0)
    throw new Error('Docker builder policy violation: builder construction evidence unavailable');

  const cacheDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-trivy-'));
  try {
    const scan = await runDocker(await scannerArguments(cacheDirectory));
    if (scan.exitCode !== 0) throw new Error('Docker builder policy violation: scanner evidence unavailable');
    const databasePath = path.join(cacheDirectory, 'db', 'metadata.json');
    let databaseBytes: Buffer;
    try {
      databaseBytes = await readFile(databasePath);
    } catch {
      throw new Error('Docker builder policy violation: scanner database evidence unavailable or stale');
    }
    let database: unknown;
    try {
      database = JSON.parse(databaseBytes.toString('utf8')) as unknown;
    } catch {
      throw new Error('Docker builder policy violation: scanner database evidence malformed');
    }
    const report = parseScanReport(scan.output);
    try {
      policy.verifyScanEvidence({
        builderImage: SECURITY_BUILDER_TAG,
        database,
        databaseSha256: sha256(databaseBytes),
        now: new Date(),
        report,
        scannerImage: TRIVY_IMAGE,
      });
    } catch (error) {
      if (error instanceof Error && error.message.endsWith('scanner report malformed')) {
        throw new Error(`${error.message} (${reportShape(report)})`);
      }
      throw error;
    }
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(
      evidencePath,
      `${JSON.stringify(
        {
          builderImage: SECURITY_BUILDER_TAG,
          databaseSha256: sha256(databaseBytes),
          scannerImage: TRIVY_IMAGE,
          schemaVersion: 1,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    process.stdout.write('Fedora builder security evidence verified\n');
  } finally {
    await rm(cacheDirectory, { force: true, recursive: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Docker builder security policy failed'}\n`);
  process.exitCode = 1;
});
