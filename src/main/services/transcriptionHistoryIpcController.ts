import type { TranscriptionHistoryRepository } from '../repositories/transcriptionHistoryRepository';
import type { TranscriptionHistoryQuery } from '@shared/transcriptionHistory';

const HISTORY_ENTRY_NOT_FOUND_ERROR = 'History entry not found';
const HISTORY_COPY_FAILED_ERROR = 'Failed to copy history text';
const HISTORY_COPY_FAILURE_LOG = 'Failed to copy transcription history text:';

export interface TranscriptionHistoryIpcControllerDependencies {
  readonly logger: {
    warn(message: string, metadata: Readonly<Record<string, unknown>>): void;
  };
  readonly writeClipboardText: (text: string) => void;
}

/** Owns renderer-facing history behavior over the backend-neutral repository port. */
export class TranscriptionHistoryIpcController {
  public constructor(
    private readonly repository: TranscriptionHistoryRepository,
    private readonly dependencies: TranscriptionHistoryIpcControllerDependencies,
  ) {}

  public list(query: TranscriptionHistoryQuery = {}) {
    return this.repository.listEntries(query);
  }

  public copyText(id: unknown): { readonly error?: string; readonly success: boolean } {
    const numericId = Number(id);
    const text = this.repository.getEntryText(numericId);
    if (!text) {
      return { success: false, error: HISTORY_ENTRY_NOT_FOUND_ERROR };
    }

    try {
      this.dependencies.writeClipboardText(text);
      return { success: true };
    } catch (error: unknown) {
      this.dependencies.logger.warn(HISTORY_COPY_FAILURE_LOG, {
        error: error instanceof Error ? error.message : String(error),
        id: numericId,
      });
      return { success: false, error: HISTORY_COPY_FAILED_ERROR };
    }
  }

  public clear(): { readonly success: true } {
    this.repository.clearEntries();
    return { success: true };
  }
}
