export const HOTKEY_TARGETS = ['record', 'stop', 'cancel', 'translate', 'prettify'] as const;

export type HotkeyTarget = (typeof HOTKEY_TARGETS)[number];

export const DEFAULT_RECORD_HOTKEY = 'F9';
export const DEFAULT_STOP_HOTKEY = 'F10';
export const DEFAULT_CANCEL_HOTKEY = 'Escape';
export const DEFAULT_TRANSLATE_HOTKEY = 'F11';
export const DEFAULT_PRETTIFY_HOTKEY = 'F12';

export interface HotkeySettings {
  hotkey: string;
  cancelHotkey: string;
  stopHotkey: string;
  translateHotkey: string;
  prettifyHotkey: string;
}

export function isHotkeyTarget(value: string): value is HotkeyTarget {
  return HOTKEY_TARGETS.includes(value as HotkeyTarget);
}

export function canRunTranslateHotkey(isRecording: boolean): boolean {
  return canRunTextActionHotkey(isRecording);
}

export function canRunTextActionHotkey(isRecording: boolean): boolean {
  return !isRecording;
}
