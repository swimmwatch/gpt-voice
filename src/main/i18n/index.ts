import en from './en';
import ru from './ru';

export type TranslationKey = keyof typeof en;
type Translations = Record<TranslationKey, string>;

const locales: Record<string, Translations> = { en, ru };

let currentLocale = 'en';

export function setLocale(locale: string): void {
  currentLocale = locales[locale] ? locale : 'en';
}

export function getLocale(): string {
  return currentLocale;
}

export function getSupportedLocales(): string[] {
  return Object.keys(locales);
}

export function t(key: TranslationKey, params?: Record<string, string>): string {
  const translations = locales[currentLocale] || locales.en;
  let text = translations[key] || locales.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export function getAllTranslations(): Translations {
  return locales[currentLocale] || locales.en;
}
