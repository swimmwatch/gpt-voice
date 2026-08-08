import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SelectedDeviceVramAvailability } from '@main/localWhisper/capability/SelectedDeviceVramAvailability';
import type { LocalWhisperOpaqueDeviceId } from '@shared/localWhisper';

const selectedDeviceId = 'local-whisper-device-selected' as LocalWhisperOpaqueDeviceId;
const otherDeviceId = 'local-whisper-device-other' as LocalWhisperOpaqueDeviceId;

function topology(deviceId: LocalWhisperOpaqueDeviceId = selectedDeviceId, vendor: 'nvidia' | 'amd' = 'nvidia') {
  return Object.freeze({
    generation: 1,
    registryFingerprint: 'registry-fingerprint',
    devices: Object.freeze([
      Object.freeze({
        id: deviceId,
        label: 'GPU 1',
        vendor,
        available: true,
        eligibleBackends: Object.freeze(vendor === 'nvidia' ? (['cuda'] as const) : (['vulkan'] as const)),
      }),
    ]),
  });
}

describe('SelectedDeviceVramAvailability', () => {
  it('samples the selected private identity and exposes bytes only for its opaque device', async () => {
    const identities: string[] = [];
    const availability = new SelectedDeviceVramAvailability({
      resolve: (deviceId, registryFingerprint) => {
        assert.equal(deviceId, selectedDeviceId);
        assert.equal(registryFingerprint, 'registry-fingerprint');
        return Object.freeze({ nativeIdentity: '0000:01:00.0' });
      },
      sample: (nativeIdentity) => {
        identities.push(nativeIdentity);
        return Promise.resolve(5 * 1024 ** 3);
      },
    });
    availability.updateTopology(topology());

    assert.equal(
      await availability.refresh({ target: 'gpu', backend: 'cuda', deviceId: selectedDeviceId }),
      5 * 1024 ** 3,
    );
    assert.deepEqual(identities, ['0000:01:00.0']);
    assert.equal(
      availability.availableBytes({ target: 'gpu', backend: 'cuda', deviceId: selectedDeviceId }),
      5 * 1024 ** 3,
    );
    assert.equal(availability.availableBytes({ target: 'gpu', backend: 'cuda', deviceId: otherDeviceId }), null);
    assert.equal(availability.availableBytes({ target: 'cpu', backend: 'cpu', cpuThreads: 4 }), null);
  });

  it('fails closed for non-NVIDIA devices, unresolved identities, and invalid samples', async () => {
    let samples = 0;
    const availability = new SelectedDeviceVramAvailability({
      resolve: () => null,
      sample: () => {
        samples += 1;
        return Promise.resolve(-1);
      },
    });

    availability.updateTopology(topology(selectedDeviceId, 'amd'));
    assert.equal(await availability.refresh({ target: 'gpu', backend: 'vulkan', deviceId: selectedDeviceId }), null);
    availability.updateTopology(topology());
    assert.equal(await availability.refresh({ target: 'gpu', backend: 'cuda', deviceId: selectedDeviceId }), null);
    assert.equal(samples, 0);

    const invalid = new SelectedDeviceVramAvailability({
      resolve: () => Object.freeze({ nativeIdentity: '0000:01:00.0' }),
      sample: () => Promise.resolve(Number.MAX_SAFE_INTEGER + 1),
    });
    invalid.updateTopology(topology());
    assert.equal(await invalid.refresh({ target: 'gpu', backend: 'cuda', deviceId: selectedDeviceId }), null);
    assert.equal(invalid.availableBytes({ target: 'gpu', backend: 'cuda', deviceId: selectedDeviceId }), null);
  });

  it('does not cache an in-flight sample after the device topology changes', async () => {
    let completeSample: (value: number | null) => void = () => undefined;
    const availability = new SelectedDeviceVramAvailability({
      resolve: () => Object.freeze({ nativeIdentity: '0000:01:00.0' }),
      sample: () =>
        new Promise((resolve) => {
          completeSample = resolve;
        }),
    });
    availability.updateTopology(topology());
    const pending = availability.refresh({ target: 'gpu', backend: 'cuda', deviceId: selectedDeviceId });

    availability.updateTopology(
      Object.freeze({ ...topology(otherDeviceId), generation: 2, registryFingerprint: 'changed-fingerprint' }),
    );
    completeSample(3 * 1024 ** 3);

    assert.equal(await pending, 3 * 1024 ** 3);
    assert.equal(availability.availableBytes({ target: 'gpu', backend: 'cuda', deviceId: selectedDeviceId }), null);
  });
});
