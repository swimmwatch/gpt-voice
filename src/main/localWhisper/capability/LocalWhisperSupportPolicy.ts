import type {
  LocalWhisperBackend,
  LocalWhisperFailureCode,
  LocalWhisperGpuVendor,
  LocalWhisperPlatform,
  LocalWhisperSupportTier,
  LocalWhisperTarget,
} from '@shared/localWhisper';

export interface LocalWhisperSupportRequest {
  readonly platform: LocalWhisperPlatform;
  readonly architecture: 'x64' | 'arm64' | 'other';
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend | null;
  readonly vendor: LocalWhisperGpuVendor | 'cpu' | null;
  readonly hipApproved: boolean;
}

export interface LocalWhisperSupportDecision {
  readonly tier: LocalWhisperSupportTier;
  readonly available: boolean;
  readonly conditionalProductionGate: boolean;
  readonly failureCode: LocalWhisperFailureCode | null;
}

function decision(
  tier: LocalWhisperSupportTier,
  available: boolean,
  conditionalProductionGate: boolean,
  failureCode: LocalWhisperFailureCode | null,
): LocalWhisperSupportDecision {
  return Object.freeze({ tier, available, conditionalProductionGate, failureCode });
}

const UNSUPPORTED_PLATFORM = decision('Unsupported', false, false, 'UNSUPPORTED_PLATFORM');
const UNSUPPORTED_ARCHITECTURE = decision('Unsupported', false, false, 'UNSUPPORTED_ARCHITECTURE');
const UNSUPPORTED_TARGET = decision('Unsupported', false, false, 'TARGET_UNSUPPORTED');
const UNSUPPORTED_BACKEND = decision('Unsupported', false, false, 'BACKEND_UNSUPPORTED');
const PLANNED_METAL = decision('Planned', false, false, 'PLANNED_UNAVAILABLE');
const PRODUCTION_CANDIDATE = decision('Production', true, true, null);
const PREVIEW = decision('Preview', true, false, null);
const HIP_NOT_APPROVED = decision('Preview', false, false, 'DEVICE_NOT_ALLOWLISTED');

/** Immutable release-claim matrix. Probe results cannot promote its support tier. */
export class LocalWhisperSupportPolicy {
  public evaluate(request: LocalWhisperSupportRequest): LocalWhisperSupportDecision {
    if (request.platform === 'other') return UNSUPPORTED_PLATFORM;
    if (request.platform === 'darwin') {
      if (
        request.architecture === 'arm64' &&
        request.target === 'gpu' &&
        request.backend === 'metal' &&
        request.vendor === 'apple'
      ) {
        return PLANNED_METAL;
      }
      return request.architecture === 'arm64' ? UNSUPPORTED_TARGET : UNSUPPORTED_ARCHITECTURE;
    }
    if (request.architecture !== 'x64') return UNSUPPORTED_ARCHITECTURE;
    if (request.platform !== 'linux' && request.platform !== 'win32') return UNSUPPORTED_PLATFORM;

    if (request.target === 'cpu') {
      return request.backend === 'cpu' && request.vendor === 'cpu' ? PRODUCTION_CANDIDATE : UNSUPPORTED_BACKEND;
    }
    if (request.backend === null) return UNSUPPORTED_BACKEND;
    if (request.vendor === 'nvidia' && request.backend === 'cuda') return PRODUCTION_CANDIDATE;
    if (request.vendor !== 'amd') return UNSUPPORTED_BACKEND;
    if (request.backend === 'vulkan') return PREVIEW;
    if (request.platform === 'linux' && request.backend === 'hip') {
      return request.hipApproved ? PREVIEW : HIP_NOT_APPROVED;
    }
    return UNSUPPORTED_BACKEND;
  }
}
