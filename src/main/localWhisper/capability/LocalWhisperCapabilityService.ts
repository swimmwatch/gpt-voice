import type {
  LocalWhisperArtifactSetupState,
  LocalWhisperFailureCode,
  LocalWhisperMemoryConfigurationIdentity,
  LocalWhisperMemoryEstimateRecord,
  LocalWhisperOpaqueDeviceId,
  LocalWhisperPlatform,
  LocalWhisperPublicSettings,
  LocalWhisperSupportTier,
} from '@shared/localWhisper';

import {
  createLocalWhisperCapabilityAdapterSet,
  type LocalWhisperBackendProbeInput,
  type LocalWhisperCapabilityAdapterSet,
} from './LocalWhisperCapabilityAdapters';
import {
  LocalWhisperResourcePolicy,
  type LocalWhisperQualifiedResourcePeak,
  type LocalWhisperResourceAvailability,
  type LocalWhisperResourceDecision,
} from './LocalWhisperResourcePolicy';
import { LocalWhisperSupportPolicy } from './LocalWhisperSupportPolicy';

export interface LocalWhisperCapabilityDevice {
  readonly id: LocalWhisperOpaqueDeviceId;
  readonly vendor: 'nvidia' | 'amd' | 'apple';
  readonly available: boolean;
}

export interface LocalWhisperCapabilityPreflightRequest {
  readonly settings: LocalWhisperPublicSettings;
  readonly platform: LocalWhisperPlatform;
  readonly architecture: 'x64' | 'arm64' | 'other';
  readonly runtimeSetup: LocalWhisperArtifactSetupState;
  readonly modelSetup: LocalWhisperArtifactSetupState;
  readonly device: LocalWhisperCapabilityDevice | null;
  readonly hipApproved: boolean;
  readonly backendProbe: LocalWhisperBackendProbeInput;
  readonly configuration: LocalWhisperMemoryConfigurationIdentity;
  readonly estimate: LocalWhisperMemoryEstimateRecord;
  readonly qualifiedPeak: LocalWhisperQualifiedResourcePeak | null;
  readonly availability: LocalWhisperResourceAvailability;
  readonly capabilityFingerprint: string;
}

export interface LocalWhisperCapabilityAssessment {
  readonly supportTier: LocalWhisperSupportTier;
  readonly runtimeSetup: LocalWhisperArtifactSetupState;
  readonly modelSetup: LocalWhisperArtifactSetupState;
  readonly selectedDeviceId: LocalWhisperOpaqueDeviceId | null;
  readonly capabilityFingerprint: string;
  readonly resources: LocalWhisperResourceDecision;
}

export type LocalWhisperCapabilityPreflightResult =
  | { readonly success: true; readonly assessment: LocalWhisperCapabilityAssessment }
  | {
      readonly success: false;
      readonly supportTier: LocalWhisperSupportTier;
      readonly runtimeSetup: LocalWhisperArtifactSetupState;
      readonly modelSetup: LocalWhisperArtifactSetupState;
      readonly code: LocalWhisperFailureCode;
      readonly resources: LocalWhisperResourceDecision | null;
    };

function artifactFailure(
  kind: 'runtime' | 'model',
  state: LocalWhisperArtifactSetupState,
): LocalWhisperFailureCode | null {
  if (state === 'Installed') return null;
  if (state === 'Blocked') return kind === 'runtime' ? 'RUNTIME_BLOCKED' : 'MODEL_BLOCKED';
  if (state === 'Corrupt') return kind === 'runtime' ? 'RUNTIME_CORRUPT' : 'MODEL_CORRUPT';
  if (state === 'Failed') return kind === 'runtime' ? 'RUNTIME_INCOMPATIBLE' : 'MODEL_INCOMPATIBLE';
  if (state === 'Missing') return kind === 'runtime' ? 'RUNTIME_MISSING' : 'MODEL_MISSING';
  return 'OPERATION_CONFLICT';
}

function failed(
  request: LocalWhisperCapabilityPreflightRequest,
  supportTier: LocalWhisperSupportTier,
  code: LocalWhisperFailureCode,
  resources: LocalWhisperResourceDecision | null = null,
): LocalWhisperCapabilityPreflightResult {
  return Object.freeze({
    success: false,
    supportTier,
    runtimeSetup: request.runtimeSetup,
    modelSetup: request.modelSetup,
    code,
    resources,
  });
}

function expectedVendor(request: LocalWhisperCapabilityPreflightRequest): 'nvidia' | 'amd' | 'apple' | 'cpu' | null {
  const { execution } = request.settings;
  if (execution.target === 'cpu') return 'cpu';
  if (execution.backend === 'cuda') return 'nvidia';
  if (execution.backend === 'vulkan' || execution.backend === 'hip') return 'amd';
  if (execution.backend === 'metal') return 'apple';
  return null;
}

/** Combines immutable support claims, installed evidence, backend prerequisites, and exact resource policy. */
export class LocalWhisperCapabilityService {
  public constructor(
    private readonly supportPolicy = new LocalWhisperSupportPolicy(),
    private readonly resourcePolicy = new LocalWhisperResourcePolicy(),
    private readonly adapters: LocalWhisperCapabilityAdapterSet = createLocalWhisperCapabilityAdapterSet(),
  ) {}

  public preflight(request: LocalWhisperCapabilityPreflightRequest): LocalWhisperCapabilityPreflightResult {
    const execution = request.settings.execution;
    const vendor = execution.target === 'cpu' ? 'cpu' : (request.device?.vendor ?? expectedVendor(request));
    const support = this.supportPolicy.evaluate({
      platform: request.platform,
      architecture: request.architecture,
      target: execution.target,
      backend: execution.backend,
      vendor,
      hipApproved: request.hipApproved,
    });
    if (!support.available) {
      return failed(request, support.tier, support.failureCode ?? 'BACKEND_UNSUPPORTED');
    }
    const runtimeFailure = artifactFailure('runtime', request.runtimeSetup);
    if (runtimeFailure) return failed(request, support.tier, runtimeFailure);
    if (
      execution.target === 'gpu' &&
      (!request.device || !request.device.available || request.device.id !== execution.deviceId)
    ) {
      return failed(request, support.tier, 'DEVICE_NOT_FOUND');
    }
    if (execution.backend === null || execution.backend !== request.backendProbe.backend) {
      return failed(request, support.tier, 'BACKEND_UNSUPPORTED');
    }
    const backendResult = this.adapters[execution.backend].evaluate(request.backendProbe);
    if (!backendResult.success) return failed(request, support.tier, backendResult.code);
    const modelFailure = artifactFailure('model', request.modelSetup);
    if (modelFailure) return failed(request, support.tier, modelFailure);

    let resources: LocalWhisperResourceDecision;
    try {
      resources = this.resourcePolicy.evaluate({
        configuration: request.configuration,
        estimate: request.estimate,
        qualifiedPeak: request.qualifiedPeak,
        availability: request.availability,
      });
    } catch {
      return failed(request, support.tier, 'MODEL_INCOMPATIBLE');
    }
    if (!resources.success && resources.failureCode) {
      return failed(request, support.tier, resources.failureCode, resources);
    }
    if (!/^[a-f0-9]{64}$/u.test(request.capabilityFingerprint)) {
      return failed(request, support.tier, 'DEVICE_PROOF_FAILED', resources);
    }
    return Object.freeze({
      success: true,
      assessment: Object.freeze({
        supportTier: support.tier,
        runtimeSetup: request.runtimeSetup,
        modelSetup: request.modelSetup,
        selectedDeviceId: execution.target === 'gpu' ? (request.device?.id ?? null) : null,
        capabilityFingerprint: request.capabilityFingerprint,
        resources,
      }),
    });
  }
}
