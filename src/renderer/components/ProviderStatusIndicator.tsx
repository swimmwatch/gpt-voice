import { Circle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';

export type ProviderStatusTone = 'error' | 'neutral' | 'success' | 'warning';

interface ProviderStatusIndicatorProps {
  readonly className?: string;
  readonly dataSlot: string;
  readonly label: string;
  readonly role?: 'alert' | 'status';
  readonly tone: ProviderStatusTone;
  readonly tooltip: string;
}

/** Renders one non-action provider state with an accessible hover and focus explanation. */
export function ProviderStatusIndicator({
  className = '',
  dataSlot,
  label,
  role = 'status',
  tone,
  tooltip,
}: ProviderStatusIndicatorProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`${label}. ${tooltip}`}
          className={`${className} is-${tone}`.trim()}
          data-slot={dataSlot}
          role={role}
          tabIndex={0}
        >
          <Circle aria-hidden="true" fill="currentColor" strokeWidth={0} />
          <span>{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
