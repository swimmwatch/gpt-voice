import {
  HOTKEY_TARGETS,
  HotkeyBindingAuthority,
  HotkeyRegistrationStatus,
  isHotkeyRegistrationFailureCode,
  isHotkeyRuntimeSnapshot,
  isHotkeyRuntimeSnapshotEntry,
  isHotkeySettings,
  isHotkeyTarget,
  isHotkeyTestResult,
  normalizeHotkey,
  type HotkeyRegistrationFailureCode,
  type HotkeyRuntimeSnapshot,
  type HotkeyRuntimeSnapshotEntry,
  type HotkeySettings,
  type HotkeyTarget,
  type HotkeyTestResult,
} from './hotkeys';

export const HOTKEY_IPC_CHANNELS = Object.freeze({
  clear: 'hotkey-clear',
  set: 'hotkey-set',
  snapshotChanged: 'hotkey-runtime-state-changed',
  snapshotQuery: 'get-hotkey-runtime-state',
  test: 'hotkey-test',
});

export interface HotkeyRuntimeState {
  readonly revision: number;
  readonly settings: HotkeySettings;
  readonly snapshot: HotkeyRuntimeSnapshot;
}

export interface HotkeySetRequest {
  readonly accelerator: string;
  readonly target: HotkeyTarget;
}

export interface HotkeyClearRequest {
  readonly target: HotkeyTarget;
}

export interface HotkeyTestRequest {
  readonly target: HotkeyTarget;
}

export type HotkeyMutationResponse =
  | Readonly<{ readonly state: HotkeyRuntimeState; readonly status: 'success' }>
  | Readonly<{
      readonly failureCode: HotkeyRegistrationFailureCode;
      readonly state: HotkeyRuntimeState;
      readonly status: 'failure';
    }>;

export interface HotkeyTestResponse {
  readonly result: HotkeyTestResult;
  readonly state: HotkeyRuntimeState;
}

const HOTKEY_SETTINGS_KEYS = [
  'cancelHotkey',
  'hotkey',
  'prettifyHotkey',
  'prettifyQuickHotkey',
  'retryTranscriptionHotkey',
  'stopHotkey',
  'translateHotkey',
] as const;

const HOTKEY_SNAPSHOT_ENTRY_KEYS = [
  'bindingAuthority',
  'configuredAccelerator',
  'dispatchStatus',
  'effectiveAccelerator',
  'failureCode',
  'registrationStatus',
  'target',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Reflect.ownKeys(value);
  return actualKeys.length === keys.length && keys.every((key) => hasOwn(value, key));
}

function hasSnapshotEntryKeys(value: Record<string, unknown>): boolean {
  const actualKeys = Reflect.ownKeys(value);
  const hasFailureCode = hasOwn(value, 'failureCode');
  return (
    actualKeys.length === HOTKEY_SNAPSHOT_ENTRY_KEYS.length - (hasFailureCode ? 0 : 1) &&
    HOTKEY_SNAPSHOT_ENTRY_KEYS.every((key) => key === 'failureCode' || hasOwn(value, key))
  );
}

function isStrictHotkeySettings(value: unknown): value is HotkeySettings {
  return isPlainObject(value) && hasExactKeys(value, HOTKEY_SETTINGS_KEYS) && isHotkeySettings(value);
}

function isStrictHotkeyRuntimeSnapshot(value: unknown): value is HotkeyRuntimeSnapshot {
  if (!isPlainObject(value) || !hasExactKeys(value, ['entries']) || !isHotkeyRuntimeSnapshot(value)) return false;
  const entries = value.entries;
  return (
    Array.isArray(entries) &&
    entries.length === HOTKEY_TARGETS.length &&
    entries.every(
      (entry, index) =>
        isPlainObject(entry) &&
        hasSnapshotEntryKeys(entry) &&
        isHotkeyRuntimeSnapshotEntry(entry) &&
        hasValidBindingInvariant(entry) &&
        entry.target === HOTKEY_TARGETS[index],
    )
  );
}

function hasValidBindingInvariant(entry: HotkeyRuntimeSnapshotEntry): boolean {
  if (entry.registrationStatus !== HotkeyRegistrationStatus.Registered) return true;
  return (
    (entry.bindingAuthority === HotkeyBindingAuthority.Application && entry.effectiveAccelerator !== null) ||
    (entry.bindingAuthority === HotkeyBindingAuthority.DesktopEnvironment && entry.effectiveAccelerator === null)
  );
}

export function isHotkeyRuntimeState(value: unknown): value is HotkeyRuntimeState {
  if (!isPlainObject(value) || !hasExactKeys(value, ['revision', 'settings', 'snapshot'])) return false;
  const { revision, settings, snapshot } = value;
  return (
    typeof revision === 'number' &&
    Number.isSafeInteger(revision) &&
    revision >= 0 &&
    isStrictHotkeySettings(settings) &&
    isStrictHotkeyRuntimeSnapshot(snapshot)
  );
}

export function isHotkeySetRequest(value: unknown): value is HotkeySetRequest {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ['accelerator', 'target']) &&
    typeof value.accelerator === 'string' &&
    normalizeHotkey(value.accelerator) !== null &&
    typeof value.target === 'string' &&
    isHotkeyTarget(value.target)
  );
}

export function isHotkeyClearRequest(value: unknown): value is HotkeyClearRequest {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ['target']) &&
    typeof value.target === 'string' &&
    isHotkeyTarget(value.target)
  );
}

export function isHotkeyTestRequest(value: unknown): value is HotkeyTestRequest {
  return isHotkeyClearRequest(value);
}

export function isHotkeyMutationResponse(value: unknown): value is HotkeyMutationResponse {
  if (!isPlainObject(value) || typeof value.status !== 'string' || !isHotkeyRuntimeState(value.state)) return false;
  if (value.status === 'success') return hasExactKeys(value, ['state', 'status']);
  return (
    value.status === 'failure' &&
    hasExactKeys(value, ['failureCode', 'state', 'status']) &&
    isHotkeyRegistrationFailureCode(value.failureCode)
  );
}

export function isHotkeyTestResponse(value: unknown): value is HotkeyTestResponse {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ['result', 'state']) &&
    isHotkeyTestResult(value.result) &&
    isHotkeyRuntimeState(value.state)
  );
}
