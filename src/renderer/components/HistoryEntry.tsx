import { Check, Copy } from 'lucide-react';
import type { JSX } from 'react';
import { Badge } from '@renderer/components/ui/badge';
import { useI18n } from '@renderer/hooks/useI18n';
import type { TranscriptionHistoryEntry } from '@shared/transcriptionHistory';

interface HistoryEntryProps {
  copied: boolean;
  entry: TranscriptionHistoryEntry;
  onCopy: (entry: TranscriptionHistoryEntry) => void;
  requestedAt: string;
}

function HistoryEntry({ copied, entry, onCopy, requestedAt }: HistoryEntryProps): JSX.Element {
  const { t } = useI18n();

  return (
    <article className="border-b border-border py-3 first:pt-0 last:border-b-0" data-slot="history-entry">
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <time dateTime={entry.requestedAt}>{requestedAt}</time>
        <Badge className="max-w-full" title={entry.providerName} variant="outline">
          <span className="truncate">{entry.providerName}</span>
        </Badge>
      </div>
      <button
        aria-label={t('history.copyAria', { provider: entry.providerName })}
        className="group flex w-full cursor-copy flex-col gap-2 rounded-md border border-border bg-surface-muted px-3 py-2.5 text-left text-sm leading-6 text-foreground transition-colors duration-[var(--duration-fast)] hover:border-primary hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => onCopy(entry)}
        title={t('history.copyHint')}
        type="button"
      >
        <span className="w-full select-text whitespace-pre-wrap break-words">{entry.text}</span>
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
          {copied ? (
            <Check aria-hidden="true" className="size-3.5 text-success" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          {copied ? t('history.copied') : t('history.copy')}
        </span>
      </button>
    </article>
  );
}

export default HistoryEntry;
