import { createHash } from 'node:crypto';
import {
  createTextActionCacheKey,
  createTextActionResultCache,
  type TextActionResultCache,
  type TextActionResultCacheOptions,
} from '@main/services/textActionCache';

export const TRANSCRIPTION_RESULT_CACHE_MAX_ENTRIES = 10;
export const TRANSCRIPTION_RESULT_CACHE_TTL_MS = 5 * 60 * 1_000;

export interface TranscriptionResultCacheKeyInput {
  audio: ArrayBuffer;
  mimeType: string;
  providerContext: readonly string[];
  providerId: string;
}

export type TranscriptionResultCacheOptions = Pick<TextActionResultCacheOptions, 'now'>;

/** Creates an opaque key without retaining the audio bytes used to derive it. */
export function createTranscriptionResultCacheKey({
  audio,
  mimeType,
  providerContext,
  providerId,
}: TranscriptionResultCacheKeyInput): string {
  const audioDigest = createHash('sha256').update(new Uint8Array(audio)).digest('hex');

  return createTextActionCacheKey(['transcription', audioDigest, mimeType, providerId, ...providerContext]);
}

export function createTranscriptionResultCache(options: TranscriptionResultCacheOptions = {}): TextActionResultCache {
  return createTextActionResultCache(TRANSCRIPTION_RESULT_CACHE_MAX_ENTRIES, {
    maxAgeMs: TRANSCRIPTION_RESULT_CACHE_TTL_MS,
    ...options,
  });
}
