import type React from 'react';
import type { SettingsPresentationState } from '@shared/settingsPresentation';
import { useI18n } from '@renderer/hooks/useI18n';
import { Button } from '@renderer/components/ui/button';
import { Spinner } from '@renderer/components/ui/spinner';

interface SettingsPresentationOverlayProps {
  readonly presentation: SettingsPresentationState;
  readonly onShowSettings: () => void;
}

/** Blocks the main surface while configuration is presented in its own window. */
function SettingsPresentationOverlay({
  onShowSettings,
  presentation,
}: SettingsPresentationOverlayProps): React.JSX.Element | null {
  const { t } = useI18n();
  if (presentation === 'idle') return null;

  const opening = presentation === 'opening';
  const title = t(opening ? 'settings.opening' : 'settings.blockedWhileOpen');

  return (
    <section
      aria-busy={opening || undefined}
      aria-labelledby="settings-presentation-overlay-title"
      aria-modal="true"
      className="settings-presentation-overlay"
      data-slot="settings-presentation-overlay"
      data-state={presentation}
      role="dialog"
    >
      <div className="settings-presentation-overlay-card">
        {opening && <Spinner active announce={false} label={title} size="lg" />}
        <h2 id="settings-presentation-overlay-title">{title}</h2>
        {!opening && (
          <Button onClick={onShowSettings} size="sm" type="button">
            {t('settings.show')}
          </Button>
        )}
      </div>
    </section>
  );
}

export default SettingsPresentationOverlay;
