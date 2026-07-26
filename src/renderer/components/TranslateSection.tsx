import { Globe } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import { TRANSLATION_PROVIDER_OPTIONS, getTranslationLanguageOptions } from '@renderer/translationLanguageOptions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import type { TranslationProviderId, TranslationSettings } from '@shared/translationProvider';

interface Props {
  error: string;
  isSaving: boolean;
  onProviderChange: (providerId: TranslationProviderId) => void;
  onTargetLanguageChange: (targetLanguage: string) => void;
  settings: TranslationSettings;
}

/** Renders the compact main-window translation provider and target selectors. */
const TranslateSection = ({
  error,
  isSaving,
  onProviderChange,
  onTargetLanguageChange,
  settings,
}: Props): React.JSX.Element => {
  const { locale, t } = useI18n();
  const languageOptions = useMemo(
    () => getTranslationLanguageOptions(settings.providerId, locale),
    [locale, settings.providerId],
  );

  return (
    <section className="command-dock-language-band" data-slot="translate-section">
      <Globe aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />

      <div className="command-dock-language-field">
        <span className="command-dock-field-label">{t('translate.provider')}</span>
        <Select
          disabled={isSaving}
          onValueChange={(providerId) => {
            if (TRANSLATION_PROVIDER_OPTIONS.some((option) => option.value === providerId)) {
              onProviderChange(providerId as TranslationProviderId);
            }
          }}
          value={settings.providerId}
        >
          <SelectTrigger
            aria-label={t('translate.provider')}
            className="command-dock-provider-trigger command-dock-translation-trigger"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="command-dock-translation-select-content">
            {TRANSLATION_PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="command-dock-language-field">
        <span className="command-dock-field-label">{t('translate.targetLanguage')}</span>
        <Select
          disabled={isSaving}
          onValueChange={onTargetLanguageChange}
          value={settings.targetLanguageByProvider[settings.providerId]}
        >
          <SelectTrigger
            aria-label={t('translate.targetLanguage')}
            className="command-dock-provider-trigger command-dock-translation-trigger"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            className="command-dock-translation-select-content"
            showScrollButtons={false}
            viewportClassName="command-dock-translation-select-viewport"
          >
            {languageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <span className="command-dock-language-state is-error" data-slot="translation-settings-state" role="alert">
          {error}
        </span>
      )}
    </section>
  );
};

export default TranslateSection;
