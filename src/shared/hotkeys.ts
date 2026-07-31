export const HOTKEY_TARGETS = [
  'record',
  'stop',
  'cancel',
  'translate',
  'prettify',
  'prettifyQuick',
  'retryTranscription',
] as const;

export type HotkeyTarget = (typeof HOTKEY_TARGETS)[number];

export const DEFAULT_RECORD_HOTKEY = 'F9';
export const DEFAULT_STOP_HOTKEY = 'F10';
export const DEFAULT_CANCEL_HOTKEY = 'Escape';
export const DEFAULT_TRANSLATE_HOTKEY = 'F11';
export const DEFAULT_PRETTIFY_HOTKEY = 'F12';
export const DEFAULT_PRETTIFY_QUICK_HOTKEY = 'Ctrl+F12';
export const DEFAULT_RETRY_TRANSCRIPTION_HOTKEY = 'Ctrl+F8';

export interface HotkeySettings {
  hotkey: string;
  cancelHotkey: string;
  stopHotkey: string;
  translateHotkey: string;
  prettifyHotkey: string;
  prettifyQuickHotkey: string;
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
const PRETTIFY_HOTKEY_TARGETS: ReadonlySet<HotkeyTarget> = new Set(['prettify', 'prettifyQuick']);
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
  switch (target) {
    case 'record':
      return settings.hotkey;
    case 'stop':
      return settings.stopHotkey;
    case 'cancel':
      return settings.cancelHotkey;
    case 'translate':
      return settings.translateHotkey;
    case 'prettify':
      return settings.prettifyHotkey;
    case 'prettifyQuick':
      return settings.prettifyQuickHotkey;
    case 'retryTranscription':
      return settings.retryTranscriptionHotkey;
  }
}

function arePrettifySiblingTargets(first: HotkeyTarget, second: HotkeyTarget): boolean {
  return first !== second && PRETTIFY_HOTKEY_TARGETS.has(first) && PRETTIFY_HOTKEY_TARGETS.has(second);
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

export function normalizeHotkeyForPlatform(hotkey: string, platform: NodeJS.Platform): string | null {
  const normalized = normalizeHotkey(hotkey);
  if (!normalized) return null;
  const platformSpecific =
    platform === 'darwin'
      ? normalized.replace(/\bCommandOrControl\b/gu, 'Command').replace(/\bSuper\b/gu, 'Command')
      : normalized.replace(/\bCommandOrControl\b/gu, 'Ctrl').replace(/\bCommand\b/gu, 'Super');
  return normalizeHotkey(platformSpecific);
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
  platform: NodeJS.Platform,
): HotkeyTarget | null {
  const parsedCandidate = parseHotkey(normalizeHotkeyForPlatform(candidate, platform) ?? '');
  if (!parsedCandidate) return null;

  for (const existingTarget of HOTKEY_TARGETS) {
    if (existingTarget === target) continue;
    const existing = parseHotkey(
      normalizeHotkeyForPlatform(getHotkeyForTarget(settings, existingTarget), platform) ?? '',
    );
    if (!existing || existing.key !== parsedCandidate.key) continue;
    if (existing.accelerator === parsedCandidate.accelerator) return existingTarget;
    if (arePrettifySiblingTargets(target, existingTarget)) continue;
    if (existing.modifiers.length === 0 || parsedCandidate.modifiers.length === 0) {
      return existingTarget;
    }
  }

  return null;
}

export function getConflictingHotkeyTargets(settings: HotkeySettings, platform: NodeJS.Platform): HotkeyTarget[] {
  return HOTKEY_TARGETS.filter((target) =>
    Boolean(getHotkeyConflict(target, getHotkeyForTarget(settings, target), settings, platform)),
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
