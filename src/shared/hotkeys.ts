export const HOTKEY_TARGETS = ['record', 'stop', 'cancel', 'translate', 'prettify', 'retryTranscription'] as const;

export type HotkeyTarget = (typeof HOTKEY_TARGETS)[number];

export const DEFAULT_RECORD_HOTKEY = 'F9';
export const DEFAULT_STOP_HOTKEY = 'F10';
export const DEFAULT_CANCEL_HOTKEY = 'Escape';
export const DEFAULT_TRANSLATE_HOTKEY = 'F11';
export const DEFAULT_PRETTIFY_HOTKEY = 'F12';
export const DEFAULT_RETRY_TRANSCRIPTION_HOTKEY = 'Ctrl+F8';

export interface HotkeySettings {
  hotkey: string;
  cancelHotkey: string;
  stopHotkey: string;
  translateHotkey: string;
  prettifyHotkey: string;
  retryTranscriptionHotkey: string;
}

export interface HotkeyKeyboardEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

interface ParsedHotkey {
  accelerator: string;
  key: string;
  modifiers: string[];
}

const MODIFIER_ALIASES: Record<string, string> = {
  alt: 'Alt',
  cmd: 'Command',
  command: 'Command',
  commandorcontrol: 'CommandOrControl',
  control: 'Ctrl',
  ctrl: 'Ctrl',
  shift: 'Shift',
  super: 'Super',
};

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Command', 'Super', 'CommandOrControl'];
const MODIFIER_EVENT_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift']);
const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  Del: 'Delete',
  Esc: 'Escape',
  Return: 'Enter',
  Spacebar: 'Space',
};

function getHotkeyForTarget(settings: HotkeySettings, target: HotkeyTarget): string {
  if (target === 'record') return settings.hotkey;
  if (target === 'stop') return settings.stopHotkey;
  if (target === 'cancel') return settings.cancelHotkey;
  if (target === 'translate') return settings.translateHotkey;
  if (target === 'prettify') return settings.prettifyHotkey;
  return settings.retryTranscriptionHotkey;
}

function normalizeHotkeyKey(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed || trimmed === '+' || trimmed === 'Unidentified') return null;
  if (trimmed.length === 1) return trimmed.toUpperCase();
  if (/^f\d{1,2}$/iu.test(trimmed)) return trimmed.toUpperCase();
  return KEY_ALIASES[trimmed] || trimmed;
}

function parseHotkey(hotkey: string): ParsedHotkey | null {
  const modifiers = new Set<string>();
  let key: string | null = null;

  for (const part of hotkey
    .split('+')
    .map((value) => value.trim())
    .filter(Boolean)) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }

    if (key) return null;
    key = normalizeHotkeyKey(part);
  }

  if (!key) return null;
  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return {
    accelerator: [...orderedModifiers, key].join('+'),
    key,
    modifiers: orderedModifiers,
  };
}

export function normalizeHotkey(hotkey: string): string | null {
  return parseHotkey(hotkey)?.accelerator ?? null;
}

export function getHotkeyFromKeyboardEvent(event: HotkeyKeyboardEvent, platform: NodeJS.Platform): string | null {
  if (MODIFIER_EVENT_KEYS.has(event.key)) return null;

  const modifiers = [
    ...(event.ctrlKey ? ['Ctrl'] : []),
    ...(event.altKey ? ['Alt'] : []),
    ...(event.shiftKey ? ['Shift'] : []),
    ...(event.metaKey ? [platform === 'darwin' ? 'Command' : 'Super'] : []),
  ];
  return normalizeHotkey([...modifiers, event.key].join('+'));
}

export function getHotkeyConflict(
  target: HotkeyTarget,
  candidate: string,
  settings: HotkeySettings,
): HotkeyTarget | null {
  const parsedCandidate = parseHotkey(candidate);
  if (!parsedCandidate) return null;

  for (const existingTarget of HOTKEY_TARGETS) {
    if (existingTarget === target) continue;
    const existing = parseHotkey(getHotkeyForTarget(settings, existingTarget));
    if (!existing || existing.key !== parsedCandidate.key) continue;
    if (
      existing.accelerator === parsedCandidate.accelerator ||
      existing.modifiers.length === 0 ||
      parsedCandidate.modifiers.length === 0
    ) {
      return existingTarget;
    }
  }

  return null;
}

export function getConflictingHotkeyTargets(settings: HotkeySettings): HotkeyTarget[] {
  return HOTKEY_TARGETS.filter((target) =>
    Boolean(getHotkeyConflict(target, getHotkeyForTarget(settings, target), settings)),
  );
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

export function canRunRetryTranscriptionHotkey(isRecording: boolean, retryTranscriptionAvailable: boolean): boolean {
  return retryTranscriptionAvailable && !isRecording;
}
