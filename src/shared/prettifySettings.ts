export const PRETTIFY_REASONING_VALUES = ['instant', 'standard', 'extended'] as const;
export const PRETTIFY_PROVIDER_IDS = ['ollama', 'vllm'] as const;

export type PrettifyReasoning = (typeof PRETTIFY_REASONING_VALUES)[number];
export type PrettifyProviderId = (typeof PRETTIFY_PROVIDER_IDS)[number];

export interface PrettifyModelOption {
  id: string;
  name: string;
}

export interface OllamaPrettifySettings {
  baseUrl: string;
  model: string;
}

export interface VllmPrettifySettings {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface PrettifySettings {
  prompt: string;
  providerId: PrettifyProviderId;
  temperature: number;
  ollama: OllamaPrettifySettings;
  vllm: VllmPrettifySettings;
}

export interface PrettifySettingsInput {
  prompt?: unknown;
  reasoning?: unknown;
  providerId?: unknown;
  temperature?: unknown;
  ollama?: Partial<OllamaPrettifySettings>;
  vllm?: Partial<VllmPrettifySettings> & {
    apiKey?: unknown;
    clearApiKey?: unknown;
  };
}

export interface PrettifyModelListResult {
  success: boolean;
  providerId: PrettifyProviderId;
  models: PrettifyModelOption[];
  error?: string;
}

export const DEFAULT_PRETTIFY_PROMPT =
  'Improve the selected text. Correct grammar errors, remove repetitions and unnecessary words, make the text clearer and neater, and preserve the original meaning. Do not add new facts. Do not significantly change the style unless necessary. Return only the improved text, without explanations or markdown.';
export const DEFAULT_PRETTIFY_REASONING: PrettifyReasoning = 'instant';
export const DEFAULT_PRETTIFY_PROVIDER_ID: PrettifyProviderId = 'ollama';
export const DEFAULT_OLLAMA_PRETTIFY_BASE_URL = 'http://127.0.0.1:11434';
export const DEFAULT_VLLM_PRETTIFY_BASE_URL = 'http://127.0.0.1:8000/v1';
export const DEFAULT_PRETTIFY_TEMPERATURE = 0;

export const DEFAULT_PRETTIFY_SETTINGS: PrettifySettings = {
  prompt: DEFAULT_PRETTIFY_PROMPT,
  providerId: DEFAULT_PRETTIFY_PROVIDER_ID,
  temperature: DEFAULT_PRETTIFY_TEMPERATURE,
  ollama: {
    baseUrl: DEFAULT_OLLAMA_PRETTIFY_BASE_URL,
    model: '',
  },
  vllm: {
    baseUrl: DEFAULT_VLLM_PRETTIFY_BASE_URL,
    model: '',
    hasApiKey: false,
  },
};

export function isPrettifyReasoning(value: unknown): value is PrettifyReasoning {
  return typeof value === 'string' && PRETTIFY_REASONING_VALUES.includes(value as PrettifyReasoning);
}

export function isPrettifyProviderId(value: unknown): value is PrettifyProviderId {
  return typeof value === 'string' && PRETTIFY_PROVIDER_IDS.includes(value as PrettifyProviderId);
}

export function normalizePrettifyTemperature(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PRETTIFY_TEMPERATURE;
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

function normalizeBaseUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || fallback;
}

function normalizeModel(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizePrettifySettings(input: PrettifySettingsInput = {}): PrettifySettings {
  const prompt =
    typeof input.prompt === 'string' && input.prompt.trim() ? input.prompt.trim() : DEFAULT_PRETTIFY_PROMPT;
  const providerId = isPrettifyProviderId(input.providerId) ? input.providerId : DEFAULT_PRETTIFY_PROVIDER_ID;
  const ollamaInput = input.ollama || {};
  const vllmInput = input.vllm || {};

  return {
    prompt,
    providerId,
    temperature: normalizePrettifyTemperature(input.temperature),
    ollama: {
      baseUrl: normalizeBaseUrl(ollamaInput.baseUrl, DEFAULT_OLLAMA_PRETTIFY_BASE_URL),
      model: normalizeModel(ollamaInput.model),
    },
    vllm: {
      baseUrl: normalizeBaseUrl(vllmInput.baseUrl, DEFAULT_VLLM_PRETTIFY_BASE_URL),
      model: normalizeModel(vllmInput.model),
      hasApiKey: typeof vllmInput.hasApiKey === 'boolean' ? vllmInput.hasApiKey : false,
    },
  };
}
