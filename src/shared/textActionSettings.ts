export interface TextActionSettings {
  translateEnabled: boolean;
  prettifyEnabled: boolean;
}

export interface TextActionSettingsInput {
  translateEnabled?: unknown;
  prettifyEnabled?: unknown;
}

export const DEFAULT_TEXT_ACTION_SETTINGS: TextActionSettings = {
  translateEnabled: true,
  prettifyEnabled: true,
};

export function normalizeTextActionSettings(input: TextActionSettingsInput = {}): TextActionSettings {
  return {
    translateEnabled:
      typeof input.translateEnabled === 'boolean'
        ? input.translateEnabled
        : DEFAULT_TEXT_ACTION_SETTINGS.translateEnabled,
    prettifyEnabled:
      typeof input.prettifyEnabled === 'boolean' ? input.prettifyEnabled : DEFAULT_TEXT_ACTION_SETTINGS.prettifyEnabled,
  };
}
