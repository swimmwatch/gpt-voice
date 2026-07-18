import { OPENAI_API_TRANSCRIPTION_LANGUAGES } from '@shared/openaiApiTranscription';

export interface OpenAIApiLanguageOption {
  label: string;
  value: (typeof OPENAI_API_TRANSCRIPTION_LANGUAGES)[number];
}

function createLanguageDisplayNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' });
  } catch {
    return null;
  }
}

function compareLabels(locale: string, left: OpenAIApiLanguageOption, right: OpenAIApiLanguageOption): number {
  try {
    return left.label.localeCompare(right.label, locale, { sensitivity: 'base' });
  } catch {
    return left.label.localeCompare(right.label, 'en', { sensitivity: 'base' });
  }
}

/** Builds the finite OpenAI transcription-language list with localized names. */
export function getOpenAIApiLanguageOptions(locale: string, autoLabel: string): OpenAIApiLanguageOption[] {
  const displayNames = createLanguageDisplayNames(locale);
  const languageOptions = OPENAI_API_TRANSCRIPTION_LANGUAGES.filter((value) => value !== 'auto')
    .map((value) => {
      const displayName = displayNames?.of(value);
      return {
        label: displayName && displayName !== value ? displayName : value,
        value,
      };
    })
    .sort((left, right) => compareLabels(locale, left, right));

  return [{ label: autoLabel, value: 'auto' }, ...languageOptions];
}
