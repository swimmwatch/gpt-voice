import { TRANSCRIPTION_MODEL_WHISPER_1 } from '@shared/transcriptionConstants';
import { DEFAULT_OPENAI_API_PRETTIFY_MODEL } from '@shared/prettifySettings';

export const OPENAI_API_PROVIDER_ID = 'openai-api';
export const OPENAI_API_SETTINGS_MODEL = TRANSCRIPTION_MODEL_WHISPER_1;
export const OPENAI_API_SETTINGS_LANGUAGES = ['auto', 'en', 'ru', 'uk', 'be'] as const;

export type OpenAIApiModel = typeof OPENAI_API_SETTINGS_MODEL;
export type OpenAIApiLanguage = (typeof OPENAI_API_SETTINGS_LANGUAGES)[number];

export interface OpenAIApiSettings {
  model: OpenAIApiModel;
  prettifyModel: string;
  language: OpenAIApiLanguage;
  prompt: string;
  temperature: number;
}

export interface OpenAIApiSettingsInput {
  apiKey?: string;
  model?: string;
  prettifyModel?: string;
  language?: string;
  prompt?: string;
  temperature?: number;
}

export interface OpenAIApiSettingsView extends OpenAIApiSettings {
  hasApiKey: boolean;
}

export interface OpenAIApiSettingsWithSecret extends OpenAIApiSettings {
  apiKey: string;
}

export const DEFAULT_OPENAI_API_SETTINGS: OpenAIApiSettings = {
  model: OPENAI_API_SETTINGS_MODEL,
  prettifyModel: DEFAULT_OPENAI_API_PRETTIFY_MODEL,
  language: 'auto',
  prompt: '',
  temperature: 0,
};

export function isOpenAIApiLanguage(value: string): value is OpenAIApiLanguage {
  return OPENAI_API_SETTINGS_LANGUAGES.includes(value as OpenAIApiLanguage);
}

export function normalizeTemperature(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_OPENAI_API_SETTINGS.temperature;
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

export function normalizeOpenAIApiSettings(input: OpenAIApiSettingsInput = {}): OpenAIApiSettings {
  const language = typeof input.language === 'string' && isOpenAIApiLanguage(input.language) ? input.language : 'auto';

  return {
    model: OPENAI_API_SETTINGS_MODEL,
    prettifyModel:
      typeof input.prettifyModel === 'string' && input.prettifyModel.trim()
        ? input.prettifyModel.trim()
        : DEFAULT_OPENAI_API_SETTINGS.prettifyModel,
    language,
    prompt: typeof input.prompt === 'string' ? input.prompt.trim() : '',
    temperature: normalizeTemperature(input.temperature),
  };
}

export function sanitizeOpenAIApiSettings(settings: OpenAIApiSettingsInput, hasApiKey: boolean): OpenAIApiSettingsView {
  return {
    ...normalizeOpenAIApiSettings(settings),
    hasApiKey,
  };
}

export function shouldUpdateApiKey(apiKey: unknown): apiKey is string {
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}
