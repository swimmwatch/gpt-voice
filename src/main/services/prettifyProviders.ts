import { StatusCodes } from 'http-status-codes';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { getPrettifySettingsWithSecret, type PrettifySettingsWithSecret } from '@main/services/prettifySettingsStorage';
import type { PrettifyModelOption, PrettifyProviderId, PrettifySettingsInput } from '@shared/prettifySettings';

const log = createLogger('prettify-provider');

export interface TextProcessingResult {
  success: boolean;
  text?: string;
  error?: string;
}

interface FetchResponseLike {
  status: number;
  text(): Promise<string>;
}

interface PrettifyProviderDependencies {
  fetch: (url: string, init?: RequestInit) => Promise<FetchResponseLike>;
}

interface PrettifyProviderRequest {
  text: string;
  signal?: AbortSignal;
  settings: PrettifySettingsWithSecret;
}

interface PrettifyProviderAdapter {
  listModels(settings: PrettifySettingsWithSecret, deps: PrettifyProviderDependencies): Promise<PrettifyModelOption[]>;
  prettify(request: PrettifyProviderRequest, deps: PrettifyProviderDependencies): Promise<TextProcessingResult>;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function safeJsonParse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createHttpError(providerName: string, status: number): string {
  return `${providerName} request failed (${status})`;
}

function sanitizeBaseUrlForMessage(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    url.username = '';
    url.password = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return baseUrl;
  }
}

function createConnectionError(providerName: string, baseUrl: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to connect to ${providerName} at ${sanitizeBaseUrlForMessage(baseUrl)}: ${message}`;
}

function createMessages(prompt: string, text: string): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: prompt },
    { role: 'user', content: text },
  ];
}

function createJsonHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function parseOllamaModels(body: string): PrettifyModelOption[] {
  const parsed = safeJsonParse(body);
  if (!isRecord(parsed) || !Array.isArray(parsed.models)) return [];

  return parsed.models
    .map((item): PrettifyModelOption | null => {
      if (!isRecord(item)) return null;
      const id = typeof item.model === 'string' ? item.model : typeof item.name === 'string' ? item.name : '';
      const trimmedId = id.trim();
      return trimmedId ? { id: trimmedId, name: trimmedId } : null;
    })
    .filter((item): item is PrettifyModelOption => Boolean(item));
}

function parseVllmModels(body: string): PrettifyModelOption[] {
  const parsed = safeJsonParse(body);
  if (!isRecord(parsed) || !Array.isArray(parsed.data)) return [];

  return parsed.data
    .map((item): PrettifyModelOption | null => {
      if (!isRecord(item) || typeof item.id !== 'string') return null;
      const id = item.id.trim();
      return id ? { id, name: id } : null;
    })
    .filter((item): item is PrettifyModelOption => Boolean(item));
}

function extractOllamaText(body: string): string {
  const parsed = safeJsonParse(body);
  if (!isRecord(parsed) || !isRecord(parsed.message) || typeof parsed.message.content !== 'string') return '';
  return parsed.message.content.trim();
}

function extractVllmText(body: string): string {
  const parsed = safeJsonParse(body);
  if (!isRecord(parsed) || !Array.isArray(parsed.choices)) return '';
  const firstChoice = parsed.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message) || typeof firstChoice.message.content !== 'string') {
    return '';
  }
  return firstChoice.message.content.trim();
}

const ollamaAdapter: PrettifyProviderAdapter = {
  async listModels(settings, deps) {
    const response = await deps.fetch(joinUrl(settings.ollama.baseUrl, '/api/tags'));
    const body = await response.text();
    if (response.status !== StatusCodes.OK) {
      throw new Error(createHttpError('Ollama', response.status));
    }
    return parseOllamaModels(body);
  },

  async prettify({ text, signal, settings }, deps) {
    const response = await deps.fetch(joinUrl(settings.ollama.baseUrl, '/api/chat'), {
      method: 'POST',
      headers: createJsonHeaders(),
      signal,
      body: JSON.stringify({
        model: settings.ollama.model,
        messages: createMessages(settings.prompt, text),
        options: {
          temperature: settings.temperature,
        },
        stream: false,
      }),
    });
    const body = await response.text();
    if (response.status !== StatusCodes.OK) {
      return { success: false, error: createHttpError('Ollama', response.status) };
    }

    const result = extractOllamaText(body);
    return result ? { success: true, text: result } : { success: false, error: t('error.noPrettifyResult') };
  },
};

const vllmAdapter: PrettifyProviderAdapter = {
  async listModels(settings, deps) {
    const response = await deps.fetch(joinUrl(settings.vllm.baseUrl, '/models'), {
      headers: createJsonHeaders(settings.vllm.apiKey),
    });
    const body = await response.text();
    if (response.status !== StatusCodes.OK) {
      throw new Error(createHttpError('vLLM', response.status));
    }
    return parseVllmModels(body);
  },

  async prettify({ text, signal, settings }, deps) {
    const response = await deps.fetch(joinUrl(settings.vllm.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: createJsonHeaders(settings.vllm.apiKey),
      signal,
      body: JSON.stringify({
        model: settings.vllm.model,
        messages: createMessages(settings.prompt, text),
        temperature: settings.temperature,
        stream: false,
      }),
    });
    const body = await response.text();
    if (response.status !== StatusCodes.OK) {
      return { success: false, error: createHttpError('vLLM', response.status) };
    }

    const result = extractVllmText(body);
    return result ? { success: true, text: result } : { success: false, error: t('error.noPrettifyResult') };
  },
};

const providerAdapters: Record<PrettifyProviderId, PrettifyProviderAdapter> = {
  ollama: ollamaAdapter,
  vllm: vllmAdapter,
};

export async function listPrettifyModels(
  providerId: PrettifyProviderId,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = { fetch },
): Promise<PrettifyModelOption[]> {
  const settings = getPrettifySettingsWithSecret({ ...draftSettings, providerId });
  const adapter = providerAdapters[providerId];
  try {
    return await adapter.listModels(settings, deps);
  } catch (error: unknown) {
    const baseUrl = providerId === 'ollama' ? settings.ollama.baseUrl : settings.vllm.baseUrl;
    const wrappedError = new Error(createConnectionError(providerId === 'ollama' ? 'Ollama' : 'vLLM', baseUrl, error));
    (wrappedError as Error & { cause?: unknown }).cause = error;
    throw wrappedError;
  }
}

export async function runPrettify(
  text: string,
  draftSettings: PrettifySettingsInput = {},
  signal?: AbortSignal,
  deps: PrettifyProviderDependencies = { fetch },
): Promise<TextProcessingResult> {
  const settings = getPrettifySettingsWithSecret(draftSettings);
  const adapter = providerAdapters[settings.providerId];
  const model = settings.providerId === 'ollama' ? settings.ollama.model : settings.vllm.model;
  const baseUrl = settings.providerId === 'ollama' ? settings.ollama.baseUrl : settings.vllm.baseUrl;

  if (!model) {
    return { success: false, error: t('error.noPrettifyModel') };
  }

  try {
    log.info('Running selected-text prettify:', {
      providerId: settings.providerId,
      model,
      textLength: text.length,
      promptLength: settings.prompt.length,
      temperature: settings.temperature,
    });
    return await adapter.prettify({ text, signal, settings }, deps);
  } catch (error: unknown) {
    if (signal?.aborted) {
      return { success: false, error: t('status.prettifyCancelled') };
    }
    return {
      success: false,
      error: createConnectionError(settings.providerId === 'ollama' ? 'Ollama' : 'vLLM', baseUrl, error),
    };
  }
}
