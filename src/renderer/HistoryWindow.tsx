import { History, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent, type UIEvent } from 'react';
import HistoryEntry from '@renderer/components/HistoryEntry';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { Button } from '@renderer/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty';
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@renderer/components/ui/scroll-area';
import { Skeleton } from '@renderer/components/ui/skeleton';
import { Spinner } from '@renderer/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import {
  getHistoryContentState,
  HistoryContentState,
  HistoryPageLoadMode,
  mergeTranscriptionHistoryPage,
  shouldLoadMoreHistory,
} from '@renderer/historyViewState';
import { useI18n } from '@renderer/hooks/useI18n';
import { useWindowStartupReady } from '@renderer/WindowStartupGate';
import { presentNotificationError } from '@shared/notifications';
import { TRANSCRIPTION_HISTORY_DEFAULT_LIMIT, type TranscriptionHistoryEntry } from '@shared/transcriptionHistory';

const HISTORY_PAGE_LIMIT = Math.min(25, TRANSCRIPTION_HISTORY_DEFAULT_LIMIT);
const HISTORY_SCROLL_THRESHOLD_PX = 96;
const HISTORY_LOADING_SKELETON_KEYS = ['history-skeleton-1', 'history-skeleton-2', 'history-skeleton-3'] as const;

interface HistoryRetryRequest {
  mode: HistoryPageLoadMode;
  offset: number;
}

interface HistoryLoadingStateProps {
  label: string;
}

function HistoryLoadingState({ label }: HistoryLoadingStateProps): JSX.Element {
  return (
    <div aria-label={label} className="grid gap-3" data-slot="history-loading" role="status">
      {HISTORY_LOADING_SKELETON_KEYS.map((key) => (
        <div className="grid gap-2 border-b border-border py-3 first:pt-0 last:border-b-0" key={key}>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Coordinates history pagination, selection, deletion, and associated window state. */
function HistoryWindow(): JSX.Element {
  const { t, locale, isReady } = useI18n();
  const [items, setItems] = useState<TranscriptionHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [retryRequest, setRetryRequest] = useState<HistoryRetryRequest | null>(null);
  const itemsRef = useRef<TranscriptionHistoryEntry[]>([]);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const clearButtonRef = useRef<HTMLButtonElement | null>(null);
  const loadingMoreRef = useRef(false);
  const isMountedRef = useRef(true);
  const requestVersionRef = useRef(0);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale || undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  const presentHistoryError = useCallback(
    (cause: unknown, fallback: string): string => {
      return presentNotificationError(cause, { context: 'generic', fallback, t }).userMessage;
    },
    [t],
  );

  const loadHistoryPage = useCallback(
    async (offset: number, mode: HistoryPageLoadMode): Promise<void> => {
      if (loadingMoreRef.current) {
        return;
      }

      const requestVersion = ++requestVersionRef.current;
      const isReplacing = mode === HistoryPageLoadMode.Replace;
      loadingMoreRef.current = true;
      if (isReplacing) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError('');

      try {
        const page = await window.electronAPI.getTranscriptionHistory({
          limit: HISTORY_PAGE_LIMIT,
          offset,
        });
        if (!isMountedRef.current || requestVersion !== requestVersionRef.current) {
          return;
        }

        const merged = mergeTranscriptionHistoryPage(itemsRef.current, page, mode);
        itemsRef.current = merged.items;
        setItems(merged.items);
        setTotal(merged.total);
        setHasMore(merged.hasMore);
        setNextOffset(merged.nextOffset);
        setRetryRequest(null);
        setIsCleared(false);
      } catch (loadError: unknown) {
        if (!isMountedRef.current || requestVersion !== requestVersionRef.current) {
          return;
        }
        setError(presentHistoryError(loadError, t('history.loadFailed')));
        setRetryRequest({ mode, offset });
      } finally {
        loadingMoreRef.current = false;
        if (isMountedRef.current && requestVersion === requestVersionRef.current) {
          if (isReplacing) {
            setIsLoading(false);
          } else {
            setIsLoadingMore(false);
          }
        }
      }
    },
    [presentHistoryError, t],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadHistoryPage(0, HistoryPageLoadMode.Replace);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isReady, loadHistoryPage]);

  useEffect(() => {
    const root = scrollRootRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel || !hasMore || isLoading || isLoadingMore || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void loadHistoryPage(nextOffset, HistoryPageLoadMode.Append);
        }
      },
      {
        root,
        rootMargin: `${HISTORY_SCROLL_THRESHOLD_PX}px 0px ${HISTORY_SCROLL_THRESHOLD_PX}px 0px`,
      },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, isLoadingMore, loadHistoryPage, nextOffset]);

  const loadMoreIfNeeded = (event: UIEvent<HTMLDivElement>): void => {
    const target = event.currentTarget;
    const remainingScrollPx = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (
      shouldLoadMoreHistory({
        hasMore,
        isLoading,
        isLoadingMore: loadingMoreRef.current,
        remainingScrollPx,
        thresholdPx: HISTORY_SCROLL_THRESHOLD_PX,
      })
    ) {
      void loadHistoryPage(nextOffset, HistoryPageLoadMode.Append);
    }
  };

  const retryHistoryLoad = (): void => {
    const request = retryRequest ?? { mode: HistoryPageLoadMode.Replace, offset: 0 };
    void loadHistoryPage(request.offset, request.mode);
  };

  const copyEntryText = async (entry: TranscriptionHistoryEntry): Promise<void> => {
    setCopyError('');
    try {
      const result = await window.electronAPI.copyTranscriptionHistoryText(entry.id);
      if (!isMountedRef.current) {
        return;
      }
      if (!result.success) {
        setCopiedId(null);
        setCopyError(presentHistoryError(result.error, t('history.copyFailed')));
        return;
      }

      setCopiedId(entry.id);
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        setCopiedId((current) => (current === entry.id ? null : current));
        copyFeedbackTimeoutRef.current = null;
      }, 1600);
    } catch (copyTextError: unknown) {
      if (!isMountedRef.current) {
        return;
      }
      setCopiedId(null);
      setCopyError(presentHistoryError(copyTextError, t('history.copyFailed')));
    }
  };

  const clearHistory = async (): Promise<void> => {
    if (isClearing || itemsRef.current.length === 0) {
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setIsClearing(true);
    setError('');
    setCopyError('');
    try {
      const result = await window.electronAPI.clearTranscriptionHistory();
      if (!isMountedRef.current || requestVersion !== requestVersionRef.current) {
        return;
      }
      if (!result.success) {
        setError(presentHistoryError(result.error, t('history.clearFailed')));
        return;
      }

      itemsRef.current = [];
      setItems([]);
      setTotal(0);
      setHasMore(false);
      setNextOffset(0);
      setRetryRequest(null);
      setCopiedId(null);
      setIsCleared(true);
    } catch (clearError: unknown) {
      if (isMountedRef.current && requestVersion === requestVersionRef.current) {
        setError(presentHistoryError(clearError, t('history.clearFailed')));
      }
    } finally {
      if (isMountedRef.current && requestVersion === requestVersionRef.current) {
        setIsClearing(false);
      }
    }
  };

  const handleClearConfirmationOpenChange = (open: boolean): void => {
    setIsClearConfirmationOpen(open);
    if (!open) {
      window.requestAnimationFrame(() => clearButtonRef.current?.focus());
    }
  };

  const handleClearConfirmationKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClearConfirmationOpenChange(false);
    }
  };

  const renderRequestedAt = (requestedAt: string): string => {
    const date = new Date(requestedAt);
    return Number.isNaN(date.getTime()) ? requestedAt : dateFormatter.format(date);
  };

  const contentState = getHistoryContentState({ error, isLoading, items });
  useWindowStartupReady(isReady && !isLoading);

  return (
    <main
      className="flex h-full min-h-0 w-full flex-col gap-3 p-4 [-webkit-app-region:no-drag]"
      data-slot="history-window"
    >
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">{t('history.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('history.count', { count: String(total) })}</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={t('history.clearAria')}
              disabled={isClearing || items.length === 0}
              onClick={() => setIsClearConfirmationOpen(true)}
              ref={clearButtonRef}
              title={t('history.clearAria')}
              variant="destructive"
            >
              {isClearing ? <Spinner label={t('history.clearing')} size="sm" /> : <Trash2 aria-hidden="true" />}
              {isClearing ? t('history.clearing') : t('history.clear')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('history.clearAria')}</TooltipContent>
        </Tooltip>
      </header>

      <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border bg-surface">
        <ScrollAreaViewport
          aria-label={t('history.title')}
          onScroll={loadMoreIfNeeded}
          ref={scrollRootRef}
          tabIndex={0}
        >
          <div className="grid gap-3 p-4">
            {isCleared && (
              <Alert>
                <AlertDescription>{t('history.cleared')}</AlertDescription>
              </Alert>
            )}

            {copyError && (
              <Alert variant="destructive">
                <AlertDescription>{copyError}</AlertDescription>
              </Alert>
            )}

            {error && items.length > 0 && (
              <Alert variant="destructive">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AlertDescription>{error}</AlertDescription>
                  <Button onClick={retryHistoryLoad} size="sm" variant="outline">
                    <RefreshCw aria-hidden="true" />
                    {t('history.retry')}
                  </Button>
                </div>
              </Alert>
            )}

            {contentState === HistoryContentState.Loading && <HistoryLoadingState label={t('history.loading')} />}

            {contentState === HistoryContentState.Error && (
              <Empty>
                <EmptyMedia className="bg-destructive/15 text-destructive">
                  <History aria-hidden="true" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>{t('history.loadFailed')}</EmptyTitle>
                  <EmptyDescription>{error}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={retryHistoryLoad} variant="outline">
                    <RefreshCw aria-hidden="true" />
                    {t('history.retry')}
                  </Button>
                </EmptyContent>
              </Empty>
            )}

            {contentState === HistoryContentState.Empty && (
              <Empty>
                <EmptyMedia>
                  <History aria-hidden="true" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>{t('history.emptyTitle')}</EmptyTitle>
                  <EmptyDescription>{t('history.emptyBody')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {contentState === HistoryContentState.Populated && (
              <div aria-live="polite" data-slot="history-list" role="list">
                {items.map((entry) => (
                  <HistoryEntry
                    copied={copiedId === entry.id}
                    entry={entry}
                    key={entry.id}
                    onCopy={(historyEntry) => void copyEntryText(historyEntry)}
                    requestedAt={renderRequestedAt(entry.requestedAt)}
                  />
                ))}
              </div>
            )}

            {hasMore && <div className="h-px" data-slot="history-load-sentinel" ref={loadMoreSentinelRef} />}

            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground" role="status">
                <Spinner label={t('history.loadingMore')} size="sm" />
                {t('history.loadingMore')}
              </div>
            )}

            {!isLoading && items.length > 0 && !hasMore && (
              <p className="py-2 text-center text-xs text-muted-foreground">{t('history.end')}</p>
            )}
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar />
      </ScrollArea>

      <AlertDialog open={isClearConfirmationOpen} onOpenChange={handleClearConfirmationOpenChange}>
        <AlertDialogContent onKeyDown={handleClearConfirmationKeyDown}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('history.clearConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('history.clearConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{t('common.keepEditing')}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={() => void clearHistory()} variant="destructive">
                <Trash2 aria-hidden="true" />
                {t('history.clear')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

export default HistoryWindow;
