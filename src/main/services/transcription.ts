import { ensureBackgroundBrowser, getActiveProvider, isBgReady } from '../browser';
import { t } from '../i18n';
import { createLogger } from '../logger';
import type { BaseVoiceProvider, TranscriptionResult } from '../providers/BaseVoiceProvider';
import {
  completeBatchTranscription,
  completeCachedTranscription,
  createTranscriptionCompletionSnapshot,
  defaultTranscriptionCompletionDependencies,
  readCachedTranscription,
  type TranscriptionCompletionDependencies,
} from './transcriptionCompletion';
import { presentNotificationError } from '@shared/notifications';

const log = createLogger('transcribe');

export interface TranscriptionServiceDependencies extends TranscriptionCompletionDependencies {
  ensureBackgroundBrowser: () => Promise<void>;
  getActiveProvider: () => BaseVoiceProvider | null;
  getRequestedAt: () => string;
  isBackgroundReady: () => boolean;
}

export type TranscriptionService = (buffer: ArrayBuffer, mimeType: string) => Promise<TranscriptionResult>;

/** Creates the main-process transcription flow without changing its renderer IPC contract. */
export function createTranscriptionService(deps: TranscriptionServiceDependencies): TranscriptionService {
  return async (buffer, mimeType) => {
    const requestedAt = deps.getRequestedAt();

    try {
      log.info('Starting transcription:', { audioByteLength: buffer.byteLength, hasMimeType: Boolean(mimeType) });

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

      const result = await provider.transcribe(buffer, mimeType);
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
      log.error('Transcription error:', presentNotificationError(error, { context: 'transcription' }).safeLogMetadata);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

export const transcribeAudio = createTranscriptionService({
  ...defaultTranscriptionCompletionDependencies,
  ensureBackgroundBrowser: () => ensureBackgroundBrowser({ includeTranslate: false }),
  getActiveProvider,
  getRequestedAt: () => new Date().toISOString(),
  isBackgroundReady: isBgReady,
});
