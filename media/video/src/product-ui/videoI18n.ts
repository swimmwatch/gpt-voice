import defaultTranslations from '@main/i18n/en';

const translations: Readonly<Record<string, string>> = defaultTranslations;

interface VideoI18nValue {
  isReady: true;
  locale: 'en';
  setLocale: (locale: string) => Promise<void>;
  supportedLocales: readonly ['en'];
  t: (key: string, params?: Record<string, string>) => string;
}

function translate(key: string, params?: Record<string, string>): string {
  let text = translations[key] || key;

  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replace(`{${name}}`, value);
  }

  return text;
}

const videoI18n: VideoI18nValue = {
  isReady: true,
  locale: 'en',
  setLocale: async () => undefined,
  supportedLocales: ['en'],
  t: translate,
};

/** Remotion-safe replacement for the Electron-backed renderer i18n hook. */
export function useI18n(): VideoI18nValue {
  return videoI18n;
}
