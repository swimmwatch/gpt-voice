export const TRANSCRIPTION_HISTORY_DEFAULT_LIMIT = 50;
export const TRANSCRIPTION_HISTORY_MAX_LIMIT = 100;

export interface TranscriptionHistoryEntry {
  id: number;
  requestedAt: string;
  providerId: string;
  providerName: string;
  text: string;
}

export interface TranscriptionHistoryPage {
  items: TranscriptionHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TranscriptionHistoryQuery {
  limit?: number;
  offset?: number;
}

export interface TranscriptionHistoryCopyResult {
  success: boolean;
  error?: string;
}

export interface TranscriptionHistoryClearResult {
  success: boolean;
  error?: string;
}
