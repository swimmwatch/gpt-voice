export const DEFAULT_GOOGLE_TRANSLATE_TARGET_LANG = 'en';
export const GOOGLE_TRANSLATE_TARGET_LANGUAGES = ['en', 'ru', 'uk', 'be'] as const;
export const GOOGLE_TRANSLATE_SOURCE_SELECTOR = 'textarea.er8xn';
export const GOOGLE_TRANSLATE_RESULT_SELECTOR = '.ryNqvb';
export const GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS = 60000;
export const GOOGLE_TRANSLATE_SOURCE_TIMEOUT_MS = 10000;
export const GOOGLE_TRANSLATE_RESULT_TIMEOUT_MS = 15000;
export const GOOGLE_TRANSLATE_CLEAR_RESULT_TIMEOUT_MS = 1500;

export interface TranslationLogMetadata {
  textLength: number;
  targetLang: string;
}

export function isGoogleTranslateTargetLanguage(value: unknown): value is (typeof GOOGLE_TRANSLATE_TARGET_LANGUAGES)[number] {
  return typeof value === 'string' && GOOGLE_TRANSLATE_TARGET_LANGUAGES.includes(value as never);
}

export function normalizeGoogleTranslateTargetLang(targetLang: string): string {
  return targetLang.trim() || DEFAULT_GOOGLE_TRANSLATE_TARGET_LANG;
}

export function buildGoogleTranslateUrl(targetLang: string): string {
  const url = new URL('https://translate.google.ru/');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', normalizeGoogleTranslateTargetLang(targetLang));
  url.searchParams.set('op', 'translate');
  return url.toString();
}

export function shouldNavigateGoogleTranslate(
  currentTargetLang: string | null | undefined,
  nextTargetLang: string,
): boolean {
  return currentTargetLang !== normalizeGoogleTranslateTargetLang(nextTargetLang);
}

export function createTranslationLogMetadata(text: string, targetLang: string): TranslationLogMetadata {
  return {
    textLength: text.length,
    targetLang: normalizeGoogleTranslateTargetLang(targetLang),
  };
}
