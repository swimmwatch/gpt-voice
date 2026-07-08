export interface TextActionSettings {
  translateEnabled: boolean;
  prettifyEnabled: boolean;
  promptCompressionEnabled: boolean;
}

export interface TextActionSettingsInput {
  translateEnabled?: unknown;
  prettifyEnabled?: unknown;
  promptCompressionEnabled?: unknown;
}

export const DEFAULT_TEXT_ACTION_SETTINGS: TextActionSettings = {
  translateEnabled: true,
  prettifyEnabled: true,
  promptCompressionEnabled: true,
};

export function normalizeTextActionSettings(input: TextActionSettingsInput = {}): TextActionSettings {
  return {
    translateEnabled:
      typeof input.translateEnabled === 'boolean'
        ? input.translateEnabled
        : DEFAULT_TEXT_ACTION_SETTINGS.translateEnabled,
    prettifyEnabled:
      typeof input.prettifyEnabled === 'boolean' ? input.prettifyEnabled : DEFAULT_TEXT_ACTION_SETTINGS.prettifyEnabled,
    promptCompressionEnabled:
      typeof input.promptCompressionEnabled === 'boolean'
        ? input.promptCompressionEnabled
        : DEFAULT_TEXT_ACTION_SETTINGS.promptCompressionEnabled,
  };
}
