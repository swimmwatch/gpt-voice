import { CircleCheck, CircleOff, LoaderCircle } from 'lucide-react';
import { Badge } from '@renderer/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { cn } from '@renderer/lib/cn';
import type { LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';
import { getLocalWhisperMainStatusPresentation } from '../LocalWhisperPresentation';

/** Presents compact Local Whisper readiness without browser-login semantics. */
export default function LocalWhisperMainStatusIndicator({
  snapshot,
}: {
  readonly snapshot: LocalWhisperMainStatusSnapshot | null;
}): React.JSX.Element {
  const presentation = snapshot
    ? getLocalWhisperMainStatusPresentation(snapshot)
    : { label: 'Not ready' as const, tone: 'blocked' as const, detail: 'Local Whisper status is loading.' };
  const loading = presentation.label === 'Busy';
  const StatusIcon = loading ? LoaderCircle : presentation.tone === 'ready' ? CircleCheck : CircleOff;
  const tooltip = presentation.detail ?? `Local Whisper is ${presentation.label.toLowerCase()}.`;
  const tone = presentation.tone === 'ready' ? 'success' : presentation.tone === 'busy' ? 'warning' : 'error';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          aria-label={`${presentation.label}. ${tooltip}`}
          className={cn('command-dock-provider-state gap-1.5 whitespace-nowrap', `is-${tone}`)}
          data-slot="local-whisper-main-status"
          role="status"
          tabIndex={0}
          variant="outline"
        >
          <StatusIcon
            aria-hidden="true"
            className={loading ? 'h-3.5 w-3.5 animate-spin motion-reduce:animate-none' : 'h-3.5 w-3.5'}
            strokeWidth={1.75}
          />
          <span>{presentation.label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
