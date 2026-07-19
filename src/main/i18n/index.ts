import en from './en';
import ru from './ru';
import be from './be';
import uk from './uk';
import es from './es';
import ptBr from './pt-BR';
import zh from './zh';
import ja from './ja';
import de from './de';
import fr from './fr';
import hi from './hi';
import { APP_LOCALE_IDS, DEFAULT_APP_LOCALE, isAppLocaleId, type AppLocaleId } from '@shared/appLocale';

export type TranslationKey = keyof typeof en;
export type Translations = Record<TranslationKey, string>;

const locales: Record<AppLocaleId, Translations> = { en, ru, be, uk, es, 'pt-BR': ptBr, zh, ja, de, fr, hi };

let currentLocale: AppLocaleId = DEFAULT_APP_LOCALE;

export function setLocale(locale: AppLocaleId): void {
  currentLocale = isAppLocaleId(locale) ? locale : DEFAULT_APP_LOCALE;
}

export function getLocale(): AppLocaleId {
  return currentLocale;
}

export function getSupportedLocales(): AppLocaleId[] {
  return [...APP_LOCALE_IDS];
}

export function t(key: TranslationKey, params?: Record<string, string>): string {
  const translations = locales[currentLocale] ?? locales.en;
  let text = translations[key] || locales.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export function getAllTranslations(): Translations {
  return locales[currentLocale] ?? locales.en;
}
