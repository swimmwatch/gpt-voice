import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  LocalWhisperAuthenticatedCatalog,
  LocalWhisperCatalogRuntimeEntry,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LocalWhisperRuntimeLaunchAuthorityFactory,
  type LocalWhisperRuntimeLaunchLeasePort,
} from '@main/localWhisper/composition/LocalWhisperRuntimeLaunchAuthorityFactory';
import { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import type {
  ManagedArtifactDescriptor,
  ManagedRuntimeLaunchLease,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import type { LocalWhisperRevisionId } from '@shared/localWhisper';
import { createFixtureCatalogPayload } from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

const RUNTIME_DIGEST = 'a'.repeat(64);
const WORKER_DIGEST = 'b'.repeat(64);

function fixture(buildRevision = RUNTIME_DIGEST): {
  readonly catalog: LocalWhisperAuthenticatedCatalog;
  readonly runtime: LocalWhisperCatalogRuntimeEntry;
} {
  const sourcePayload = structuredClone(createFixtureCatalogPayload());
  const sourceRuntime = sourcePayload.runtimes[0];
  assert.ok(sourceRuntime);
  const runtime = Object.freeze({
    ...sourceRuntime,
    identity: Object.freeze({
      ...sourceRuntime.identity,
      buildRevision: buildRevision as LocalWhisperRevisionId,
    }),
  });
  const payload = Object.freeze({ ...sourcePayload, runtimes: Object.freeze([runtime]) });
  const catalog: LocalWhisperAuthenticatedCatalog = {
    signingKeyId: runtime.identity.signingKeyId,
    payload,
    isRuntimeDenylisted: () => false,
    isModelDenylisted: () => false,
  };
  return { catalog, runtime };
}

function lease(revalidated: { value: number }, released: { value: number }): ManagedRuntimeLaunchLease {
  const runtimeLease = new ManagedArtifactLease(
    {
      artifactId: 'runtime-artifact' as never,
      artifactKind: 'runtime',
      canonicalName: `runtime-${'c'.repeat(64)}`,
      catalogDigest: 'd'.repeat(64),
      identity: {
        deviceOrVolumeId: '1',
        fileId: '2',
        linkCount: 1,
        mode: 0o700,
        parentFileId: '1',
        sizeBytes: 0,
        type: 'directory',
      },
      purpose: 'load',
    },
    'native-runtime-token',
    () => {
      released.value += 1;
      return Promise.resolve();
    },
  );
  return {
    runtimeLease,
    workerExecutablePath: '/managed/runtime/worker',
    workerFileIdentity: {
      deviceOrVolumeId: '1',
      fileId: '3',
      linkCount: 1,
      mode: 0o500,
      parentFileId: '2',
      sizeBytes: 100,
      type: 'regular',
    },
    workerFileSha256: WORKER_DIGEST,
    workingDirectoryPath: '/managed/runtime',
    revalidate: () => {
      revalidated.value += 1;
      return Promise.resolve();
    },
  };
}

class RuntimeLeasePort implements LocalWhisperRuntimeLaunchLeasePort {
  public calls = 0;

  public constructor(private readonly launchLease: ManagedRuntimeLaunchLease) {}

  public leaseInstalledRuntimeForLaunch(_descriptor: ManagedArtifactDescriptor): Promise<ManagedRuntimeLaunchLease> {
    this.calls += 1;
    return Promise.resolve(this.launchLease);
  }
}

describe('LocalWhisperRuntimeLaunchAuthorityFactory', () => {
  it('binds the catalog build digest and exact installed worker lease to one launch mode', async () => {
    const values = fixture();
    const revalidated = { value: 0 };
    const released = { value: 0 };
    const port = new RuntimeLeasePort(lease(revalidated, released));
    const authority = await new LocalWhisperRuntimeLaunchAuthorityFactory(port).acquire({
      ...values,
      configurationEpoch: 7,
      launchMode: 'registry',
    });

    assert.equal(authority.expectedHandshake.runtimeBuildDigest, RUNTIME_DIGEST);
    assert.equal(authority.workerFileSha256, WORKER_DIGEST);
    assert.deepEqual(authority.expectedHandshake.capabilities, [
      'cpu-baseline',
      'exact-model-authority',
      'cooperative-cancellation',
    ]);
    assert.equal(authority.launchMode, 'registry');
    await authority.revalidate();
    assert.equal(revalidated.value, 1);
    await authority.runtimeLease.release();
    assert.equal(released.value, 1);
  });

  it('rejects a catalog runtime without an exact build digest before leasing it', async () => {
    const values = fixture('not-a-build-digest');
    const port = new RuntimeLeasePort(lease({ value: 0 }, { value: 0 }));

    await assert.rejects(
      new LocalWhisperRuntimeLaunchAuthorityFactory(port).acquire({
        ...values,
        configurationEpoch: 1,
        launchMode: 'probe',
      }),
      /runtime launch identity invalid/u,
    );
    assert.equal(port.calls, 0);
  });
});
