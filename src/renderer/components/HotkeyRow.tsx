import { FlaskConical, Pencil, Trash2 } from 'lucide-react';
import { useRef, type JSX } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Kbd } from '@renderer/components/ui/kbd';
import { Switch } from '@renderer/components/ui/switch';
import {
  canRemoveHotkey,
  canTestHotkey,
  getHotkeyAuthorityTranslationKey,
  getHotkeyFailureTranslationKey,
  getHotkeyStatusTranslationKey,
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
  const changeButtonRef = useRef<HTMLButtonElement | null>(null);
  const testButtonRef = useRef<HTMLButtonElement | null>(null);
  const canToggle = typeof enabled === 'boolean' && Boolean(onEnabledChange);
  const configuredValue = entry.configuredAccelerator ?? t('hotkey.notAssigned');
  const status = t(getHotkeyStatusTranslationKey(entry));
  const authority = t(getHotkeyAuthorityTranslationKey(entry));
  const detail =
    entry.registrationStatus === HotkeyRegistrationStatus.Failed
      ? t(getHotkeyFailureTranslationKey(entry.failureCode))
      : entry.effectiveAccelerator !== null
        ? t('hotkey.effective', { accelerator: entry.effectiveAccelerator })
        : entry.configuredAccelerator !== null
          ? t('hotkey.preference', { accelerator: entry.configuredAccelerator })
          : null;
  const description = [configuredValue, status, authority, detail].filter(Boolean).join('. ');
  const controlsDisabled = disabled || isMutationPending;
  const testStatus = testResult ? t(getHotkeyTestTranslationKey(testResult)) : null;

  const handleRemove = async (): Promise<void> => {
    if (await onRemoveClick()) {
      window.requestAnimationFrame(() => changeButtonRef.current?.focus());
    }
  };

  const handleTest = async (): Promise<void> => {
    await onTestClick();
    window.requestAnimationFrame(() => testButtonRef.current?.focus());
  };

  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="text-sm text-foreground">{label}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Kbd className="max-w-32 truncate">{configuredValue}</Kbd>
          <span className="text-xs text-muted-foreground">{status}</span>
        </div>
        <p className="text-xs text-muted-foreground">{authority}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        {testStatus && <p className="text-xs text-muted-foreground">{testStatus}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          aria-label={`${t('hotkey.change')}: ${label}. ${description}`}
          disabled={controlsDisabled}
          onClick={onChangeClick}
          ref={changeButtonRef}
          size="sm"
          variant="outline"
        >
          <Pencil aria-hidden="true" />
          {t('hotkey.change')}
        </Button>
        {canRemoveHotkey(entry) && (
          <Button
            aria-label={`${t('hotkey.remove')}: ${label}. ${description}`}
            disabled={controlsDisabled}
            onClick={() => void handleRemove()}
            size="sm"
            variant="outline"
          >
            <Trash2 aria-hidden="true" />
            {t('hotkey.remove')}
          </Button>
        )}
        {canTestHotkey(entry) && (
          <Button
            aria-label={`${t('hotkey.test')}: ${label}. ${description}`}
            disabled={controlsDisabled || isTestActionDisabled}
            onClick={() => void handleTest()}
            ref={testButtonRef}
            size="sm"
            variant="outline"
          >
            <FlaskConical aria-hidden="true" />
            {testResult === 'waiting' ? t('hotkey.testing') : t('hotkey.test')}
          </Button>
        )}
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
  );
}

export default HotkeyRow;
