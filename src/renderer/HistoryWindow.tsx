import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TRANSCRIPTION_HISTORY_DEFAULT_LIMIT, type TranscriptionHistoryEntry } from '@shared/transcriptionHistory';
import { useI18n } from './hooks/useI18n';

const HISTORY_SCROLL_THRESHOLD_PX = 96;

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
  const loadingMoreRef = useRef(false);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale || undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  const loadMorePage = useCallback(async (offset: number) => {
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setError('');

    try {
      const page = await window.electronAPI.getTranscriptionHistory({
        limit: TRANSCRIPTION_HISTORY_DEFAULT_LIMIT,
        offset,
      });
      setItems((current) => [...current, ...page.items]);
      setTotal(page.total);
      setHasMore(page.hasMore);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    let disposed = false;
    window.electronAPI
      .getTranscriptionHistory({
        limit: TRANSCRIPTION_HISTORY_DEFAULT_LIMIT,
        offset: 0,
      })
      .then(
        (page) => {
          if (disposed) return;
          setItems(page.items);
          setTotal(page.total);
          setHasMore(page.hasMore);
        },
        (loadError: unknown) => {
          if (disposed) return;
          setError(getErrorMessage(loadError));
        },
      )
      .finally(() => {
        if (!disposed) {
          setIsLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [isReady]);

  const loadMoreIfNeeded = (event: React.UIEvent<HTMLElement>): void => {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining <= HISTORY_SCROLL_THRESHOLD_PX && hasMore && !loadingMoreRef.current && !isLoading) {
      void loadMorePage(items.length);
    }
  };

  const copyEntryText = async (entry: TranscriptionHistoryEntry): Promise<void> => {
    setCopyError('');
    const result = await window.electronAPI.copyTranscriptionHistoryText(entry.id);
    if (!result.success) {
      setCopiedId(null);
      setCopyError(result.error || t('history.copyFailed'));
      return;
    }

    setCopiedId(entry.id);
    window.setTimeout(() => {
      setCopiedId((current) => (current === entry.id ? null : current));
    }, 1600);
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
    <main className="history-window-shell" onScroll={loadMoreIfNeeded}>
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

        {isLoadingMore && <p className="modal-instruction history-footer-state">{t('history.loadingMore')}</p>}
        {!isLoading && items.length > 0 && !hasMore && (
          <p className="modal-instruction history-footer-state">{t('history.end')}</p>
        )}
      </section>
    </main>
  );
};

export default HistoryWindow;
