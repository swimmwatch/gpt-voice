import { FlaskConical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRef, type JSX } from 'react';
import { Button } from '@renderer/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { Kbd } from '@renderer/components/ui/kbd';
import { Switch } from '@renderer/components/ui/switch';
import {
  canRemoveHotkey,
  canTestHotkey,
  getHotkeyAssignedAccelerator,
  getHotkeyFailureTranslationKey,
  getHotkeyTestTranslationKey,
} from '@renderer/hotkeySettingsPresentation';
import { useI18n } from '@renderer/hooks/useI18n';
import { HotkeyRegistrationStatus, type HotkeyRuntimeSnapshotEntry, type HotkeyTestResult } from '@shared/hotkeys';

interface HotkeyRowProps {
  disabled?: boolean;
  enabled?: boolean;
  entry: HotkeyRuntimeSnapshotEntry;
  isMutationPending: boolean;
  isTestActionDisabled: boolean;
  label: string;
  onChangeClick: () => void;
  onEnabledChange?: (enabled: boolean) => void;
  onRemoveClick: () => Promise<boolean>;
  onTestClick: () => Promise<void>;
  testResult: HotkeyTestResult | 'waiting' | null;
}

/** Renders main-owned configured, registration, authority, and physical-test state for one hotkey. */
function HotkeyRow({
  disabled = false,
  enabled,
  entry,
  isMutationPending,
  isTestActionDisabled,
  label,
  onChangeClick,
  onEnabledChange,
  onRemoveClick,
  onTestClick,
  testResult,
}: HotkeyRowProps): JSX.Element {
  const { t } = useI18n();
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const canToggle = typeof enabled === 'boolean' && Boolean(onEnabledChange);
  const assignedAccelerator = getHotkeyAssignedAccelerator(entry);
  const assignment = entry.configuredAccelerator ?? t('hotkey.notAssigned');
  const description = `${label}. ${assignment}`;
  const controlsDisabled = disabled || isMutationPending;
  const registrationFailure =
    entry.registrationStatus === HotkeyRegistrationStatus.Failed
      ? t(getHotkeyFailureTranslationKey(entry.failureCode))
      : null;
  const testStatus = testResult
    ? t(getHotkeyTestTranslationKey(testResult), { accelerator: assignedAccelerator ?? '', target: label })
    : null;

  const handleRemove = async (): Promise<void> => {
    if (await onRemoveClick()) {
      window.requestAnimationFrame(() => actionsButtonRef.current?.focus());
    }
  };

  const handleTest = async (): Promise<void> => {
    await onTestClick();
    window.requestAnimationFrame(() => actionsButtonRef.current?.focus());
  };

  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="text-sm text-foreground">{label}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Kbd className="max-w-32 truncate">{assignment}</Kbd>
        </div>
        {testStatus && (
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
            {testStatus}
          </p>
        )}
        {registrationFailure && <p className="text-sm text-destructive">{registrationFailure}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={description}
              className="size-9 p-0"
              disabled={controlsDisabled}
              ref={actionsButtonRef}
              size="sm"
              variant="outline"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={controlsDisabled} onSelect={onChangeClick}>
              <Pencil aria-hidden="true" />
              <span>{t('hotkey.change')}</span>
            </DropdownMenuItem>
            {canTestHotkey(entry) && (
              <DropdownMenuItem disabled={controlsDisabled || isTestActionDisabled} onSelect={() => void handleTest()}>
                <FlaskConical aria-hidden="true" />
                <span>{t('hotkey.test')}</span>
              </DropdownMenuItem>
            )}
            {canRemoveHotkey(entry) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={controlsDisabled}
                  onSelect={() => void handleRemove()}
                >
                  <Trash2 aria-hidden="true" />
                  <span>{t('hotkey.remove')}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex w-9 shrink-0 justify-center">
          {canToggle && onEnabledChange ? (
            <Switch
              aria-label={t('hotkey.enabled', { target: label })}
              checked={enabled}
              disabled={controlsDisabled}
              onCheckedChange={onEnabledChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default HotkeyRow;
