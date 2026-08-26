import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LocalWhisperDeviceIdentityRepository,
  type LocalWhisperDeviceIdentityReadResult,
  type LocalWhisperDeviceIdentityStore,
} from '@main/localWhisper/deviceIdentity/LocalWhisperDeviceIdentityRepository';

class MemoryIdentityStore implements LocalWhisperDeviceIdentityStore {
  public value: unknown = null;

  public read(): LocalWhisperDeviceIdentityReadResult {
    return this.value === null ? { status: 'missing' } : { status: 'ok', value: this.value };
  }

  public write(value: unknown): void {
    this.value = structuredClone(value);
  }

  public remove(): boolean {
    const existed = this.value !== null;
    this.value = null;
    return existed;
  }
}

describe('LocalWhisperDeviceIdentityRepository', () => {
  it('keeps IDs stable only for the same salt, canonical identity, and version', () => {
    const store = new MemoryIdentityStore();
    const repository = new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 7));
    const first = repository.getOpaqueId('pci:0000:01:00.0|uuid:fixture');
    const second = repository.getOpaqueId('pci:0000:01:00.0|uuid:fixture');
    const other = repository.getOpaqueId('pci:0000:02:00.0|uuid:fixture');
    assert.equal(first, second);
    assert.notEqual(first, other);
    assert.doesNotMatch(JSON.stringify(store.value), /pci|uuid|0000:/u);

    const reloaded = new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 8));
    assert.equal(reloaded.getOpaqueId('pci:0000:01:00.0|uuid:fixture'), first);
  });

  it('fails closed for salt loss, malformed state, unsafe identity, and digest collisions', () => {
    const store = new MemoryIdentityStore();
    const first = new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 1));
    const beforeReset = first.getOpaqueId('native-a');
    assert.equal(first.reset(), true);
    const afterReset = new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 2));
    assert.notEqual(afterReset.getOpaqueId('native-a'), beforeReset);

    store.value = { schemaVersion: 1, identityVersion: 1, saltBase64Url: 'unsafe' };
    assert.throws(() =>
      new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 4)).getOpaqueId(
        'native-a',
      ),
    );
    store.value = null;
    assert.throws(() =>
      new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 5)).getOpaqueId(
        'unsafe\nidentity',
      ),
    );

    const collision = new LocalWhisperDeviceIdentityRepository(
      new MemoryIdentityStore(),
      () => Uint8Array.from({ length: 32 }, () => 3),
      () => 'a'.repeat(64),
    );
    assert.throws(() => collision.projectOpaqueIds(['native-a', 'native-b']), /collision/u);
    const sequentialCollision = new LocalWhisperDeviceIdentityRepository(
      new MemoryIdentityStore(),
      () => Uint8Array.from({ length: 32 }, () => 6),
      () => 'b'.repeat(64),
    );
    sequentialCollision.getOpaqueId('native-a');
    assert.throws(() => sequentialCollision.getOpaqueId('native-b'), /collision/u);
  });
});
