import React, { createContext, use, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import defaultTranslations from '@main/i18n/en';
import { DEFAULT_APP_LOCALE, type AppLocaleId } from '@shared/appLocale';

const DEFAULT_TRANSLATIONS: Readonly<Record<string, string>> = defaultTranslations;

interface I18nContextValue {
  t: (key: string, params?: Record<string, string>) => string;
  locale: AppLocaleId;
  setLocale: (locale: AppLocaleId) => Promise<void>;
  supportedLocales: AppLocaleId[];
  isReady: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => DEFAULT_TRANSLATIONS[key] || key,
  locale: DEFAULT_APP_LOCALE,
  setLocale: async () => {},
  supportedLocales: ['en'],
  isReady: false,
});

export const useI18n = () => use(I18nContext);

/** Synchronizes persisted application language and translations across renderer windows. */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [translations, setTranslations] = useState<Readonly<Record<string, string>>>(DEFAULT_TRANSLATIONS);
  const [currentLocale, setCurrentLocale] = useState<AppLocaleId>(DEFAULT_APP_LOCALE);
  const [supportedLocales, setSupportedLocales] = useState<AppLocaleId[]>([DEFAULT_APP_LOCALE]);
  const [isReady, setIsReady] = useState(false);
  const refreshRequestRef = useRef(0);

  const refreshLocale = useCallback(async (): Promise<void> => {
    const requestId = ++refreshRequestRef.current;
    const [tr, locale] = await Promise.all([window.electronAPI.getTranslations(), window.electronAPI.getLocale()]);
    if (requestId !== refreshRequestRef.current) return;
    setTranslations(tr);
    setCurrentLocale(locale);
    setIsReady(true);
  }, []);

  useEffect(() => {
    let disposed = false;

    const initI18n = async () => {
      const requestId = ++refreshRequestRef.current;
      try {
        const [tr, loc, supported] = await Promise.all([
          window.electronAPI.getTranslations(),
          window.electronAPI.getLocale(),
          window.electronAPI.getSupportedLocales(),
        ]);

        if (disposed || requestId !== refreshRequestRef.current) return;
        setTranslations(tr);
        setCurrentLocale(loc);
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

    const unsubscribe = window.electronAPI.onLocaleChanged(() => {
      void refreshLocale().catch(() => undefined);
    });

    return () => {
      disposed = true;
      refreshRequestRef.current += 1;
      unsubscribe();
    };
  }, [refreshLocale]);

  useEffect(() => {
    document.documentElement.lang = currentLocale;
  }, [currentLocale]);

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

  const setLocale = useCallback(
    async (newLocale: AppLocaleId) => {
      const result = await window.electronAPI.setLocale(newLocale);
      if (!result.success) throw new Error('Failed to save application language');
      await refreshLocale();
    },
    [refreshLocale],
  );

  const contextValue = useMemo(
    () => ({ t, locale: currentLocale, setLocale, supportedLocales, isReady }),
    [currentLocale, isReady, setLocale, supportedLocales, t],
  );

  return <I18nContext value={contextValue}>{children}</I18nContext>;
};
