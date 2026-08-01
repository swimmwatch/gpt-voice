import type { BaseVoiceProvider, TranscriptionResult } from '../providers/BaseVoiceProvider';
import type { TranscriptionHistoryRepository } from '../repositories/transcriptionHistoryRepository';
import { createTranscriptionResultCacheKey } from './transcriptionResultCache';
import type { TextActionResultCache } from './textActionCache';
import { presentNotificationError } from '@shared/notifications';

export interface TranscriptionCompletionDependencies {
  cache: TextActionResultCache;
  historyRepository: TranscriptionHistoryRepository;
  logger: {
    error(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
  writeClipboardText: (text: string) => void;
}

export interface TranscriptionCompletionSnapshot {
  readonly providerContext: readonly string[];
  readonly providerId: string;
  readonly providerName: string;
  readonly requestedAt: string;
}

export function createTranscriptionCompletionSnapshot(
  provider: BaseVoiceProvider,
  requestedAt: string,
  providerContext: readonly string[] = provider.getTranscriptionCacheContext(),
): TranscriptionCompletionSnapshot {
  return Object.freeze({
    providerContext: Object.freeze(Array.from(providerContext)),
    providerId: provider.info.id,
    providerName: provider.info.name,
    requestedAt,
  });
}

function getCacheLogMetadata(snapshot: TranscriptionCompletionSnapshot, buffer: ArrayBuffer, mimeType: string) {
  return {
    audioByteLength: buffer.byteLength,
    hasMimeType: Boolean(mimeType),
    providerId: snapshot.providerId,
  };
}

export function readCachedTranscription(
  deps: TranscriptionCompletionDependencies,
  snapshot: TranscriptionCompletionSnapshot,
  buffer: ArrayBuffer,
  mimeType: string,
): string | null {
  const metadata = getCacheLogMetadata(snapshot, buffer, mimeType);
  try {
    const key = createTranscriptionResultCacheKey({
      audio: buffer,
      mimeType,
      providerContext: snapshot.providerContext,
      providerId: snapshot.providerId,
    });
    const cachedText = deps.cache.get(key);
    const isHit = Boolean(cachedText?.trim());
    deps.logger.info('Transcription result cache lookup:', { ...metadata, hit: isHit });
    return isHit ? cachedText : null;
  } catch {
    deps.logger.warn('Transcription result cache lookup failed:', metadata);
    return null;
  }
}

function cacheTranscriptionResult(
  deps: TranscriptionCompletionDependencies,
  snapshot: TranscriptionCompletionSnapshot,
  buffer: ArrayBuffer,
  mimeType: string,
  text: string,
  reportCacheActivity = true,
): void {
  const metadata = getCacheLogMetadata(snapshot, buffer, mimeType);
  try {
    const key = createTranscriptionResultCacheKey({
      audio: buffer,
      mimeType,
      providerContext: snapshot.providerContext,
      providerId: snapshot.providerId,
    });
    deps.cache.set(key, text);
    if (reportCacheActivity) deps.logger.info('Transcription result cache stored:', metadata);
  } catch {
    if (reportCacheActivity) deps.logger.warn('Transcription result cache storage failed:', metadata);
  }
}

function recordTranscriptionHistory(
  deps: TranscriptionCompletionDependencies,
  snapshot: TranscriptionCompletionSnapshot,
  text: string,
  reportFailure = true,
): void {
  try {
    deps.historyRepository.addEntry({
      requestedAt: snapshot.requestedAt,
      providerId: snapshot.providerId,
      providerName: snapshot.providerName,
      text,
    });
  } catch (historyError: unknown) {
    if (!reportFailure) return;
    deps.logger.warn('Failed to save transcription history entry:', {
      textLength: text.length,
      ...presentNotificationError(historyError, { context: 'transcription' }).safeLogMetadata,
    });
  }
}

export function completeCachedTranscription(
  deps: TranscriptionCompletionDependencies,
  snapshot: TranscriptionCompletionSnapshot,
  text: string,
): TranscriptionResult {
  deps.writeClipboardText(text);
  recordTranscriptionHistory(deps, snapshot, text);
  return { success: true, text };
}

export function completeBatchTranscription(
  deps: TranscriptionCompletionDependencies,
  snapshot: TranscriptionCompletionSnapshot,
  buffer: ArrayBuffer,
  mimeType: string,
  text: string,
  options: { readonly writeClipboard?: boolean } = {},
): void {
  if (options.writeClipboard && text) deps.writeClipboardText(text);
  if (text.trim()) cacheTranscriptionResult(deps, snapshot, buffer, mimeType, text);
  if (text) recordTranscriptionHistory(deps, snapshot, text);
}

export function completeStreamingTranscription(
  deps: TranscriptionCompletionDependencies,
  snapshot: TranscriptionCompletionSnapshot,
  buffer: ArrayBuffer,
  mimeType: string,
  text: string,
): void {
  cacheTranscriptionResult(deps, snapshot, buffer, mimeType, text, false);
  deps.writeClipboardText(text);
  recordTranscriptionHistory(deps, snapshot, text, false);
}
