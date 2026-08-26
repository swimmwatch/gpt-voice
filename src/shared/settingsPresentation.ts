export const SETTINGS_PRESENTATION_STATES = ['idle', 'opening', 'open'] as const;

export type SettingsPresentationState = (typeof SETTINGS_PRESENTATION_STATES)[number];

export const SETTINGS_PRESENTATION_IPC_CHANNELS = Object.freeze({
  changed: 'settings-presentation-changed',
  focus: 'focus-settings-window',
  query: 'get-settings-presentation',
});

export function isSettingsPresentationState(value: unknown): value is SettingsPresentationState {
  return typeof value === 'string' && SETTINGS_PRESENTATION_STATES.includes(value as SettingsPresentationState);
}
