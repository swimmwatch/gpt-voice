import { getOllamaModelControl, type OllamaModelControl } from '@renderer/prettifyModelControl';
import type { MainPrettifyCliConnectionState } from '@renderer/mainPrettifyCliConnection';
import type { TranslationKey } from '@main/i18n';
import type { PrettifyModelOption, PrettifyProviderId, PrettifySettings } from '@shared/prettifySettings';

export const MAIN_PRETTIFY_PROVIDER_LABEL_KEYS: Record<PrettifyProviderId, string> = {
  ollama: 'prettify.provider.ollama',
  vllm: 'prettify.provider.vllm',
  'claude-cli': 'prettify.provider.claudeCli',
  'codex-cli': 'prettify.provider.codexCli',
};

export type MainPrettifyProviderStatusTone = 'error' | 'neutral' | 'success' | 'warning';
export type MainPrettifyHttpProviderId = Extract<PrettifyProviderId, 'ollama' | 'vllm'>;

export const MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES = Object.freeze({
  Checking: 'checking',
  Connected: 'connected',
  NotConnected: 'not-connected',
} as const);

export type MainPrettifyHttpConnectionStatus =
  (typeof MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES)[keyof typeof MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES];

export interface MainPrettifyHttpConnectionState {
  readonly providerId: MainPrettifyHttpProviderId;
  readonly status: MainPrettifyHttpConnectionStatus;
}

export interface MainPrettifyProviderStatus {
  labelKey: TranslationKey;
  loading?: boolean;
  tone: MainPrettifyProviderStatusTone;
  tooltipKey?: TranslationKey;
  valueKey?: TranslationKey;
}

export interface MainPrettifyProviderViewState {
  connection: MainPrettifyProviderStatus | null;
  model: string;
  modelFallbackKey: string;
  ollamaControl: OllamaModelControl | null;
  providerId: PrettifyProviderId;
  providerLabelKey: string;
}

export interface MainPrettifyProviderSelectionState {
  error: string;
  pendingRequestId: number | null;
  settings: PrettifySettings;
}

export type MainPrettifyProviderSelectionAction =
  | { requestId: number; type: 'begin'; providerId: PrettifyProviderId }
  | { requestId: number; type: 'resolved'; settings: PrettifySettings }
  | { error: string; requestId: number; type: 'rejected'; settings: PrettifySettings }
  | { settings: PrettifySettings; type: 'snapshot' };

function getActiveModel(settings: PrettifySettings): string {
  switch (settings.providerId) {
    case 'ollama':
      return settings.ollama.model;
    case 'vllm':
      return settings.vllm.model;
    case 'claude-cli':
      return settings.claudeCli.model;
    case 'codex-cli':
      return settings.codexCli.model;
  }
}

export function getMainPrettifyHttpConnectionStatus(
  settings: PrettifySettings,
  modelDiscoverySucceeded: boolean,
): MainPrettifyHttpConnectionStatus {
  const isHttpProvider = settings.providerId === 'ollama' || settings.providerId === 'vllm';
  return modelDiscoverySucceeded && isHttpProvider && Boolean(getActiveModel(settings).trim())
    ? MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.Connected
    : MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.NotConnected;
}

export function getMainPrettifyCliConnectionViewState(
  providerId: PrettifyProviderId,
  connection: MainPrettifyCliConnectionState | null,
): MainPrettifyProviderStatus | null {
  if (providerId !== 'claude-cli' && providerId !== 'codex-cli') return null;
  if (!connection || connection.providerId !== providerId || connection.status === 'checking') {
    return {
      labelKey: 'mainDock.prettifyChecking',
      loading: true,
      tone: 'neutral',
      tooltipKey: 'prettify.cli.statusChecking',
    };
  }
  switch (connection.status) {
    case 'connected':
      return {
        labelKey: 'provider.connected',
        tone: 'success',
        tooltipKey: 'prettify.cli.statusAvailable',
      };
    case 'login-required':
      return {
        labelKey: 'provider.notConnected',
        tone: 'warning',
        tooltipKey: 'mainDock.prettifySignInHelp',
      };
    case 'unavailable':
      return {
        labelKey: 'provider.notConnected',
        tone: 'error',
        tooltipKey: 'prettify.cli.statusUnavailable',
      };
  }
}

export function getMainPrettifyHttpConnectionViewState(
  providerId: PrettifyProviderId,
  connection: MainPrettifyHttpConnectionState | null,
): MainPrettifyProviderStatus | null {
  if (providerId !== 'ollama' && providerId !== 'vllm') return null;
  if (
    !connection ||
    connection.providerId !== providerId ||
    connection.status === MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.Checking
  ) {
    return {
      labelKey: 'mainDock.prettifyChecking',
      loading: true,
      tone: 'neutral',
      tooltipKey: 'provider.connectionCheckingTooltip',
    };
  }
  return connection.status === MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.Connected
    ? {
        labelKey: 'provider.connected',
        tone: 'success',
        tooltipKey: 'provider.connectionReadyTooltip',
      }
    : {
        labelKey: 'provider.notConnected',
        tone: 'error',
        tooltipKey: 'mainDock.prettifyUnavailable',
      };
}

export function getMainPrettifyProviderViewState(
  settings: PrettifySettings,
  ollamaModels: readonly PrettifyModelOption[],
  cliConnection: MainPrettifyCliConnectionState | null = null,
  httpConnection: MainPrettifyHttpConnectionState | null = null,
): MainPrettifyProviderViewState {
  const ollamaControl = getOllamaModelControl(settings, ollamaModels);
  const isCliProvider = settings.providerId === 'claude-cli' || settings.providerId === 'codex-cli';
  return {
    connection:
      getMainPrettifyCliConnectionViewState(settings.providerId, cliConnection) ??
      getMainPrettifyHttpConnectionViewState(settings.providerId, httpConnection),
    model: getActiveModel(settings),
    modelFallbackKey: isCliProvider ? 'prettify.providerDefault' : 'prettify.noModels',
    ollamaControl,
    providerId: settings.providerId,
    providerLabelKey: MAIN_PRETTIFY_PROVIDER_LABEL_KEYS[settings.providerId],
  };
}

export function reduceMainPrettifyProviderSelection(
  state: MainPrettifyProviderSelectionState,
  action: MainPrettifyProviderSelectionAction,
): MainPrettifyProviderSelectionState {
  switch (action.type) {
    case 'begin':
      return {
        error: '',
        pendingRequestId: action.requestId,
        settings: { ...state.settings, providerId: action.providerId },
      };
    case 'resolved':
      return state.pendingRequestId === action.requestId
        ? { error: '', pendingRequestId: null, settings: action.settings }
        : state;
    case 'rejected':
      return state.pendingRequestId === action.requestId
        ? { error: action.error, pendingRequestId: null, settings: action.settings }
        : state;
    case 'snapshot':
      return { ...state, error: '', settings: action.settings };
  }
}
