import {
  HotkeyBindingAuthority,
  HotkeyDispatchStatus,
  HotkeyRegistrationFailureCode,
  HotkeyRegistrationStatus,
  HotkeyTestResult,
  type HotkeyRuntimeSnapshotEntry,
  type HotkeyTarget,
} from '@shared/hotkeys';
import type { HotkeyRuntimeState } from '@shared/hotkeyIpc';

export type HotkeySettingsTranslationKey =
  | 'hotkey.failure.internalConflict'
  | 'hotkey.failure.invalidAccelerator'
  | 'hotkey.failure.osReserved'
  | 'hotkey.failure.persistenceFailed'
  | 'hotkey.failure.reconciliationFailed'
  | 'hotkey.failure.registrationRejected'
  | 'hotkey.failure.unsupportedPlatform'
  | 'hotkey.authority.application'
  | 'hotkey.authority.desktopEnvironment'
  | 'hotkey.authority.none'
  | 'hotkey.status.desktopManaged'
  | 'hotkey.status.failed'
  | 'hotkey.status.registered'
  | 'hotkey.status.suppressed'
  | 'hotkey.status.unassigned'
  | 'hotkey.test.detected'
  | 'hotkey.test.timedOut'
  | 'hotkey.test.unavailable'
  | 'hotkey.testing';

const FAILURE_TRANSLATION_KEYS = Object.freeze({
  [HotkeyRegistrationFailureCode.InternalConflict]: 'hotkey.failure.internalConflict',
  [HotkeyRegistrationFailureCode.InvalidAccelerator]: 'hotkey.failure.invalidAccelerator',
  [HotkeyRegistrationFailureCode.OsReserved]: 'hotkey.failure.osReserved',
  [HotkeyRegistrationFailureCode.PersistenceFailed]: 'hotkey.failure.persistenceFailed',
  [HotkeyRegistrationFailureCode.ReconciliationFailed]: 'hotkey.failure.reconciliationFailed',
  [HotkeyRegistrationFailureCode.RegistrationRejected]: 'hotkey.failure.registrationRejected',
  [HotkeyRegistrationFailureCode.UnsupportedPlatform]: 'hotkey.failure.unsupportedPlatform',
} as const satisfies Readonly<Record<HotkeyRegistrationFailureCode, HotkeySettingsTranslationKey>>);

const TEST_TRANSLATION_KEYS = Object.freeze({
  [HotkeyTestResult.Detected]: 'hotkey.test.detected',
  [HotkeyTestResult.TimedOut]: 'hotkey.test.timedOut',
  [HotkeyTestResult.Unavailable]: 'hotkey.test.unavailable',
  waiting: 'hotkey.testing',
} as const satisfies Readonly<Record<HotkeyTestResult | 'waiting', HotkeySettingsTranslationKey>>);

export function getHotkeyRuntimeSnapshotEntry(
  runtimeState: HotkeyRuntimeState,
  target: HotkeyTarget,
): HotkeyRuntimeSnapshotEntry {
  const entry = runtimeState.snapshot.entries.find((candidate) => candidate.target === target);
  if (!entry) throw new Error('Hotkey runtime snapshot is missing a target');
  return entry;
}

export function getHotkeyFailureTranslationKey(
  failureCode: HotkeyRegistrationFailureCode | undefined,
): HotkeySettingsTranslationKey {
  return FAILURE_TRANSLATION_KEYS[failureCode ?? HotkeyRegistrationFailureCode.RegistrationRejected];
}

export function getHotkeyStatusTranslationKey(entry: HotkeyRuntimeSnapshotEntry): HotkeySettingsTranslationKey {
  if (entry.registrationStatus === HotkeyRegistrationStatus.Unassigned) return 'hotkey.status.unassigned';
  if (entry.registrationStatus === HotkeyRegistrationStatus.Failed) return 'hotkey.status.failed';
  if (entry.dispatchStatus === HotkeyDispatchStatus.Suppressed) return 'hotkey.status.suppressed';
  return entry.effectiveAccelerator === null ? 'hotkey.status.desktopManaged' : 'hotkey.status.registered';
}

export function getHotkeyAuthorityTranslationKey(entry: HotkeyRuntimeSnapshotEntry): HotkeySettingsTranslationKey {
  switch (entry.bindingAuthority) {
    case HotkeyBindingAuthority.Application:
      return 'hotkey.authority.application';
    case HotkeyBindingAuthority.DesktopEnvironment:
      return 'hotkey.authority.desktopEnvironment';
    case HotkeyBindingAuthority.None:
      return 'hotkey.authority.none';
  }
}

export function getHotkeyTestTranslationKey(result: HotkeyTestResult | 'waiting'): HotkeySettingsTranslationKey {
  return TEST_TRANSLATION_KEYS[result];
}

export function canRemoveHotkey(entry: HotkeyRuntimeSnapshotEntry): boolean {
  return entry.configuredAccelerator !== null;
}

export function canTestHotkey(entry: HotkeyRuntimeSnapshotEntry): boolean {
  return entry.registrationStatus === HotkeyRegistrationStatus.Registered;
}
