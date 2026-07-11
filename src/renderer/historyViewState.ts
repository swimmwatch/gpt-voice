import type { TranscriptionHistoryEntry, TranscriptionHistoryPage } from '@shared/transcriptionHistory';

export enum HistoryContentState {
  Empty = 'empty',
  Error = 'error',
  Loading = 'loading',
  Populated = 'populated',
}

export enum HistoryPageLoadMode {
  Append = 'append',
  Replace = 'replace',
}

interface HistoryContentStateInput {
  error: string;
  isLoading: boolean;
  items: readonly TranscriptionHistoryEntry[];
}

interface HistoryLoadMoreInput {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  remainingScrollPx: number;
  thresholdPx: number;
}

interface MergedHistoryPage {
  hasMore: boolean;
  items: TranscriptionHistoryEntry[];
  nextOffset: number;
  total: number;
}

export function getHistoryContentState({ error, isLoading, items }: HistoryContentStateInput): HistoryContentState {
  if (isLoading && items.length === 0) {
    return HistoryContentState.Loading;
  }
  if (error && items.length === 0) {
    return HistoryContentState.Error;
  }
  if (items.length === 0) {
    return HistoryContentState.Empty;
  }
  return HistoryContentState.Populated;
}

export function mergeTranscriptionHistoryPage(
  currentItems: readonly TranscriptionHistoryEntry[],
  page: TranscriptionHistoryPage,
  mode: HistoryPageLoadMode,
): MergedHistoryPage {
  const items =
    mode === HistoryPageLoadMode.Replace
      ? [...page.items]
      : [...currentItems, ...page.items.filter((entry) => !currentItems.some((current) => current.id === entry.id))];

  return {
    hasMore: page.hasMore,
    items,
    nextOffset: page.offset + page.items.length,
    total: page.total,
  };
}

export function shouldLoadMoreHistory({
  hasMore,
  isLoading,
  isLoadingMore,
  remainingScrollPx,
  thresholdPx,
}: HistoryLoadMoreInput): boolean {
  return hasMore && !isLoading && !isLoadingMore && remainingScrollPx <= thresholdPx;
}
