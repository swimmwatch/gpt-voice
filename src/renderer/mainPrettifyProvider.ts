import { getOllamaModelControl, type OllamaModelControl } from '@renderer/prettifyModelControl';
import type { PrettifyModelOption, PrettifyProviderId, PrettifySettings } from '@shared/prettifySettings';

export const MAIN_PRETTIFY_PROVIDER_LABEL_KEYS: Record<PrettifyProviderId, string> = {
  ollama: 'prettify.provider.ollama',
  vllm: 'prettify.provider.vllm',
  'claude-cli': 'prettify.provider.claudeCli',
  'codex-cli': 'prettify.provider.codexCli',
};

export type MainPrettifyProviderStatusTone = 'neutral' | 'success' | 'warning';

export interface MainPrettifyProviderStatus {
  labelKey: string;
  tone: MainPrettifyProviderStatusTone;
  valueKey?: string;
}

export interface MainPrettifyProviderViewState {
  model: string;
  modelFallbackKey: string;
  ollamaControl: OllamaModelControl | null;
  providerId: PrettifyProviderId;
  providerLabelKey: string;
  status: MainPrettifyProviderStatus;
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

function getProviderStatus(
  settings: PrettifySettings,
  ollamaControl: OllamaModelControl | null,
): MainPrettifyProviderStatus {
  switch (settings.providerId) {
    case 'ollama':
      if (!settings.ollama.model) {
        return { labelKey: 'mainDock.prettifyNotConfigured', tone: 'neutral' };
      }
      return ollamaControl?.isLoaded
        ? { labelKey: 'modelMemory.loaded', tone: 'success' }
        : { labelKey: 'modelMemory.notLoaded', tone: 'neutral' };
    case 'vllm':
      return settings.vllm.model
        ? { labelKey: 'mainDock.prettifyConfigured', tone: 'success' }
        : { labelKey: 'mainDock.prettifyNotConfigured', tone: 'neutral' };
    case 'claude-cli':
      return {
        labelKey: 'mainDock.prettifyEffort',
        tone: 'neutral',
        valueKey: `prettify.claudeCli.effort.${settings.claudeCli.effort}`,
      };
    case 'codex-cli':
      return { labelKey: 'mainDock.prettifyExperimental', tone: 'warning' };
  }
}

export function getMainPrettifyProviderViewState(
  settings: PrettifySettings,
  ollamaModels: readonly PrettifyModelOption[],
): MainPrettifyProviderViewState {
  const ollamaControl = getOllamaModelControl(settings, ollamaModels);
  const isCliProvider = settings.providerId === 'claude-cli' || settings.providerId === 'codex-cli';
  return {
    model: getActiveModel(settings),
    modelFallbackKey: isCliProvider ? 'prettify.providerDefault' : 'prettify.noModels',
    ollamaControl,
    providerId: settings.providerId,
    providerLabelKey: MAIN_PRETTIFY_PROVIDER_LABEL_KEYS[settings.providerId],
    status: getProviderStatus(settings, ollamaControl),
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
