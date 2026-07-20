export const APP_LOCALE_IDS = ['en', 'ru', 'be', 'uk', 'es', 'pt-BR', 'zh', 'ja', 'de', 'fr', 'hi'] as const;

export type AppLocaleId = (typeof APP_LOCALE_IDS)[number];

export interface AppLocaleDefinition {
  id: AppLocaleId;
  nativeName: string;
}

export const APP_LOCALES: readonly AppLocaleDefinition[] = [
  { id: 'en', nativeName: 'English' },
  { id: 'ru', nativeName: 'Русский' },
  { id: 'be', nativeName: 'Беларуская' },
  { id: 'uk', nativeName: 'Українська' },
  { id: 'es', nativeName: 'Español' },
  { id: 'pt-BR', nativeName: 'Português (Brasil)' },
  { id: 'zh', nativeName: '简体中文' },
  { id: 'ja', nativeName: '日本語' },
  { id: 'de', nativeName: 'Deutsch' },
  { id: 'fr', nativeName: 'Français' },
  { id: 'hi', nativeName: 'हिन्दी' },
];

export const DEFAULT_APP_LOCALE: AppLocaleId = 'en';

export function isAppLocaleId(value: unknown): value is AppLocaleId {
  return typeof value === 'string' && APP_LOCALE_IDS.includes(value as AppLocaleId);
}

/** Canonicalizes saved locale spellings without broadening the supported locale set. */
export function normalizeAppLocale(value: unknown): AppLocaleId | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().replace(/_/gu, '-');
  if (!candidate) return null;

  const exact = APP_LOCALE_IDS.find((locale) => locale.toLowerCase() === candidate.toLowerCase());
  if (exact) return exact;

  const base = candidate.split('-')[0]?.toLowerCase();
  return APP_LOCALE_IDS.find((locale) => locale.toLowerCase() === base) ?? null;
}
