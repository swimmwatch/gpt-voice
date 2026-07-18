export const CLAUDE_WEB_PROVIDER_ID = 'claude-web';
export const DEFAULT_CLAUDE_WEB_LANGUAGE = 'en-US';
export const MAX_CLAUDE_WEB_LANGUAGE_LENGTH = 255;

export type ClaudeWebLanguage = string;

export interface ClaudeWebSettings {
  language: ClaudeWebLanguage;
}

export interface ClaudeWebSettingsInput {
  language?: string;
}

export interface ClaudeWebSettingsUpdateInput {
  language: string;
}

export const DEFAULT_CLAUDE_WEB_SETTINGS: ClaudeWebSettings = {
  language: DEFAULT_CLAUDE_WEB_LANGUAGE,
};

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getClaudeWebLanguageInputError(value: unknown): string | null {
  if (typeof value !== 'string') return 'Claude language must be a string';

  const language = value.trim();
  if (!language) return 'Claude language is required';
  if (language.length > MAX_CLAUDE_WEB_LANGUAGE_LENGTH) {
    return `Claude language must be at most ${MAX_CLAUDE_WEB_LANGUAGE_LENGTH} characters`;
  }

  try {
    if (Intl.getCanonicalLocales(language).length !== 1) {
      return 'Claude language must be a valid BCP 47 language tag';
    }
  } catch {
    return 'Claude language must be a valid BCP 47 language tag';
  }

  return null;
}

export function canonicalizeClaudeWebLanguage(value?: string): ClaudeWebLanguage {
  if (value === undefined) return DEFAULT_CLAUDE_WEB_LANGUAGE;

  const error = getClaudeWebLanguageInputError(value);
  if (error) throw new Error(error);
  return Intl.getCanonicalLocales(value.trim())[0];
}

export function getClaudeWebSettingsInputError(input: unknown = {}): string | null {
  if (!isSettingsObject(input)) return 'Claude Web settings must be an object';
  if (input.language === undefined) return null;
  return getClaudeWebLanguageInputError(input.language);
}

export function assertValidClaudeWebSettingsInput(input: unknown = {}): asserts input is ClaudeWebSettingsInput {
  const error = getClaudeWebSettingsInputError(input);
  if (error) throw new Error(error);
}

export function getClaudeWebSettingsUpdateInputError(input: unknown): string | null {
  if (!isSettingsObject(input)) return 'Claude Web settings update must be an object';
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== 'language') {
    return 'Claude Web settings update must contain only language';
  }
  return getClaudeWebLanguageInputError(input.language);
}

export function assertValidClaudeWebSettingsUpdateInput(input: unknown): asserts input is ClaudeWebSettingsUpdateInput {
  const error = getClaudeWebSettingsUpdateInputError(input);
  if (error) throw new Error(error);
}

export function normalizeClaudeWebSettings(input: ClaudeWebSettingsInput = {}): ClaudeWebSettings {
  assertValidClaudeWebSettingsInput(input);
  return { language: canonicalizeClaudeWebLanguage(input.language) };
}

export function suggestClaudeWebLanguage(locale: unknown): ClaudeWebLanguage | null {
  if (getClaudeWebLanguageInputError(locale)) return null;
  return canonicalizeClaudeWebLanguage(locale as string);
}
