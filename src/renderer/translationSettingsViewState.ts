import type { TranslationSettings, TranslationSettingsSaveResult } from '@shared/translationProvider';

export function getSelectedTranslationTarget(settings: TranslationSettings): string {
  return settings.targetLanguageByProvider[settings.providerId];
}

export function createTranslationSettingsCandidate(
  settings: TranslationSettings,
  targetLanguage: string,
): TranslationSettings {
  return {
    providerId: settings.providerId,
    targetLanguageByProvider: {
      ...settings.targetLanguageByProvider,
      [settings.providerId]: targetLanguage,
    },
  };
}

export function resolveTranslationSettingsSave(
  confirmed: TranslationSettings,
  result: TranslationSettingsSaveResult,
): TranslationSettings {
  return result.success ? result.settings : confirmed;
}
