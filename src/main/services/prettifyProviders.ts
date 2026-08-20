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
  getHttpPrettifyProviderName,
  isHttpPrettifyProviderId,
} from '@main/services/prettifyHttpProviders';
import {
  BasePrettifyProvider,
  PRETTIFY_MODEL_LOAD_UNAVAILABLE_ERROR_KEY,
  PRETTIFY_MODEL_UNLOAD_UNAVAILABLE_ERROR_KEY,
  PRETTIFY_PROVIDER_UNAVAILABLE_ERROR_KEY,
  type PreparePrettifyExecutionResult,
  type PrettifyFetch,
  type PrettifyProviderDependencies,
  type TextProcessingResult,
} from '@main/services/prettifyProviderBase';
import {
  normalizePrettifyExecutionInstruction,
  type PrettifyExecutionInstruction,
} from '@main/services/prettifyProfileInstruction';
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
  type PrettifyProviderSettingsInput,
} from '@shared/prettifySettings';

export {
  BasePrettifyProvider,
  ClaudeCliPrettifyProvider,
  CodexCliPrettifyProvider,
  OllamaPrettifyProvider,
  VllmPrettifyProvider,
};
export type { PrettifyExecutionInstruction } from '@main/services/prettifyProfileInstruction';
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
  readonly settings: Pick<PrettifySettingsStorage, 'getProviderSettingsWithSecret'>;
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
      throw new Error('Invalid Ollama Prettify provider definition');
    }
    return provider;
  }

  public getVllm(): VllmPrettifyProvider {
    const provider = this.get('vllm');
    if (!(provider instanceof VllmPrettifyProvider)) {
      throw new Error('Invalid vLLM Prettify provider definition');
    }
    return provider;
  }
}

export interface PrettifyRuntimeDependencies {
  readonly audit: PrettifyProviderAudit;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly registry: PrettifyProviderRegistry;
  readonly settings: Pick<PrettifySettingsStorage, 'getProviderSettingsWithSecret'>;
}

/** Owns Prettify dispatch, settings resolution, audit correlation, and model shutdown. */
export class PrettifyRuntime {
  private readonly providerConnectionStates = new Map<
    KnownPrettifyProviderId,
    { readonly connected: boolean; readonly revision: number }
  >();

  public constructor(private readonly dependencies: PrettifyRuntimeDependencies) {}

  public isProviderConnected(providerId: unknown): boolean {
    return isKnownPrettifyProviderId(providerId) && this.providerConnectionStates.get(providerId)?.connected === true;
  }

  public async checkCliConnection(
    providerId: unknown,
    draftSettings: PrettifyProviderSettingsInput = {},
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PrettifyCliConnectionResult> {
    if (!isPrettifyCliProviderId(providerId)) {
      this.dependencies.audit.recordUnknownProvider(providerId, 'availability');
      throw new Error(this.providerUnavailableError());
    }
    const connectionRevision = this.beginProviderConnectionCheck(providerId);
    const auditContext = this.dependencies.audit.startAvailability(providerId);
    const provider = this.dependencies.registry.get(providerId);
    let settings: PrettifySettingsWithSecret;
    try {
      settings = this.getSettingsForKnownProvider(providerId, draftSettings);
    } catch (error: unknown) {
      this.completeProviderConnectionCheck(providerId, connectionRevision, false);
      this.dependencies.audit.terminalException(auditContext, 'configuration', error);
      throw error;
    }

    try {
      const availability = await provider.checkAvailability(settings, signal, auditContext);
      const connected = availability.status === 'available';
      this.completeProviderConnectionCheck(providerId, connectionRevision, connected);
      if (connected) return { providerId, status: 'connected' };
      const errorCode = availability.errorCode ?? 'process-failed';
      return errorCode === 'not-authenticated'
        ? { providerId, status: 'login-required' }
        : { errorCode, providerId, status: 'unavailable' };
    } catch (error: unknown) {
      this.completeProviderConnectionCheck(providerId, connectionRevision, false);
      this.dependencies.audit.terminalException(auditContext, 'process', error);
      return { errorCode: 'process-failed', providerId, status: 'unavailable' };
    }
  }

  public async listModels(
    providerId: unknown,
    draftSettings: PrettifyProviderSettingsInput = {},
  ): Promise<PrettifyModelListResult> {
    const audit = this.dependencies.audit;
    if (!isKnownPrettifyProviderId(providerId)) {
      audit.recordUnknownProvider(providerId, 'model-list');
      return {
        availability: { status: 'unavailable' },
        error: this.providerUnavailableError(),
        models: [],
        providerId: 'ollama',
        source: 'http',
        success: false,
      };
    }
    const connectionRevision = this.beginProviderConnectionCheck(providerId);
    const provider = this.dependencies.registry.get(providerId);
    const auditContext = audit.startModelList(providerId);
    let settings: PrettifySettingsWithSecret;
    try {
      settings = this.getSettingsForKnownProvider(providerId, draftSettings);
    } catch (error: unknown) {
      this.completeProviderConnectionCheck(providerId, connectionRevision, false);
      audit.terminalException(auditContext, 'configuration', error);
      throw error;
    }
    try {
      const result = await provider.listModels(settings, auditContext);
      const success = result.availability.status === 'available';
      this.completeProviderConnectionCheck(
        providerId,
        connectionRevision,
        this.isProviderExecutionReady(provider, settings, success),
      );
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
      this.completeProviderConnectionCheck(providerId, connectionRevision, false);
      audit.terminalException(auditContext, 'model-discovery', error);
      if (!isHttpPrettifyProviderId(providerId)) throw error;
      return {
        availability: { status: 'unavailable' },
        error: this.providerUnavailableError(),
        models: [],
        providerId,
        source: provider.capabilities.modelSource,
        success: false,
      };
    }
  }

  public async loadModel(
    providerId: unknown,
    draftSettings: PrettifyProviderSettingsInput = {},
  ): Promise<PrettifyModelLoadResult> {
    const audit = this.dependencies.audit;
    if (!isKnownPrettifyProviderId(providerId)) {
      audit.recordUnknownProvider(providerId, 'model-load');
      return { success: false, providerId: 'ollama', error: this.providerUnavailableError() };
    }
    const provider = this.dependencies.registry.get(providerId);
    const auditContext = isHttpPrettifyProviderId(providerId) ? audit.startModelLoad(providerId) : undefined;
    if (!provider.capabilities.modelLifecycle) {
      if (auditContext) audit.terminalFailure(auditContext, 'validation', 'model-lifecycle-failed');
      return {
        success: false,
        providerId,
        error: this.dependencies.localization.translate(PRETTIFY_MODEL_LOAD_UNAVAILABLE_ERROR_KEY),
      };
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
    draftSettings: PrettifyProviderSettingsInput = {},
  ): Promise<PrettifyModelUnloadResult> {
    const audit = this.dependencies.audit;
    if (!isKnownPrettifyProviderId(providerId)) {
      audit.recordUnknownProvider(providerId, 'model-unload');
      return { success: false, providerId: 'ollama', error: this.providerUnavailableError() };
    }
    const provider = this.dependencies.registry.get(providerId);
    const auditContext = isHttpPrettifyProviderId(providerId) ? audit.startModelUnload(providerId) : undefined;
    if (!provider.capabilities.modelLifecycle) {
      if (auditContext) audit.terminalFailure(auditContext, 'validation', 'model-lifecycle-failed');
      return {
        success: false,
        providerId,
        error: this.dependencies.localization.translate(PRETTIFY_MODEL_UNLOAD_UNAVAILABLE_ERROR_KEY),
      };
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

  public async releaseProviderResources(
    providerId: KnownPrettifyProviderId,
  ): Promise<
    | { readonly success: true; readonly warning?: 'vllm-gpu-release-failed' }
    | { readonly success: false; readonly error: string }
  > {
    if (providerId === 'vllm') {
      try {
        const settings = this.getSettingsForKnownProvider(providerId, { providerId });
        const context = this.dependencies.audit.startModelUnload(providerId);
        await this.dependencies.registry.getVllm().releaseGpuResources(settings, context);
        this.providerConnectionStates.delete(providerId);
        return { success: true };
      } catch {
        this.providerConnectionStates.delete(providerId);
        return { success: true, warning: 'vllm-gpu-release-failed' };
      }
    }

    try {
      if (providerId === 'ollama') {
        const context = this.dependencies.audit.startModelUnload(providerId);
        await this.dependencies.registry.getOllama().unloadLoadedModel({}, context);
      }
      this.providerConnectionStates.delete(providerId);
      return { success: true };
    } catch {
      return {
        success: false,
        error: this.dependencies.localization.translate('prettify.modelUnloadFailed'),
      };
    }
  }

  public async prepare(
    instruction: unknown,
    draftSettings: PrettifyProviderSettingsInput = {},
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PreparePrettifyExecutionResult> {
    let normalizedInstruction: PrettifyExecutionInstruction;
    try {
      normalizedInstruction = normalizePrettifyExecutionInstruction(instruction);
    } catch {
      return { success: false, error: this.dependencies.localization.translate('prettify.instructionInvalid') };
    }
    const audit = this.dependencies.audit;
    const requestedProvider = draftSettings.providerId;
    if (requestedProvider !== undefined && !isKnownPrettifyProviderId(requestedProvider)) {
      audit.recordUnknownProvider(requestedProvider, 'prepare');
      return { success: false, error: this.providerUnavailableError() };
    }

    let settings: PrettifySettingsWithSecret;
    try {
      settings = isKnownPrettifyProviderId(requestedProvider)
        ? this.getSettingsForKnownProvider(requestedProvider, draftSettings)
        : this.dependencies.settings.getProviderSettingsWithSecret(draftSettings);
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
      return { success: false, error: this.providerUnavailableError() };
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
      return await provider.prepare(settings, normalizedInstruction, signal, auditContext);
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
        return { success: false, error: this.providerUnavailableError() };
      }
      audit.terminalException(auditContext, 'readiness', error);
      return {
        success: false,
        error: createConnectionError(getHttpPrettifyProviderName(providerId), this.dependencies.localization),
      };
    }
  }

  public async run(
    text: string,
    instruction: unknown,
    draftSettings: PrettifyProviderSettingsInput = {},
    signal?: AbortSignal,
  ): Promise<TextProcessingResult> {
    const prepared = await this.prepare(instruction, draftSettings, signal);
    return prepared.success ? prepared.prepared.execute(text) : prepared;
  }

  private getSettingsForKnownProvider(
    providerId: KnownPrettifyProviderId,
    draftSettings: PrettifyProviderSettingsInput,
  ): PrettifySettingsWithSecret {
    if (isPrettifyProviderId(providerId)) {
      return this.dependencies.settings.getProviderSettingsWithSecret({ ...draftSettings, providerId });
    }
    const { providerId: _ignoredProviderId, ...settingsWithoutProvider } = draftSettings;
    return this.dependencies.settings.getProviderSettingsWithSecret(settingsWithoutProvider);
  }

  private beginProviderConnectionCheck(providerId: KnownPrettifyProviderId): number {
    const revision = (this.providerConnectionStates.get(providerId)?.revision ?? 0) + 1;
    this.providerConnectionStates.set(providerId, { connected: false, revision });
    return revision;
  }

  private completeProviderConnectionCheck(
    providerId: KnownPrettifyProviderId,
    revision: number,
    connected: boolean,
  ): void {
    if (this.providerConnectionStates.get(providerId)?.revision !== revision) return;
    this.providerConnectionStates.set(providerId, { connected, revision });
  }

  private isProviderExecutionReady(
    provider: BasePrettifyProvider,
    settings: PrettifySettingsWithSecret,
    available: boolean,
  ): boolean {
    if (!available) return false;
    return !provider.capabilities.httpGenerationControls || Boolean(provider.getModelMetadata(settings).model.trim());
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
    return this.providerUnavailableError();
  }

  private providerUnavailableError(): string {
    return this.dependencies.localization.translate(PRETTIFY_PROVIDER_UNAVAILABLE_ERROR_KEY);
  }

  private resolveSettingsForAuditedOperation(
    providerId: KnownPrettifyProviderId,
    draftSettings: PrettifyProviderSettingsInput,
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
