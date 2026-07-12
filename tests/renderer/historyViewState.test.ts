import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getHistoryContentState,
  HistoryContentState,
  HistoryPageLoadMode,
  mergeTranscriptionHistoryPage,
  shouldLoadMoreHistory,
} from '@renderer/historyViewState';
import type { TranscriptionHistoryEntry, TranscriptionHistoryPage } from '@shared/transcriptionHistory';

const FIRST_ENTRY: TranscriptionHistoryEntry = {
  id: 3,
  providerId: 'chatgpt',
  providerName: 'ChatGPT Web',
  requestedAt: '2026-07-10T10:00:00.000Z',
  text: 'First entry',
};

const SECOND_ENTRY: TranscriptionHistoryEntry = {
  id: 2,
  providerId: 'openai-api',
  providerName: 'OpenAI API',
  requestedAt: '2026-07-10T09:00:00.000Z',
  text: 'Second entry',
};

const THIRD_ENTRY: TranscriptionHistoryEntry = {
  id: 1,
  providerId: 'chatgpt',
  providerName: 'ChatGPT Web',
  requestedAt: '2026-07-10T08:00:00.000Z',
  text: 'Third entry',
};

describe('historyViewState', () => {
  it('replaces entries and derives the next offset from the returned page', () => {
    const page: TranscriptionHistoryPage = {
      hasMore: true,
      items: [FIRST_ENTRY, SECOND_ENTRY],
      limit: 25,
      offset: 0,
      total: 3,
    };

    assert.deepEqual(mergeTranscriptionHistoryPage([THIRD_ENTRY], page, HistoryPageLoadMode.Replace), {
      hasMore: true,
      items: [FIRST_ENTRY, SECOND_ENTRY],
      nextOffset: 2,
      total: 3,
    });
  });

  it('suppresses duplicate appended IDs while still advancing by the received page size', () => {
    const page: TranscriptionHistoryPage = {
      hasMore: false,
      items: [SECOND_ENTRY, THIRD_ENTRY],
      limit: 25,
      offset: 2,
      total: 3,
    };

    assert.deepEqual(mergeTranscriptionHistoryPage([FIRST_ENTRY, SECOND_ENTRY], page, HistoryPageLoadMode.Append), {
      hasMore: false,
      items: [FIRST_ENTRY, SECOND_ENTRY, THIRD_ENTRY],
      nextOffset: 4,
      total: 3,
    });
  });

  it('derives loading, error, empty, and populated content states without hiding existing entries on append errors', () => {
    assert.equal(getHistoryContentState({ error: '', isLoading: true, items: [] }), HistoryContentState.Loading);
    assert.equal(
      getHistoryContentState({ error: 'Unavailable', isLoading: false, items: [] }),
      HistoryContentState.Error,
    );
    assert.equal(getHistoryContentState({ error: '', isLoading: false, items: [] }), HistoryContentState.Empty);
    assert.equal(
      getHistoryContentState({ error: 'Unable to load more', isLoading: false, items: [FIRST_ENTRY] }),
      HistoryContentState.Populated,
    );
  });

  it('only requests another page near the bottom while an eligible page is available', () => {
    assert.equal(
      shouldLoadMoreHistory({
        hasMore: true,
        isLoading: false,
        isLoadingMore: false,
        remainingScrollPx: 96,
        thresholdPx: 96,
      }),
      true,
    );
    assert.equal(
      shouldLoadMoreHistory({
        hasMore: true,
        isLoading: false,
        isLoadingMore: true,
        remainingScrollPx: 0,
        thresholdPx: 96,
      }),
      false,
    );
    assert.equal(
      shouldLoadMoreHistory({
        hasMore: false,
        isLoading: false,
        isLoadingMore: false,
        remainingScrollPx: 0,
        thresholdPx: 96,
      }),
      false,
    );
  });
});
