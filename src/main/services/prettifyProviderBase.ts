import type { ClaudeCliPrettifyAdapter } from '@main/services/prettifyClaudeCli';
import type { CodexCliPrettifyAdapter } from '@main/services/prettifyCodexCli';
import type { PrettifySettingsWithSecret } from '@main/services/prettifySettingsStorage';
import {
  getPrettifyProviderCapabilities,
  type KnownPrettifyProviderId,
  type PrettifyCliRuntimeErrorCode,
  type PrettifyModelLoadResult,
  type PrettifyModelListResult,
  type PrettifyModelOption,
  type PrettifyModelSource,
  type PrettifyModelUnloadResult,
  type PrettifyProviderCapabilities,
  type PrettifyProviderAvailability,
} from '@shared/prettifySettings';

export const PRETTIFY_PROVIDER_UNAVAILABLE_ERROR = 'Prettify provider is unavailable';

export interface TextProcessingResult {
  success: boolean;
  text?: string;
  error?: string;
  errorCode?: PrettifyCliRuntimeErrorCode;
}

interface FetchResponseLike {
  status: number;
  text(): Promise<string>;
}

export interface PrettifyProviderDependencies {
  claudeCliAdapter?: Pick<ClaudeCliPrettifyAdapter, 'prepare'> &
    Partial<Pick<ClaudeCliPrettifyAdapter, 'checkAvailability'>>;
  codexCliAdapter?: Pick<CodexCliPrettifyAdapter, 'listModels' | 'prepare'> &
    Partial<Pick<CodexCliPrettifyAdapter, 'checkAvailability'>>;
  fetch: (url: string, init?: RequestInit) => Promise<FetchResponseLike>;
}

export interface PrettifyProviderRequest {
  text: string;
  signal?: AbortSignal;
  settings: PrettifySettingsWithSecret;
}

export interface PrettifyProviderModelMetadata {
  model: string;
  source: PrettifyModelSource;
  usesDefaultModel: boolean;
}

export interface PrettifyProviderModelList {
  availability: PrettifyModelListResult['availability'];
  models: PrettifyModelOption[];
  source: PrettifyModelSource;
}

export interface PreparedPrettifyExecution {
  readonly cacheContext: readonly string[];
  readonly providerId: KnownPrettifyProviderId;
  execute(text: string): Promise<TextProcessingResult>;
}

export type PreparePrettifyExecutionResult =
  | { prepared: PreparedPrettifyExecution; success: true }
  | { error: string; errorCode?: PrettifyCliRuntimeErrorCode; success: false };

export function createOneShotExecution(
  providerId: KnownPrettifyProviderId,
  cacheContext: readonly string[],
  execute: (text: string) => Promise<TextProcessingResult>,
): PreparedPrettifyExecution {
  let consumed = false;
  return {
    cacheContext,
    providerId,
    execute: async (text) => {
      if (consumed) return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
      consumed = true;
      return execute(text);
    },
  };
}

/** Shared provider-domain contract. Persistence, validation, and IPC stay in their dedicated services. */
export abstract class BasePrettifyProvider {
  public readonly capabilities: PrettifyProviderCapabilities;

  protected constructor(public readonly id: KnownPrettifyProviderId) {
    this.capabilities = getPrettifyProviderCapabilities(id);
  }

  public getModelMetadata(settings: PrettifySettingsWithSecret): PrettifyProviderModelMetadata {
    const model = this.getConfiguredModel(settings);
    return {
      model,
      source: this.capabilities.modelSource,
      usesDefaultModel: !model,
    };
  }

  public checkAvailability(
    _settings: PrettifySettingsWithSecret,
    _signal: AbortSignal,
    _deps: PrettifyProviderDependencies,
  ): Promise<PrettifyProviderAvailability> {
    return Promise.resolve({ status: 'unavailable' });
  }

  public listModels(
    _settings: PrettifySettingsWithSecret,
    _deps: PrettifyProviderDependencies,
  ): Promise<PrettifyProviderModelList> {
    return Promise.resolve({
      availability: { status: 'unavailable' },
      models: [],
      source: this.capabilities.modelSource,
    });
  }

  public prepare(
    _settings: PrettifySettingsWithSecret,
    _signal: AbortSignal,
    _deps: PrettifyProviderDependencies,
  ): Promise<PreparePrettifyExecutionResult> {
    return Promise.resolve({ success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR });
  }

  public prettify(
    _request: PrettifyProviderRequest,
    _deps: PrettifyProviderDependencies,
  ): Promise<TextProcessingResult> {
    return Promise.resolve({ success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR });
  }

  public loadModel(
    _settings: PrettifySettingsWithSecret,
    _deps: PrettifyProviderDependencies,
  ): Promise<PrettifyModelLoadResult> {
    return Promise.resolve({
      success: false,
      providerId: this.id,
      error: 'Model loading is available only for Ollama',
    });
  }

  public unloadModel(
    _settings: PrettifySettingsWithSecret,
    _deps: PrettifyProviderDependencies,
  ): Promise<PrettifyModelUnloadResult> {
    return Promise.resolve({
      success: false,
      providerId: this.id,
      error: 'Model unloading is available only for Ollama',
    });
  }

  protected abstract getConfiguredModel(settings: PrettifySettingsWithSecret): string;
}
