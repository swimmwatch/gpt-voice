import {
  TRANSCRIPTION_HISTORY_DEFAULT_LIMIT,
  TRANSCRIPTION_HISTORY_MAX_LIMIT,
  type TranscriptionHistoryEntry,
  type TranscriptionHistoryPage,
  type TranscriptionHistoryQuery,
} from '@shared/transcriptionHistory';

export interface NewTranscriptionHistoryEntry {
  readonly providerId: string;
  readonly providerName: string;
  readonly requestedAt: string;
  readonly text: string;
}

export interface TranscriptionHistoryPagination {
  readonly limit: number;
  readonly offset: number;
}

export interface TranscriptionHistoryRepository {
  addEntry(entry: NewTranscriptionHistoryEntry): TranscriptionHistoryEntry;
  clearEntries(): void;
  getEntryText(id: number): string | null;
  listEntries(query?: TranscriptionHistoryQuery): TranscriptionHistoryPage;
}

function normalizeInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.trunc(value);
}

export function normalizeTranscriptionHistoryQuery(
  query: TranscriptionHistoryQuery = {},
): TranscriptionHistoryPagination {
  const requestedLimit = normalizeInteger(query.limit, TRANSCRIPTION_HISTORY_DEFAULT_LIMIT);
  const requestedOffset = normalizeInteger(query.offset, 0);
  return {
    limit: Math.min(TRANSCRIPTION_HISTORY_MAX_LIMIT, Math.max(1, requestedLimit)),
    offset: Math.max(0, requestedOffset),
  };
}
