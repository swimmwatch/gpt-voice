import { t } from '@main/i18n';
import { ClaudeCliPrettifyErrorCode } from '@main/services/prettifyClaudeCli';
import {
  ClaudeCliPrettifyProvider,
  CodexCliPrettifyProvider,
  createCliFailure,
} from '@main/services/prettifyCliProviders';
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
  type PrettifyProviderDependencies,
  type TextProcessingResult,
} from '@main/services/prettifyProviderBase';
import { prettifyProviderAudit, type PrettifyAuditOperationContext } from '@main/services/prettifyProviderAudit';
import { getPrettifySettingsWithSecret, type PrettifySettingsWithSecret } from '@main/services/prettifySettingsStorage';
import {
  isKnownPrettifyProviderId,
  type PrettifyCliConnectionResult,
  type PrettifyCliProviderId,
  isPrettifyProviderId,
  type KnownPrettifyProviderId,
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
  PrettifyProviderModelMetadata,
  PrettifyProviderRequest,
} from '@main/services/prettifyProviderBase';
export type { PreparePrettifyExecutionResult, PrettifyProviderDependencies, TextProcessingResult };

const DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES: PrettifyProviderDependencies = {
  audit: prettifyProviderAudit,
  fetch,
};

export const KNOWN_PRETTIFY_PROVIDERS: Readonly<Record<KnownPrettifyProviderId, BasePrettifyProvider>> = Object.freeze({
  ollama: new OllamaPrettifyProvider(),
  vllm: new VllmPrettifyProvider(),
  'claude-cli': new ClaudeCliPrettifyProvider(),
  'codex-cli': new CodexCliPrettifyProvider(),
});

export function getKnownPrettifyProvider(providerId: KnownPrettifyProviderId): BasePrettifyProvider {
  switch (providerId) {
    case 'ollama':
      return KNOWN_PRETTIFY_PROVIDERS.ollama;
    case 'vllm':
      return KNOWN_PRETTIFY_PROVIDERS.vllm;
    case 'claude-cli':
      return KNOWN_PRETTIFY_PROVIDERS['claude-cli'];
    case 'codex-cli':
      return KNOWN_PRETTIFY_PROVIDERS['codex-cli'];
  }
}

export async function checkPrettifyCliConnection(
  providerId: PrettifyCliProviderId,
  draftSettings: PrettifySettingsInput = {},
  options: { deps?: PrettifyProviderDependencies; signal?: AbortSignal } = {},
): Promise<PrettifyCliConnectionResult> {
  const deps = options.deps ?? DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES;
  const audit = deps.audit ?? prettifyProviderAudit;
  const auditContext = audit.startAvailability(providerId);
  const provider = getKnownPrettifyProvider(providerId);
  let settings: PrettifySettingsWithSecret;
  try {
    settings = getSettingsForKnownProvider(providerId, draftSettings);
  } catch (error: unknown) {
    audit.terminalException(auditContext, 'configuration', error);
    throw error;
  }
  try {
    const availability = await provider.checkAvailability(
      settings,
      options.signal ?? new AbortController().signal,
      deps,
      auditContext,
    );
    if (availability.status === 'available') return { providerId, status: 'connected' };
    const errorCode = availability.errorCode ?? 'process-failed';
    return errorCode === 'not-authenticated'
      ? { providerId, status: 'login-required' }
      : { errorCode, providerId, status: 'unavailable' };
  } catch (error: unknown) {
    audit.terminalException(auditContext, 'process', error);
    return { errorCode: 'process-failed', providerId, status: 'unavailable' };
  }
}

function getKnownProviderForDispatch(providerId: unknown): BasePrettifyProvider | null {
  return isKnownPrettifyProviderId(providerId) ? getKnownPrettifyProvider(providerId) : null;
}

function getSettingsForKnownProvider(
  providerId: KnownPrettifyProviderId,
  draftSettings: PrettifySettingsInput,
): PrettifySettingsWithSecret {
  if (isPrettifyProviderId(providerId)) {
    return getPrettifySettingsWithSecret({ ...draftSettings, providerId });
  }
  const { providerId: _ignoredProviderId, ...settingsWithoutProvider } = draftSettings;
  return getPrettifySettingsWithSecret(settingsWithoutProvider);
}

function getModelListFailureMessage(
  providerId: KnownPrettifyProviderId,
  errorCode?: PrettifyCliRuntimeErrorCode,
): string {
  if (providerId === 'claude-cli' && errorCode) {
    return createCliFailure(providerId, errorCode as ClaudeCliPrettifyErrorCode).error;
  }
  if (providerId === 'codex-cli' && errorCode) {
    return createCliFailure(providerId, errorCode as CodexCliPrettifyErrorCode).error;
  }
  return PRETTIFY_PROVIDER_UNAVAILABLE_ERROR;
}

export async function listPrettifyModels(
  providerId: unknown,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<PrettifyModelListResult> {
  const audit = deps.audit ?? prettifyProviderAudit;
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
  const provider = getKnownPrettifyProvider(providerId);
  const auditContext = audit.startModelList(providerId);
  let settings: PrettifySettingsWithSecret;
  try {
    settings = getSettingsForKnownProvider(providerId, draftSettings);
  } catch (error: unknown) {
    audit.terminalException(auditContext, 'configuration', error);
    throw error;
  }
  try {
    const result = await provider.listModels(settings, deps, auditContext);
    const success = result.availability.status === 'available';
    const errorCode = result.availability.status === 'unavailable' ? result.availability.errorCode : undefined;
    return {
      availability: result.availability,
      ...(success ? {} : { error: getModelListFailureMessage(providerId, errorCode) }),
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
      error: createConnectionError(
        getHttpPrettifyProviderName(providerId),
        getHttpPrettifyProviderBaseUrl(settings, providerId),
        error,
      ),
      models: [],
      providerId,
      source: provider.capabilities.modelSource,
      success: false,
    };
  }
}

export async function loadPrettifyModel(
  providerId: unknown,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<PrettifyModelLoadResult> {
  const audit = deps.audit ?? prettifyProviderAudit;
  if (!isKnownPrettifyProviderId(providerId)) {
    audit.recordUnknownProvider(providerId, 'model-load');
    return { success: false, providerId: 'ollama', error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
  }
  const provider = getKnownPrettifyProvider(providerId);
  const auditContext = isHttpPrettifyProviderId(providerId) ? audit.startModelLoad(providerId) : undefined;
  if (!provider.capabilities.modelLifecycle) {
    if (auditContext) {
      audit.terminalFailure(auditContext, 'validation', 'model-lifecycle-failed');
    }
    return { success: false, providerId, error: 'Model loading is available only for Ollama' };
  }
  let settings: PrettifySettingsWithSecret;
  try {
    settings = getSettingsForKnownProvider(providerId, draftSettings);
  } catch (error: unknown) {
    if (auditContext) audit.terminalException(auditContext, 'configuration', error);
    throw error;
  }
  try {
    return await provider.loadModel(settings, deps, auditContext);
  } catch (error: unknown) {
    if (auditContext) audit.terminalException(auditContext, 'model-lifecycle', error);
    throw error;
  }
}

export async function unloadPrettifyModel(
  providerId: unknown,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<PrettifyModelUnloadResult> {
  const audit = deps.audit ?? prettifyProviderAudit;
  if (!isKnownPrettifyProviderId(providerId)) {
    audit.recordUnknownProvider(providerId, 'model-unload');
    return { success: false, providerId: 'ollama', error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
  }
  const provider = getKnownPrettifyProvider(providerId);
  const auditContext = isHttpPrettifyProviderId(providerId) ? audit.startModelUnload(providerId) : undefined;
  if (!provider.capabilities.modelLifecycle) {
    if (auditContext) {
      audit.terminalFailure(auditContext, 'validation', 'model-lifecycle-failed');
    }
    return { success: false, providerId, error: 'Model unloading is available only for Ollama' };
  }
  let settings: PrettifySettingsWithSecret;
  try {
    settings = getSettingsForKnownProvider(providerId, draftSettings);
  } catch (error: unknown) {
    if (auditContext) audit.terminalException(auditContext, 'configuration', error);
    throw error;
  }
  try {
    return await provider.unloadModel(settings, deps, auditContext);
  } catch (error: unknown) {
    if (auditContext) audit.terminalException(auditContext, 'model-lifecycle', error);
    throw error;
  }
}

export async function unloadLoadedOllamaPrettifyModel(
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
  fallbackSettings: PrettifySettingsInput = {},
): Promise<void> {
  const provider = KNOWN_PRETTIFY_PROVIDERS.ollama;
  if (!(provider instanceof OllamaPrettifyProvider)) throw new Error(PRETTIFY_PROVIDER_UNAVAILABLE_ERROR);
  await provider.unloadLoadedModel(deps, fallbackSettings);
}

export async function preparePrettifyExecution(
  draftSettings: PrettifySettingsInput = {},
  signal: AbortSignal = new AbortController().signal,
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<PreparePrettifyExecutionResult> {
  const audit = deps.audit ?? prettifyProviderAudit;
  const requestedProvider = draftSettings.providerId;
  if (requestedProvider !== undefined && !isKnownPrettifyProviderId(requestedProvider)) {
    audit.recordUnknownProvider(requestedProvider, 'prepare');
    return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
  }

  let settings: PrettifySettingsWithSecret;
  try {
    settings = isKnownPrettifyProviderId(requestedProvider)
      ? getSettingsForKnownProvider(requestedProvider, draftSettings)
      : getPrettifySettingsWithSecret(draftSettings);
  } catch (error: unknown) {
    if (isKnownPrettifyProviderId(requestedProvider)) {
      const context = audit.startPrepare(requestedProvider);
      audit.terminalException(context, 'configuration', error);
    }
    throw error;
  }
  const providerId = isKnownPrettifyProviderId(requestedProvider) ? requestedProvider : settings.providerId;
  const provider = getKnownProviderForDispatch(providerId);
  if (!provider) {
    audit.recordUnknownProvider(providerId, 'prepare');
    return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
  }
  const modelMetadata = provider.getModelMetadata(settings);
  const auditContext: PrettifyAuditOperationContext = audit.startPrepare(providerId, {
    modelConfigured: Boolean(modelMetadata.model),
    modelNameLength: modelMetadata.model.length,
    modelSource: provider.capabilities.modelSource,
    usesDefaultModel: modelMetadata.usesDefaultModel,
  });

  try {
    return await provider.prepare(settings, signal, deps, auditContext);
  } catch (error: unknown) {
    if (signal.aborted) {
      audit.terminalCancelled(auditContext, 'cleanup');
      return { success: false, error: t('status.prettifyCancelled') };
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

export async function runPrettify(
  text: string,
  draftSettings: PrettifySettingsInput = {},
  signal?: AbortSignal,
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<TextProcessingResult> {
  const prepared = await preparePrettifyExecution(draftSettings, signal, deps);
  if (!prepared.success) return prepared;

  return prepared.prepared.execute(text);
}
