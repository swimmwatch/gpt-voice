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

export enum DesktopPlatform {
  Windows = 'windows',
  Linux = 'linux',
  Macos = 'macos',
  Unsupported = 'unsupported',
}

export enum LinuxSessionType {
  X11 = 'x11',
  Wayland = 'wayland',
  Unknown = 'unknown',
  NotApplicable = 'not-applicable',
}

export enum HotkeyBindingAuthority {
  None = 'none',
  Application = 'application',
  DesktopEnvironment = 'desktop-environment',
}

export enum HotkeyRegistrationStatus {
  Unassigned = 'unassigned',
  Registered = 'registered',
  Failed = 'failed',
}

export enum HotkeyDispatchStatus {
  Enabled = 'enabled',
  Suppressed = 'suppressed',
}

export enum HotkeyRegistrationFailureCode {
  InvalidAccelerator = 'invalid-accelerator',
  InternalConflict = 'internal-conflict',
  OsReserved = 'os-reserved',
  RegistrationRejected = 'registration-rejected',
  PersistenceFailed = 'persistence-failed',
  ReconciliationFailed = 'reconciliation-failed',
  UnsupportedPlatform = 'unsupported-platform',
}

export enum HotkeyTestResult {
  Detected = 'detected',
  TimedOut = 'timed-out',
  Unavailable = 'unavailable',
}

export const DEFAULT_RECORD_HOTKEY = 'F9';
export const DEFAULT_STOP_HOTKEY = 'F10';
export const DEFAULT_CANCEL_HOTKEY = 'Escape';
export const DEFAULT_TRANSLATE_HOTKEY = 'F11';
export const DEFAULT_PRETTIFY_HOTKEY = 'F12';
export const DEFAULT_PRETTIFY_QUICK_HOTKEY = 'Ctrl+F12';
export const DEFAULT_RETRY_TRANSCRIPTION_HOTKEY = 'Ctrl+F8';

export interface HotkeySettings {
  readonly hotkey: string | null;
  readonly cancelHotkey: string | null;
  readonly stopHotkey: string | null;
  readonly translateHotkey: string | null;
  readonly prettifyHotkey: string | null;
  readonly prettifyQuickHotkey: string | null;
  readonly retryTranscriptionHotkey: string | null;
}

export interface HotkeyRuntimeSnapshotEntry {
  readonly bindingAuthority: HotkeyBindingAuthority;
  readonly configuredAccelerator: string | null;
  readonly dispatchStatus: HotkeyDispatchStatus;
  readonly effectiveAccelerator: string | null;
  readonly failureCode?: HotkeyRegistrationFailureCode;
  readonly registrationStatus: HotkeyRegistrationStatus;
  readonly target: HotkeyTarget;
}

export interface HotkeyRuntimeSnapshot {
  readonly entries: readonly HotkeyRuntimeSnapshotEntry[];
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
const DESKTOP_PLATFORM_VALUES: ReadonlySet<string> = new Set(Object.values(DesktopPlatform));
const LINUX_SESSION_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(LinuxSessionType));
const HOTKEY_BINDING_AUTHORITY_VALUES: ReadonlySet<string> = new Set(Object.values(HotkeyBindingAuthority));
const HOTKEY_REGISTRATION_STATUS_VALUES: ReadonlySet<string> = new Set(Object.values(HotkeyRegistrationStatus));
const HOTKEY_DISPATCH_STATUS_VALUES: ReadonlySet<string> = new Set(Object.values(HotkeyDispatchStatus));
const HOTKEY_FAILURE_CODE_VALUES: ReadonlySet<string> = new Set(Object.values(HotkeyRegistrationFailureCode));
const HOTKEY_TEST_RESULT_VALUES: ReadonlySet<string> = new Set(Object.values(HotkeyTestResult));
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

export function createUnassignedHotkeySettings(): HotkeySettings {
  return Object.freeze({
    cancelHotkey: null,
    hotkey: null,
    prettifyHotkey: null,
    prettifyQuickHotkey: null,
    retryTranscriptionHotkey: null,
    stopHotkey: null,
    translateHotkey: null,
  });
}

export function getHotkeyForTarget(settings: HotkeySettings, target: HotkeyTarget): string | null {
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

export function setHotkeyForTarget(
  settings: HotkeySettings,
  target: HotkeyTarget,
  accelerator: string | null,
): HotkeySettings {
  switch (target) {
    case 'record':
      return { ...settings, hotkey: accelerator };
    case 'stop':
      return { ...settings, stopHotkey: accelerator };
    case 'cancel':
      return { ...settings, cancelHotkey: accelerator };
    case 'translate':
      return { ...settings, translateHotkey: accelerator };
    case 'prettify':
      return { ...settings, prettifyHotkey: accelerator };
    case 'prettifyQuick':
      return { ...settings, prettifyQuickHotkey: accelerator };
    case 'retryTranscription':
      return { ...settings, retryTranscriptionHotkey: accelerator };
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

export function isNullableHotkey(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && normalizeHotkey(value) !== null);
}

export function isDesktopPlatform(value: unknown): value is DesktopPlatform {
  return typeof value === 'string' && DESKTOP_PLATFORM_VALUES.has(value);
}

export function isLinuxSessionType(value: unknown): value is LinuxSessionType {
  return typeof value === 'string' && LINUX_SESSION_TYPE_VALUES.has(value);
}

export function isHotkeyBindingAuthority(value: unknown): value is HotkeyBindingAuthority {
  return typeof value === 'string' && HOTKEY_BINDING_AUTHORITY_VALUES.has(value);
}

export function isHotkeyRegistrationStatus(value: unknown): value is HotkeyRegistrationStatus {
  return typeof value === 'string' && HOTKEY_REGISTRATION_STATUS_VALUES.has(value);
}

export function isHotkeyDispatchStatus(value: unknown): value is HotkeyDispatchStatus {
  return typeof value === 'string' && HOTKEY_DISPATCH_STATUS_VALUES.has(value);
}

export function isHotkeyRegistrationFailureCode(value: unknown): value is HotkeyRegistrationFailureCode {
  return typeof value === 'string' && HOTKEY_FAILURE_CODE_VALUES.has(value);
}

export function isHotkeyTestResult(value: unknown): value is HotkeyTestResult {
  return typeof value === 'string' && HOTKEY_TEST_RESULT_VALUES.has(value);
}

export function isHotkeySettings(value: unknown): value is HotkeySettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return [
    settings.hotkey,
    settings.stopHotkey,
    settings.cancelHotkey,
    settings.translateHotkey,
    settings.prettifyHotkey,
    settings.prettifyQuickHotkey,
    settings.retryTranscriptionHotkey,
  ].every((accelerator) => isNullableHotkey(accelerator));
}

export function isHotkeyRuntimeSnapshotEntry(value: unknown): value is HotkeyRuntimeSnapshotEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  if (
    !isHotkeyTarget(entry.target as string) ||
    !isNullableHotkey(entry.configuredAccelerator) ||
    !isNullableHotkey(entry.effectiveAccelerator) ||
    !isHotkeyBindingAuthority(entry.bindingAuthority) ||
    !isHotkeyRegistrationStatus(entry.registrationStatus) ||
    !isHotkeyDispatchStatus(entry.dispatchStatus) ||
    (entry.failureCode !== undefined && !isHotkeyRegistrationFailureCode(entry.failureCode))
  ) {
    return false;
  }

  if (entry.registrationStatus === HotkeyRegistrationStatus.Unassigned) {
    return (
      entry.configuredAccelerator === null &&
      entry.effectiveAccelerator === null &&
      entry.bindingAuthority === HotkeyBindingAuthority.None &&
      entry.failureCode === undefined
    );
  }
  if (entry.registrationStatus === HotkeyRegistrationStatus.Registered) {
    return (
      entry.configuredAccelerator !== null &&
      entry.bindingAuthority !== HotkeyBindingAuthority.None &&
      entry.failureCode === undefined
    );
  }
  return entry.configuredAccelerator !== null && entry.failureCode !== undefined;
}

export function isHotkeyRuntimeSnapshot(value: unknown): value is HotkeyRuntimeSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = (value as Record<string, unknown>).entries;
  return (
    Array.isArray(entries) &&
    entries.length === HOTKEY_TARGETS.length &&
    entries.every((entry, index) => isHotkeyRuntimeSnapshotEntry(entry) && entry.target === HOTKEY_TARGETS[index])
  );
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
    const configuredAccelerator = getHotkeyForTarget(settings, existingTarget);
    if (configuredAccelerator === null) continue;
    const existing = parseHotkey(normalizeHotkeyForPlatform(configuredAccelerator, platform) ?? '');
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
  return HOTKEY_TARGETS.filter((target) => {
    const accelerator = getHotkeyForTarget(settings, target);
    return accelerator !== null && Boolean(getHotkeyConflict(target, accelerator, settings, platform));
  });
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
