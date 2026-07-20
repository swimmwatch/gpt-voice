import {
  OPENAI_API_TRANSCRIPTION_LANGUAGES,
  OPENAI_API_TRANSCRIPTION_MODELS,
  isOpenAIApiTranscriptionLanguage,
  isOpenAIApiTranscriptionModel,
  type OpenAIApiTranscriptionLanguage,
  type OpenAIApiTranscriptionModel,
} from '@shared/openaiApiTranscription';
import { TRANSCRIPTION_MODEL_WHISPER_1 } from '@shared/transcriptionConstants';

export const OPENAI_API_PROVIDER_ID = 'openai-api';
export const OPENAI_API_SETTINGS_MODEL = TRANSCRIPTION_MODEL_WHISPER_1;
export const OPENAI_API_SETTINGS_MODELS = OPENAI_API_TRANSCRIPTION_MODELS;
export const OPENAI_API_SETTINGS_LANGUAGES = OPENAI_API_TRANSCRIPTION_LANGUAGES;

export type OpenAIApiModel = OpenAIApiTranscriptionModel;
export type OpenAIApiLanguage = OpenAIApiTranscriptionLanguage;

export interface OpenAIApiSettings {
  model: OpenAIApiModel;
  language: OpenAIApiLanguage;
  prompt: string;
  temperature: number;
}

export interface OpenAIApiSettingsInput {
  apiKey?: string;
  model?: string;
  prettifyModel?: unknown;
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
  language: 'auto',
  prompt: '',
  temperature: 0,
};

export function isOpenAIApiLanguage(value: string): value is OpenAIApiLanguage {
  return isOpenAIApiTranscriptionLanguage(value);
}

export function isOpenAIApiModel(value: string): value is OpenAIApiModel {
  return isOpenAIApiTranscriptionModel(value);
}

export function normalizeTemperature(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_OPENAI_API_SETTINGS.temperature;
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

function isOpenAIApiSettingsInput(value: unknown): value is OpenAIApiSettingsInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getOpenAIApiSettingsInputError(input: unknown = {}): string | null {
  if (!isOpenAIApiSettingsInput(input)) {
    return 'OpenAI API settings must be an object';
  }
  if (input.apiKey !== undefined && typeof input.apiKey !== 'string') {
    return 'OpenAI API key must be a string';
  }
  if (input.model !== undefined && !isOpenAIApiModel(input.model)) {
    return 'Select a supported transcription model';
  }
  if (input.language !== undefined && !isOpenAIApiLanguage(input.language)) {
    return 'Select a supported transcription language';
  }
  if (input.prompt !== undefined && typeof input.prompt !== 'string') {
    return 'Transcription prompt must be a string';
  }
  if (
    input.temperature !== undefined &&
    (typeof input.temperature !== 'number' ||
      !Number.isFinite(input.temperature) ||
      input.temperature < 0 ||
      input.temperature > 1)
  ) {
    return 'Temperature must be between 0 and 1';
  }
  return null;
}

export function assertValidOpenAIApiSettingsInput(input: unknown = {}): asserts input is OpenAIApiSettingsInput {
  const error = getOpenAIApiSettingsInputError(input);
  if (error) throw new Error(error);
}

export function normalizeOpenAIApiSettings(input: OpenAIApiSettingsInput = {}): OpenAIApiSettings {
  const model =
    typeof input.model === 'string' && isOpenAIApiModel(input.model) ? input.model : OPENAI_API_SETTINGS_MODEL;
  const language = typeof input.language === 'string' && isOpenAIApiLanguage(input.language) ? input.language : 'auto';

  return {
    model,
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
