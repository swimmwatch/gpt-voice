import { useState, type JSX } from 'react';
import type { TranslationFunction } from '@renderer/components/settings/types';
import { Field } from '@renderer/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { APP_LOCALES, type AppLocaleId } from '@shared/appLocale';

interface SystemSectionProps {
  locale: AppLocaleId;
  onLocaleChange: (locale: AppLocaleId) => Promise<void>;
  supportedLocales: readonly AppLocaleId[];
  t: TranslationFunction;
}

/** Applies renderer language changes immediately while keeping browser identity locale separate. */
function SystemSection({ locale, onLocaleChange, supportedLocales, t }: SystemSectionProps): JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const localeOptions = APP_LOCALES.filter(({ id }) => supportedLocales.includes(id));

  const changeLocale = async (value: AppLocaleId): Promise<void> => {
    if (value === locale || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await onLocaleChange(value);
    } catch {
      setError(t('appSettings.languageSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-labelledby="system-heading" className="grid gap-5 pb-4">
      <h2 className="text-base font-semibold text-foreground" id="system-heading">
        {t('appSettings.system')}
      </h2>

      <Field
        description={t('appSettings.languageHelp')}
        disabled={isSaving}
        error={error}
        id="application-language"
        label={t('appSettings.language')}
      >
        <Select disabled={isSaving} onValueChange={(value) => void changeLocale(value as AppLocaleId)} value={locale}>
          <SelectTrigger aria-busy={isSaving || undefined} id="application-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {localeOptions.map(({ id, nativeName }) => (
              <SelectItem key={id} value={id}>
                {nativeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSaving && <p className="text-xs text-muted-foreground">{t('appSettings.languageSaving')}</p>}
      </Field>
    </section>
  );
}

export default SystemSection;
