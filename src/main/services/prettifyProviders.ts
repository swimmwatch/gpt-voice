import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
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

const log = createLogger('prettify-provider');
const DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES: PrettifyProviderDependencies = { fetch };

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
  const provider = getKnownPrettifyProvider(providerId);
  const settings = getSettingsForKnownProvider(providerId, draftSettings);
  try {
    const availability = await provider.checkAvailability(
      settings,
      options.signal ?? new AbortController().signal,
      options.deps ?? DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
    );
    if (availability.status === 'available') return { providerId, status: 'connected' };
    const errorCode = availability.errorCode ?? 'process-failed';
    return errorCode === 'not-authenticated'
      ? { providerId, status: 'login-required' }
      : { errorCode, providerId, status: 'unavailable' };
  } catch {
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
  providerId: KnownPrettifyProviderId,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<PrettifyModelListResult> {
  const provider = getKnownPrettifyProvider(providerId);
  const settings = getSettingsForKnownProvider(providerId, draftSettings);
  try {
    const result = await provider.listModels(settings, deps);
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
  providerId: KnownPrettifyProviderId,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<PrettifyModelLoadResult> {
  const provider = getKnownPrettifyProvider(providerId);
  if (!provider.capabilities.modelLifecycle) {
    return { success: false, providerId, error: 'Model loading is available only for Ollama' };
  }
  return provider.loadModel(getSettingsForKnownProvider(providerId, draftSettings), deps);
}

export async function unloadPrettifyModel(
  providerId: KnownPrettifyProviderId,
  draftSettings: PrettifySettingsInput = {},
  deps: PrettifyProviderDependencies = DEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES,
): Promise<PrettifyModelUnloadResult> {
  const provider = getKnownPrettifyProvider(providerId);
  if (!provider.capabilities.modelLifecycle) {
    return { success: false, providerId, error: 'Model unloading is available only for Ollama' };
  }
  return provider.unloadModel(getSettingsForKnownProvider(providerId, draftSettings), deps);
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
  const requestedProvider = draftSettings.providerId;
  if (requestedProvider !== undefined && !isKnownPrettifyProviderId(requestedProvider)) {
    return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
  }

  const settings = isKnownPrettifyProviderId(requestedProvider)
    ? getSettingsForKnownProvider(requestedProvider, draftSettings)
    : getPrettifySettingsWithSecret(draftSettings);
  const providerId = isKnownPrettifyProviderId(requestedProvider) ? requestedProvider : settings.providerId;
  const provider = getKnownProviderForDispatch(providerId);
  if (!provider) return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };

  try {
    return await provider.prepare(settings, signal, deps);
  } catch (error: unknown) {
    if (signal.aborted) return { success: false, error: t('status.prettifyCancelled') };
    if (!isHttpPrettifyProviderId(providerId)) {
      return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
    }
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

  log.info('Running selected-text prettify:', {
    providerId: prepared.prepared.providerId,
    textLength: text.length,
    cacheContextFields: prepared.prepared.cacheContext.length,
  });
  return prepared.prepared.execute(text);
}
