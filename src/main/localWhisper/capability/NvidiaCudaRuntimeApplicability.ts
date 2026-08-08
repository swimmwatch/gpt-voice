import {
  getLocalWhisperRuntimeIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogCudaApplicability,
  type LocalWhisperCatalogRuntimeEntry,
} from '../catalog/LocalWhisperCatalogTypes';
import { LocalWhisperDeviceIdentityRepository } from '../deviceIdentity/LocalWhisperDeviceIdentityRepository';
import type { LocalWhisperDeviceDescriptor, LocalWhisperFailureCode, LocalWhisperPlatform } from '@shared/localWhisper';

import type { NvidiaHostInventoryDevice, NvidiaHostInventoryResult } from './NvidiaSmiHostInventory';

interface NvidiaCudaRuntimeApplicabilityDependencies {
  readonly catalog: LocalWhisperAuthenticatedCatalog;
  readonly platform: LocalWhisperPlatform;
  readonly architecture: 'x64' | 'arm64' | 'other';
  readonly identities: LocalWhisperDeviceIdentityRepository;
}

interface RuntimeMatch {
  readonly device: LocalWhisperDeviceDescriptor;
  readonly runtimeIdentityKey: string;
}

export interface NvidiaCudaRuntimeApplicabilitySnapshot {
  readonly devices: readonly LocalWhisperDeviceDescriptor[];
  readonly runtimeIdentityKeys: readonly string[];
  readonly unavailableReason: LocalWhisperFailureCode | null;
}

function parseVersion(value: string): readonly [number, number] | null {
  const match = /^(\d{1,4})\.(\d{1,4})$/u.exec(value);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return Number.isSafeInteger(major) && Number.isSafeInteger(minor) ? Object.freeze([major, minor]) : null;
}

function atLeast(actual: readonly [number, number], minimum: readonly [number, number]): boolean {
  return actual[0] > minimum[0] || (actual[0] === minimum[0] && actual[1] >= minimum[1]);
}

function noApplicability(): NvidiaCudaRuntimeApplicabilitySnapshot {
  return Object.freeze({
    devices: Object.freeze([]),
    runtimeIdentityKeys: Object.freeze([]),
    unavailableReason: 'DEVICE_NOT_FOUND',
  });
}

function currentCudaEntries(
  catalog: LocalWhisperAuthenticatedCatalog,
  platform: LocalWhisperPlatform,
  architecture: 'x64' | 'arm64' | 'other',
): readonly LocalWhisperCatalogRuntimeEntry[] {
  return Object.freeze(
    catalog.payload.runtimes.filter(
      ({ identity }) =>
        identity.platform === platform &&
        identity.architecture === architecture &&
        identity.target === 'gpu' &&
        identity.backend === 'cuda',
    ),
  );
}

function matches(
  entry: LocalWhisperCatalogRuntimeEntry,
  device: NvidiaHostInventoryDevice,
): { readonly matches: true } | { readonly matches: false; readonly reason: LocalWhisperFailureCode } {
  const applicability = entry.applicability;
  if (
    !applicability ||
    entry.identity.computeTargets.length !== 1 ||
    entry.identity.computeTargets[0] !== applicability.computeTarget
  ) {
    return Object.freeze({ matches: false, reason: 'RUNTIME_INCOMPATIBLE' });
  }
  const minimumDriver = parseVersion(applicability.minimumDriverVersion);
  const minimumCapability = parseVersion(applicability.minimumComputeCapability);
  const maximumCapability = parseVersion(applicability.maximumComputeCapability);
  if (!minimumDriver || !minimumCapability || !maximumCapability) {
    return Object.freeze({ matches: false, reason: 'RUNTIME_INCOMPATIBLE' });
  }
  const driver: readonly [number, number] = [device.driverVersion.major, device.driverVersion.minor];
  const capability: readonly [number, number] = [device.computeCapability.major, device.computeCapability.minor];
  if (!atLeast(driver, minimumDriver)) return Object.freeze({ matches: false, reason: 'DRIVER_INCOMPATIBLE' });
  if (!atLeast(capability, minimumCapability) || !atLeast(maximumCapability, capability)) {
    return Object.freeze({ matches: false, reason: 'DEVICE_NOT_ALLOWLISTED' });
  }
  if (device.totalVramBytes < applicability.minimumTotalVramBytes) {
    return Object.freeze({ matches: false, reason: 'INSUFFICIENT_VRAM' });
  }
  return Object.freeze({ matches: true });
}

function bestReason(failures: readonly LocalWhisperFailureCode[]): LocalWhisperFailureCode {
  return (
    failures.find((reason) => reason === 'DRIVER_INCOMPATIBLE') ??
    failures.find((reason) => reason === 'INSUFFICIENT_VRAM') ??
    failures.find((reason) => reason === 'DEVICE_NOT_ALLOWLISTED') ??
    failures[0] ??
    'DEVICE_NOT_FOUND'
  );
}

/** Resolves the sole catalog-authorized RTX 50 CUDA runtime without revealing raw inventory data. */
export class NvidiaCudaRuntimeApplicability {
  public constructor(private readonly dependencies: NvidiaCudaRuntimeApplicabilityDependencies) {}

  public resolve(inventory: NvidiaHostInventoryResult): NvidiaCudaRuntimeApplicabilitySnapshot {
    if (
      !inventory.available ||
      this.dependencies.platform === 'other' ||
      this.dependencies.platform === 'darwin' ||
      this.dependencies.architecture !== 'x64'
    ) {
      return noApplicability();
    }
    const entries = currentCudaEntries(
      this.dependencies.catalog,
      this.dependencies.platform,
      this.dependencies.architecture,
    );
    if (entries.length !== 1) {
      return Object.freeze({ ...noApplicability(), unavailableReason: 'RUNTIME_INCOMPATIBLE' });
    }
    const entry = entries[0];
    if (!entry) return noApplicability();
    const matching: RuntimeMatch[] = [];
    const failures: LocalWhisperFailureCode[] = [];
    for (const device of inventory.devices) {
      const result = matches(entry, device);
      if (!result.matches) {
        failures.push(result.reason);
        continue;
      }
      try {
        matching.push(
          Object.freeze({
            device: Object.freeze({
              id: this.dependencies.identities.getOpaqueId(device.nativeIdentity),
              label: `NVIDIA GPU ${matching.length + 1}`,
              vendor: 'nvidia',
              available: true,
              eligibleBackends: Object.freeze(['cuda'] as const),
            }),
            runtimeIdentityKey: getLocalWhisperRuntimeIdentityKey(entry.identity),
          }),
        );
      } catch {
        return Object.freeze({ ...noApplicability(), unavailableReason: 'DEVICE_NOT_FOUND' });
      }
    }
    if (matching.length === 0) {
      return Object.freeze({ ...noApplicability(), unavailableReason: bestReason(failures) });
    }
    return Object.freeze({
      devices: Object.freeze(matching.map(({ device }) => device)),
      runtimeIdentityKeys: Object.freeze([...new Set(matching.map(({ runtimeIdentityKey }) => runtimeIdentityKey))]),
      unavailableReason: null,
    });
  }

  public supports(
    snapshot: NvidiaCudaRuntimeApplicabilitySnapshot,
    entry: LocalWhisperCatalogRuntimeEntry,
    deviceId: string | null,
  ): boolean {
    if (deviceId === null || !snapshot.devices.some((device) => device.id === deviceId)) return false;
    return snapshot.runtimeIdentityKeys.includes(getLocalWhisperRuntimeIdentityKey(entry.identity));
  }
}

export function createRtx50CudaApplicability(minimumDriverVersion: string): LocalWhisperCatalogCudaApplicability {
  return Object.freeze({
    computeTarget: 'sm_120a-real',
    minimumDriverVersion,
    minimumComputeCapability: '12.0',
    maximumComputeCapability: '12.0',
    minimumTotalVramBytes: 6 * 1024 ** 3,
    policyRevision: 'rtx50-sm120a-policy-v1' as LocalWhisperCatalogCudaApplicability['policyRevision'],
  });
}
