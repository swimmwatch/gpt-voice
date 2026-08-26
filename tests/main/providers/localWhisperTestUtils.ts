import type {
  LocalWhisperCoordinatorPort,
  LocalWhisperCoordinatorTranscriptionRequest,
  LocalWhisperDispatchSnapshot,
  LocalWhisperEligibilityRequest,
  LocalWhisperProviderReadiness,
} from '@main/providers/LocalWhisperVoiceProvider';
import {
  createLocalWhisperActionSuccess,
  type LocalWhisperActionResult,
  type LocalWhisperRuntimeSnapshot,
} from '@shared/localWhisper';

export const READY_LOCAL_WHISPER_SNAPSHOT: LocalWhisperRuntimeSnapshot = Object.freeze({
  supportTier: 'Production',
  runtimeSetup: 'Installed',
  modelSetup: 'Installed',
  capability: 'Validated',
  residency: 'Loaded',
  activity: 'Idle',
  operationalStatus: 'Ready',
  canAttempt: true,
  blockingCode: null,
});

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
}

export function createCanonicalLocalWhisperWav(sampleByteLength = 4): ArrayBuffer {
  const byteLength = 44 + sampleByteLength;
  const buffer = new ArrayBuffer(byteLength);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, byteLength - 8, true);
  writeAscii(bytes, 8, 'WAVE');
  writeAscii(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, 'data');
  view.setUint32(40, sampleByteLength, true);
  return buffer;
}

/** Mutable fake owned by one test graph; records coordinator boundary ordering. */
export class RecordingLocalWhisperCoordinator implements LocalWhisperCoordinatorPort {
  public readonly calls: string[] = [];
  public cacheContext: readonly string[] = Object.freeze(['engine', 'whisperCpp', 'private-context-v1']);
  public readiness: LocalWhisperProviderReadiness = Object.freeze({
    snapshot: READY_LOCAL_WHISPER_SNAPSHOT,
    failure: null,
  });
  public eligibilityResult: LocalWhisperActionResult<undefined> = createLocalWhisperActionSuccess(
    'checkCompatibility',
    READY_LOCAL_WHISPER_SNAPSHOT,
    undefined,
  );
  public transcriptionResult: LocalWhisperActionResult<string> = createLocalWhisperActionSuccess(
    'transcribe',
    READY_LOCAL_WHISPER_SNAPSHOT,
    'local transcript',
  );
  public switchResult: LocalWhisperActionResult<undefined> = createLocalWhisperActionSuccess(
    'shutdown',
    READY_LOCAL_WHISPER_SNAPSHOT,
    undefined,
  );
  public lastEligibilityRequest: LocalWhisperEligibilityRequest | null = null;
  public lastTranscriptionRequest: LocalWhisperCoordinatorTranscriptionRequest | null = null;

  public constructor(private readonly events?: string[]) {}

  private record(event: string): void {
    this.calls.push(event);
    this.events?.push(event);
  }

  public getReadinessSnapshot(): LocalWhisperProviderReadiness {
    this.record('readiness');
    return this.readiness;
  }

  public captureDispatchSnapshot(): LocalWhisperDispatchSnapshot {
    this.record('capture');
    return Object.freeze({
      epochs: Object.freeze({ provider: 1, configuration: 2, inventory: 3 }),
      readiness: this.readiness,
      cacheContext: Object.freeze([...this.cacheContext]),
    });
  }

  public checkEligibility(request: LocalWhisperEligibilityRequest): Promise<LocalWhisperActionResult<undefined>> {
    this.record('eligibility');
    this.lastEligibilityRequest = request;
    return Promise.resolve(this.eligibilityResult);
  }

  public transcribe(request: LocalWhisperCoordinatorTranscriptionRequest): Promise<LocalWhisperActionResult<string>> {
    this.record('transcribe');
    this.lastTranscriptionRequest = request;
    return Promise.resolve(this.transcriptionResult);
  }

  public prepareProviderSwitch(): Promise<LocalWhisperActionResult<undefined>> {
    this.record('switch');
    return Promise.resolve(this.switchResult);
  }

  public cancel(): Promise<LocalWhisperActionResult<undefined>> {
    this.record('cancel');
    return Promise.resolve(createLocalWhisperActionSuccess('cancel', this.readiness.snapshot, undefined));
  }

  public shutdown(): Promise<LocalWhisperActionResult<undefined>> {
    this.record('shutdown');
    return Promise.resolve(createLocalWhisperActionSuccess('shutdown', this.readiness.snapshot, undefined));
  }
}
