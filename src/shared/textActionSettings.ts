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

function isTextActionSettingsInput(value: unknown): value is TextActionSettingsInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getTextActionSettingsInputError(input: unknown = {}): string | null {
  if (!isTextActionSettingsInput(input)) {
    return 'Text action settings must be an object';
  }
  if (input.translateEnabled !== undefined && typeof input.translateEnabled !== 'boolean') {
    return 'Translate enabled must be a boolean';
  }
  if (input.prettifyEnabled !== undefined && typeof input.prettifyEnabled !== 'boolean') {
    return 'Prettify enabled must be a boolean';
  }
  return null;
}

export function assertValidTextActionSettingsInput(input: unknown = {}): asserts input is TextActionSettingsInput {
  const error = getTextActionSettingsInputError(input);
  if (error) throw new Error(error);
}

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
