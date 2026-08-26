import { CircleCheck, CircleOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { Badge } from '@renderer/components/ui/badge';
import { cn } from '@renderer/lib/cn';
import { Spinner } from '@renderer/components/ui/spinner';

export type ProviderStatusTone = 'error' | 'neutral' | 'success' | 'warning';

const ACCESSIBLE_NAME_SEPARATOR = '. ';

interface ProviderStatusIndicatorProps {
  readonly className?: string;
  readonly dataSlot: string;
  readonly label: string;
  readonly loading?: boolean;
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
  loading = false,
  role = 'status',
  tone,
  tooltip,
}: ProviderStatusIndicatorProps): React.JSX.Element {
  const accessibleName = getProviderStatusAccessibleName(label, tooltip);
  const StatusIcon = tone === 'success' ? CircleCheck : CircleOff;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          aria-label={accessibleName}
          className={cn('provider-status-badge border-0 bg-transparent', className, `is-${tone}`)}
          data-slot={dataSlot}
          role={role}
          tabIndex={0}
        >
          <Spinner
            active={loading}
            announce={false}
            fallback={<StatusIcon aria-hidden="true" strokeWidth={1.75} />}
            label={accessibleName}
          />
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
