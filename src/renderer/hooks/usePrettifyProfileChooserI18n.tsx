import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import defaultTranslations from '@main/i18n/en';
import { DEFAULT_APP_LOCALE, type AppLocaleId } from '@shared/appLocale';
import type { PrettifyProfileChooserAPI } from '@shared/prettifyProfileChooser';

const DEFAULT_TRANSLATIONS: Readonly<Record<string, string>> = defaultTranslations;

interface PrettifyProfileChooserI18nContextValue {
  readonly isReady: boolean;
  readonly locale: AppLocaleId;
  readonly t: (key: string, params?: Readonly<Record<string, string>>) => string;
}

interface PrettifyProfileChooserI18nProviderProps {
  readonly api: Pick<PrettifyProfileChooserAPI, 'getLocale' | 'getTranslations' | 'onLocaleChanged'>;
  readonly children: ReactNode;
}

const PrettifyProfileChooserI18nContext = createContext<PrettifyProfileChooserI18nContextValue>({
  isReady: false,
  locale: DEFAULT_APP_LOCALE,
  t: (key) => DEFAULT_TRANSLATIONS[key] ?? key,
});

export function usePrettifyProfileChooserI18n(): PrettifyProfileChooserI18nContextValue {
  return use(PrettifyProfileChooserI18nContext);
}

export function PrettifyProfileChooserI18nProvider({
  api,
  children,
}: PrettifyProfileChooserI18nProviderProps): React.JSX.Element {
  const [translations, setTranslations] = useState<Readonly<Record<string, string>>>(DEFAULT_TRANSLATIONS);
  const [locale, setLocale] = useState<AppLocaleId>(DEFAULT_APP_LOCALE);
  const [isReady, setIsReady] = useState(false);
  const refreshRequestRef = useRef(0);

  const refreshLocale = useCallback(async (): Promise<void> => {
    const requestId = ++refreshRequestRef.current;
    const [nextTranslations, nextLocale] = await Promise.all([api.getTranslations(), api.getLocale()]);
    if (requestId !== refreshRequestRef.current) return;
    setTranslations(nextTranslations);
    setLocale(nextLocale);
    setIsReady(true);
  }, [api]);

  useEffect(() => {
    let disposed = false;
    const initialize = async (): Promise<void> => {
      try {
        await refreshLocale();
      } catch {
        if (!disposed) setIsReady(true);
      }
    };
    void initialize();

    const unsubscribe = api.onLocaleChanged(() => {
      void refreshLocale().catch(() => undefined);
    });
    return () => {
      disposed = true;
      refreshRequestRef.current += 1;
      unsubscribe();
    };
  }, [api, refreshLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Readonly<Record<string, string>>): string => {
      let text = translations[key] ?? DEFAULT_TRANSLATIONS[key] ?? key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(`{${name}}`, value);
        }
      }
      return text;
    },
    [translations],
  );
  const value = useMemo(() => ({ isReady, locale, t }), [isReady, locale, t]);

  return <PrettifyProfileChooserI18nContext value={value}>{children}</PrettifyProfileChooserI18nContext>;
}
