import type { BaseVoiceProvider, TranscriptionResult } from '../providers/BaseVoiceProvider';
import { writeClipboardText } from '../electronRuntime';
import { createLogger } from '../logger';
import { addTranscriptionHistoryEntry } from './transcriptionHistoryStorage';
import { createTranscriptionResultCache, createTranscriptionResultCacheKey } from './transcriptionResultCache';
import type { TextActionResultCache } from './textActionCache';
import { presentNotificationError } from '@shared/notifications';

const log = createLogger('transcribe');

export interface TranscriptionCompletionDependencies {
  addHistoryEntry: (entry: { requestedAt: string; providerId: string; providerName: string; text: string }) => unknown;
  cache: TextActionResultCache;
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
): TranscriptionCompletionSnapshot {
  return Object.freeze({
    providerContext: Object.freeze(Array.from(provider.getTranscriptionCacheContext())),
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
    log.info('Transcription result cache lookup:', { ...metadata, hit: isHit });
    return isHit ? cachedText : null;
  } catch {
    log.warn('Transcription result cache lookup failed:', metadata);
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
    if (reportCacheActivity) log.info('Transcription result cache stored:', metadata);
  } catch {
    if (reportCacheActivity) log.warn('Transcription result cache storage failed:', metadata);
  }
}

function recordTranscriptionHistory(
  deps: TranscriptionCompletionDependencies,
  snapshot: TranscriptionCompletionSnapshot,
  text: string,
  reportFailure = true,
): void {
  try {
    deps.addHistoryEntry({
      requestedAt: snapshot.requestedAt,
      providerId: snapshot.providerId,
      providerName: snapshot.providerName,
      text,
    });
  } catch (historyError: unknown) {
    if (!reportFailure) return;
    log.warn('Failed to save transcription history entry:', {
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
): void {
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

export const defaultTranscriptionCompletionDependencies: TranscriptionCompletionDependencies = {
  addHistoryEntry: addTranscriptionHistoryEntry,
  cache: createTranscriptionResultCache(),
  writeClipboardText,
};
