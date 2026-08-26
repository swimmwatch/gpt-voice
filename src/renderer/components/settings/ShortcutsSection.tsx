import type { JSX } from 'react';
import HotkeyRow from '@renderer/components/HotkeyRow';
import type { TranslationFunction } from '@renderer/components/settings/types';
import { getHotkeyRuntimeSnapshotEntry } from '@renderer/hotkeySettingsPresentation';
import { HOTKEY_TARGETS, type HotkeyTarget, type HotkeyTestResult } from '@shared/hotkeys';
import type { HotkeyRuntimeState } from '@shared/hotkeyIpc';
import type { TextActionSettings } from '@shared/textActionSettings';

interface ShortcutsSectionProps {
  hotkeyMutationTarget: HotkeyTarget | null;
  hotkeyRuntimeState: HotkeyRuntimeState;
  hotkeyTestState: { readonly result: HotkeyTestResult | 'waiting'; readonly target: HotkeyTarget } | null;
  onHotkeyChange: (target: HotkeyTarget) => void;
  onHotkeyRemove: (target: HotkeyTarget) => Promise<boolean>;
  onHotkeyTest: (target: HotkeyTarget) => Promise<void>;
  onTextActionEnabledChange: (key: keyof TextActionSettings, enabled: boolean) => void;
  t: TranslationFunction;
  textActionSettings: TextActionSettings;
}

function ShortcutsSection({
  hotkeyMutationTarget,
  hotkeyRuntimeState,
  hotkeyTestState,
  onHotkeyChange,
  onHotkeyRemove,
  onHotkeyTest,
  onTextActionEnabledChange,
  t,
  textActionSettings,
}: ShortcutsSectionProps): JSX.Element {
  return (
    <section aria-labelledby="shortcuts-heading" className="grid gap-4 pb-4">
      <h2 className="text-base font-semibold text-foreground" id="shortcuts-heading">
        {t('appSettings.hotkeys')}
      </h2>
      <div className="grid border-b border-border">
        {HOTKEY_TARGETS.map((target) => {
          const entry = getHotkeyRuntimeSnapshotEntry(hotkeyRuntimeState, target);
          const isTestWaiting = hotkeyTestState?.result === 'waiting';
          return (
            <HotkeyRow
              disabled={isTestWaiting || (hotkeyMutationTarget !== null && hotkeyMutationTarget !== target)}
              enabled={
                target === 'translate'
                  ? textActionSettings.translateEnabled
                  : target === 'prettify'
                    ? textActionSettings.prettifyEnabled
                    : target === 'prettifyQuick'
                      ? textActionSettings.prettifyQuickEnabled
                      : undefined
              }
              entry={entry}
              isMutationPending={hotkeyMutationTarget === target}
              isTestActionDisabled={isTestWaiting}
              key={target}
              label={t(`hotkey.${target}`)}
              onChangeClick={() => onHotkeyChange(target)}
              onEnabledChange={
                target === 'translate'
                  ? (enabled) => onTextActionEnabledChange('translateEnabled', enabled)
                  : target === 'prettify'
                    ? (enabled) => onTextActionEnabledChange('prettifyEnabled', enabled)
                    : target === 'prettifyQuick'
                      ? (enabled) => onTextActionEnabledChange('prettifyQuickEnabled', enabled)
                      : undefined
              }
              onRemoveClick={() => onHotkeyRemove(target)}
              onTestClick={() => onHotkeyTest(target)}
              testResult={hotkeyTestState?.target === target ? hotkeyTestState.result : null}
            />
          );
        })}
      </div>
    </section>
  );
}

export default ShortcutsSection;
