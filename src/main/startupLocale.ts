import { DEFAULT_APP_LOCALE, normalizeAppLocale, type AppLocaleId } from '@shared/appLocale';

export { DEFAULT_APP_LOCALE } from '@shared/appLocale';

/** Uses a supported explicit preference; legacy or missing preferences start in English. */
export function resolveStartupLocale(
  savedLocale: unknown,
  savedLocaleWasExplicitlySelected: boolean,
  supportedLocaleValues: readonly AppLocaleId[],
): AppLocaleId {
  const supportedLocales = new Set(supportedLocaleValues);
  const normalizedLocale = normalizeAppLocale(savedLocale);
  return savedLocaleWasExplicitlySelected && normalizedLocale && supportedLocales.has(normalizedLocale)
    ? normalizedLocale
    : DEFAULT_APP_LOCALE;
}
