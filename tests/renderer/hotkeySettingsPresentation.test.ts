import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canRemoveHotkey,
  canTestHotkey,
  getHotkeyAuthorityTranslationKey,
  getHotkeyFailureTranslationKey,
  getHotkeyRuntimeSnapshotEntry,
  getHotkeyStatusTranslationKey,
  getHotkeyTestTranslationKey,
  type HotkeySettingsTranslationKey,
} from '../../src/renderer/hotkeySettingsPresentation';
import type { HotkeyRuntimeState } from '../../src/shared/hotkeyIpc';
import {
  createUnassignedHotkeySettings,
  HOTKEY_TARGETS,
  HotkeyBindingAuthority,
  HotkeyDispatchStatus,
  HotkeyRegistrationFailureCode,
  HotkeyRegistrationStatus,
  HotkeyTestResult,
  type HotkeyRuntimeSnapshotEntry,
  type HotkeyTarget,
} from '../../src/shared/hotkeys';

function createUnassignedEntry(target: HotkeyTarget): HotkeyRuntimeSnapshotEntry {
  return {
    bindingAuthority: HotkeyBindingAuthority.None,
    configuredAccelerator: null,
    dispatchStatus: HotkeyDispatchStatus.Enabled,
    effectiveAccelerator: null,
    registrationStatus: HotkeyRegistrationStatus.Unassigned,
    target,
  };
}

function createRuntimeState(
  entries: Readonly<Partial<Record<HotkeyTarget, HotkeyRuntimeSnapshotEntry>>>,
): HotkeyRuntimeState {
  return {
    revision: 4,
    settings: createUnassignedHotkeySettings(),
    snapshot: {
      entries: HOTKEY_TARGETS.map((target) => entries[target] ?? createUnassignedEntry(target)),
    },
  };
}

function createRegisteredEntry(
  target: HotkeyTarget,
  bindingAuthority: HotkeyBindingAuthority,
  effectiveAccelerator: string | null,
): HotkeyRuntimeSnapshotEntry {
  return {
    bindingAuthority,
    configuredAccelerator: 'Ctrl+Shift+R',
    dispatchStatus: HotkeyDispatchStatus.Enabled,
    effectiveAccelerator,
    registrationStatus: HotkeyRegistrationStatus.Registered,
    target,
  };
}

describe('hotkey settings presentation', () => {
  it('keeps configured, effective, authority, and registration state distinct', () => {
    const applicationEntry = createRegisteredEntry('record', HotkeyBindingAuthority.Application, 'Ctrl+Shift+R');
    const desktopEntry = createRegisteredEntry('stop', HotkeyBindingAuthority.DesktopEnvironment, null);
    const suppressedEntry: HotkeyRuntimeSnapshotEntry = {
      ...applicationEntry,
      dispatchStatus: HotkeyDispatchStatus.Suppressed,
      target: 'cancel',
    };
    const failedEntry: HotkeyRuntimeSnapshotEntry = {
      bindingAuthority: HotkeyBindingAuthority.None,
      configuredAccelerator: 'Ctrl+Shift+T',
      dispatchStatus: HotkeyDispatchStatus.Enabled,
      effectiveAccelerator: null,
      failureCode: HotkeyRegistrationFailureCode.RegistrationRejected,
      registrationStatus: HotkeyRegistrationStatus.Failed,
      target: 'translate',
    };
    const runtimeState = createRuntimeState({
      cancel: suppressedEntry,
      record: applicationEntry,
      stop: desktopEntry,
      translate: failedEntry,
    });

    assert.strictEqual(getHotkeyRuntimeSnapshotEntry(runtimeState, 'record'), applicationEntry);
    assert.equal(getHotkeyStatusTranslationKey(applicationEntry), 'hotkey.status.registered');
    assert.equal(getHotkeyAuthorityTranslationKey(applicationEntry), 'hotkey.authority.application');
    assert.equal(getHotkeyStatusTranslationKey(desktopEntry), 'hotkey.status.desktopManaged');
    assert.equal(getHotkeyAuthorityTranslationKey(desktopEntry), 'hotkey.authority.desktopEnvironment');
    assert.equal(getHotkeyStatusTranslationKey(suppressedEntry), 'hotkey.status.suppressed');
    assert.equal(getHotkeyStatusTranslationKey(failedEntry), 'hotkey.status.failed');
    assert.equal(getHotkeyAuthorityTranslationKey(failedEntry), 'hotkey.authority.none');
    assert.equal(
      getHotkeyStatusTranslationKey(getHotkeyRuntimeSnapshotEntry(runtimeState, 'prettify')),
      'hotkey.status.unassigned',
    );
  });

  it('maps only bounded main-owned result enums to translation keys and allowed actions', () => {
    const failureCases: readonly [HotkeyRegistrationFailureCode, HotkeySettingsTranslationKey][] = [
      [HotkeyRegistrationFailureCode.InvalidAccelerator, 'hotkey.failure.invalidAccelerator'],
      [HotkeyRegistrationFailureCode.InternalConflict, 'hotkey.failure.internalConflict'],
      [HotkeyRegistrationFailureCode.OsReserved, 'hotkey.failure.osReserved'],
      [HotkeyRegistrationFailureCode.RegistrationRejected, 'hotkey.failure.registrationRejected'],
      [HotkeyRegistrationFailureCode.PersistenceFailed, 'hotkey.failure.persistenceFailed'],
      [HotkeyRegistrationFailureCode.ReconciliationFailed, 'hotkey.failure.reconciliationFailed'],
      [HotkeyRegistrationFailureCode.UnsupportedPlatform, 'hotkey.failure.unsupportedPlatform'],
    ];
    const registered = createRegisteredEntry('record', HotkeyBindingAuthority.Application, 'Ctrl+Shift+R');
    const failed: HotkeyRuntimeSnapshotEntry = {
      ...registered,
      bindingAuthority: HotkeyBindingAuthority.None,
      effectiveAccelerator: null,
      failureCode: HotkeyRegistrationFailureCode.PersistenceFailed,
      registrationStatus: HotkeyRegistrationStatus.Failed,
    };

    for (const [failureCode, translationKey] of failureCases) {
      assert.equal(getHotkeyFailureTranslationKey(failureCode), translationKey);
    }
    assert.equal(getHotkeyFailureTranslationKey(undefined), 'hotkey.failure.registrationRejected');
    assert.equal(getHotkeyTestTranslationKey('waiting'), 'hotkey.testing');
    assert.equal(getHotkeyTestTranslationKey(HotkeyTestResult.Detected), 'hotkey.test.detected');
    assert.equal(getHotkeyTestTranslationKey(HotkeyTestResult.TimedOut), 'hotkey.test.timedOut');
    assert.equal(getHotkeyTestTranslationKey(HotkeyTestResult.Unavailable), 'hotkey.test.unavailable');
    assert.equal(canRemoveHotkey(createUnassignedEntry('record')), false);
    assert.equal(canRemoveHotkey(failed), true);
    assert.equal(canTestHotkey(registered), true);
    assert.equal(canTestHotkey(failed), false);
  });
});
