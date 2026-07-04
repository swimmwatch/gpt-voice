export const PRETTIFY_REASONING_VALUES = ['instant', 'standard', 'extended'] as const;

export type PrettifyReasoning = (typeof PRETTIFY_REASONING_VALUES)[number];

export interface PrettifySettings {
  prompt: string;
  reasoning: PrettifyReasoning;
}

export interface PrettifySettingsInput {
  prompt?: unknown;
  reasoning?: unknown;
}

export const DEFAULT_PRETTIFY_PROMPT =
  'Improve the selected text. Correct grammar errors, remove repetitions and unnecessary words, make the text clearer and neater, and preserve the original meaning. Do not add new facts. Do not significantly change the style unless necessary. Return only the improved text, without explanations or markdown.';
export const DEFAULT_PRETTIFY_REASONING: PrettifyReasoning = 'instant';
export const DEFAULT_OPENAI_API_PRETTIFY_MODEL = 'gpt-5.4-mini';

export const DEFAULT_PRETTIFY_SETTINGS: PrettifySettings = {
  prompt: DEFAULT_PRETTIFY_PROMPT,
  reasoning: DEFAULT_PRETTIFY_REASONING,
};

export function isPrettifyReasoning(value: unknown): value is PrettifyReasoning {
  return typeof value === 'string' && PRETTIFY_REASONING_VALUES.includes(value as PrettifyReasoning);
}

export function normalizePrettifySettings(input: PrettifySettingsInput = {}): PrettifySettings {
  const prompt =
    typeof input.prompt === 'string' && input.prompt.trim() ? input.prompt.trim() : DEFAULT_PRETTIFY_PROMPT;
  const reasoning = isPrettifyReasoning(input.reasoning) ? input.reasoning : DEFAULT_PRETTIFY_REASONING;

  return { prompt, reasoning };
}
