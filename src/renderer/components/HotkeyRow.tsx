import { Pencil } from 'lucide-react';
import type { JSX } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Kbd } from '@renderer/components/ui/kbd';
import { Switch } from '@renderer/components/ui/switch';
import { useI18n } from '@renderer/hooks/useI18n';

interface HotkeyRowProps {
  disabled?: boolean;
  enabled?: boolean;
  label: string;
  onChangeClick: () => void;
  onEnabledChange?: (enabled: boolean) => void;
  value: string;
}

function HotkeyRow({
  disabled = false,
  enabled,
  label,
  onChangeClick,
  onEnabledChange,
  value,
}: HotkeyRowProps): JSX.Element {
  const { t } = useI18n();
  const canToggle = typeof enabled === 'boolean' && Boolean(onEnabledChange);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 border-b border-border py-2.5 last:border-b-0">
      <span className="min-w-0 text-sm text-foreground">{label}</span>
      <Kbd className="max-w-32 truncate">{value}</Kbd>
      <Button disabled={disabled} onClick={onChangeClick} size="sm" variant="outline">
        <Pencil aria-hidden="true" />
        {t('hotkey.change')}
      </Button>
      {canToggle && onEnabledChange ? (
        <Switch
          aria-label={t('hotkey.enabled', { target: label })}
          checked={enabled}
          disabled={disabled}
          onCheckedChange={onEnabledChange}
        />
      ) : (
        <span aria-hidden="true" className="h-5 w-9" />
      )}
    </div>
  );
}

export default HotkeyRow;
