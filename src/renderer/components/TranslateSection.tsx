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
  const stateMessage = error || (isSaving ? t('translate.saving') : '');

  return (
    <section className="command-dock-language-band" data-slot="translate-section">
      <Globe aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />

      <div className="command-dock-language-field">
        <span className="command-dock-language-label">{t('translate.provider')}</span>
        <Select
          disabled={isSaving}
          onValueChange={(providerId) => {
            if (TRANSLATION_PROVIDER_OPTIONS.some((option) => option.value === providerId)) {
              onProviderChange(providerId as TranslationProviderId);
            }
          }}
          value={settings.providerId}
        >
          <SelectTrigger aria-label={t('translate.provider')} className="command-dock-language-trigger">
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
        <span className="command-dock-language-label">{t('translate.targetLanguage')}</span>
        <Select
          disabled={isSaving}
          onValueChange={onTargetLanguageChange}
          value={settings.targetLanguageByProvider[settings.providerId]}
        >
          <SelectTrigger aria-label={t('translate.targetLanguage')} className="command-dock-language-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="command-dock-translation-select-content">
            {languageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stateMessage && (
        <span
          className={`command-dock-language-state ${error ? 'is-error' : 'is-saving'}`}
          data-slot="translation-settings-state"
          role={error ? 'alert' : 'status'}
        >
          {stateMessage}
        </span>
      )}
    </section>
  );
};

export default TranslateSection;
