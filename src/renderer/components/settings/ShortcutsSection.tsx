import type { JSX } from 'react';
import HotkeyRow from '@renderer/components/HotkeyRow';
import type { TranslationFunction } from '@renderer/components/settings/types';
import { HOTKEY_TARGETS, type HotkeyTarget } from '@shared/hotkeys';
import type { TextActionSettings } from '@shared/textActionSettings';

interface ShortcutsSectionProps {
  getHotkeyValue: (target: HotkeyTarget) => string;
  onHotkeyChange: (target: HotkeyTarget) => void;
  onTextActionEnabledChange: (key: 'prettifyEnabled' | 'translateEnabled', enabled: boolean) => void;
  t: TranslationFunction;
  textActionSettings: TextActionSettings;
}

function ShortcutsSection({
  getHotkeyValue,
  onHotkeyChange,
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
        {HOTKEY_TARGETS.map((target) => (
          <HotkeyRow
            enabled={
              target === 'translate'
                ? textActionSettings.translateEnabled
                : target === 'prettify'
                  ? textActionSettings.prettifyEnabled
                  : undefined
            }
            key={target}
            label={t(`hotkey.${target}`)}
            onChangeClick={() => onHotkeyChange(target)}
            onEnabledChange={
              target === 'translate'
                ? (enabled) => onTextActionEnabledChange('translateEnabled', enabled)
                : target === 'prettify'
                  ? (enabled) => onTextActionEnabledChange('prettifyEnabled', enabled)
                  : undefined
            }
            value={getHotkeyValue(target)}
          />
        ))}
      </div>
    </section>
  );
}

export default ShortcutsSection;
