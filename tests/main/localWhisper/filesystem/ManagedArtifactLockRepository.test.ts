import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ManagedArtifactLockRepository } from '@main/localWhisper/filesystem/ManagedArtifactLockRepository';
import {
  ManagedFilesystemAdapterError,
  type ManagedFilesystemOpenResult,
  type ManagedFilesystemPlatformAdapter,
} from '@main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';

function artifactId(value: string) {
  const result = toLocalWhisperArtifactId(value);
  assert.ok(result);
  return result;
}

function harness() {
  let held = false;
  let acquisitions = 0;
  let releases = 0;
  const native: ManagedFilesystemOpenResult = Object.freeze({
    token: 'native-lock-token',
    identity: Object.freeze({
      deviceOrVolumeId: 'device',
      fileId: 'file',
      linkCount: 1,
      mode: 0o600,
      parentFileId: 'parent',
      sizeBytes: 1,
      type: 'regular',
    }),
  });
  const adapter = {
    acquireArtifactLock: async () => {
      acquisitions += 1;
      if (held) throw new ManagedFilesystemAdapterError('CONFLICT');
      held = true;
      return native;
    },
    release: async (token: string) => {
      assert.equal(token, native.token);
      assert.equal(held, true);
      held = false;
      releases += 1;
    },
  } as Pick<ManagedFilesystemPlatformAdapter, 'acquireArtifactLock' | 'release'> as ManagedFilesystemPlatformAdapter;
  const repository = new ManagedArtifactLockRepository({
    adapter,
    appInstanceNonce: 'app-instance-00000001',
    osProcessStartIdentity: 'process-start',
    pid: 42,
  });
  return Object.freeze({
    repository,
    counts: () => Object.freeze({ acquisitions, releases }),
  });
}

describe('ManagedArtifactLockRepository', () => {
  it('reference-counts immutable read leases and releases the native lock after the last reader', async () => {
    const value = harness();
    const id = artifactId('runtime-cuda');
    const load = await value.repository.acquire('root', id, 'runtime-cuda', 'load');
    const verify = await value.repository.acquire('root', id, 'runtime-cuda', 'verify');

    assert.deepEqual(value.counts(), { acquisitions: 1, releases: 0 });
    await load.release();
    assert.deepEqual(value.counts(), { acquisitions: 1, releases: 0 });
    await verify.release();
    assert.deepEqual(value.counts(), { acquisitions: 1, releases: 1 });

    const next = await value.repository.acquire('root', id, 'runtime-cuda', 'integrity');
    assert.deepEqual(value.counts(), { acquisitions: 2, releases: 1 });
    await next.release();
    assert.deepEqual(value.counts(), { acquisitions: 2, releases: 2 });
  });

  it('keeps mutation locks exclusive while an immutable read lease is held', async () => {
    const value = harness();
    const id = artifactId('runtime-cuda');
    const load = await value.repository.acquire('root', id, 'runtime-cuda', 'load');

    await assert.rejects(
      value.repository.acquire('root', id, 'runtime-cuda', 'delete'),
      (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'CONFLICT',
    );
    assert.deepEqual(value.counts(), { acquisitions: 2, releases: 0 });
    await load.release();
    assert.deepEqual(value.counts(), { acquisitions: 2, releases: 1 });
  });
});
