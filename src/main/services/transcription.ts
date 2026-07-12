import { ensureBackgroundBrowser, getActiveProvider, isBgReady } from '../browser';
import { writeClipboardText } from '../electronRuntime';
import { t } from '../i18n';
import { createLogger } from '../logger';
import type { BaseVoiceProvider, TranscriptionResult } from '../providers/BaseVoiceProvider';
import { addTranscriptionHistoryEntry } from './transcriptionHistoryStorage';
import { createTranscriptionResultCache, createTranscriptionResultCacheKey } from './transcriptionResultCache';
import type { TextActionResultCache } from './textActionCache';
import { presentNotificationError } from '@shared/notifications';

const log = createLogger('transcribe');

export interface TranscriptionServiceDependencies {
  addHistoryEntry: (entry: { requestedAt: string; providerId: string; providerName: string; text: string }) => unknown;
  cache: TextActionResultCache;
  ensureBackgroundBrowser: () => Promise<void>;
  getActiveProvider: () => BaseVoiceProvider | null;
  getRequestedAt: () => string;
  isBackgroundReady: () => boolean;
  writeClipboardText: (text: string) => void;
}

export type TranscriptionService = (buffer: ArrayBuffer, mimeType: string) => Promise<TranscriptionResult>;

function getCacheLogMetadata(provider: BaseVoiceProvider, buffer: ArrayBuffer, mimeType: string) {
  return {
    audioByteLength: buffer.byteLength,
    hasMimeType: Boolean(mimeType),
    providerId: provider.info.id,
  };
}

function readCachedTranscription(
  deps: TranscriptionServiceDependencies,
  provider: BaseVoiceProvider,
  buffer: ArrayBuffer,
  mimeType: string,
): string | null {
  const metadata = getCacheLogMetadata(provider, buffer, mimeType);
  try {
    const key = createTranscriptionResultCacheKey({
      audio: buffer,
      mimeType,
      providerContext: provider.getTranscriptionCacheContext(),
      providerId: provider.info.id,
    });
    const cachedText = deps.cache.get(key);
    const isHit = Boolean(cachedText?.trim());
    log.info('Transcription result cache lookup:', { ...metadata, hit: isHit });
    return isHit ? cachedText : null;
  } catch {
    log.warn('Transcription result cache lookup failed:', metadata);
    return null;
  }
}

function cacheTranscriptionResult(
  deps: TranscriptionServiceDependencies,
  provider: BaseVoiceProvider,
  buffer: ArrayBuffer,
  mimeType: string,
  text: string,
): void {
  const metadata = getCacheLogMetadata(provider, buffer, mimeType);
  try {
    const key = createTranscriptionResultCacheKey({
      audio: buffer,
      mimeType,
      providerContext: provider.getTranscriptionCacheContext(),
      providerId: provider.info.id,
    });
    deps.cache.set(key, text);
    log.info('Transcription result cache stored:', metadata);
  } catch {
    log.warn('Transcription result cache storage failed:', metadata);
  }
}

function recordTranscriptionHistory(
  deps: TranscriptionServiceDependencies,
  provider: BaseVoiceProvider,
  requestedAt: string,
  text: string,
): void {
  try {
    deps.addHistoryEntry({
      requestedAt,
      providerId: provider.info.id,
      providerName: provider.info.name,
      text,
    });
  } catch (historyError: unknown) {
    log.warn('Failed to save transcription history entry:', {
      textLength: text.length,
      ...presentNotificationError(historyError, { context: 'transcription' }).safeLogMetadata,
    });
  }
}

function createCachedResult(
  deps: TranscriptionServiceDependencies,
  provider: BaseVoiceProvider,
  requestedAt: string,
  text: string,
): TranscriptionResult {
  deps.writeClipboardText(text);
  recordTranscriptionHistory(deps, provider, requestedAt, text);
  return { success: true, text };
}

/** Creates the main-process transcription flow without changing its renderer IPC contract. */
export function createTranscriptionService(deps: TranscriptionServiceDependencies): TranscriptionService {
  return async (buffer, mimeType) => {
    const requestedAt = deps.getRequestedAt();

    try {
      log.info('Starting transcription:', { audioByteLength: buffer.byteLength, hasMimeType: Boolean(mimeType) });

      const providerBeforeEnsure = deps.getActiveProvider();
      if (providerBeforeEnsure) {
        const cachedText = readCachedTranscription(deps, providerBeforeEnsure, buffer, mimeType);
        if (cachedText) {
          return createCachedResult(deps, providerBeforeEnsure, requestedAt, cachedText);
        }
      }

      await deps.ensureBackgroundBrowser();
      const provider = deps.getActiveProvider();
      if (!provider) {
        return { success: false, error: t('error.notLoggedIn') };
      }

      if (provider !== providerBeforeEnsure) {
        const cachedText = readCachedTranscription(deps, provider, buffer, mimeType);
        if (cachedText) {
          return createCachedResult(deps, provider, requestedAt, cachedText);
        }
      }

      if (!deps.isBackgroundReady() || !provider.isReady()) {
        return { success: false, error: t('error.notLoggedIn') };
      }

      const result = await provider.transcribe(buffer, mimeType);
      if (result.success && result.text?.trim()) {
        cacheTranscriptionResult(deps, provider, buffer, mimeType, result.text);
      }
      if (result.success && result.text) {
        recordTranscriptionHistory(deps, provider, requestedAt, result.text);
      }

      return result;
    } catch (error: unknown) {
      log.error('Transcription error:', presentNotificationError(error, { context: 'transcription' }).safeLogMetadata);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

export const transcribeAudio = createTranscriptionService({
  addHistoryEntry: addTranscriptionHistoryEntry,
  cache: createTranscriptionResultCache(),
  ensureBackgroundBrowser: () => ensureBackgroundBrowser({ includeTranslate: false }),
  getActiveProvider,
  getRequestedAt: () => new Date().toISOString(),
  isBackgroundReady: isBgReady,
  writeClipboardText,
});
