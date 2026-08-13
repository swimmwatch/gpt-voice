import { Pause, Play, Square, X, type LucideIcon } from 'lucide-react';
import { cn } from '@renderer/lib/cn';
import type {
  ProviderHotkeyContextualAction,
  ProviderContextualActionIcon,
} from '@renderer/useProviderHotkeyHomeIntegration';

const ICONS: Readonly<Record<ProviderContextualActionIcon, LucideIcon>> = {
  cancel: X,
  pause: Pause,
  resume: Play,
  stop: Square,
};

interface ContextualActionTileProps {
  readonly action: ProviderHotkeyContextualAction;
}

/** Renders one compact, provider-neutral contextual action with its effective accelerator. */
export default function ContextualActionTile({ action }: ContextualActionTileProps): React.JSX.Element {
  const Icon = ICONS[action.icon];
  const accessibleName = `${action.label}: ${action.hotkey}`;

  return (
    <button
      aria-busy={action.busy || undefined}
      aria-label={accessibleName}
      className={cn('command-dock-contextual-action', action.icon === 'cancel' && 'is-destructive')}
      data-contextual-action-id={`${action.provider}:${action.action}`}
      disabled={!action.available || action.busy}
      onClick={action.onActivate}
      title={accessibleName}
      type="button"
    >
      <Icon aria-hidden="true" />
      <kbd aria-hidden="true">{action.hotkey}</kbd>
    </button>
  );
}
