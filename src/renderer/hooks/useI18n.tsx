import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import defaultTranslations from '@main/i18n/en';

const DEFAULT_TRANSLATIONS: Readonly<Record<string, string>> = defaultTranslations;

interface I18nContextValue {
  t: (key: string, params?: Record<string, string>) => string;
  locale: string;
  setLocale: (locale: string) => Promise<void>;
  supportedLocales: string[];
  isReady: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => DEFAULT_TRANSLATIONS[key] || key,
  locale: 'en',
  setLocale: async () => {},
  supportedLocales: ['en'],
  isReady: false,
});

export const useI18n = () => useContext(I18nContext);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [translations, setTranslations] = useState<Readonly<Record<string, string>>>(DEFAULT_TRANSLATIONS);
  const [locale, setLocaleState] = useState('en');
  const [supportedLocales, setSupportedLocales] = useState<string[]>(['en']);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    const initI18n = async () => {
      try {
        const [tr, loc, supported] = await Promise.all([
          window.electronAPI.getTranslations(),
          window.electronAPI.getLocale(),
          window.electronAPI.getSupportedLocales(),
        ]);

        if (disposed) return;
        setTranslations(tr);
        setLocaleState(loc);
        setSupportedLocales(supported);
      } catch {
        // Keep the default English fallback context if preload IPC is not ready yet.
      } finally {
        if (!disposed) {
          setIsReady(true);
        }
      }
    };

    void initI18n();

    return () => {
      disposed = true;
    };
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      let text = translations[key] || DEFAULT_TRANSLATIONS[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, v);
        }
      }
      return text;
    },
    [translations],
  );

  const setLocale = useCallback(async (newLocale: string) => {
    await window.electronAPI.setLocale(newLocale);
    const tr = await window.electronAPI.getTranslations();
    setTranslations(tr);
    setLocaleState(newLocale);
    setIsReady(true);
  }, []);

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, supportedLocales, isReady }}>{children}</I18nContext.Provider>
  );
};
