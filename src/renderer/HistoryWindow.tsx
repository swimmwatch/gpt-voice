import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TRANSCRIPTION_HISTORY_DEFAULT_LIMIT, type TranscriptionHistoryEntry } from '@shared/transcriptionHistory';
import { useI18n } from './hooks/useI18n';

const HISTORY_PAGE_LIMIT = Math.min(25, TRANSCRIPTION_HISTORY_DEFAULT_LIMIT);
const HISTORY_SCROLL_THRESHOLD_PX = 96;
type HistoryPageLoadMode = 'append' | 'replace';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const HistoryWindow: React.FC = () => {
  const { t, locale, isReady } = useI18n();
  const [items, setItems] = useState<TranscriptionHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyError, setCopyError] = useState('');
  const [nextOffset, setNextOffset] = useState(0);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const isMountedRef = useRef(true);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale || undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  const loadHistoryPage = useCallback(async (offset: number, mode: HistoryPageLoadMode) => {
    if (loadingMoreRef.current) return;

    const isReplacing = mode === 'replace';
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
      if (!isMountedRef.current) return;

      setItems((current) => {
        if (isReplacing) return page.items;

        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !existingIds.has(item.id))];
      });
      setTotal(page.total);
      setHasMore(page.hasMore);
      setNextOffset(page.offset + page.items.length);
    } catch (loadError: unknown) {
      if (!isMountedRef.current) return;
      setError(getErrorMessage(loadError));
    } finally {
      loadingMoreRef.current = false;
      if (isMountedRef.current) {
        if (isReplacing) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    }
  }, []);

  useEffect(() => {
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
      void loadHistoryPage(0, 'replace');
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
          void loadHistoryPage(nextOffset, 'append');
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

  const loadMoreIfNeeded = (event: React.UIEvent<HTMLElement>): void => {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining <= HISTORY_SCROLL_THRESHOLD_PX && hasMore && !loadingMoreRef.current && !isLoading) {
      void loadHistoryPage(nextOffset, 'append');
    }
  };

  const copyEntryText = async (entry: TranscriptionHistoryEntry): Promise<void> => {
    setCopyError('');
    try {
      const result = await window.electronAPI.copyTranscriptionHistoryText(entry.id);
      if (!isMountedRef.current) return;
      if (!result.success) {
        setCopiedId(null);
        setCopyError(result.error || t('history.copyFailed'));
        return;
      }

      setCopiedId(entry.id);
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        setCopiedId((current) => (current === entry.id ? null : current));
        copyFeedbackTimeoutRef.current = null;
      }, 1600);
    } catch (copyTextError: unknown) {
      if (!isMountedRef.current) return;
      setCopiedId(null);
      setCopyError(getErrorMessage(copyTextError) || t('history.copyFailed'));
    }
  };

  const clearHistory = async (): Promise<void> => {
    if (isClearing || items.length === 0 || !window.confirm(t('history.clearConfirm'))) {
      return;
    }

    setIsClearing(true);
    setError('');
    setCopyError('');
    try {
      const result = await window.electronAPI.clearTranscriptionHistory();
      if (!result.success) {
        setError(result.error || t('history.clearFailed'));
        return;
      }
      setItems([]);
      setTotal(0);
      setHasMore(false);
      setNextOffset(0);
      setCopiedId(null);
    } catch (clearError: unknown) {
      setError(getErrorMessage(clearError));
    } finally {
      setIsClearing(false);
    }
  };

  const renderRequestedAt = (requestedAt: string): string => {
    const date = new Date(requestedAt);
    if (Number.isNaN(date.getTime())) {
      return requestedAt;
    }
    return dateFormatter.format(date);
  };

  return (
    <main className="history-window-shell" ref={scrollRootRef} onScroll={loadMoreIfNeeded}>
      <section className="history-window-panel">
        <header className="history-header">
          <div>
            <h1>{t('history.title')}</h1>
            <p className="history-count">{t('history.count', { count: String(total) })}</p>
          </div>
          <button
            type="button"
            className="hotkey-btn history-clear-btn"
            onClick={() => void clearHistory()}
            disabled={isClearing || items.length === 0}
          >
            {isClearing ? t('history.clearing') : t('history.clear')}
          </button>
        </header>

        {isLoading && <p className="modal-instruction">{t('loading.initializing')}</p>}
        {error && <p className="settings-error">{error}</p>}
        {copyError && <p className="settings-error">{copyError}</p>}

        {!isLoading && items.length === 0 && !error && (
          <div className="history-empty">
            <h2>{t('history.emptyTitle')}</h2>
            <p>{t('history.emptyBody')}</p>
          </div>
        )}

        <div className="history-list" aria-live="polite">
          {items.map((entry) => (
            <article className="history-entry" key={entry.id}>
              <div className="history-entry-meta">
                <time dateTime={entry.requestedAt}>{renderRequestedAt(entry.requestedAt)}</time>
                <span>{entry.providerName}</span>
              </div>
              <button
                type="button"
                className="history-entry-text"
                onClick={() => void copyEntryText(entry)}
                title={t('history.copyHint')}
                aria-label={t('history.copyAria', { provider: entry.providerName })}
              >
                {entry.text}
              </button>
              <div className="history-entry-footer">
                <span>{t('history.copyHint')}</span>
                {copiedId === entry.id && <strong>{t('history.copied')}</strong>}
              </div>
            </article>
          ))}
        </div>

        {hasMore && <div className="history-load-sentinel" ref={loadMoreSentinelRef} aria-hidden="true" />}
        {isLoadingMore && <p className="modal-instruction history-footer-state">{t('history.loadingMore')}</p>}
        {!isLoading && items.length > 0 && !hasMore && (
          <p className="modal-instruction history-footer-state">{t('history.end')}</p>
        )}
      </section>
    </main>
  );
};

export default HistoryWindow;
