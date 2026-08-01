import type { ProviderAuditPhase } from '@main/providerAudit';
import type { LocalWhisperVoiceProvider } from '@main/providers/LocalWhisperVoiceProvider';
import type { TranscriptionResult } from '@main/providers/BaseVoiceProvider';
import type {
  VoiceAuditMetadata,
  VoiceBatchAuditContext,
  VoiceProviderAudit,
} from '@main/providers/voiceProviderAudit';
import { createLocalWhisperRendererSafeFailure, type LocalWhisperRendererSafeFailure } from '@shared/localWhisper';
import {
  completeBatchTranscription,
  completeCachedTranscription,
  createTranscriptionCompletionSnapshot,
  readCachedTranscription,
  type TranscriptionCompletionDependencies,
} from './transcriptionCompletion';
import { validateLocalWhisperCanonicalWav } from './localWhisperWavValidator';

export interface LocalWhisperTranscriptionDispatchDependencies extends TranscriptionCompletionDependencies {
  readonly audit: VoiceProviderAudit;
}

function toFailureResult(failure: LocalWhisperRendererSafeFailure): TranscriptionResult {
  return { success: false, error: failure.code, failure };
}

function toAuditCauseCode(failure: LocalWhisperRendererSafeFailure): NonNullable<VoiceAuditMetadata['causeCode']> {
  switch (failure.code) {
    case 'AUDIO_FORMAT_UNSUPPORTED':
      return 'invalid-audio';
    case 'INVALID_SETTINGS':
    case 'SETTINGS_VERSION_UNSUPPORTED':
      return 'invalid-settings';
    case 'OPERATION_CONFLICT':
    case 'STALE_CONFIGURATION':
      return 'operation-conflict';
    case 'CANCELLED':
    case 'DOWNLOAD_CANCELLED':
      return 'cancelled';
    default:
      return 'unexpected-failure';
  }
}

function terminalFailure(
  audit: VoiceProviderAudit,
  context: VoiceBatchAuditContext,
  phase: ProviderAuditPhase,
  failure: LocalWhisperRendererSafeFailure,
): void {
  audit.terminalBatch(context, phase, failure.code === 'CANCELLED' ? 'cancelled' : 'failure', {
    causeCode: toAuditCauseCode(failure),
  });
}

/** Owns the Local Whisper-only validation, eligibility-before-cache, and completion ordering. */
export class LocalWhisperTranscriptionDispatch {
  public constructor(private readonly dependencies: LocalWhisperTranscriptionDispatchDependencies) {}

  public async transcribe(
    provider: LocalWhisperVoiceProvider,
    buffer: ArrayBuffer,
    mimeType: string,
    requestedAt: string,
  ): Promise<TranscriptionResult> {
    const wav = validateLocalWhisperCanonicalWav(buffer);
    if (!wav.valid) {
      const failure = createLocalWhisperRendererSafeFailure('AUDIO_FORMAT_UNSUPPORTED');
      const auditContext = this.dependencies.audit.startBatch(provider.info.id, buffer, mimeType);
      terminalFailure(this.dependencies.audit, auditContext, 'validation', failure);
      return toFailureResult(failure);
    }

    const auditContext = this.dependencies.audit.startBatch(provider.info.id, buffer, mimeType);
    try {
      const dispatch = provider.captureDispatchSnapshot();
      if (!dispatch.readiness.snapshot.canAttempt) {
        const failure = dispatch.readiness.failure ?? createLocalWhisperRendererSafeFailure('INVALID_SETTINGS');
        terminalFailure(this.dependencies.audit, auditContext, 'readiness', failure);
        return toFailureResult(failure);
      }

      const eligibility = await provider.checkEligibility({ dispatch, audio: wav.audio });
      if (!eligibility.success) {
        terminalFailure(this.dependencies.audit, auditContext, 'readiness', eligibility.error);
        return toFailureResult(eligibility.error);
      }

      const completion = createTranscriptionCompletionSnapshot(provider, requestedAt, dispatch.cacheContext);
      const cachedText = readCachedTranscription(this.dependencies, completion, buffer, mimeType);
      if (cachedText) {
        const result = completeCachedTranscription(this.dependencies, completion, cachedText);
        this.dependencies.audit.terminalBatch(auditContext, 'result', 'success', {
          resultLength: cachedText.length,
        });
        return result;
      }

      const transcription = await provider.transcribeCaptured({ dispatch, buffer, mimeType });
      if (!transcription.success) {
        terminalFailure(this.dependencies.audit, auditContext, 'result', transcription.error);
        return toFailureResult(transcription.error);
      }
      if (!transcription.value.trim()) {
        const failure = createLocalWhisperRendererSafeFailure('EMPTY_TRANSCRIPTION');
        terminalFailure(this.dependencies.audit, auditContext, 'result', failure);
        return toFailureResult(failure);
      }

      completeBatchTranscription(this.dependencies, completion, buffer, mimeType, transcription.value, {
        writeClipboard: true,
      });
      this.dependencies.audit.terminalBatch(auditContext, 'result', 'success', {
        resultLength: transcription.value.length,
      });
      return { success: true, text: transcription.value };
    } catch {
      const failure = createLocalWhisperRendererSafeFailure('TRANSCRIPTION_FAILED');
      terminalFailure(this.dependencies.audit, auditContext, 'result', failure);
      this.dependencies.logger.warn('Local Whisper transcription failed:', {
        causeCode: failure.code,
        providerId: provider.info.id,
      });
      return toFailureResult(failure);
    }
  }
}
