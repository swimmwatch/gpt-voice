import { DEFAULT_PRETTIFY_SETTINGS, type PrettifySettings } from '@shared/prettifySettings';

const ADVANCED_PRETTIFY_SETTING_KEYS = [
  'topP',
  'topK',
  'minP',
  'repeatPenalty',
  'maxOutputTokens',
  'seed',
] as const satisfies ReadonlyArray<keyof PrettifySettings>;

export interface PrettifyAdvancedSettingsSummary {
  customValueCount: number;
  usesDefaults: boolean;
}

export type OllamaModelAction = 'load' | 'unload';

export function getOllamaModelAction(isLoaded: boolean): OllamaModelAction {
  return isLoaded ? 'unload' : 'load';
}

export function getPrettifyAdvancedSettingsSummary(
  settings: Pick<PrettifySettings, (typeof ADVANCED_PRETTIFY_SETTING_KEYS)[number]>,
): PrettifyAdvancedSettingsSummary {
  const customValueCount = ADVANCED_PRETTIFY_SETTING_KEYS.filter(
    (key) => settings[key] !== DEFAULT_PRETTIFY_SETTINGS[key],
  ).length;

  return {
    customValueCount,
    usesDefaults: customValueCount === 0,
  };
}
