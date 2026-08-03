import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';

import { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import type { ManagedArtifactIdentitySnapshot } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import { LinuxProcessGroupOwner } from '@main/localWhisper/supervisor/LinuxProcessGroupOwner';
import { WindowsJobObjectOwner } from '@main/localWhisper/supervisor/WindowsJobObjectOwner';
import type {
  LocalWhisperOwnedWorkerProcess,
  LocalWhisperWorkerLaunchAuthority,
} from '@main/localWhisper/supervisor/WorkerProcessOwnership';
import { toLocalWhisperArtifactId, toLocalWhisperRevisionId, type LocalWhisperRevisionId } from '@shared/localWhisper';

interface FixturePaths {
  readonly authorityWorkerSource: string;
  readonly fsGuard: string;
  readonly identityProbe: string;
  readonly launcher: string;
  readonly workerSource: string;
}

interface PreparedRuntime {
  readonly authority: LocalWhisperWorkerLaunchAuthority;
  readonly directory: string;
  readonly statePath: string;
}

interface ParentDeathState {
  readonly directory: string;
  readonly descendantPid: number;
  readonly workerPid: number;
}

const workspaceRoot = resolve(__dirname, '..', '..');
const outputDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'launcher');
const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const fixturePaths: FixturePaths = {
  authorityWorkerSource: resolve(outputDirectory, 'fixtures', 'local-whisper-authority-worker-fixture'),
  fsGuard: resolve(workspaceRoot, '.cache', 'local-whisper', 'fs-guard', 'fs-guard'),
  launcher: resolve(outputDirectory, `local-whisper-launcher${executableSuffix}`),
  identityProbe: resolve(outputDirectory, 'fixtures', `local-whisper-launcher-identity-fixture${executableSuffix}`),
  workerSource: resolve(outputDirectory, 'fixtures', `local-whisper-launcher-fixture-worker${executableSuffix}`),
};
const fixtureExecutablePaths = [fixturePaths.launcher, fixturePaths.identityProbe, fixturePaths.workerSource] as const;
const linuxModelLaunchFixturePaths = [fixturePaths.fsGuard, fixturePaths.authorityWorkerSource] as const;
const runtimeDirectoryPrefix = 'gpt-voice-local-whisper-launcher-';

function parseParentDeathState(source: string): ParentDeathState {
  const value: unknown = JSON.parse(source);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid launcher parent-death state');
  }
  const state = value as Record<string, unknown>;
  const directory = state.directory;
  const workerPid = state.workerPid;
  const descendantPid = state.descendantPid;
  if (
    Object.keys(state).length !== 3 ||
    typeof directory !== 'string' ||
    resolve(directory) !== directory ||
    dirname(directory) !== resolve(tmpdir()) ||
    !basename(directory).startsWith(runtimeDirectoryPrefix) ||
    !Number.isSafeInteger(workerPid) ||
    (workerPid as number) <= 0 ||
    !Number.isSafeInteger(descendantPid) ||
    (descendantPid as number) <= 0
  ) {
    throw new Error('Invalid launcher parent-death state');
  }
  return { directory, workerPid: workerPid as number, descendantPid: descendantPid as number };
}

function revision(value: string): LocalWhisperRevisionId {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid launcher fixture revision');
  return parsed;
}

function runProbe(arguments_: readonly string[]): string {
  const result = spawnSync(fixturePaths.identityProbe, arguments_, {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) throw new Error('Local Whisper launcher identity fixture failed');
  return result.stdout.trim();
}

function parseIdentity(line: string): ManagedArtifactIdentitySnapshot {
  const [deviceOrVolumeId, fileId, linkCount, mode, parentFileId, sizeBytes, type] = line.split('\t');
  const parsedLinkCount = Number(linkCount);
  const parsedMode = Number(mode);
  const parsedSizeBytes = Number(sizeBytes);
  if (
    !deviceOrVolumeId ||
    !fileId ||
    !parentFileId ||
    !Number.isSafeInteger(parsedLinkCount) ||
    !Number.isSafeInteger(parsedMode) ||
    !Number.isSafeInteger(parsedSizeBytes) ||
    (type !== 'directory' && type !== 'regular')
  ) {
    throw new Error('Invalid launcher fixture identity');
  }
  return {
    deviceOrVolumeId,
    fileId,
    linkCount: parsedLinkCount,
    mode: parsedMode,
    parentFileId,
    sizeBytes: parsedSizeBytes,
    type,
  };
}

function readIdentities(directory: string, worker: string) {
  const lines = runProbe(['--paths', directory, worker]).split(/\r?\n/u);
  if (lines.length !== 2) throw new Error('Invalid launcher fixture identity response');
  return { directory: parseIdentity(lines[0] ?? ''), worker: parseIdentity(lines[1] ?? '') };
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function fileIdentity(path: string): ManagedArtifactIdentitySnapshot {
  const value = statSync(path, { bigint: true });
  const parent = statSync(dirname(path), { bigint: true });
  return {
    deviceOrVolumeId: String(value.dev),
    fileId: String(value.ino),
    linkCount: Number(value.nlink),
    mode: Number(value.mode & 0o777n),
    parentFileId: String(parent.ino),
    sizeBytes: Number(value.size),
    type: value.isDirectory() ? 'directory' : 'regular',
  };
}

function prepareRuntime(ignoreTermination = false): PreparedRuntime {
  const directory = mkdtempSync(resolve(tmpdir(), runtimeDirectoryPrefix));
  chmodSync(directory, 0o700);
  if (ignoreTermination) {
    writeFileSync(resolve(directory, 'launcher-fixture-ignore-term'), 'fixture\n', { mode: 0o600 });
  }
  const worker = resolve(directory, `worker${executableSuffix}`);
  copyFileSync(fixturePaths.workerSource, worker);
  chmodSync(worker, 0o500);
  const identities = readIdentities(directory, worker);
  const artifactId = toLocalWhisperArtifactId('runtime-launcher-fixture');
  if (!artifactId) throw new Error('Invalid launcher fixture artifact ID');
  const lease = new ManagedArtifactLease(
    {
      artifactId,
      artifactKind: 'runtime',
      canonicalName: `runtime-${'a'.repeat(64)}`,
      catalogDigest: 'b'.repeat(64),
      identity: identities.directory,
      purpose: 'load',
    },
    'launcher-fixture-lease',
    () => Promise.resolve(),
  );
  const digest = sha256(worker);
  return {
    directory,
    statePath: resolve(directory, 'launcher-fixture-state'),
    authority: {
      configurationEpoch: 1,
      expectedHandshake: {
        engine: 'whisperCpp',
        runtimeRevision: revision('launcher-fixture-v1'),
        runtimeBuildDigest: digest,
        backend: 'cpu',
        capabilities: ['cpu-fixture'],
      },
      launchMode: 'probe',
      runtimeIdentityKey: 'launcher-fixture-runtime',
      runtimeLease: lease,
      workerExecutablePath: worker,
      workerFileIdentity: identities.worker,
      workerFileSha256: digest,
      workingDirectoryPath: directory,
      revalidate: () => {
        const current = readIdentities(directory, worker);
        assert.deepEqual(current, identities);
        assert.equal(sha256(worker), digest);
        return Promise.resolve();
      },
    },
  };
}

function processOwner(modelGuard = false, launcherExecutablePath = fixturePaths.launcher) {
  const dependencies = {
    environment: process.env,
    getProcessStartIdentity: (pid: number) => Promise.resolve(runProbe(['--process', String(pid)])),
    launcherExecutablePath,
    ...(modelGuard
      ? {
          launcherExecutableSha256: sha256(launcherExecutablePath),
          modelGuardExecutablePath: fixturePaths.fsGuard,
        }
      : {}),
  };
  return process.platform === 'win32'
    ? new WindowsJobObjectOwner(dependencies)
    : new LinuxProcessGroupOwner(dependencies);
}

function framedControl(message: object): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const frame = Buffer.alloc(5 + body.length);
  frame.writeUInt32BE(body.length, 0);
  frame[4] = 1;
  body.copy(frame, 5);
  return frame;
}

function writeStream(stream: Writable, bytes: Uint8Array): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.write(bytes, (error) => {
      if (error) reject(new Error('Local Whisper model launch fixture write failed'));
      else resolve();
    });
  });
}

function bufferedReader(stream: Readable) {
  const iterator = stream[Symbol.asyncIterator]();
  let buffered = Buffer.alloc(0);
  return {
    async exact(size: number): Promise<Buffer> {
      while (buffered.length < size) {
        const next = await iterator.next();
        if (next.done) throw new Error('Local Whisper model launch fixture output ended');
        buffered = Buffer.concat([buffered, Buffer.from(next.value as Uint8Array)]);
      }
      const value = buffered.subarray(0, size);
      buffered = buffered.subarray(size);
      return value;
    },
  };
}

async function readControl(reader: ReturnType<typeof bufferedReader>): Promise<Record<string, unknown>> {
  const header = await reader.exact(5);
  const size = header.readUInt32BE(0);
  if (header[4] !== 1 || size === 0 || size > 1_048_576) {
    throw new Error('Local Whisper model launch fixture frame invalid');
  }
  const parsed: unknown = JSON.parse((await reader.exact(size)).toString('utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Local Whisper model launch fixture control invalid');
  }
  return parsed as Record<string, unknown>;
}

async function verifyModelLaunchChain(): Promise<void> {
  const directory = mkdtempSync(resolve(tmpdir(), 'gpt-voice-local-whisper-model-launch-'));
  chmodSync(directory, 0o700);
  const worker = resolve(directory, 'worker');
  const launcher = resolve(directory, 'launcher');
  const model = resolve(directory, 'model.ggml');
  copyFileSync(fixturePaths.launcher, launcher);
  chmodSync(launcher, 0o500);
  copyFileSync(fixturePaths.authorityWorkerSource, worker);
  chmodSync(worker, 0o500);
  writeFileSync(model, 'model-launch-fixture\n', { mode: 0o400 });
  const identities = readIdentities(directory, worker);
  const runtimeArtifactId = toLocalWhisperArtifactId('runtime-model-launch-fixture');
  const modelArtifactId = toLocalWhisperArtifactId('model-launch-fixture');
  if (!runtimeArtifactId || !modelArtifactId) throw new Error('Invalid model launch fixture artifact ID');
  const runtimeLeaseToken = 'model-launch-runtime-lease';
  const modelLeaseToken = 'model-launch-model-lease';
  const runtimeLease = new ManagedArtifactLease(
    {
      artifactId: runtimeArtifactId,
      artifactKind: 'runtime',
      canonicalName: `runtime-${'c'.repeat(64)}`,
      catalogDigest: 'd'.repeat(64),
      identity: identities.directory,
      purpose: 'load',
    },
    runtimeLeaseToken,
    () => Promise.resolve(),
  );
  const modelLease = new ManagedArtifactLease(
    {
      artifactId: modelArtifactId,
      artifactKind: 'model',
      canonicalName: `model-${'e'.repeat(64)}`,
      catalogDigest: 'f'.repeat(64),
      identity: identities.directory,
      purpose: 'load',
    },
    modelLeaseToken,
    () => Promise.resolve(),
  );
  const workerDigest = sha256(worker);
  const modelDigest = sha256(model);
  const modelIdentity = fileIdentity(model);
  const authority: LocalWhisperWorkerLaunchAuthority = {
    configurationEpoch: 7,
    expectedHandshake: {
      engine: 'whisperCpp',
      runtimeRevision: revision('authority-fixture-v1'),
      runtimeBuildDigest: 'authority-fixture-build',
      backend: 'cpu',
      capabilities: ['authority-fixture'],
    },
    launchMode: 'fullLoad',
    runtimeIdentityKey: 'model-launch-fixture-runtime',
    runtimeLease,
    workerExecutablePath: worker,
    workerFileIdentity: identities.worker,
    workerFileSha256: workerDigest,
    workingDirectoryPath: directory,
    revalidate: () => Promise.resolve(),
    modelGuardAuthority: {
      modelFileIdentity: modelIdentity,
      modelFilePath: model,
      modelFileSha256: modelDigest,
      modelFileSizeBytes: modelIdentity.sizeBytes,
      modelIdentityKey: 'model-launch-fixture-model',
      modelLease,
      modelLeaseTokenDigest: createHash('sha256').update(modelLeaseToken, 'utf8').digest('hex'),
      operationNonce: Uint8Array.from({ length: 16 }, (_value, index) => index + 1),
      revalidate: () => Promise.resolve(),
    },
  };
  let owned: LocalWhisperOwnedWorkerProcess | null = null;
  try {
    owned = await processOwner(true, launcher).launch(authority, 'model_launch_fixture_nonce_1234');
    const reader = bufferedReader(owned.output);
    await writeStream(owned.input, framedControl({ type: 'hello', protocolVersion: 1 }));
    assert.deepEqual(await readControl(reader), {
      type: 'helloAck',
      protocolVersion: 1,
      engine: 'whisperCpp',
      runtimeRevision: 'authority-fixture-v1',
      runtimeBuildDigest: 'authority-fixture-build',
      backend: 'cpu',
      capabilities: ['authority-fixture'],
      maxControlFrameBytes: 1_048_576,
      maxAudioChunkBytes: 1_048_576,
    });
    owned.input.end();
    assert.equal(await owned.waitForExit(5_000), true);
  } finally {
    if (owned && !(await owned.waitForExit(0))) {
      owned.closeOwnershipControl();
      await owned.forceTreeTermination();
      await owned.waitForExit(5_000);
    }
    await Promise.all([runtimeLease.release(), modelLease.release()]);
    rmSync(directory, { force: true, recursive: true });
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readFixturePids(path: string): readonly [number, number] {
  const values = readFileSync(path, 'utf8').trim().split(/\r?\n/u).map(Number);
  if (values.length !== 2 || values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('Invalid launcher process-tree fixture state');
  }
  return [values[0], values[1]];
}

async function terminateUnrelated(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => child.once('exit', () => resolve()));
}

async function verifyControlClosure(): Promise<void> {
  const runtime = prepareRuntime();
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    shell: false,
    stdio: 'ignore',
    windowsHide: true,
  });
  let owned: LocalWhisperOwnedWorkerProcess | null = null;
  try {
    owned = await processOwner().launch(runtime.authority, 'launcher_fixture_nonce_1234');
    assert.equal(await waitUntil(() => existsSync(runtime.statePath), 5_000), true);
    const [workerPid, descendantPid] = readFixturePids(runtime.statePath);
    assert.equal(isAlive(workerPid), true);
    assert.equal(isAlive(descendantPid), true);
    owned.closeOwnershipControl();
    assert.equal(await owned.waitForExit(12_000), true);
    assert.equal(await waitUntil(() => !isAlive(workerPid) && !isAlive(descendantPid), 5_000), true);
    assert.equal(unrelated.pid ? isAlive(unrelated.pid) : false, true);
  } finally {
    if (owned && !(await owned.waitForExit(0))) {
      owned.closeOwnershipControl();
      await owned.forceTreeTermination();
      await owned.waitForExit(5_000);
    }
    await terminateUnrelated(unrelated);
    await runtime.authority.runtimeLease.release();
    rmSync(runtime.directory, { force: true, recursive: true });
  }
}

async function verifyHungTreeHardKill(): Promise<void> {
  const runtime = prepareRuntime(true);
  let owned: LocalWhisperOwnedWorkerProcess | null = null;
  try {
    owned = await processOwner().launch(runtime.authority, 'launcher_hung_tree_1234');
    assert.equal(await waitUntil(() => existsSync(runtime.statePath), 5_000), true);
    const [workerPid, descendantPid] = readFixturePids(runtime.statePath);
    owned.closeOwnershipControl();
    assert.equal(await owned.waitForExit(12_000), true);
    assert.equal(await waitUntil(() => !isAlive(workerPid) && !isAlive(descendantPid), 5_000), true);
  } finally {
    if (owned && !(await owned.waitForExit(0))) {
      owned.closeOwnershipControl();
      await owned.forceTreeTermination();
      await owned.waitForExit(5_000);
    }
    await runtime.authority.runtimeLease.release();
    rmSync(runtime.directory, { force: true, recursive: true });
  }
}

async function runParentDeathChild(): Promise<never> {
  const runtime = prepareRuntime();
  await processOwner().launch(runtime.authority, 'launcher_parent_death_1234');
  assert.equal(await waitUntil(() => existsSync(runtime.statePath), 5_000), true);
  const [workerPid, descendantPid] = readFixturePids(runtime.statePath);
  process.stdout.write(`${JSON.stringify({ directory: runtime.directory, workerPid, descendantPid })}\n`, () =>
    process.exit(0),
  );
  return await new Promise<never>(() => undefined);
}

async function verifyParentDeath(): Promise<void> {
  const child = spawn(process.execPath, ['--import', 'tsx', resolve(__filename), '--parent-death-child'], {
    cwd: workspaceRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const chunks: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  const status = await new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  assert.equal(status, 0);
  const state = parseParentDeathState(Buffer.concat(chunks).toString('utf8'));
  try {
    assert.equal(await waitUntil(() => !isAlive(state.workerPid) && !isAlive(state.descendantPid), 12_000), true);
  } finally {
    rmSync(state.directory, { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  if (process.platform !== 'linux' && process.platform !== 'win32') {
    throw new Error('Local Whisper launcher verification supports Linux and Windows only');
  }
  for (const path of fixtureExecutablePaths) {
    if (!existsSync(path)) throw new Error(`Missing launcher verification fixture: ${basename(path)}`);
  }
  if (process.platform === 'linux') {
    for (const path of linuxModelLaunchFixturePaths) {
      if (!existsSync(path)) throw new Error(`Missing model launch verification fixture: ${basename(path)}`);
    }
  }
  if (process.argv.includes('--parent-death-child')) await runParentDeathChild();
  if (process.argv.includes('--model-launch-only')) {
    if (process.platform !== 'linux') throw new Error('Model launch verification requires Linux');
    await verifyModelLaunchChain();
    process.stdout.write('Local Whisper model launch chain verified on linux\n');
    return;
  }
  if (!process.argv.includes('--fixture')) throw new Error('Launcher verification requires --fixture');
  mkdirSync(dirname(fixturePaths.launcher), { mode: 0o700, recursive: true });
  await verifyControlClosure();
  await verifyHungTreeHardKill();
  await verifyParentDeath();
  if (process.platform === 'linux') await verifyModelLaunchChain();
  process.stdout.write(`Local Whisper launcher fixture verified on ${process.platform}\n`);
}

void main();
