import type {
  LocalWhisperDeviceDescriptor,
  LocalWhisperGpuBackend,
  LocalWhisperOpaqueDeviceId,
} from '@shared/localWhisper';

import type { LocalWhisperDeviceIdentityRepository } from '../deviceIdentity/LocalWhisperDeviceIdentityRepository';
import {
  createLocalWhisperRegistryFingerprint,
  type LocalWhisperDeviceRegistry,
  type LocalWhisperDeviceRegistryEntry,
} from '../supervisor/LocalWhisperDeviceAuthority';

interface ProjectedDevice {
  readonly descriptor: LocalWhisperDeviceDescriptor;
  readonly entry: LocalWhisperDeviceRegistryEntry;
}

export interface LocalWhisperDeviceTopologySnapshot {
  readonly generation: number;
  readonly registryFingerprint: string;
  readonly devices: readonly LocalWhisperDeviceDescriptor[];
}

function isGpuBackend(value: string): value is LocalWhisperGpuBackend {
  return value === 'cuda' || value === 'hip' || value === 'vulkan' || value === 'metal';
}

function vendor(backend: LocalWhisperGpuBackend): LocalWhisperDeviceDescriptor['vendor'] {
  if (backend === 'cuda') return 'nvidia';
  if (backend === 'metal') return 'apple';
  return 'amd';
}

function label(backend: LocalWhisperGpuBackend, ordinal: number): string {
  const family = backend === 'cuda' ? 'NVIDIA GPU' : backend === 'metal' ? 'Apple GPU' : 'AMD GPU';
  return `${family} ${ordinal + 1}`;
}

/** Owns private registry identities and exposes only stable per-install opaque devices. */
export class LocalWhisperDeviceTopologyAuthority {
  private generationValue = 0;
  private fingerprintValue: string | null = null;
  private readonly projected = new Map<LocalWhisperOpaqueDeviceId, ProjectedDevice>();

  public constructor(private readonly identities: LocalWhisperDeviceIdentityRepository) {}

  public update(registry: LocalWhisperDeviceRegistry): LocalWhisperDeviceTopologySnapshot {
    if (!isGpuBackend(registry.backendId)) throw new Error('Local Whisper GPU topology requires a GPU backend');
    const fingerprint = createLocalWhisperRegistryFingerprint(registry);
    if (fingerprint !== this.fingerprintValue) {
      if (this.generationValue >= Number.MAX_SAFE_INTEGER)
        throw new Error('Local Whisper topology generation exhausted');
      this.generationValue += 1;
      this.fingerprintValue = fingerprint;
      this.projected.clear();
      const opaqueIds = this.identities.projectOpaqueIds(registry.entries.map(({ nativeIdentity }) => nativeIdentity));
      registry.entries.forEach((entry, index) => {
        const id = opaqueIds[index];
        if (!id) throw new Error('Local Whisper opaque device projection failed');
        this.projected.set(
          id,
          Object.freeze({
            descriptor: Object.freeze({
              id,
              label: label(registry.backendId as LocalWhisperGpuBackend, entry.ordinal),
              vendor: vendor(registry.backendId as LocalWhisperGpuBackend),
              available: true,
              eligibleBackends: Object.freeze([registry.backendId as LocalWhisperGpuBackend]),
            }),
            entry,
          }),
        );
      });
    }
    return Object.freeze({
      generation: this.generationValue,
      registryFingerprint: fingerprint,
      devices: Object.freeze([...this.projected.values()].map(({ descriptor }) => descriptor)),
    });
  }

  public resolve(
    deviceId: LocalWhisperOpaqueDeviceId,
    registryFingerprint: string,
  ): LocalWhisperDeviceRegistryEntry | null {
    if (registryFingerprint !== this.fingerprintValue) return null;
    return this.projected.get(deviceId)?.entry ?? null;
  }

  public invalidate(): void {
    this.fingerprintValue = null;
    this.projected.clear();
  }
}
