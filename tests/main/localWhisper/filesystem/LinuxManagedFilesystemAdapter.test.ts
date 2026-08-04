import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, test } from 'node:test';

import { LinuxManagedFilesystemAdapter } from '@main/localWhisper/filesystem/LinuxManagedFilesystemAdapter';
import { ManagedArtifactLockRepository } from '@main/localWhisper/filesystem/ManagedArtifactLockRepository';
import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { getLocalWhisperModelIdentityKey } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  ManagedArtifactRemovalClearance,
  ManagedArtifactRemovalClearanceIssuer,
  ManagedArtifactStore,
  ManagedArtifactStoreError,
  createManagedModelDescriptor,
  getManagedArtifactFileName,
  getManagedArtifactStorageFileName,
  type ManagedArtifactDescriptor,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import { ManagedArtifactPathResolver } from '@main/localWhisper/filesystem/ManagedArtifactPathResolver';
import { NativeManagedFilesystemGuardTransport } from '@main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';
import { ManagedFilesystemAdapterError } from '@main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import {
  createFixtureCatalogPayload,
  createFixtureCatalogTrustPolicy,
  signFixtureCatalog,
} from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

const GUARD_PATH = path.resolve('.cache', 'local-whisper', 'fs-guard', 'fs-guard');
const CONTENT = Buffer.from('managed whisper model fixture', 'utf8');
const RUNTIME_WORKER_CONTENT = Buffer.from('managed whisper runtime worker fixture', 'utf8');
const RUNTIME_LIBRARY_CONTENT = Buffer.from('managed whisper runtime library fixture', 'utf8');
const temporaryRoots: string[] = [];
const activeStores = new Set<ManagedArtifactStore>();
const removalClearanceIssuer = new ManagedArtifactRemovalClearanceIssuer();

interface Harness {
  readonly adapter: LinuxManagedFilesystemAdapter;
  readonly descriptor: ManagedArtifactDescriptor;
  readonly managedRoot: string;
  readonly store: ManagedArtifactStore;
  readonly temporaryRoot: string;
}

function currentProcessStartIdentity(): string {
  const value = readFileSync(`/proc/${process.pid}/stat`, 'utf8');
  const closeParenthesis = value.lastIndexOf(')');
  const fields = value
    .slice(closeParenthesis + 2)
    .trim()
    .split(' ');
  const identity = fields[19];
  assert.ok(identity);
  return identity;
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function artifactId(value: string) {
  const result = toLocalWhisperArtifactId(value);
  assert.ok(result);
  return result;
}

function createDescriptor(identityKey = 'linux-native-model-fixture'): ManagedArtifactDescriptor {
  const canonicalName = `model-${sha256(identityKey)}`;
  return Object.freeze({
    artifactId: artifactId(canonicalName),
    canonicalName,
    catalogDigest: sha256('fixture-catalog'),
    expectedFiles: Object.freeze([
      Object.freeze({
        fileId: artifactId('model-data'),
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

function createRuntimeDescriptor(executableCount = 1): ManagedArtifactDescriptor {
  const identityKey = `linux-native-runtime-fixture-${executableCount}`;
  const canonicalName = `runtime-${sha256(identityKey)}`;
  const executableFiles = Array.from({ length: executableCount }, (_, index) => {
    const content = index === 0 ? RUNTIME_WORKER_CONTENT : Buffer.from(`alternate-runtime-worker-${index}`, 'utf8');
    return Object.freeze({
      fileId: artifactId(index === 0 ? 'worker' : `runtime-worker-${index}`),
      kind: 'executable' as const,
      mode: 0o700,
      sha256: sha256(content),
      sizeBytes: content.byteLength,
    });
  });
  return Object.freeze({
    artifactId: artifactId(canonicalName),
    canonicalName,
    catalogDigest: sha256('fixture-runtime-catalog'),
    expectedFiles: Object.freeze([
      ...executableFiles,
      Object.freeze({
        fileId: artifactId('runtime-cudart-12.8.1'),
        kind: 'library' as const,
        mode: 0o600,
        sha256: sha256(RUNTIME_LIBRARY_CONTENT),
        sizeBytes: RUNTIME_LIBRARY_CONTENT.byteLength,
      }),
    ]),
    identityKey,
    kind: 'runtime',
    namespace: 'runtimes',
    runtimePlatform: 'linux',
  });
}

function createHarness(
  instanceSuffix: string,
  temporaryRoot?: string,
  descriptor: ManagedArtifactDescriptor = createDescriptor(),
): Harness {
  const ownedTemporaryRoot = temporaryRoot ?? mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-fs-'));
  if (!temporaryRoot) temporaryRoots.push(ownedTemporaryRoot);
  const resolution = new ManagedArtifactPathResolver({
    environment: { XDG_DATA_HOME: path.join(ownedTemporaryRoot, 'data') },
    homeDirectory: () => path.join(ownedTemporaryRoot, 'home'),
    platform: 'linux',
  }).resolve();
  assert.equal(resolution.availability, 'available');
  if (resolution.availability !== 'available') throw new Error('Linux resolution unavailable');
  const transport = new NativeManagedFilesystemGuardTransport({
    executablePath: GUARD_PATH,
    spawnProcess: spawn,
  });
  const adapter = new LinuxManagedFilesystemAdapter(transport);
  let nonceCounter = 0;
  const lockRepository = new ManagedArtifactLockRepository({
    adapter,
    appInstanceNonce: `app-instance-${instanceSuffix.padEnd(20, 'x')}`,
    osProcessStartIdentity: currentProcessStartIdentity(),
    pid: process.pid,
  });
  const store = new ManagedArtifactStore({
    adapter,
    generateOperationNonce: () => `operation-${instanceSuffix}-${String(++nonceCounter).padStart(20, '0')}`,
    lockRepository,
    rootResolution: resolution,
  });
  activeStores.add(store);
  return {
    adapter,
    descriptor,
    managedRoot: resolution.managedRoot,
    store,
    temporaryRoot: ownedTemporaryRoot,
  };
}

function loadCatalogForContent() {
  const payload = structuredClone(createFixtureCatalogPayload());
  const file = payload.models[0].expectedFiles[0] as {
    mode: number;
    sha256: string;
    sizeBytes: number;
  };
  file.mode = 0o600;
  file.sha256 = sha256(CONTENT);
  file.sizeBytes = CONTENT.byteLength;
  (payload.models[0] as { installedSizeBytes: number; transferSizeBytes: number }).installedSizeBytes =
    CONTENT.byteLength;
  (payload.models[0] as { installedSizeBytes: number; transferSizeBytes: number }).transferSizeBytes =
    CONTENT.byteLength;
  const result = new LocalWhisperCatalogRepository({
    readDocument: () => signFixtureCatalog(payload),
    trustPolicy: createFixtureCatalogTrustPolicy(),
  }).load();
  if (!result.success) assert.fail(`Fixture catalog failed: ${result.code}`);
  return result.catalog;
}

async function installFixture(harness: Harness): Promise<void> {
  await installFiles(harness, new Map([[harness.descriptor.expectedFiles[0].fileId, CONTENT]]));
}

async function installFiles(harness: Harness, contentByFileId: ReadonlyMap<string, Buffer>): Promise<void> {
  const staging = await harness.store.createStaging(harness.descriptor);
  for (const expected of harness.descriptor.expectedFiles) {
    const content = contentByFileId.get(expected.fileId);
    assert.ok(content);
    const file = await harness.store.createStagedFile(staging, expected.fileId);
    await harness.store.appendStagedFile(file, content);
    await harness.store.sealStagedFile(file);
  }
  await harness.store.promote(harness.descriptor, staging);
}

function runtimeContents(descriptor: ManagedArtifactDescriptor): ReadonlyMap<string, Buffer> {
  return new Map(
    descriptor.expectedFiles.map((expected, index) => [
      expected.fileId,
      expected.kind === 'library'
        ? RUNTIME_LIBRARY_CONTENT
        : index === 0
          ? RUNTIME_WORKER_CONTENT
          : Buffer.from(`alternate-runtime-worker-${index}`, 'utf8'),
    ]),
  );
}

function installedFilePath(harness: Harness): string {
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
    assert.ok(path.basename(root).startsWith('gpt-voice-local-whisper-fs-'));
    rmSync(root, { force: true, recursive: true });
  }
});

describe('LinuxManagedFilesystemAdapter real openat2 contract', { skip: process.platform !== 'linux' }, () => {
  test('rejects a forged destructive-removal clearance', () => {
    const descriptor = createDescriptor();
    assert.throws(
      () => new ManagedArtifactRemovalClearance(Symbol('forged'), descriptor.artifactId),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'INVALID_CLEARANCE',
    );
  });

  test('promotes a fully verified staging tree and deletes only its exact manifest', async () => {
    const harness = createHarness('install-delete');
    await harness.store.initialize();
    await installFixture(harness);

    const installed = await harness.store.leaseInstalledArtifact(harness.descriptor, 'load');
    assert.throws(() => JSON.stringify(installed), /LEASE_NOT_SERIALIZABLE/);
    await installed.release();

    await harness.store.deleteArtifact(harness.descriptor, removalClearanceIssuer.issue(harness.descriptor.artifactId));
    await assert.rejects(
      harness.store.leaseInstalledArtifact(harness.descriptor, 'verify'),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_MISSING',
    );
    await harness.store.dispose();
  });

  test('returns an anchored exact runtime-worker launch lease', async () => {
    const descriptor = createRuntimeDescriptor();
    const harness = createHarness('runtime-launch-lease', undefined, descriptor);
    await harness.store.initialize();
    await installFiles(harness, runtimeContents(descriptor));

    const launch = await harness.store.leaseInstalledRuntimeForLaunch(descriptor);

    assert.equal(launch.workerFileSha256, sha256(RUNTIME_WORKER_CONTENT));
    assert.equal(launch.workerFileIdentity.type, 'regular');
    assert.equal(
      launch.workerExecutablePath,
      path.join(
        harness.managedRoot,
        'runtimes',
        descriptor.canonicalName,
        getManagedArtifactStorageFileName(descriptor, descriptor.expectedFiles[0].fileId),
      ),
    );
    assert.ok(existsSync(path.join(launch.workingDirectoryPath, 'libcudart.so.12')));
    assert.equal(launch.workingDirectoryPath, path.dirname(launch.workerExecutablePath));
    await launch.revalidate();
    const movedWorker = `${launch.workerExecutablePath}.moved`;
    renameSync(launch.workerExecutablePath, movedWorker);
    writeFileSync(launch.workerExecutablePath, RUNTIME_WORKER_CONTENT, { mode: 0o700 });
    await assert.rejects(
      launch.revalidate(),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_UNPROVABLE',
    );
    await launch.runtimeLease.release();
    await harness.store.dispose();
  });

  test('rejects runtime manifests without exactly one executable', async () => {
    for (const executableCount of [0, 2]) {
      const descriptor = createRuntimeDescriptor(executableCount);
      const harness = createHarness(`runtime-executable-count-${executableCount}`, undefined, descriptor);
      await harness.store.initialize();
      await assert.rejects(
        harness.store.leaseInstalledRuntimeForLaunch(descriptor),
        (error) => error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_UNPROVABLE',
      );
      await harness.store.dispose();
    }
  });

  test('releases the runtime lease when launch identity revalidation fails', async () => {
    const descriptor = createRuntimeDescriptor();
    const harness = createHarness('runtime-launch-revalidation', undefined, descriptor);
    await harness.store.initialize();
    await installFiles(harness, runtimeContents(descriptor));
    const originalRevalidate = harness.adapter.revalidate.bind(harness.adapter);
    let revalidationCount = 0;
    harness.adapter.revalidate = async (token, expectedIdentity) => {
      revalidationCount += 1;
      if (revalidationCount === 2) throw new ManagedFilesystemAdapterError('IDENTITY_CHANGED');
      await originalRevalidate(token, expectedIdentity);
    };

    await assert.rejects(
      harness.store.leaseInstalledRuntimeForLaunch(descriptor),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_UNPROVABLE',
    );
    harness.adapter.revalidate = originalRevalidate;
    const recoveredLease = await harness.store.leaseInstalledArtifact(descriptor, 'verify');
    await recoveredLease.release();
    await harness.store.dispose();
  });

  test('discards only a proven partial staging tree through anchored file identities', async () => {
    const harness = createHarness('discard-partial');
    await harness.store.initialize();
    const staging = await harness.store.createStaging(harness.descriptor);
    const file = await harness.store.createStagedFile(staging, harness.descriptor.expectedFiles[0].fileId);
    await harness.store.appendStagedFile(file, CONTENT.subarray(0, 7));
    await harness.store.sealStagedFile(file);

    await harness.store.discardStaging(staging);

    assert.deepEqual(readdirSync(path.join(harness.managedRoot, 'staging')), []);
    assert.equal(existsSync(path.join(harness.managedRoot, 'models', harness.descriptor.canonicalName)), false);
    await harness.store.dispose();
  });

  test('anchors a managed root beneath an ordinary path containing spaces', async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-fs-'));
    temporaryRoots.push(temporaryRoot);
    const adapter = new LinuxManagedFilesystemAdapter(
      new NativeManagedFilesystemGuardTransport({ executablePath: GUARD_PATH, spawnProcess: spawn }),
    );
    const root = await adapter.initialize(
      path.join(temporaryRoot, 'data with spaces', 'com.swimmwatch.gptvoice', 'local-whisper'),
    );
    await adapter.revalidate(root.token, root.identity);
    await adapter.release(root.token);
    await adapter.dispose();
  });

  test('serializes the same artifact across duplicate app instances', async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-fs-'));
    temporaryRoots.push(temporaryRoot);
    const first = createHarness('first-instance', temporaryRoot);
    const second = createHarness('second-instance', temporaryRoot);
    await first.store.initialize();
    await second.store.initialize();

    const firstStaging = await first.store.createStaging(first.descriptor);
    await assert.rejects(
      second.store.createStaging(second.descriptor),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'OPERATION_CONFLICT',
    );
    await firstStaging.release();
    const secondStaging = await second.store.createStaging(second.descriptor);
    await secondStaging.release();
    await first.store.dispose();
    await second.store.dispose();
  });

  test('reconstructs installed evidence only from the exact managed manifest', async () => {
    const harness = createHarness('inventory-evidence');
    const catalog = loadCatalogForContent();
    const descriptor = createManagedModelDescriptor(catalog, catalog.payload.models[0]);
    const catalogHarness = { ...harness, descriptor };
    await harness.store.initialize();
    await installFixture(catalogHarness);
    mkdirSync(path.join(harness.managedRoot, 'models', 'unknown-safe-directory'), { mode: 0o700 });
    const outside = path.join(harness.temporaryRoot, 'unknown-link-target');
    mkdirSync(outside, { mode: 0o700 });
    symlinkSync(outside, path.join(harness.managedRoot, 'models', 'unknown-link'));

    const evidence = await harness.store.buildEvidenceSnapshot(catalog);
    const model = evidence.getModelEvidence(getLocalWhisperModelIdentityKey(catalog.payload.models[0].identity));
    assert.equal(model.kind, 'installed');
    if (model.kind === 'installed') {
      assert.equal(model.manifestValid, true);
      assert.equal(model.files[0].sha256, sha256(CONTENT));
    }
    assert.deepEqual(evidence.listUnmanagedEvidence(), [
      { recoveryLabel: 'Unmanaged Local Whisper storage entry' },
      { recoveryLabel: 'Unmanaged Local Whisper storage entry' },
    ]);
    await harness.store.dispose();
  });

  test('classifies a known symlinked identity as corrupt without granting deletion authority', async () => {
    const harness = createHarness('corrupt-symlink-evidence');
    const catalog = loadCatalogForContent();
    const descriptor = createManagedModelDescriptor(catalog, catalog.payload.models[0]);
    await harness.store.initialize();
    const outside = path.join(harness.temporaryRoot, 'known-link-target');
    mkdirSync(outside, { mode: 0o700 });
    symlinkSync(outside, path.join(harness.managedRoot, 'models', descriptor.canonicalName));

    const evidence = await harness.store.buildEvidenceSnapshot(catalog);
    const model = evidence.getModelEvidence(getLocalWhisperModelIdentityKey(catalog.payload.models[0].identity));
    assert.deepEqual(model, {
      kind: 'installed',
      manifestIdentityKey: descriptor.identityKey,
      manifestValid: false,
      files: [],
    });
    assert.deepEqual(evidence.listUnmanagedEvidence(), [{ recoveryLabel: 'Unmanaged Local Whisper storage entry' }]);
    await harness.store.dispose();
  });

  test('never overwrites an older immutable revision during atomic promotion', async () => {
    const harness = createHarness('promotion-conflict');
    await harness.store.initialize();
    await installFixture(harness);
    const staging = await harness.store.createStaging(harness.descriptor);
    const file = await harness.store.createStagedFile(staging, harness.descriptor.expectedFiles[0].fileId);
    await harness.store.appendStagedFile(file, CONTENT);
    await harness.store.sealStagedFile(file);

    await assert.rejects(
      harness.store.promote(harness.descriptor, staging),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'OPERATION_CONFLICT',
    );
    assert.equal(readFileSync(installedFilePath(harness), 'utf8'), CONTENT.toString('utf8'));
    await harness.store.dispose();
  });

  test('rejects case-colliding or undeclared staging entries before promotion', async () => {
    const harness = createHarness('case-collision');
    await harness.store.initialize();
    const staging = await harness.store.createStaging(harness.descriptor);
    const file = await harness.store.createStagedFile(staging, harness.descriptor.expectedFiles[0].fileId);
    await harness.store.appendStagedFile(file, CONTENT);
    await harness.store.sealStagedFile(file);
    const stagingName = readdirSync(path.join(harness.managedRoot, 'staging'))[0];
    assert.ok(stagingName);
    writeFileSync(path.join(harness.managedRoot, 'staging', stagingName, 'FILE-ambiguous'), CONTENT, {
      mode: 0o600,
    });

    await assert.rejects(
      harness.store.promote(harness.descriptor, staging),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'INSTALL_FAILED',
    );
    assert.equal(existsSync(path.join(harness.managedRoot, 'models', harness.descriptor.canonicalName)), false);
    await harness.store.dispose();
  });

  test('fails closed on a held-directory rename and replacement race', async () => {
    const harness = createHarness('rename-race');
    await harness.store.initialize();
    await installFixture(harness);
    const root = await harness.adapter.initialize(harness.managedRoot);
    const opened = await harness.adapter.openArtifactDirectory(root.token, 'models', harness.descriptor.canonicalName);
    assert.ok(opened);

    const original = path.dirname(installedFilePath(harness));
    const moved = `${original}-moved`;
    renameSync(original, moved);
    mkdirSync(original, { mode: 0o700 });
    await assert.rejects(
      harness.adapter.revalidate(opened.token, opened.identity),
      (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'IDENTITY_CHANGED',
    );
    await harness.adapter.release(opened.token);
    await harness.adapter.release(root.token);
    await harness.store.dispose();
  });

  test('quarantines and preserves an artifact containing an unexpected symlink', async () => {
    const harness = createHarness('symlink-delete');
    await harness.store.initialize();
    await installFixture(harness);
    const outside = path.join(harness.temporaryRoot, 'outside.txt');
    writeFileSync(outside, 'must survive', { mode: 0o600 });
    symlinkSync(outside, path.join(path.dirname(installedFilePath(harness)), 'unexpected-link'));

    await assert.rejects(
      harness.store.deleteArtifact(harness.descriptor, removalClearanceIssuer.issue(harness.descriptor.artifactId)),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'DELETE_FAILED',
    );
    assert.equal(readFileSync(outside, 'utf8'), 'must survive');
    assert.equal(readdirSync(path.join(harness.managedRoot, 'quarantine')).length, 1);
    await harness.store.dispose();
  });

  test('rejects an exact-file identity swap inside a held quarantine lease', async () => {
    const harness = createHarness('file-id-race');
    await harness.store.initialize();
    await installFixture(harness);
    const root = await harness.adapter.initialize(harness.managedRoot);
    const artifact = await harness.adapter.openArtifactDirectory(
      root.token,
      'models',
      harness.descriptor.canonicalName,
    );
    assert.ok(artifact);
    const quarantine = await harness.adapter.quarantineArtifactDirectory(
      root.token,
      artifact.token,
      'models',
      harness.descriptor.canonicalName,
      'quarantine-race-00000001',
    );
    const entries = await harness.adapter.inspectDirectory(quarantine.token, [
      { canonicalName: 'managed-manifest-v1', mode: 0o600 },
      {
        canonicalName: getManagedArtifactFileName(harness.descriptor.expectedFiles[0].fileId),
        mode: 0o600,
      },
    ]);
    const expected = entries.find(({ canonicalName }) => canonicalName.startsWith('file-'));
    assert.ok(expected);
    const quarantineName = readdirSync(path.join(harness.managedRoot, 'quarantine'))[0];
    assert.ok(quarantineName);
    const filePath = path.join(harness.managedRoot, 'quarantine', quarantineName, expected.canonicalName);
    renameSync(filePath, `${filePath}.swapped-out`);
    writeFileSync(filePath, CONTENT, { mode: 0o600 });

    await assert.rejects(
      harness.adapter.deleteQuarantinedFile(quarantine.token, expected.canonicalName, expected.identity),
      (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'IDENTITY_CHANGED',
    );
    await harness.adapter.release(quarantine.token);
    await harness.adapter.release(artifact.token);
    await harness.adapter.release(root.token);
    await harness.store.dispose();
  });

  test('rejects hard-linked manifest files before deletion', async () => {
    const harness = createHarness('hardlink-delete');
    await harness.store.initialize();
    await installFixture(harness);
    const outsideLink = path.join(harness.temporaryRoot, 'outside-hardlink');
    linkSync(installedFilePath(harness), outsideLink);

    await assert.rejects(
      harness.store.deleteArtifact(harness.descriptor, removalClearanceIssuer.issue(harness.descriptor.artifactId)),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'DELETE_FAILED',
    );
    assert.equal(readFileSync(outsideLink, 'utf8'), CONTENT.toString('utf8'));
    await harness.store.dispose();
  });

  test('rejects a symlinked managed-root component instead of following it', async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-fs-'));
    temporaryRoots.push(temporaryRoot);
    const dataRoot = path.join(temporaryRoot, 'data');
    const outside = path.join(temporaryRoot, 'outside');
    mkdirSync(dataRoot, { mode: 0o700 });
    mkdirSync(outside, { mode: 0o700 });
    symlinkSync(outside, path.join(dataRoot, 'com.swimmwatch.gptvoice'));
    const harness = createHarness('root-symlink', temporaryRoot);

    await assert.rejects(
      harness.store.initialize(),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'STORAGE_UNAVAILABLE',
    );
    assert.deepEqual(readdirSync(outside), []);
    await harness.store.dispose();
  });

  test('recovers only a stale full-owner lock and fails closed on malformed metadata', async () => {
    const stale = createHarness('stale-lock');
    await stale.store.initialize();
    const lockPath = path.join(stale.managedRoot, 'locks', `lock-${stale.descriptor.canonicalName}`);
    writeFileSync(
      lockPath,
      `old-instance-nonce-0000\n${process.pid}\nnot-the-current-start\nstaging\n${stale.descriptor.artifactId}\n`,
      { mode: 0o600 },
    );
    chmodSync(lockPath, 0o600);
    const staging = await stale.store.createStaging(stale.descriptor);
    await staging.release();
    await stale.store.dispose();

    const malformed = createHarness('malformed-lock', stale.temporaryRoot);
    await malformed.store.initialize();
    writeFileSync(lockPath, 'malformed\n', { mode: 0o600 });
    await assert.rejects(
      malformed.store.createStaging(malformed.descriptor),
      (error) => error instanceof ManagedArtifactStoreError && error.code === 'INSTALL_FAILED',
    );
    assert.equal(readFileSync(lockPath, 'utf8'), 'malformed\n');
    await malformed.store.dispose();
  });
});
