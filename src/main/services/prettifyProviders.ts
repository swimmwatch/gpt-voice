/* eslint-disable max-classes-per-file -- Factory, registry, and runtime form one Prettify ownership boundary. */
import type { I18nService } from '@main/i18n';
import {
  ClaudeCliPrettifyProvider,
  CodexCliPrettifyProvider,
  createCliFailure,
} from '@main/services/prettifyCliProviders';
import type { ClaudeCliPrettifyAdapter } from '@main/services/prettifyClaudeCli';
import { ClaudeCliPrettifyErrorCode } from '@main/services/prettifyClaudeCli';
import type { CodexCliPrettifyAdapter } from '@main/services/prettifyCodexCli';
import { CodexCliPrettifyErrorCode } from '@main/services/prettifyCodexCli';
import {
  OllamaPrettifyProvider,
  VllmPrettifyProvider,
  createConnectionError,
  getHttpPrettifyProviderBaseUrl,
  getHttpPrettifyProviderName,
  isHttpPrettifyProviderId,
} from '@main/services/prettifyHttpProviders';
import {
  BasePrettifyProvider,
  PRETTIFY_PROVIDER_UNAVAILABLE_ERROR,
  type PreparePrettifyExecutionResult,
  type PrettifyFetch,
  type PrettifyProviderDependencies,
  type TextProcessingResult,
} from '@main/services/prettifyProviderBase';
import type { PrettifyHttpReadiness } from '@main/services/prettifyHttpReadiness';
import type { PrettifyAuditOperationContext, PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import type { PrettifySettingsStorage, PrettifySettingsWithSecret } from '@main/services/prettifySettingsStorage';
import {
  isKnownPrettifyProviderId,
  isPrettifyCliProviderId,
  isPrettifyProviderId,
  type KnownPrettifyProviderId,
  type PrettifyCliConnectionResult,
  type PrettifyCliRuntimeErrorCode,
  type PrettifyModelListResult,
  type PrettifyModelLoadResult,
  type PrettifyModelUnloadResult,
  type PrettifySettingsInput,
} from '@shared/prettifySettings';

export {
  BasePrettifyProvider,
  ClaudeCliPrettifyProvider,
  CodexCliPrettifyProvider,
  OllamaPrettifyProvider,
  PRETTIFY_PROVIDER_UNAVAILABLE_ERROR,
  VllmPrettifyProvider,
};
export type {
  PreparedPrettifyExecution,
  PrettifyProviderDependencies,
  PrettifyProviderModelMetadata,
  PrettifyProviderRequest,
} from '@main/services/prettifyProviderBase';
export type { PreparePrettifyExecutionResult, TextProcessingResult };

export interface PrettifyProviderFactoryDependencies {
  readonly audit: PrettifyProviderAudit;
  readonly claudeCliAdapter: Pick<ClaudeCliPrettifyAdapter, 'checkAvailability' | 'prepare'>;
  readonly codexCliAdapter: Pick<CodexCliPrettifyAdapter, 'checkAvailability' | 'listModels' | 'prepare'>;
  readonly diagnosticCapture: PrettifyProviderDependencies['diagnosticCapture'];
  readonly fetch: PrettifyFetch;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly readiness: PrettifyHttpReadiness;
  readonly settings: Pick<PrettifySettingsStorage, 'getWithSecret'>;
}

/** Exhaustively constructs graph-owned Prettify providers and their stateful adapters. */
export class PrettifyProviderFactory {
  public constructor(private readonly dependencies: PrettifyProviderFactoryDependencies) {}

  public create(providerId: KnownPrettifyProviderId): BasePrettifyProvider {
    switch (providerId) {
      case 'ollama':
        return new OllamaPrettifyProvider({
          audit: this.dependencies.audit,
          diagnosticCapture: this.dependencies.diagnosticCapture,
          fetch: this.dependencies.fetch,
          localization: this.dependencies.localization,
          readiness: this.dependencies.readiness,
          settings: this.dependencies.settings,
        });
      case 'vllm':
        return new VllmPrettifyProvider({
          audit: this.dependencies.audit,
          diagnosticCapture: this.dependencies.diagnosticCapture,
          fetch: this.dependencies.fetch,
          localization: this.dependencies.localization,
          readiness: this.dependencies.readiness,
          settings: this.dependencies.settings,
        });
      case 'claude-cli':
        return new ClaudeCliPrettifyProvider({
          adapter: this.dependencies.claudeCliAdapter,
          audit: this.dependencies.audit,
          diagnosticCapture: this.dependencies.diagnosticCapture,
          localization: this.dependencies.localization,
        });
      case 'codex-cli':
        return new CodexCliPrettifyProvider({
          adapter: this.dependencies.codexCliAdapter,
          audit: this.dependencies.audit,
          diagnosticCapture: this.dependencies.diagnosticCapture,
          localization: this.dependencies.localization,
        });
    }
  }
}

/** Lazily owns exactly one stateful provider instance per graph and provider ID. */
export class PrettifyProviderRegistry {
  private readonly providers = new Map<KnownPrettifyProviderId, BasePrettifyProvider>();

  public constructor(private readonly factory: PrettifyProviderFactory) {}

  public get(providerId: KnownPrettifyProviderId): BasePrettifyProvider {
    const current = this.providers.get(providerId);
    if (current) return current;

    const provider = this.factory.create(providerId);
    if (provider.id !== providerId) throw new Error('Invalid Prettify provider definition');
    this.providers.set(providerId, provider);
    return provider;
  }

  public getOllama(): OllamaPrettifyProvider {
    const provider = this.get('ollama');
    if (!(provider instanceof OllamaPrettifyProvider)) {
      throw new Error(PRETTIFY_PROVIDER_UNAVAILABLE_ERROR);
    }
    return provider;
  }
}

export interface PrettifyRuntimeDependencies {
  readonly audit: PrettifyProviderAudit;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly registry: PrettifyProviderRegistry;
  readonly settings: Pick<PrettifySettingsStorage, 'getWithSecret'>;
}

/** Owns Prettify dispatch, settings resolution, audit correlation, and model shutdown. */
export class PrettifyRuntime {
  public constructor(private readonly dependencies: PrettifyRuntimeDependencies) {}

  public async checkCliConnection(
    providerId: unknown,
    draftSettings: PrettifySettingsInput = {},
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PrettifyCliConnectionResult> {
    if (!isPrettifyCliProviderId(providerId)) {
      this.dependencies.audit.recordUnknownProvider(providerId, 'availability');
      throw new Error('Unsupported Prettify CLI provider');
    }
    const auditContext = this.dependencies.audit.startAvailability(providerId);
    const provider = this.dependencies.registry.get(providerId);
    let settings: PrettifySettingsWithSecret;
    try {
      settings = this.getSettingsForKnownProvider(providerId, draftSettings);
    } catch (error: unknown) {
      this.dependencies.audit.terminalException(auditContext, 'configuration', error);
      throw error;
    }

    try {
      const availability = await provider.checkAvailability(settings, signal, auditContext);
      if (availability.status === 'available') return { providerId, status: 'connected' };
      const errorCode = availability.errorCode ?? 'process-failed';
      return errorCode === 'not-authenticated'
        ? { providerId, status: 'login-required' }
        : { errorCode, providerId, status: 'unavailable' };
    } catch (error: unknown) {
      this.dependencies.audit.terminalException(auditContext, 'process', error);
      return { errorCode: 'process-failed', providerId, status: 'unavailable' };
    }
  }

  public async listModels(
    providerId: unknown,
    draftSettings: PrettifySettingsInput = {},
  ): Promise<PrettifyModelListResult> {
    const audit = this.dependencies.audit;
    if (!isKnownPrettifyProviderId(providerId)) {
      audit.recordUnknownProvider(providerId, 'model-list');
      return {
        availability: { status: 'unavailable' },
        error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR,
        models: [],
        providerId: 'ollama',
        source: 'http',
        success: false,
      };
    }
    const provider = this.dependencies.registry.get(providerId);
    const auditContext = audit.startModelList(providerId);
    let settings: PrettifySettingsWithSecret;
    try {
      settings = this.getSettingsForKnownProvider(providerId, draftSettings);
    } catch (error: unknown) {
      audit.terminalException(auditContext, 'configuration', error);
      throw error;
    }
    try {
      const result = await provider.listModels(settings, auditContext);
      const success = result.availability.status === 'available';
      const errorCode = result.availability.status === 'unavailable' ? result.availability.errorCode : undefined;
      return {
        availability: result.availability,
        ...(success ? {} : { error: this.getModelListFailureMessage(providerId, errorCode) }),
        models: result.models,
        providerId,
        source: result.source,
        success,
      };
    } catch (error: unknown) {
      audit.terminalException(auditContext, 'model-discovery', error);
      if (!isHttpPrettifyProviderId(providerId)) throw error;
      return {
        availability: { status: 'unavailable' },
        error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR,
        models: [],
        providerId,
        source: provider.capabilities.modelSource,
        success: false,
      };
    }
  }

  public async loadModel(
    providerId: unknown,
    draftSettings: PrettifySettingsInput = {},
  ): Promise<PrettifyModelLoadResult> {
    const audit = this.dependencies.audit;
    if (!isKnownPrettifyProviderId(providerId)) {
      audit.recordUnknownProvider(providerId, 'model-load');
      return { success: false, providerId: 'ollama', error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
    }
    const provider = this.dependencies.registry.get(providerId);
    const auditContext = isHttpPrettifyProviderId(providerId) ? audit.startModelLoad(providerId) : undefined;
    if (!provider.capabilities.modelLifecycle) {
      if (auditContext) audit.terminalFailure(auditContext, 'validation', 'model-lifecycle-failed');
      return { success: false, providerId, error: 'Model loading is available only for Ollama' };
    }
    const settings = this.resolveSettingsForAuditedOperation(providerId, draftSettings, auditContext);
    try {
      return await provider.loadModel(settings, auditContext);
    } catch (error: unknown) {
      if (auditContext) audit.terminalException(auditContext, 'model-lifecycle', error);
      throw error;
    }
  }

  public async unloadModel(
    providerId: unknown,
    draftSettings: PrettifySettingsInput = {},
  ): Promise<PrettifyModelUnloadResult> {
    const audit = this.dependencies.audit;
    if (!isKnownPrettifyProviderId(providerId)) {
      audit.recordUnknownProvider(providerId, 'model-unload');
      return { success: false, providerId: 'ollama', error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
    }
    const provider = this.dependencies.registry.get(providerId);
    const auditContext = isHttpPrettifyProviderId(providerId) ? audit.startModelUnload(providerId) : undefined;
    if (!provider.capabilities.modelLifecycle) {
      if (auditContext) audit.terminalFailure(auditContext, 'validation', 'model-lifecycle-failed');
      return { success: false, providerId, error: 'Model unloading is available only for Ollama' };
    }
    const settings = this.resolveSettingsForAuditedOperation(providerId, draftSettings, auditContext);
    try {
      return await provider.unloadModel(settings, auditContext);
    } catch (error: unknown) {
      if (auditContext) audit.terminalException(auditContext, 'model-lifecycle', error);
      throw error;
    }
  }

  public shutdown(): Promise<void> {
    return this.dependencies.registry.getOllama().unloadLoadedModel();
  }

  public async prepare(
    draftSettings: PrettifySettingsInput = {},
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PreparePrettifyExecutionResult> {
    const audit = this.dependencies.audit;
    const requestedProvider = draftSettings.providerId;
    if (requestedProvider !== undefined && !isKnownPrettifyProviderId(requestedProvider)) {
      audit.recordUnknownProvider(requestedProvider, 'prepare');
      return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
    }

    let settings: PrettifySettingsWithSecret;
    try {
      settings = isKnownPrettifyProviderId(requestedProvider)
        ? this.getSettingsForKnownProvider(requestedProvider, draftSettings)
        : this.dependencies.settings.getWithSecret(draftSettings);
    } catch (error: unknown) {
      if (isKnownPrettifyProviderId(requestedProvider)) {
        const context = audit.startPrepare(requestedProvider);
        audit.terminalException(context, 'configuration', error);
      }
      throw error;
    }
    const providerId = isKnownPrettifyProviderId(requestedProvider) ? requestedProvider : settings.providerId;
    if (!isKnownPrettifyProviderId(providerId)) {
      audit.recordUnknownProvider(providerId, 'prepare');
      return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
    }
    const provider = this.dependencies.registry.get(providerId);
    const modelMetadata = provider.getModelMetadata(settings);
    const auditContext = audit.startPrepare(providerId, {
      modelConfigured: Boolean(modelMetadata.model),
      modelNameLength: modelMetadata.model.length,
      modelSource: provider.capabilities.modelSource,
      usesDefaultModel: modelMetadata.usesDefaultModel,
    });

    try {
      return await provider.prepare(settings, signal, auditContext);
    } catch (error: unknown) {
      if (signal.aborted) {
        audit.terminalCancelled(auditContext, 'cleanup');
        return {
          success: false,
          error: this.dependencies.localization.translate('status.prettifyCancelled'),
        };
      }
      if (!isHttpPrettifyProviderId(providerId)) {
        audit.terminalException(auditContext, 'process', error);
        return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
      }
      audit.terminalException(auditContext, 'readiness', error);
      return {
        success: false,
        error: createConnectionError(
          getHttpPrettifyProviderName(providerId),
          getHttpPrettifyProviderBaseUrl(settings, providerId),
          error,
        ),
      };
    }
  }

  public async run(
    text: string,
    draftSettings: PrettifySettingsInput = {},
    signal?: AbortSignal,
  ): Promise<TextProcessingResult> {
    const prepared = await this.prepare(draftSettings, signal);
    return prepared.success ? prepared.prepared.execute(text) : prepared;
  }

  private getSettingsForKnownProvider(
    providerId: KnownPrettifyProviderId,
    draftSettings: PrettifySettingsInput,
  ): PrettifySettingsWithSecret {
    if (isPrettifyProviderId(providerId)) {
      return this.dependencies.settings.getWithSecret({ ...draftSettings, providerId });
    }
    const { providerId: _ignoredProviderId, ...settingsWithoutProvider } = draftSettings;
    return this.dependencies.settings.getWithSecret(settingsWithoutProvider);
  }

  private getModelListFailureMessage(
    providerId: KnownPrettifyProviderId,
    errorCode?: PrettifyCliRuntimeErrorCode,
  ): string {
    if (providerId === 'claude-cli' && errorCode) {
      return createCliFailure(providerId, errorCode as ClaudeCliPrettifyErrorCode, this.dependencies.localization)
        .error;
    }
    if (providerId === 'codex-cli' && errorCode) {
      return createCliFailure(providerId, errorCode as CodexCliPrettifyErrorCode, this.dependencies.localization).error;
    }
    return PRETTIFY_PROVIDER_UNAVAILABLE_ERROR;
  }

  private resolveSettingsForAuditedOperation(
    providerId: KnownPrettifyProviderId,
    draftSettings: PrettifySettingsInput,
    auditContext?: PrettifyAuditOperationContext,
  ): PrettifySettingsWithSecret {
    try {
      return this.getSettingsForKnownProvider(providerId, draftSettings);
    } catch (error: unknown) {
      if (auditContext) this.dependencies.audit.terminalException(auditContext, 'configuration', error);
      throw error;
    }
  }
}
