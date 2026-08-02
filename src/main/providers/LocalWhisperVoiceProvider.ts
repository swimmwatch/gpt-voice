/* eslint-disable max-classes-per-file -- the provider, its typed operation error, and safe placeholder share one port contract. */
import {
  createLocalWhisperActionFailure,
  createLocalWhisperActionSuccess,
  createLocalWhisperRendererSafeFailure,
  LOCAL_WHISPER_PROVIDER_ID,
  type LocalWhisperActionId,
  type LocalWhisperActionResult,
  type LocalWhisperRendererSafeFailure,
  type LocalWhisperRuntimeSnapshot,
} from '@shared/localWhisper';
import { BatchVoiceProvider } from './BatchVoiceProvider';
import type {
  LocalWhisperCoordinatorPort,
  LocalWhisperCoordinatorTranscriptionRequest,
  LocalWhisperDispatchSnapshot,
  LocalWhisperEligibilityRequest,
  LocalWhisperProviderReadiness,
} from '../localWhisper/coordinator/LocalWhisperCoordinatorTypes';
import type { TranscriptionResult, VoiceProviderInfo } from './BaseVoiceProvider';

export type {
  LocalWhisperCanonicalAudioDescriptor,
  LocalWhisperCoordinatorPort,
  LocalWhisperCoordinatorTranscriptionRequest,
  LocalWhisperDispatchEpochs,
  LocalWhisperDispatchSnapshot,
  LocalWhisperEligibilityRequest,
  LocalWhisperProviderReadiness,
} from '../localWhisper/coordinator/LocalWhisperCoordinatorTypes';

export const LOCAL_WHISPER_RENDERER_PROVIDER_INFO = Object.freeze({
  id: LOCAL_WHISPER_PROVIDER_ID,
  name: 'Local Whisper',
  authType: 'localRuntime',
  category: 'local',
  hasSettings: true,
  transcriptionMode: 'batch',
} as const satisfies VoiceProviderInfo);

/** Carries one renderer-safe Local Whisper failure without native exception detail. */
export class LocalWhisperProviderOperationError extends Error {
  public readonly failure: LocalWhisperRendererSafeFailure;

  public constructor(failure: LocalWhisperRendererSafeFailure) {
    super(failure.code);
    this.name = 'LocalWhisperProviderOperationError';
    this.failure = failure;
  }
}

function toTranscriptionResult(result: LocalWhisperActionResult<string>): TranscriptionResult {
  if (result.success) return { success: true, text: result.value };
  return { success: false, error: result.error.code, failure: result.error };
}

/** Buffered provider facade; all mutable local-runtime work remains owned by its injected coordinator. */
export class LocalWhisperVoiceProvider extends BatchVoiceProvider {
  public readonly info = LOCAL_WHISPER_RENDERER_PROVIDER_INFO;

  public constructor(private readonly coordinator: LocalWhisperCoordinatorPort) {
    super();
  }

  public getLocalRuntimeReadiness(): LocalWhisperProviderReadiness {
    return this.coordinator.getReadinessSnapshot();
  }

  public captureDispatchSnapshot(): LocalWhisperDispatchSnapshot {
    return this.coordinator.captureDispatchSnapshot();
  }

  public checkEligibility(request: LocalWhisperEligibilityRequest): Promise<LocalWhisperActionResult<undefined>> {
    return this.coordinator.checkEligibility(request);
  }

  public transcribeCaptured(
    request: LocalWhisperCoordinatorTranscriptionRequest,
  ): Promise<LocalWhisperActionResult<string>> {
    return this.coordinator.transcribe(request);
  }

  public prepareProviderSwitch(nextProviderId: string): Promise<LocalWhisperActionResult<undefined>> {
    return this.coordinator.prepareProviderSwitch(nextProviderId);
  }

  public override getTranscriptionCacheContext(): readonly string[] {
    return this.captureDispatchSnapshot().cacheContext;
  }

  public override isReady(): boolean {
    const status = this.getLocalRuntimeReadiness().snapshot.operationalStatus;
    return status === 'Ready' || status === 'Busy';
  }

  public override async transcribe(buffer: ArrayBuffer, mimeType = ''): Promise<TranscriptionResult> {
    return toTranscriptionResult(
      await this.coordinator.transcribe({
        dispatch: this.captureDispatchSnapshot(),
        buffer,
        mimeType,
      }),
    );
  }

  public override async cancel(): Promise<void> {
    const result = await this.coordinator.cancel();
    if (!result.success) throw new LocalWhisperProviderOperationError(result.error);
  }

  public override async shutdown(): Promise<void> {
    const result = await this.coordinator.shutdown();
    if (!result.success) throw new LocalWhisperProviderOperationError(result.error);
    await super.shutdown();
  }
}

const UNAVAILABLE_LOCAL_WHISPER_SNAPSHOT: LocalWhisperRuntimeSnapshot = Object.freeze({
  supportTier: 'Unsupported',
  runtimeSetup: 'Missing',
  modelSetup: 'Missing',
  capability: 'Unchecked',
  residency: 'Unloaded',
  activity: 'Idle',
  operationalStatus: 'NotReady',
  canAttempt: false,
  blockingCode: 'INVALID_SETTINGS',
});

const UNAVAILABLE_LOCAL_WHISPER_READINESS: LocalWhisperProviderReadiness = Object.freeze({
  snapshot: UNAVAILABLE_LOCAL_WHISPER_SNAPSHOT,
  failure: createLocalWhisperRendererSafeFailure('INVALID_SETTINGS'),
});

function unavailableActionFailure<T>(action: LocalWhisperActionId): Promise<LocalWhisperActionResult<T>> {
  return Promise.resolve(
    createLocalWhisperActionFailure(action, 'INVALID_SETTINGS', UNAVAILABLE_LOCAL_WHISPER_SNAPSHOT),
  );
}

/** Safe composition-root placeholder until Task 15 wires the process-owned coordinator. */
export class UnavailableLocalWhisperCoordinatorPort implements LocalWhisperCoordinatorPort {
  public getReadinessSnapshot(): LocalWhisperProviderReadiness {
    return UNAVAILABLE_LOCAL_WHISPER_READINESS;
  }

  public captureDispatchSnapshot(): LocalWhisperDispatchSnapshot {
    return Object.freeze({
      epochs: Object.freeze({ provider: 0, configuration: 0, inventory: 0 }),
      readiness: UNAVAILABLE_LOCAL_WHISPER_READINESS,
      cacheContext: Object.freeze(['unconfigured']),
    });
  }

  public checkEligibility(): Promise<LocalWhisperActionResult<undefined>> {
    return unavailableActionFailure<undefined>('transcribe');
  }

  public transcribe(): Promise<LocalWhisperActionResult<string>> {
    return unavailableActionFailure<string>('transcribe');
  }

  public prepareProviderSwitch(): Promise<LocalWhisperActionResult<undefined>> {
    return Promise.resolve(
      createLocalWhisperActionSuccess('providerSwitch', UNAVAILABLE_LOCAL_WHISPER_SNAPSHOT, undefined),
    );
  }

  public cancel(): Promise<LocalWhisperActionResult<undefined>> {
    return Promise.resolve(createLocalWhisperActionSuccess('cancel', UNAVAILABLE_LOCAL_WHISPER_SNAPSHOT, undefined));
  }

  public shutdown(): Promise<LocalWhisperActionResult<undefined>> {
    return Promise.resolve(createLocalWhisperActionSuccess('shutdown', UNAVAILABLE_LOCAL_WHISPER_SNAPSHOT, undefined));
  }
}
