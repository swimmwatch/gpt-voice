import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface I18nContextValue {
  t: (key: string, params?: Record<string, string>) => string;
  locale: string;
  setLocale: (locale: string) => Promise<void>;
  supportedLocales: string[];
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  locale: 'en',
  setLocale: async () => {},
  supportedLocales: ['en'],
});

export const useI18n = () => useContext(I18nContext);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [locale, setLocaleState] = useState('en');
  const [supportedLocales, setSupportedLocales] = useState<string[]>(['en']);

  useEffect(() => {
    Promise.all([
      window.electronAPI.getTranslations(),
      window.electronAPI.getLocale(),
      window.electronAPI.getSupportedLocales(),
    ]).then(([tr, loc, supported]) => {
      setTranslations(tr);
      setLocaleState(loc);
      setSupportedLocales(supported);
    });
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      let text = translations[key] || key;
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
  }, []);

  return <I18nContext.Provider value={{ t, locale, setLocale, supportedLocales }}>{children}</I18nContext.Provider>;
};
