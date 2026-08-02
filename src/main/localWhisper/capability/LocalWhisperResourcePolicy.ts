import {
  getLocalWhisperMemoryConfigurationKey,
  type LocalWhisperFailureCode,
  type LocalWhisperMemoryConfigurationIdentity,
  type LocalWhisperMemoryEstimateRecord,
} from '@shared/localWhisper';

export const LOCAL_WHISPER_RESOURCE_HEADROOM_PERCENT = 20;
export const LOCAL_WHISPER_MINIMUM_RESOURCE_HEADROOM_BYTES = 512 * 1024 * 1024;

export interface LocalWhisperQualifiedResourcePeak {
  readonly configuration: LocalWhisperMemoryConfigurationIdentity;
  readonly measuredPeakRamBytes: number;
  readonly measuredPeakVramBytes: number | 'notApplicable';
}

export interface LocalWhisperResourceAvailability {
  readonly freeRamBytes: number | null;
  readonly freeVramBytes: number | null;
}

export interface LocalWhisperResourceDecision {
  readonly success: boolean;
  readonly failureCode: Extract<LocalWhisperFailureCode, 'INSUFFICIENT_RAM' | 'INSUFFICIENT_VRAM'> | null;
  readonly evidence: 'catalog' | 'qualified';
  readonly requiredRamBytes: number;
  readonly requiredVramBytes: number | 'notApplicable';
  readonly freeRamBytes: number | null;
  readonly freeVramBytes: number | null;
}

export interface LocalWhisperResourcePolicyInput {
  readonly configuration: LocalWhisperMemoryConfigurationIdentity;
  readonly estimate: LocalWhisperMemoryEstimateRecord;
  readonly qualifiedPeak: LocalWhisperQualifiedResourcePeak | null;
  readonly availability: LocalWhisperResourceAvailability;
}

function checkedRequiredBytes(peak: number): number {
  if (!Number.isSafeInteger(peak) || peak < 0) throw new Error('Invalid Local Whisper resource peak');
  const percentageHeadroom = Math.ceil((peak * LOCAL_WHISPER_RESOURCE_HEADROOM_PERCENT) / 100);
  const headroom = Math.max(percentageHeadroom, LOCAL_WHISPER_MINIMUM_RESOURCE_HEADROOM_BYTES);
  const required = peak + headroom;
  if (!Number.isSafeInteger(required)) throw new Error('Local Whisper resource requirement overflow');
  return required;
}

function validAvailability(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

/** Applies exact selected-configuration peaks and fail-closed known-deficit checks. */
export class LocalWhisperResourcePolicy {
  public evaluate(input: LocalWhisperResourcePolicyInput): LocalWhisperResourceDecision {
    const expectedKey = getLocalWhisperMemoryConfigurationKey(input.configuration);
    if (getLocalWhisperMemoryConfigurationKey(input.estimate) !== expectedKey) {
      throw new Error('Local Whisper catalog estimate does not match selected configuration');
    }
    if (!validAvailability(input.availability.freeRamBytes) || !validAvailability(input.availability.freeVramBytes)) {
      throw new Error('Invalid Local Whisper resource availability');
    }

    const qualified = input.qualifiedPeak;
    if (qualified && getLocalWhisperMemoryConfigurationKey(qualified.configuration) !== expectedKey) {
      throw new Error('Local Whisper qualified peak does not match selected configuration');
    }
    const evidence = qualified ? 'qualified' : 'catalog';
    const ramPeak = qualified?.measuredPeakRamBytes ?? input.estimate.estimatedPeakRamBytes;
    const vramPeak = qualified?.measuredPeakVramBytes ?? input.estimate.estimatedPeakVramBytes;
    const requiredRamBytes = checkedRequiredBytes(ramPeak);
    const requiredVramBytes = vramPeak === 'notApplicable' ? vramPeak : checkedRequiredBytes(vramPeak);
    const insufficientRam =
      input.availability.freeRamBytes !== null && input.availability.freeRamBytes < requiredRamBytes;
    const insufficientVram =
      requiredVramBytes !== 'notApplicable' &&
      input.availability.freeVramBytes !== null &&
      input.availability.freeVramBytes < requiredVramBytes;
    const failureCode = insufficientRam ? 'INSUFFICIENT_RAM' : insufficientVram ? 'INSUFFICIENT_VRAM' : null;
    return Object.freeze({
      success: failureCode === null,
      failureCode,
      evidence,
      requiredRamBytes,
      requiredVramBytes,
      freeRamBytes: input.availability.freeRamBytes,
      freeVramBytes: input.availability.freeVramBytes,
    });
  }
}
