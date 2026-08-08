import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NvidiaCudaRuntimeApplicability } from '@main/localWhisper/capability/NvidiaCudaRuntimeApplicability';
import {
  NvidiaSmiHostInventory,
  type NvidiaHostInventoryResult,
} from '@main/localWhisper/capability/NvidiaSmiHostInventory';
import { LocalWhisperDeviceIdentityRepository } from '@main/localWhisper/deviceIdentity/LocalWhisperDeviceIdentityRepository';
import type { LocalWhisperDeviceIdentityStore } from '@main/localWhisper/deviceIdentity/FileLocalWhisperDeviceIdentityStore';
import type { LocalWhisperAuthenticatedCatalog } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';

import { createQualificationCatalogPayload } from '../../../fixtures/local-whisper/catalog/qualificationCatalogSigner';

class MemoryIdentityStore implements LocalWhisperDeviceIdentityStore {
  private value: unknown = null;

  public read(): { readonly status: 'missing' } | { readonly status: 'ok'; readonly value: unknown } {
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

function catalog(): LocalWhisperAuthenticatedCatalog {
  const payload = createQualificationCatalogPayload();
  return Object.freeze({
    signingKeyId: payload.runtimes[0]!.identity.signingKeyId,
    payload,
    isModelDenylisted: () => false,
    isRuntimeDenylisted: () => false,
  });
}

function inventory(
  overrides: Partial<Extract<NvidiaHostInventoryResult, { readonly available: true }>['devices'][number]> = {},
): NvidiaHostInventoryResult {
  return Object.freeze({
    available: true,
    devices: Object.freeze([
      Object.freeze({
        nativeIdentity: '0000:01:00.0',
        driverVersion: Object.freeze({ major: 570, minor: 26, patch: 0 }),
        computeCapability: Object.freeze({ major: 12, minor: 0 }),
        totalVramBytes: 8 * 1024 ** 3,
        available: true,
        ...overrides,
      }),
    ]),
  });
}

function resolver(platform: 'linux' | 'win32' = 'linux'): NvidiaCudaRuntimeApplicability {
  return new NvidiaCudaRuntimeApplicability({
    catalog: catalog(),
    platform,
    architecture: 'x64',
    identities: new LocalWhisperDeviceIdentityRepository(new MemoryIdentityStore(), () =>
      Uint8Array.from({ length: 32 }, (_value, index) => index + 1),
    ),
  });
}

describe('NVIDIA RTX 50 pre-install inventory', () => {
  it('uses only an absolute reviewed path and parses one bounded inventory without exposing command output', async () => {
    const calls: { executablePath: string; arguments_: readonly string[] }[] = [];
    const source = new NvidiaSmiHostInventory({
      platform: 'linux',
      environment: Object.freeze({ PATH: '/unsafe' }),
      pathExists: (candidate) => candidate === '/usr/bin/nvidia-smi',
      command: {
        run: async (executablePath, arguments_) => {
          calls.push({ executablePath, arguments_ });
        return '00000000:01:00.0, 12.0, 570.26, 8192\n';
        },
      },
    });

    const result = await source.read();

    assert.deepEqual(calls, [
      {
        executablePath: '/usr/bin/nvidia-smi',
        arguments_: ['--query-gpu=pci.bus_id,compute_cap,driver_version,memory.total', '--format=csv,noheader,nounits'],
      },
    ]);
    assert.equal(result.available, true);
    assert.equal(result.available && result.devices.length, 1);
    assert.equal(result.available && result.devices[0]?.nativeIdentity, '0000:01:00.0');
  });

  it('fails closed for malformed, duplicate, reordered, and oversized NVIDIA output', async () => {
    for (const output of [
      'not-a-pci-id, 12.0, 570.26, 8192\n',
      '0000:01:00.0, 12.0, 570.26, 8192\n0000:01:00.0, 12.0, 570.26, 8192\n',
      '0000:02:00.0, 12.0, 570.26, 8192\n0000:01:00.0, 12.0, 570.26, 8192\n',
      'x'.repeat(4_097),
    ]) {
      const source = new NvidiaSmiHostInventory({
        platform: 'win32',
        environment: Object.freeze({ SystemRoot: 'C:\\Windows' }),
        pathExists: (candidate) => candidate.endsWith('nvidia-smi.exe'),
        command: { run: async () => output },
      });
      assert.deepEqual(await source.read(), { available: false, reason: 'DEVICE_NOT_FOUND' });
    }
  });
});

describe('NVIDIA RTX 50 runtime applicability', () => {
  it('projects exactly one opaque RTX 50 CUDA runtime and never exposes raw hardware identity', () => {
    const result = resolver().resolve(inventory());

    assert.equal(result.unavailableReason, null);
    assert.equal(result.devices.length, 1);
    assert.equal(result.runtimeIdentityKeys.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /0000:01:00\.0|570\.26/u);
  });

  it('fails closed for RTX 30, RTX 40, malformed capability, stale driver, insufficient VRAM, and cross-platform rows', () => {
    const cases: readonly [NvidiaCudaRuntimeApplicability, NvidiaHostInventoryResult, string][] = [
      [resolver(), inventory({ computeCapability: Object.freeze({ major: 8, minor: 6 }) }), 'DEVICE_NOT_ALLOWLISTED'],
      [resolver(), inventory({ computeCapability: Object.freeze({ major: 8, minor: 9 }) }), 'DEVICE_NOT_ALLOWLISTED'],
      [
        resolver(),
        inventory({ driverVersion: Object.freeze({ major: 560, minor: 0, patch: 0 }) }),
        'DRIVER_INCOMPATIBLE',
      ],
      [resolver(), inventory({ totalVramBytes: 4 * 1024 ** 3 }), 'INSUFFICIENT_VRAM'],
      [resolver('win32'), inventory(), 'RUNTIME_INCOMPATIBLE'],
    ];
    for (const [applicability, hostInventory, reason] of cases) {
      const result = applicability.resolve(hostInventory);
      assert.equal(result.devices.length, 0);
      assert.equal(result.runtimeIdentityKeys.length, 0);
      assert.equal(result.unavailableReason, reason);
    }
  });
});
