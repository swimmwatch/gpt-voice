import type { PrettifySettingsDraft } from '@renderer/appSettingsUtils';
import {
  DEFAULT_PRETTIFY_SETTINGS,
  getPrettifyProviderCapabilities,
  type PrettifyProviderAvailability,
  type PrettifyProviderCapabilities,
} from '@shared/prettifySettings';

const ADVANCED_PRETTIFY_SETTING_KEYS = [
  'topP',
  'topK',
  'minP',
  'repeatPenalty',
  'maxOutputTokens',
  'seed',
] as const satisfies ReadonlyArray<keyof PrettifySettingsDraft>;

export interface PrettifyAdvancedSettingsSummary {
  customValueCount: number;
  usesDefaults: boolean;
}

export interface PrettifyProviderSettingsViewState {
  advancedSettings: PrettifyAdvancedSettingsSummary;
  availability: PrettifyProviderAvailability;
  canExecute: boolean;
  capabilities: PrettifyProviderCapabilities;
  providerId: PrettifySettingsDraft['providerId'];
}

export type OllamaModelAction = 'load' | 'unload';

export function getOllamaModelAction(isLoaded: boolean): OllamaModelAction {
  return isLoaded ? 'unload' : 'load';
}

export function getPrettifyAdvancedSettingsSummary(settings: PrettifySettingsDraft): PrettifyAdvancedSettingsSummary {
  let customValueCount: number;
  switch (settings.providerId) {
    case 'ollama':
    case 'vllm':
      customValueCount = ADVANCED_PRETTIFY_SETTING_KEYS.filter(
        (key) => settings[key] !== DEFAULT_PRETTIFY_SETTINGS[key],
      ).length;
      break;
    case 'claude-cli':
      customValueCount = [
        Boolean(settings.claudeCli.fallbackModel.trim()),
        settings.claudeCli.effort !== DEFAULT_PRETTIFY_SETTINGS.claudeCli.effort,
        settings.claudeCli.timeoutSeconds !== DEFAULT_PRETTIFY_SETTINGS.claudeCli.timeoutSeconds,
      ].filter(Boolean).length;
      break;
    case 'codex-cli':
      customValueCount = [
        settings.codexCli.reasoningEffort !== DEFAULT_PRETTIFY_SETTINGS.codexCli.reasoningEffort,
        settings.codexCli.verbosity !== DEFAULT_PRETTIFY_SETTINGS.codexCli.verbosity,
        settings.codexCli.timeoutSeconds !== DEFAULT_PRETTIFY_SETTINGS.codexCli.timeoutSeconds,
      ].filter(Boolean).length;
      break;
  }

  return {
    customValueCount,
    usesDefaults: customValueCount === 0,
  };
}

export function getPrettifyProviderSettingsViewState(
  settings: PrettifySettingsDraft,
  availability: PrettifyProviderAvailability,
): PrettifyProviderSettingsViewState {
  return {
    advancedSettings: getPrettifyAdvancedSettingsSummary(settings),
    availability,
    canExecute: availability.status === 'available',
    capabilities: getPrettifyProviderCapabilities(settings.providerId),
    providerId: settings.providerId,
  };
}
