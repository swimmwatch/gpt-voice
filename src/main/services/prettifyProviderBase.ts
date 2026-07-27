import type { PrettifyAuditOperationContext, PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
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

export interface PrettifyFetchResponse {
  status: number;
  text(): Promise<string>;
}

export type PrettifyFetch = (url: string, init?: RequestInit) => Promise<PrettifyFetchResponse>;

export interface PrettifyProviderDependencies {
  readonly audit: PrettifyProviderAudit;
}

export interface PrettifyProviderRequest {
  auditContext?: PrettifyAuditOperationContext;
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

/** Shared provider-domain contract. Persistence, validation, and IPC stay in their dedicated services. */
export abstract class BasePrettifyProvider {
  public readonly capabilities: PrettifyProviderCapabilities;

  protected constructor(
    public readonly id: KnownPrettifyProviderId,
    protected readonly audit: PrettifyProviderAudit,
  ) {
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
    _auditContext?: PrettifyAuditOperationContext,
  ): Promise<PrettifyProviderAvailability> {
    return Promise.resolve({ status: 'unavailable' });
  }

  public listModels(
    _settings: PrettifySettingsWithSecret,
    _auditContext?: PrettifyAuditOperationContext,
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
    _auditContext?: PrettifyAuditOperationContext,
  ): Promise<PreparePrettifyExecutionResult> {
    return Promise.resolve({ success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR });
  }

  public prettify(_request: PrettifyProviderRequest): Promise<TextProcessingResult> {
    return Promise.resolve({ success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR });
  }

  public loadModel(
    _settings: PrettifySettingsWithSecret,
    _auditContext?: PrettifyAuditOperationContext,
  ): Promise<PrettifyModelLoadResult> {
    return Promise.resolve({
      success: false,
      providerId: this.id,
      error: 'Model loading is available only for Ollama',
    });
  }

  public unloadModel(
    _settings: PrettifySettingsWithSecret,
    _auditContext?: PrettifyAuditOperationContext,
  ): Promise<PrettifyModelUnloadResult> {
    return Promise.resolve({
      success: false,
      providerId: this.id,
      error: 'Model unloading is available only for Ollama',
    });
  }

  protected abstract getConfiguredModel(settings: PrettifySettingsWithSecret): string;
}
