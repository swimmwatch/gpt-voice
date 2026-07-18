import { canonicalizeClaudeWebLanguage, getClaudeWebLanguageInputError } from '@shared/claudeWebSettings';

export interface ClaudeWebLanguageOption {
  label: string;
  value: string;
}

const COMMON_CLAUDE_WEB_LANGUAGE_TAGS = [
  'af',
  'am',
  'ar',
  'ar-AE',
  'ar-SA',
  'az',
  'be',
  'bg',
  'bn',
  'bs',
  'ca',
  'cs',
  'cy',
  'da',
  'de',
  'de-AT',
  'de-CH',
  'el',
  'en',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-IN',
  'en-NZ',
  'en-US',
  'es',
  'es-419',
  'es-ES',
  'et',
  'eu',
  'fa',
  'fi',
  'fil',
  'fr',
  'fr-CA',
  'ga',
  'gl',
  'gu',
  'he',
  'hi',
  'hr',
  'hu',
  'hy',
  'id',
  'is',
  'it',
  'ja',
  'ka',
  'kk',
  'km',
  'kn',
  'ko',
  'lo',
  'lt',
  'lv',
  'mk',
  'ml',
  'mn',
  'mr',
  'ms',
  'mt',
  'my',
  'ne',
  'nl',
  'no',
  'pa',
  'pl',
  'pt',
  'pt-BR',
  'pt-PT',
  'ro',
  'ru',
  'sk',
  'sl',
  'sq',
  'sr',
  'sv',
  'sw',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'ur',
  'uz',
  'vi',
  'zh',
  'zh-CN',
  'zh-HK',
  'zh-TW',
  'zu',
] as const;

function canonicalizeOptionalLanguage(value: string): string | null {
  return getClaudeWebLanguageInputError(value) ? null : canonicalizeClaudeWebLanguage(value);
}

function createLanguageDisplayNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' });
  } catch {
    return null;
  }
}

/** Builds localized searchable options while keeping the saved and suggested values first. */
export function getClaudeWebLanguageOptions(
  locale: string,
  prioritizedValues: readonly string[] = [],
): ClaudeWebLanguageOption[] {
  const displayNames = createLanguageDisplayNames(locale);
  const values = [...prioritizedValues, ...COMMON_CLAUDE_WEB_LANGUAGE_TAGS];
  const seen = new Set<string>();
  const options: ClaudeWebLanguageOption[] = [];

  for (const value of values) {
    const canonicalValue = canonicalizeOptionalLanguage(value);
    if (!canonicalValue || seen.has(canonicalValue)) continue;
    seen.add(canonicalValue);
    const displayName = displayNames?.of(canonicalValue);
    options.push({
      label: displayName && displayName !== canonicalValue ? displayName : canonicalValue,
      value: canonicalValue,
    });
  }

  return options;
}
