import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, test } from 'node:test';

import {
  ManagedArtifactRemovalClearanceIssuer,
  ManagedArtifactStore,
  ManagedArtifactStoreError,
  getManagedArtifactFileName,
  getManagedArtifactStorageFileName,
  type ManagedArtifactDescriptor,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import { ManagedArtifactLockRepository } from '@main/localWhisper/filesystem/ManagedArtifactLockRepository';
import { ManagedArtifactPathResolver } from '@main/localWhisper/filesystem/ManagedArtifactPathResolver';
import { NativeManagedFilesystemGuardTransport } from '@main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';
import { WindowsManagedFilesystemAdapter } from '@main/localWhisper/filesystem/WindowsManagedFilesystemAdapter';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';

const CONTENT = Buffer.from('windows managed whisper fixture', 'utf8');
const GUARD_PATH = path.resolve('.cache', 'local-whisper', 'fs-guard', 'fs-guard.exe');
const activeStores = new Set<ManagedArtifactStore>();
const temporaryRoots: string[] = [];
const clearanceIssuer = new ManagedArtifactRemovalClearanceIssuer();

interface WindowsHarness {
  readonly descriptor: ManagedArtifactDescriptor;
  readonly managedRoot: string;
  readonly store: ManagedArtifactStore;
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function artifactId(value: string) {
  const result = toLocalWhisperArtifactId(value);
  assert.ok(result);
  return result;
}

function createDescriptor(): ManagedArtifactDescriptor {
  const identityKey = 'windows-native-model-fixture';
  const canonicalName = `model-${sha256(identityKey)}`;
  return Object.freeze({
    artifactId: artifactId(canonicalName),
    canonicalName,
    catalogDigest: sha256('windows-fixture-catalog'),
    expectedFiles: Object.freeze([
      Object.freeze({
        fileId: artifactId('windows-model-data'),
        kind: 'data' as const,
        mode: 0o600,
        sha256: sha256(CONTENT),
        sizeBytes: CONTENT.byteLength,
      }),
    ]),
    identityKey,
    kind: 'model',
    namespace: 'models',
  });
}

async function createHarness(instance: string, sharedRoot?: string): Promise<WindowsHarness> {
  const temporaryRoot = sharedRoot ?? mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-win-'));
  if (!sharedRoot) temporaryRoots.push(temporaryRoot);
  const dataRoot = path.join(temporaryRoot, 'data');
  mkdirSync(dataRoot, { mode: 0o700, recursive: true });
  const resolution = new ManagedArtifactPathResolver({
    environment: { LOCALAPPDATA: dataRoot },
    homeDirectory: () => temporaryRoot,
    platform: 'win32',
  }).resolve();
  assert.equal(resolution.availability, 'available');
  if (resolution.availability !== 'available') throw new Error('Windows resolution unavailable');
  const adapter = new WindowsManagedFilesystemAdapter(
    new NativeManagedFilesystemGuardTransport({
      environment: {},
      executablePath: GUARD_PATH,
      generateProcessInstanceId: () => '11111111-1111-1111-8111-111111111111',
      platform: 'win32',
      spawnProcess: spawn,
    }),
  );
  const processIdentity = await adapter.getProcessStartIdentity(process.pid);
  let nonce = 0;
  const lockRepository = new ManagedArtifactLockRepository({
    adapter,
    appInstanceNonce: `windows-instance-${instance.padEnd(20, 'x')}`,
    osProcessStartIdentity: processIdentity,
    pid: process.pid,
  });
  const store = new ManagedArtifactStore({
    adapter,
    generateOperationNonce: () => `windows-operation-${instance}-${String(++nonce).padStart(18, '0')}`,
    lockRepository,
    rootResolution: resolution,
  });
  activeStores.add(store);
  return { descriptor: createDescriptor(), managedRoot: resolution.managedRoot, store };
}

async function install(harness: WindowsHarness): Promise<void> {
  const staging = await harness.store.createStaging(harness.descriptor);
  const file = await harness.store.createStagedFile(staging, harness.descriptor.expectedFiles[0].fileId);
  await harness.store.appendStagedFile(file, CONTENT);
  await harness.store.sealStagedFile(file);
  await harness.store.promote(harness.descriptor, staging);
}

function installedFilePath(harness: WindowsHarness): string {
  return path.join(
    harness.managedRoot,
    'models',
    harness.descriptor.canonicalName,
    getManagedArtifactFileName(harness.descriptor.expectedFiles[0].fileId),
  );
}

afterEach(async () => {
  for (const store of activeStores) await store.dispose();
  activeStores.clear();
  for (const root of temporaryRoots.splice(0)) {
    assert.ok(path.basename(root).startsWith('gpt-voice-local-whisper-win-'));
    rmSync(root, { force: true, recursive: true });
  }
});

describe('WindowsManagedFilesystemAdapter real handle contract', { skip: process.platform !== 'win32' }, () => {
  test('maps authenticated runtime roles to canonical Windows loader names', () => {
    const roles = [
      ['worker', 'executable', 'worker.exe'],
      ['runtime-microsoft-vc-runtime-14.51.36247.0-msvcp140', 'library', 'msvcp140.dll'],
      ['runtime-microsoft-vc-runtime-14.51.36247.0-vcruntime140', 'library', 'vcruntime140.dll'],
      ['runtime-microsoft-vc-runtime-14.51.36247.0-vcruntime140-1', 'library', 'vcruntime140_1.dll'],
      ['runtime-cuda-runtime-12.8.1', 'library', 'cudart64_12.dll'],
      ['runtime-cublas-12.8.1', 'library', 'cublas64_12.dll'],
      ['runtime-cublas-lt-12.8.1', 'library', 'cublasLt64_12.dll'],
    ] as const;
    const canonicalName = `runtime-${sha256('windows-runtime-loader-fixture')}`;
    const descriptor: ManagedArtifactDescriptor = Object.freeze({
      artifactId: artifactId(canonicalName),
      canonicalName,
      catalogDigest: sha256('windows-runtime-loader-catalog'),
      expectedFiles: Object.freeze(
        roles.map(([fileId, kind]) =>
          Object.freeze({ fileId: artifactId(fileId), kind, mode: 0, sha256: sha256(fileId), sizeBytes: 1 }),
        ),
      ),
      identityKey: 'windows-runtime-loader-fixture',
      kind: 'runtime',
      namespace: 'runtimes',
      runtimePlatform: 'win32',
    });
    assert.deepEqual(
      descriptor.expectedFiles.map((file) => getManagedArtifactStorageFileName(descriptor, file.fileId)),
      roles.map(([, , fileName]) => fileName),
    );
  });

  test('promotes, reopens, and exactly deletes a managed artifact', async () => {
    const harness = await createHarness('install-delete');
    await harness.store.initialize();
    await install(harness);
    const lease = await harness.store.leaseInstalledArtifact(harness.descriptor, 'load');
    await lease.release();
    await harness.store.deleteArtifact(harness.descriptor, clearanceIssuer.issue(harness.descriptor.artifactId));
    await assert.rejects(
      harness.store.leaseInstalledArtifact(harness.descriptor, 'verify'),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_MISSING',
    );
  });

  test('serializes duplicate Windows app instances by full owner identity', async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-win-'));
    temporaryRoots.push(temporaryRoot);
    const first = await createHarness('first', temporaryRoot);
    const second = await createHarness('second', temporaryRoot);
    await first.store.initialize();
    await second.store.initialize();
    const held = await first.store.createStaging(first.descriptor);
    await assert.rejects(
      second.store.createStaging(second.descriptor),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'OPERATION_CONFLICT',
    );
    await held.release();
  });

  test('rejects a junction at the immutable artifact identity', async () => {
    const harness = await createHarness('junction');
    await harness.store.initialize();
    const outside = path.join(path.dirname(harness.managedRoot), 'outside-junction-target');
    mkdirSync(outside, { mode: 0o700 });
    symlinkSync(outside, path.join(harness.managedRoot, 'models', harness.descriptor.canonicalName), 'junction');

    await assert.rejects(
      harness.store.leaseInstalledArtifact(harness.descriptor, 'verify'),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_UNPROVABLE',
    );
    assert.deepEqual(readdirSync(outside), []);
  });

  test('rejects alternate data streams and keeps the base file untouched', async () => {
    const harness = await createHarness('alternate-stream');
    await harness.store.initialize();
    await install(harness);
    const filePath = installedFilePath(harness);
    writeFileSync(`${filePath}:unexpected`, 'hidden stream');

    await assert.rejects(
      harness.store.leaseInstalledArtifact(harness.descriptor, 'verify'),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_UNPROVABLE',
    );
    assert.equal(readFileSync(filePath, 'utf8'), CONTENT.toString('utf8'));
  });
});
