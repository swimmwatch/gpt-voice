import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TranscriptionHistoryRepository } from '@main/repositories/transcriptionHistoryRepository';
import { TRANSCRIPTION_HISTORY_DEFAULT_LIMIT, TRANSCRIPTION_HISTORY_MAX_LIMIT } from '@shared/transcriptionHistory';

export interface TranscriptionHistoryRepositoryContractHarness {
  readonly repository: TranscriptionHistoryRepository;
  dispose(): void;
}

export function registerTranscriptionHistoryRepositoryContract(
  createHarness: () => TranscriptionHistoryRepositoryContractHarness,
): void {
  describe('transcription history repository contract', () => {
    it('preserves domain values, deterministic ordering, lookup, and clear behavior', () => {
      const harness = createHarness();
      try {
        const first = harness.repository.addEntry({
          providerId: 'chatgpt',
          providerName: 'ChatGPT Web',
          requestedAt: '2026-07-27T10:00:00.000Z',
          text: 'first',
        });
        const second = harness.repository.addEntry({
          providerId: 'openai-api',
          providerName: 'OpenAI API',
          requestedAt: '2026-07-27T11:00:00.000Z',
          text: 'second',
        });

        assert.deepEqual(harness.repository.listEntries({ limit: 1, offset: 0 }), {
          hasMore: true,
          items: [second],
          limit: 1,
          offset: 0,
          total: 2,
        });
        assert.equal(harness.repository.getEntryText(first.id), 'first');
        assert.equal(harness.repository.getEntryText(-1), null);

        harness.repository.clearEntries();
        assert.equal(harness.repository.listEntries().total, 0);
      } finally {
        harness.dispose();
      }
    });

    it('normalizes pagination at the repository boundary', () => {
      const harness = createHarness();
      try {
        assert.deepEqual(harness.repository.listEntries(), {
          hasMore: false,
          items: [],
          limit: TRANSCRIPTION_HISTORY_DEFAULT_LIMIT,
          offset: 0,
          total: 0,
        });
        assert.deepEqual(harness.repository.listEntries({ limit: -1, offset: -10 }), {
          hasMore: false,
          items: [],
          limit: 1,
          offset: 0,
          total: 0,
        });
        assert.deepEqual(harness.repository.listEntries({ limit: 500, offset: 2.9 }), {
          hasMore: false,
          items: [],
          limit: TRANSCRIPTION_HISTORY_MAX_LIMIT,
          offset: 2,
          total: 0,
        });
      } finally {
        harness.dispose();
      }
    });
  });
}
