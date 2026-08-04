import type {
  LocalWhisperActionResult,
  LocalWhisperArtifactId,
  LocalWhisperArtifactSetupState,
  LocalWhisperCapabilityState,
  LocalWhisperCapabilityStaleCause,
  LocalWhisperFailureCode,
  LocalWhisperOpaqueDeviceId,
  LocalWhisperPromptMutation,
  LocalWhisperPublicSettings,
  LocalWhisperRendererSafeFailure,
  LocalWhisperRuntimeSnapshot,
  LocalWhisperSettings,
  LocalWhisperSupportTier,
} from '@shared/localWhisper';

import type {
  LocalWhisperCapabilityAssessment,
  LocalWhisperCapabilityPreflightResult,
} from '../capability/LocalWhisperCapabilityService';
import type { LocalWhisperResourceDecision } from '../capability/LocalWhisperResourcePolicy';

export interface LocalWhisperDispatchEpochs {
  readonly provider: number;
  readonly configuration: number;
  readonly inventory: number;
}

export interface LocalWhisperCoordinatorEpochs extends LocalWhisperDispatchEpochs {
  readonly topology: number;
  readonly capability: number;
  readonly worker: number;
}

export interface LocalWhisperProviderReadiness {
  readonly snapshot: LocalWhisperRuntimeSnapshot;
  readonly failure: LocalWhisperRendererSafeFailure | null;
}

export interface LocalWhisperDispatchSnapshot {
  readonly epochs: LocalWhisperDispatchEpochs;
  readonly readiness: LocalWhisperProviderReadiness;
  readonly cacheContext: readonly string[];
}

export interface LocalWhisperCanonicalAudioDescriptor {
  readonly byteLength: number;
  readonly dataOffset: number;
  readonly dataByteLength: number;
  readonly sampleRate: 16_000;
  readonly channelCount: 1;
  readonly bitsPerSample: 16;
}

export interface LocalWhisperEligibilityRequest {
  readonly dispatch: LocalWhisperDispatchSnapshot;
  readonly audio: LocalWhisperCanonicalAudioDescriptor;
}

export interface LocalWhisperCoordinatorTranscriptionRequest {
  readonly dispatch: LocalWhisperDispatchSnapshot;
  readonly buffer: ArrayBuffer;
  readonly mimeType: string;
}

export interface LocalWhisperCoordinatorPort {
  getReadinessSnapshot(): LocalWhisperProviderReadiness;
  captureDispatchSnapshot(): LocalWhisperDispatchSnapshot;
  checkEligibility(request: LocalWhisperEligibilityRequest): Promise<LocalWhisperActionResult<undefined>>;
  transcribe(request: LocalWhisperCoordinatorTranscriptionRequest): Promise<LocalWhisperActionResult<string>>;
  prepareProviderSwitch(nextProviderId: string): Promise<LocalWhisperActionResult<undefined>>;
  cancel(): Promise<LocalWhisperActionResult<undefined>>;
  shutdown(): Promise<LocalWhisperActionResult<undefined>>;
}

export interface LocalWhisperCoordinatorSnapshot {
  readonly snapshotRevision: number;
  readonly epochs: LocalWhisperCoordinatorEpochs;
  readonly configured: boolean;
  readonly settings: LocalWhisperPublicSettings;
  readonly runtime: LocalWhisperRuntimeSnapshot;
  readonly failure: LocalWhisperRendererSafeFailure | null;
  readonly hasInitialPrompt: boolean;
  readonly selectedDeviceId: LocalWhisperOpaqueDeviceId | null;
  readonly capabilityFingerprint: string | null;
  readonly staleCause: LocalWhisperCapabilityStaleCause | null;
  readonly resources: LocalWhisperResourceDecision | null;
}

export type LocalWhisperCoordinatorSnapshotListener = (snapshot: LocalWhisperCoordinatorSnapshot) => void;

interface LocalWhisperSettingsTransactionEpochs {
  readonly expectedConfigurationEpoch: number;
  readonly expectedInventoryEpoch: number;
}

export type LocalWhisperSettingsTransaction =
  | (LocalWhisperSettingsTransactionEpochs & {
      readonly kind: 'save';
      readonly candidate: LocalWhisperPublicSettings;
      readonly promptMutation: LocalWhisperPromptMutation;
    })
  | (LocalWhisperSettingsTransactionEpochs & { readonly kind: 'reset' });

export interface LocalWhisperCoordinatorSettingsPort {
  validateInitial(candidate: unknown): LocalWhisperSettings | null;
  validate(candidate: unknown): LocalWhisperSettings | null;
  supportTier?(settings: LocalWhisperSettings): LocalWhisperSupportTier;
  defaultSettings(): LocalWhisperSettings;
  save(settings: LocalWhisperSettings): Promise<void>;
  reset(): Promise<void>;
}

export interface LocalWhisperCoordinatorCapabilityRequest {
  readonly settings: LocalWhisperPublicSettings;
  readonly epochs: LocalWhisperCoordinatorEpochs;
  readonly requestId: string;
  readonly signal: AbortSignal;
}

export interface LocalWhisperCoordinatorCapabilityPort {
  preflight(request: LocalWhisperCoordinatorCapabilityRequest): Promise<LocalWhisperCapabilityPreflightResult>;
}

export type LocalWhisperCoordinatorWorkerResult<T = undefined> =
  { readonly success: true; readonly value: T } | { readonly success: false; readonly code: LocalWhisperFailureCode };

export interface LocalWhisperResidentWorkerLease {
  transcribe(request: {
    readonly audio: Uint8Array;
    readonly settings: LocalWhisperSettings;
    readonly settingsEpoch: number;
    readonly requestId: string;
    readonly signal: AbortSignal;
  }): Promise<LocalWhisperCoordinatorWorkerResult<string>>;
  cancel(): Promise<LocalWhisperCoordinatorWorkerResult>;
  revalidate(): Promise<boolean>;
  unload(): Promise<LocalWhisperCoordinatorWorkerResult>;
  terminate(): Promise<boolean>;
  shutdown(): Promise<boolean>;
}

export interface LocalWhisperCoordinatorWorkerPort {
  probeFresh(request: {
    readonly settings: LocalWhisperPublicSettings;
    readonly assessment: LocalWhisperCapabilityAssessment;
    readonly epochs: LocalWhisperCoordinatorEpochs;
    readonly requestId: string;
    readonly signal: AbortSignal;
  }): Promise<LocalWhisperCoordinatorWorkerResult>;
  loadFresh(request: {
    readonly settings: LocalWhisperPublicSettings;
    readonly assessment: LocalWhisperCapabilityAssessment;
    readonly epochs: LocalWhisperCoordinatorEpochs;
    readonly requestId: string;
    readonly signal: AbortSignal;
  }): Promise<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>>;
}

export interface LocalWhisperArtifactRemovalRequest {
  readonly kind: 'runtime' | 'model';
  readonly artifactId: LocalWhisperArtifactId;
  readonly confirmed: boolean;
  readonly expectedConfigurationEpoch: number;
  readonly expectedInventoryEpoch: number;
}

export type LocalWhisperArtifactRemovalResult =
  | {
      readonly success: true;
      readonly inventoryEpoch: number;
      readonly runtimeSetup: LocalWhisperArtifactSetupState;
      readonly modelSetup: LocalWhisperArtifactSetupState;
    }
  | { readonly success: false; readonly code: LocalWhisperFailureCode };

export interface LocalWhisperArtifactRemovalCommand {
  readonly request: LocalWhisperArtifactRemovalRequest;
  readonly settings: LocalWhisperPublicSettings;
  readonly epochs: LocalWhisperCoordinatorEpochs;
  readonly requestId: string;
  readonly signal: AbortSignal;
}

export interface LocalWhisperCoordinatorArtifactPort {
  removeSelected(command: LocalWhisperArtifactRemovalCommand): Promise<LocalWhisperArtifactRemovalResult>;
}

export interface LocalWhisperCoordinatorCachePort {
  context(settings: LocalWhisperSettings, epochs: LocalWhisperCoordinatorEpochs): readonly string[];
}

export interface LocalWhisperCoordinatorInventoryPort {
  selectedSetup(settings: LocalWhisperSettings): {
    readonly inventoryEpoch: number;
    readonly runtimeSetup: LocalWhisperArtifactSetupState;
    readonly modelSetup: LocalWhisperArtifactSetupState;
  };
  subscribe(listener: (inventoryEpoch: number) => void): () => void;
}

export interface LocalWhisperCoordinatorInitialState {
  readonly settings: LocalWhisperSettings;
  readonly configured: boolean;
  readonly inventoryEpoch: number;
  readonly runtimeSetup: LocalWhisperArtifactSetupState;
  readonly modelSetup: LocalWhisperArtifactSetupState;
  readonly capability?: LocalWhisperCapabilityState;
  readonly supportTier?: LocalWhisperSupportTier;
}

export interface LocalWhisperCoordinatorDependencies {
  readonly settings: LocalWhisperCoordinatorSettingsPort;
  readonly capability: LocalWhisperCoordinatorCapabilityPort;
  readonly workers: LocalWhisperCoordinatorWorkerPort;
  readonly artifacts: LocalWhisperCoordinatorArtifactPort;
  readonly cache: LocalWhisperCoordinatorCachePort;
  readonly inventory?: LocalWhisperCoordinatorInventoryPort;
  readonly nextRequestId: () => string;
  readonly initial: LocalWhisperCoordinatorInitialState;
}
