import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LocalWhisperAuthenticatedCatalog } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LocalWhisperModelLaunchAuthorityFactory,
  type LocalWhisperModelLaunchLeasePort,
} from '@main/localWhisper/composition/LocalWhisperModelLaunchAuthorityFactory';
import { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import type {
  ManagedArtifactDescriptor,
  ManagedModelLaunchLease,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import { createFixtureCatalogPayload } from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

function catalog(): LocalWhisperAuthenticatedCatalog {
  const payload = createFixtureCatalogPayload();
  return Object.freeze({
    signingKeyId: payload.runtimes[0].identity.signingKeyId,
    payload,
    isRuntimeDenylisted: () => false,
    isModelDenylisted: () => false,
  });
}

function launchLease(released: { value: number }): ManagedModelLaunchLease {
  const modelLease = new ManagedArtifactLease(
    {
      artifactId: 'model-artifact' as never,
      artifactKind: 'model',
      canonicalName: `model-${'a'.repeat(64)}`,
      catalogDigest: 'b'.repeat(64),
      identity: {
        deviceOrVolumeId: '1',
        fileId: '2',
        linkCount: 1,
        mode: 0o700,
        parentFileId: '1',
        sizeBytes: 1,
        type: 'directory',
      },
      purpose: 'load',
    },
    'native-model-token',
    () => {
      released.value += 1;
      return Promise.resolve();
    },
  );
  return Object.freeze({
    modelLease,
    modelLeaseTokenDigest: 'd'.repeat(64),
    modelFilePath: '/managed/models/model/file-model',
    modelFileIdentity: Object.freeze({
      deviceOrVolumeId: '1',
      fileId: '3',
      linkCount: 1,
      mode: 0o600,
      parentFileId: '2',
      sizeBytes: 200,
      type: 'regular' as const,
    }),
    modelFileSha256: 'c'.repeat(64),
    modelFileSizeBytes: 200,
    revalidate: () => Promise.resolve(),
  });
}

class ModelLeasePort implements LocalWhisperModelLaunchLeasePort {
  public calls = 0;

  public constructor(private readonly value: ManagedModelLaunchLease) {}

  public leaseInstalledModelForLaunch(_descriptor: ManagedArtifactDescriptor): Promise<ManagedModelLaunchLease> {
    this.calls += 1;
    return Promise.resolve(this.value);
  }
}

describe('LocalWhisperModelLaunchAuthorityFactory', () => {
  it('binds one catalog ggml model to a held exact-file lease and nonce', async () => {
    const catalogValue = catalog();
    const released = { value: 0 };
    const port = new ModelLeasePort(launchLease(released));
    const authority = await new LocalWhisperModelLaunchAuthorityFactory({
      randomBytes: (size) => Uint8Array.from({ length: size }, (_value, index) => index + 1),
      store: port,
    }).acquire(catalogValue, catalogValue.payload.models[0]);

    assert.equal(port.calls, 1);
    assert.equal(authority.modelFileSha256, 'c'.repeat(64));
    assert.equal(authority.modelFileSizeBytes, 200);
    assert.equal(authority.modelLeaseTokenDigest, 'd'.repeat(64));
    assert.equal(authority.operationNonce.byteLength, 16);
    assert.match(authority.modelIdentityKey, /base/u);
    await authority.modelLease.release();
    assert.equal(released.value, 1);
  });

  it('rejects denied models and invalid operation nonces before leasing', async () => {
    const catalogValue = catalog();
    const denied = Object.freeze({ ...catalogValue, isModelDenylisted: () => true });
    const port = new ModelLeasePort(launchLease({ value: 0 }));

    await assert.rejects(
      () =>
        new LocalWhisperModelLaunchAuthorityFactory({ randomBytes: () => new Uint8Array(16), store: port }).acquire(
          denied,
          denied.payload.models[0],
        ),
      /model launch identity invalid/u,
    );
    await assert.rejects(
      () =>
        new LocalWhisperModelLaunchAuthorityFactory({ randomBytes: () => new Uint8Array(16), store: port }).acquire(
          catalogValue,
          catalogValue.payload.models[0],
        ),
      /operation nonce invalid/u,
    );
    assert.equal(port.calls, 0);
  });
});
