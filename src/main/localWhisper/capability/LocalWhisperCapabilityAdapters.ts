/* eslint-disable max-classes-per-file -- each fixed backend adapter implements one closed prerequisite contract. */
import type { LocalWhisperBackend, LocalWhisperFailureCode } from '@shared/localWhisper';

export type LocalWhisperBackendProbeResult =
  { readonly success: true } | { readonly success: false; readonly code: LocalWhisperFailureCode };

export interface LocalWhisperCpuProbeInput {
  readonly backend: 'cpu';
  readonly logicalProcessorCount: number;
  readonly resolvedThreads: number;
  readonly isaSupported: boolean;
  readonly boundedComputePassed: boolean;
}

export interface LocalWhisperCudaProbeInput {
  readonly backend: 'cuda';
  readonly physicalNvidiaDevice: boolean;
  readonly driverCompatible: boolean;
  readonly computeTargetCompiled: boolean;
  readonly dependencyClosureValid: boolean;
  readonly allocationPassed: boolean;
  readonly dispatchPassed: boolean;
}

export interface LocalWhisperVulkanProbeInput {
  readonly backend: 'vulkan';
  readonly physicalAmdDevice: boolean;
  readonly apiVersion: readonly [major: number, minor: number];
  readonly generatedShaderTarget: readonly [major: number, minor: number];
  readonly storageBuffer16BitAccess: boolean;
  readonly requiredExtensionsPresent: boolean;
  readonly allocationPassed: boolean;
  readonly dispatchPassed: boolean;
}

export interface LocalWhisperHipProbeInput {
  readonly backend: 'hip';
  readonly approvedRow: boolean;
  readonly exactOsKernelDriverMatch: boolean;
  readonly exactRuntimeClosureMatch: boolean;
  readonly exactPciAndGfxMatch: boolean;
  readonly pcieAtomicsSatisfied: boolean;
  readonly permissionsSatisfied: boolean;
  readonly allocationPassed: boolean;
  readonly dispatchPassed: boolean;
}

export interface LocalWhisperMetalProbeInput {
  readonly backend: 'metal';
}

export type LocalWhisperBackendProbeInput =
  | LocalWhisperCpuProbeInput
  | LocalWhisperCudaProbeInput
  | LocalWhisperVulkanProbeInput
  | LocalWhisperHipProbeInput
  | LocalWhisperMetalProbeInput;

export interface LocalWhisperCapabilityAdapter<TInput extends LocalWhisperBackendProbeInput> {
  readonly backend: TInput['backend'];
  evaluate(input: TInput): LocalWhisperBackendProbeResult;
}

const SUCCESS = Object.freeze({ success: true } as const);

function failure(code: LocalWhisperFailureCode): LocalWhisperBackendProbeResult {
  return Object.freeze({ success: false, code });
}

function versionAtLeast(actual: readonly [number, number], required: readonly [number, number]): boolean {
  return actual[0] > required[0] || (actual[0] === required[0] && actual[1] >= required[1]);
}

/** Validates the bounded CPU execution prerequisite contract. */
export class LocalWhisperCpuCapabilityAdapter implements LocalWhisperCapabilityAdapter<LocalWhisperCpuProbeInput> {
  public readonly backend = 'cpu' as const;

  public evaluate(input: LocalWhisperCpuProbeInput): LocalWhisperBackendProbeResult {
    if (
      !Number.isSafeInteger(input.logicalProcessorCount) ||
      !Number.isSafeInteger(input.resolvedThreads) ||
      input.logicalProcessorCount <= 0 ||
      input.resolvedThreads <= 0 ||
      input.resolvedThreads > input.logicalProcessorCount ||
      !input.isaSupported
    ) {
      return failure('CPU_FEATURE_MISSING');
    }
    return input.boundedComputePassed ? SUCCESS : failure('BACKEND_INIT_FAILED');
  }
}

/** Validates the app-owned CUDA runtime, device, allocation, and dispatch evidence. */
export class LocalWhisperCudaCapabilityAdapter implements LocalWhisperCapabilityAdapter<LocalWhisperCudaProbeInput> {
  public readonly backend = 'cuda' as const;

  public evaluate(input: LocalWhisperCudaProbeInput): LocalWhisperBackendProbeResult {
    if (!input.physicalNvidiaDevice) return failure('DEVICE_NOT_FOUND');
    if (!input.driverCompatible) return failure('DRIVER_INCOMPATIBLE');
    if (!input.computeTargetCompiled || !input.dependencyClosureValid) {
      return failure('RUNTIME_PREREQUISITE_MISSING');
    }
    if (!input.allocationPassed) return failure('ALLOCATION_FAILED');
    return input.dispatchPassed ? SUCCESS : failure('BACKEND_INIT_FAILED');
  }
}

/** Validates the hardware AMD Vulkan prerequisite and generated-shader contract. */
export class LocalWhisperVulkanCapabilityAdapter implements LocalWhisperCapabilityAdapter<LocalWhisperVulkanProbeInput> {
  public readonly backend = 'vulkan' as const;

  public evaluate(input: LocalWhisperVulkanProbeInput): LocalWhisperBackendProbeResult {
    if (!input.physicalAmdDevice) return failure('DEVICE_NOT_FOUND');
    const required: readonly [number, number] = [
      Math.max(1, input.generatedShaderTarget[0]),
      input.generatedShaderTarget[0] > 1 ? input.generatedShaderTarget[1] : Math.max(2, input.generatedShaderTarget[1]),
    ];
    if (
      !versionAtLeast(input.apiVersion, required) ||
      !input.storageBuffer16BitAccess ||
      !input.requiredExtensionsPresent
    ) {
      return failure('DEVICE_FEATURE_MISSING');
    }
    if (!input.allocationPassed) return failure('ALLOCATION_FAILED');
    return input.dispatchPassed ? SUCCESS : failure('BACKEND_INIT_FAILED');
  }
}

/** Validates one immutable approved Linux HIP environment row. */
export class LocalWhisperHipCapabilityAdapter implements LocalWhisperCapabilityAdapter<LocalWhisperHipProbeInput> {
  public readonly backend = 'hip' as const;

  public evaluate(input: LocalWhisperHipProbeInput): LocalWhisperBackendProbeResult {
    if (
      !input.approvedRow ||
      !input.exactOsKernelDriverMatch ||
      !input.exactRuntimeClosureMatch ||
      !input.exactPciAndGfxMatch ||
      !input.pcieAtomicsSatisfied
    ) {
      return failure('DEVICE_NOT_ALLOWLISTED');
    }
    if (!input.permissionsSatisfied) return failure('GPU_PERMISSION_DENIED');
    if (!input.allocationPassed) return failure('ALLOCATION_FAILED');
    return input.dispatchPassed ? SUCCESS : failure('BACKEND_INIT_FAILED');
  }
}

/** Keeps the future Apple Metal route explicit and unavailable in this release. */
export class LocalWhisperMetalCapabilityAdapter implements LocalWhisperCapabilityAdapter<LocalWhisperMetalProbeInput> {
  public readonly backend = 'metal' as const;

  public evaluate(): LocalWhisperBackendProbeResult {
    return failure('PLANNED_UNAVAILABLE');
  }
}

export type LocalWhisperCapabilityAdapterSet = Readonly<
  Record<LocalWhisperBackend, LocalWhisperCapabilityAdapter<LocalWhisperBackendProbeInput>>
>;

export function createLocalWhisperCapabilityAdapterSet(): LocalWhisperCapabilityAdapterSet {
  return Object.freeze({
    cpu: new LocalWhisperCpuCapabilityAdapter(),
    cuda: new LocalWhisperCudaCapabilityAdapter(),
    vulkan: new LocalWhisperVulkanCapabilityAdapter(),
    hip: new LocalWhisperHipCapabilityAdapter(),
    metal: new LocalWhisperMetalCapabilityAdapter(),
  });
}
