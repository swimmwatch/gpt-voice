import { ensureBackgroundBrowser, getActiveProvider, isBgReady } from '../browser';
import { t } from '../i18n';
import { createLogger } from '../logger';
import type { BaseVoiceProvider, TranscriptionResult } from '../providers/BaseVoiceProvider';
import { isBatchVoiceProvider } from '../providers/voiceProviderGuards';
import {
  voiceProviderAudit,
  type VoiceProviderAudit,
  type VoiceBatchAuditContext,
} from '../providers/voiceProviderAudit';
import {
  completeBatchTranscription,
  completeCachedTranscription,
  createTranscriptionCompletionSnapshot,
  defaultTranscriptionCompletionDependencies,
  readCachedTranscription,
  type TranscriptionCompletionDependencies,
} from './transcriptionCompletion';
import { presentNotificationError } from '@shared/notifications';
import { normalizeProviderAuditExceptionType } from '@main/providerAudit';

const log = createLogger('transcribe');

export interface TranscriptionServiceDependencies extends TranscriptionCompletionDependencies {
  audit?: VoiceProviderAudit;
  ensureBackgroundBrowser: () => Promise<void>;
  getActiveProvider: () => BaseVoiceProvider | null;
  getRequestedAt: () => string;
  isBackgroundReady: () => boolean;
}

export type TranscriptionService = (buffer: ArrayBuffer, mimeType: string) => Promise<TranscriptionResult>;

/** Creates the main-process transcription flow without changing its renderer IPC contract. */
export function createTranscriptionService(deps: TranscriptionServiceDependencies): TranscriptionService {
  const audit = deps.audit ?? voiceProviderAudit;
  return async (buffer, mimeType) => {
    const requestedAt = deps.getRequestedAt();
    let auditContext: VoiceBatchAuditContext | undefined;

    try {
      const providerBeforeEnsure = deps.getActiveProvider();
      if (providerBeforeEnsure) {
        const snapshot = createTranscriptionCompletionSnapshot(providerBeforeEnsure, requestedAt);
        const cachedText = readCachedTranscription(deps, snapshot, buffer, mimeType);
        if (cachedText) {
          return completeCachedTranscription(deps, snapshot, cachedText);
        }
      }

      await deps.ensureBackgroundBrowser();
      const provider = deps.getActiveProvider();
      if (!provider) {
        return { success: false, error: t('error.notLoggedIn') };
      }

      if (provider !== providerBeforeEnsure) {
        const snapshot = createTranscriptionCompletionSnapshot(provider, requestedAt);
        const cachedText = readCachedTranscription(deps, snapshot, buffer, mimeType);
        if (cachedText) {
          return completeCachedTranscription(deps, snapshot, cachedText);
        }
      }

      if (!deps.isBackgroundReady() || !provider.isReady()) {
        return { success: false, error: t('error.notLoggedIn') };
      }

      const batchProvider = isBatchVoiceProvider(provider) ? provider : null;
      if (batchProvider) {
        auditContext = audit.startBatch(provider.info.id, buffer, mimeType);
      }
      const result =
        batchProvider && auditContext
          ? await batchProvider.transcribe(buffer, mimeType, auditContext)
          : await provider.transcribe(buffer, mimeType);
      if (auditContext) {
        audit.terminalBatch(
          auditContext,
          'result',
          result.success ? 'success' : 'failure',
          result.success && result.text
            ? { resultLength: result.text.length }
            : {
                causeCode: 'unknown',
              },
        );
      }
      if (result.success && result.text) {
        completeBatchTranscription(
          deps,
          createTranscriptionCompletionSnapshot(provider, requestedAt),
          buffer,
          mimeType,
          result.text,
        );
      }

      return result;
    } catch (error: unknown) {
      if (auditContext) {
        audit.terminalBatch(auditContext, 'submission', 'failure', {
          causeCode: 'unknown',
          exceptionType: normalizeProviderAuditExceptionType(error),
        });
      } else {
        log.error(
          'Transcription error:',
          presentNotificationError(error, { context: 'transcription' }).safeLogMetadata,
        );
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

export const transcribeAudio = createTranscriptionService({
  ...defaultTranscriptionCompletionDependencies,
  ensureBackgroundBrowser: () => ensureBackgroundBrowser(),
  getActiveProvider,
  getRequestedAt: () => new Date().toISOString(),
  isBackgroundReady: isBgReady,
});
