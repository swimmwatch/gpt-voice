import { StatusCodes } from 'http-status-codes';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { getPrettifySettingsWithSecret, type PrettifySettingsWithSecret } from '@main/services/prettifySettingsStorage';
import type {
  PrettifyModelLoadResult,
  PrettifyModelOption,
  PrettifyProviderId,
  PrettifySettingsInput,
} from '@shared/prettifySettings';

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

interface LoadedOllamaPrettifyModel {
  baseUrl: string;
  model: string;
}

interface RunningOllamaModelInfo {
  sizeBytes?: number;
  vramSizeBytes?: number;
}

let loadedOllamaPrettifyModel: LoadedOllamaPrettifyModel | null = null;

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

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function getOllamaModelId(item: Record<string, unknown>): string {
  const id = typeof item.model === 'string' ? item.model : typeof item.name === 'string' ? item.name : '';
  return id.trim();
}

function parseOllamaModels(body: string): PrettifyModelOption[] {
  const parsed = safeJsonParse(body);
  if (!isRecord(parsed) || !Array.isArray(parsed.models)) return [];

  return parsed.models
    .map((item): PrettifyModelOption | null => {
      if (!isRecord(item)) return null;
      const id = getOllamaModelId(item);
      if (!id) return null;
      const sizeBytes = getFiniteNumber(item.size);
      return sizeBytes === undefined ? { id, name: id } : { id, name: id, sizeBytes };
    })
    .filter((item): item is PrettifyModelOption => Boolean(item));
}

function parseOllamaRunningModels(body: string): Map<string, RunningOllamaModelInfo> {
  const parsed = safeJsonParse(body);
  const models = new Map<string, RunningOllamaModelInfo>();
  if (!isRecord(parsed) || !Array.isArray(parsed.models)) return models;

  for (const item of parsed.models) {
    if (!isRecord(item)) continue;
    const id = getOllamaModelId(item);
    if (!id) continue;
    const sizeBytes = getFiniteNumber(item.size);
    const vramSizeBytes = getFiniteNumber(item.size_vram);
    models.set(id, {
      ...(sizeBytes === undefined ? {} : { sizeBytes }),
      ...(vramSizeBytes === undefined ? {} : { vramSizeBytes }),
    });
  }

  return models;
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

async function getRunningOllamaModels(
  baseUrl: string,
  deps: PrettifyProviderDependencies,
): Promise<Map<string, RunningOllamaModelInfo>> {
  const response = await deps.fetch(joinUrl(baseUrl, '/api/ps'));
  const body = await response.text();
  if (response.status !== StatusCodes.OK) return new Map();
  return parseOllamaRunningModels(body);
}

async function getOllamaModelVramSize(
  baseUrl: string,
  model: string,
  deps: PrettifyProviderDependencies,
): Promise<number | undefined> {
  try {
    return (await getRunningOllamaModels(baseUrl, deps)).get(model)?.vramSizeBytes;
  } catch {
    return undefined;
  }
}

function withOllamaRunningMetadata(
  models: PrettifyModelOption[],
  runningModels: Map<string, RunningOllamaModelInfo>,
): PrettifyModelOption[] {
  return models.map((model) => {
    const runningModel = runningModels.get(model.id);
    if (!runningModel) return model;
    const sizeBytes = model.sizeBytes ?? runningModel.sizeBytes;

    return {
      ...model,
      isLoaded: true,
      ...(sizeBytes === undefined ? {} : { sizeBytes }),
      ...(runningModel.vramSizeBytes === undefined ? {} : { vramSizeBytes: runningModel.vramSizeBytes }),
    };
  });
}

function isPinnedOllamaModel(settings: PrettifySettingsWithSecret['ollama']): boolean {
  return (
    Boolean(loadedOllamaPrettifyModel) &&
    loadedOllamaPrettifyModel?.baseUrl === settings.baseUrl &&
    loadedOllamaPrettifyModel.model === settings.model
  );
}

async function setOllamaModelKeepAlive(
  model: LoadedOllamaPrettifyModel,
  keepAlive: number,
  deps: PrettifyProviderDependencies,
): Promise<void> {
  const response = await deps.fetch(joinUrl(model.baseUrl, '/api/chat'), {
    method: 'POST',
    headers: createJsonHeaders(),
    body: JSON.stringify({
      model: model.model,
      messages: [],
      keep_alive: keepAlive,
      stream: false,
    }),
  });
  await response.text();
  if (response.status !== StatusCodes.OK) {
    throw new Error(createHttpError('Ollama', response.status));
  }
}

const ollamaAdapter: PrettifyProviderAdapter = {
  async listModels(settings, deps) {
    const response = await deps.fetch(joinUrl(settings.ollama.baseUrl, '/api/tags'));
    const body = await response.text();
    if (response.status !== StatusCodes.OK) {
      throw new Error(createHttpError('Ollama', response.status));
    }
    const models = parseOllamaModels(body);
    try {
      return withOllamaRunningMetadata(models, await getRunningOllamaModels(settings.ollama.baseUrl, deps));
    } catch {
      return models;
    }
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
        ...(isPinnedOllamaModel(settings.ollama) ? { keep_alive: -1 } : {}),
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

export async function loadPrettifyModel(
  providerId: PrettifyProviderId,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = { fetch },
): Promise<PrettifyModelLoadResult> {
  const settings = getPrettifySettingsWithSecret({ ...draftSettings, providerId });
  if (providerId !== 'ollama') {
    return { success: false, providerId, error: 'Model loading is available only for Ollama' };
  }
  if (!settings.ollama.model) {
    return { success: false, providerId, error: t('error.noPrettifyModel') };
  }

  const nextModel = {
    baseUrl: settings.ollama.baseUrl,
    model: settings.ollama.model,
  };

  try {
    if (
      loadedOllamaPrettifyModel &&
      (loadedOllamaPrettifyModel.baseUrl !== nextModel.baseUrl || loadedOllamaPrettifyModel.model !== nextModel.model)
    ) {
      await setOllamaModelKeepAlive(loadedOllamaPrettifyModel, 0, deps);
    }

    log.info('Loading Ollama prettify model:', { model: nextModel.model });
    await setOllamaModelKeepAlive(nextModel, -1, deps);
    loadedOllamaPrettifyModel = nextModel;
    return {
      success: true,
      providerId,
      model: nextModel.model,
      vramSizeBytes: await getOllamaModelVramSize(nextModel.baseUrl, nextModel.model, deps),
    };
  } catch (error: unknown) {
    return {
      success: false,
      providerId,
      model: nextModel.model,
      error: createConnectionError('Ollama', nextModel.baseUrl, error),
    };
  }
}

export async function unloadLoadedOllamaPrettifyModel(deps: PrettifyProviderDependencies = { fetch }): Promise<void> {
  const model = loadedOllamaPrettifyModel;
  if (!model) return;

  loadedOllamaPrettifyModel = null;
  log.info('Unloading Ollama prettify model:', { model: model.model });
  await setOllamaModelKeepAlive(model, 0, deps);
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
