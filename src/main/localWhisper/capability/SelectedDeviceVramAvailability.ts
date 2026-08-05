import type { LocalWhisperOpaqueDeviceId, LocalWhisperPublicSettings } from '@shared/localWhisper';

import type { LocalWhisperDeviceTopologySnapshot } from '../composition/LocalWhisperDeviceTopologyAuthority';

interface NativeDeviceIdentity {
  readonly nativeIdentity: string;
}

export interface SelectedDeviceVramAvailabilityDependencies {
  readonly resolve: (deviceId: LocalWhisperOpaqueDeviceId, registryFingerprint: string) => NativeDeviceIdentity | null;
  readonly sample: (nativeIdentity: string) => Promise<number | null>;
}

type LocalWhisperExecutionSettings = LocalWhisperPublicSettings['execution'];

/** Owns a fail-closed VRAM sample bound to one current opaque NVIDIA device. */
export class SelectedDeviceVramAvailability {
  private topology: LocalWhisperDeviceTopologySnapshot | null = null;
  private sampled: { readonly deviceId: LocalWhisperOpaqueDeviceId; readonly freeBytes: number } | null = null;
  private refreshToken: object = Object.freeze({});

  public constructor(private readonly dependencies: SelectedDeviceVramAvailabilityDependencies) {}

  public updateTopology(topology: LocalWhisperDeviceTopologySnapshot): void {
    this.refreshToken = Object.freeze({});
    this.topology = topology;
    if (
      this.sampled &&
      !topology.devices.some(({ id, vendor }) => id === this.sampled?.deviceId && vendor === 'nvidia')
    ) {
      this.sampled = null;
    }
  }

  public availableBytes(execution: LocalWhisperExecutionSettings): number | null {
    return execution.target === 'gpu' && this.sampled?.deviceId === execution.deviceId ? this.sampled.freeBytes : null;
  }

  public async refresh(execution: LocalWhisperExecutionSettings): Promise<number | null> {
    const refreshToken = Object.freeze({});
    this.refreshToken = refreshToken;
    const topology = this.topology;
    if (execution.target !== 'gpu' || execution.deviceId === null || !topology) {
      this.sampled = null;
      return null;
    }
    const deviceId = execution.deviceId;
    if (topology.devices.find(({ id }) => id === deviceId)?.vendor !== 'nvidia') {
      this.sampled = null;
      return null;
    }
    const entry = this.dependencies.resolve(deviceId, topology.registryFingerprint);
    if (!entry) {
      this.sampled = null;
      return null;
    }
    let sampled: number | null = null;
    try {
      sampled = await this.dependencies.sample(entry.nativeIdentity);
    } catch {
      // External GPU telemetry is optional and must leave resource facts fail-closed.
    }
    const freeBytes = sampled !== null && Number.isSafeInteger(sampled) && sampled >= 0 ? sampled : null;
    if (this.refreshToken === refreshToken && this.topology === topology) {
      this.sampled = freeBytes === null ? null : Object.freeze({ deviceId, freeBytes });
    }
    return freeBytes;
  }

  public invalidate(): void {
    this.refreshToken = Object.freeze({});
    this.topology = null;
    this.sampled = null;
  }
}
