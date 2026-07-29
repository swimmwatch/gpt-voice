import { Circle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';

export type ProviderStatusTone = 'error' | 'neutral' | 'success' | 'warning';

const ACCESSIBLE_NAME_SEPARATOR = '. ';

interface ProviderStatusIndicatorProps {
  readonly className?: string;
  readonly dataSlot: string;
  readonly label: string;
  readonly role?: 'alert' | 'status';
  readonly tone: ProviderStatusTone;
  readonly tooltip: string;
}

export function getProviderStatusAccessibleName(label: string, tooltip: string): string {
  const normalizedLabel = label.trim();
  const normalizedTooltip = tooltip.trim();
  if (!normalizedTooltip || normalizedLabel === normalizedTooltip) return normalizedLabel;
  if (!normalizedLabel) return normalizedTooltip;
  return `${normalizedLabel}${ACCESSIBLE_NAME_SEPARATOR}${normalizedTooltip}`;
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
  const accessibleName = getProviderStatusAccessibleName(label, tooltip);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={accessibleName}
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
