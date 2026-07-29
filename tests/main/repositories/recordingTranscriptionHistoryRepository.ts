import type {
  NewTranscriptionHistoryEntry,
  TranscriptionHistoryRepository,
} from '@main/repositories/transcriptionHistoryRepository';
import { normalizeTranscriptionHistoryQuery } from '@main/repositories/transcriptionHistoryRepository';
import type {
  TranscriptionHistoryEntry,
  TranscriptionHistoryPage,
  TranscriptionHistoryQuery,
} from '@shared/transcriptionHistory';

/** State-owning repository fake shared by transcription service tests. */
export class RecordingTranscriptionHistoryRepository implements TranscriptionHistoryRepository {
  public readonly addedEntries: NewTranscriptionHistoryEntry[] = [];
  public entries: TranscriptionHistoryEntry[] = [];
  private nextId = 1;

  public constructor(private readonly onAdd?: (entry: NewTranscriptionHistoryEntry) => void) {}

  public addEntry(entry: NewTranscriptionHistoryEntry): TranscriptionHistoryEntry {
    this.onAdd?.(entry);
    this.addedEntries.push(entry);
    const saved = { id: this.nextId++, ...entry };
    this.entries.push(saved);
    return saved;
  }

  public clearEntries(): void {
    this.entries = [];
  }

  public getEntryText(id: number): string | null {
    return this.entries.find((entry) => entry.id === id)?.text ?? null;
  }

  public listEntries(query: TranscriptionHistoryQuery = {}): TranscriptionHistoryPage {
    const { limit, offset } = normalizeTranscriptionHistoryQuery(query);
    const ordered = [...this.entries].sort(
      (left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id - left.id,
    );
    const items = ordered.slice(offset, offset + limit);
    return {
      hasMore: offset + items.length < ordered.length,
      items,
      limit,
      offset,
      total: ordered.length,
    };
  }
}
