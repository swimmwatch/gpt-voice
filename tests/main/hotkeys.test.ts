import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRunTextActionHotkey,
  canRunRetryTranscriptionHotkey,
  canRunTranslateHotkey,
  createUnassignedHotkeySettings,
  DesktopPlatform,
  getHotkeyConflict,
  getHotkeyFromKeyboardEvent,
  HotkeyBindingAuthority,
  HotkeyDispatchStatus,
  HotkeyRegistrationFailureCode,
  HotkeyRegistrationStatus,
  HotkeyTestResult,
  HOTKEY_TARGETS,
  isDesktopPlatform,
  isHotkeyBindingAuthority,
  isHotkeyDispatchStatus,
  isHotkeyRegistrationFailureCode,
  isHotkeyRegistrationStatus,
  isHotkeyRuntimeSnapshot,
  isHotkeyRuntimeSnapshotEntry,
  isHotkeySettings,
  isHotkeyTestResult,
  isLinuxSessionType,
  isHotkeyTarget,
  LinuxSessionType,
  normalizeHotkey,
  normalizeHotkeyForPlatform,
} from '@shared/hotkeys';

describe('hotkeys', () => {
  it('creates an explicit unassigned setting for every target', () => {
    assert.deepEqual(createUnassignedHotkeySettings(), {
      cancelHotkey: null,
      hotkey: null,
      prettifyHotkey: null,
      prettifyQuickHotkey: null,
      retryTranscriptionHotkey: null,
      stopHotkey: null,
      translateHotkey: null,
    });
  });

  it('validates bounded registration contracts and canonical target snapshots', () => {
    assert.equal(isDesktopPlatform(DesktopPlatform.Linux), true);
    assert.equal(isLinuxSessionType(LinuxSessionType.Wayland), true);
    assert.equal(isHotkeyBindingAuthority(HotkeyBindingAuthority.Application), true);
    assert.equal(isHotkeyRegistrationStatus(HotkeyRegistrationStatus.Registered), true);
    assert.equal(isHotkeyDispatchStatus(HotkeyDispatchStatus.Suppressed), true);
    assert.equal(isHotkeyRegistrationFailureCode(HotkeyRegistrationFailureCode.ReconciliationFailed), true);
    assert.equal(isHotkeyTestResult(HotkeyTestResult.TimedOut), true);
    assert.equal(isDesktopPlatform('android'), false);
    assert.equal(isLinuxSessionType('portal'), false);

    const entry = {
      bindingAuthority: HotkeyBindingAuthority.Application,
      configuredAccelerator: 'Ctrl+F9',
      dispatchStatus: HotkeyDispatchStatus.Enabled,
      effectiveAccelerator: 'Ctrl+F9',
      registrationStatus: HotkeyRegistrationStatus.Registered,
      target: 'record',
    } as const;
    assert.equal(isHotkeyRuntimeSnapshotEntry(entry), true);
    assert.equal(
      isHotkeyRuntimeSnapshot({
        entries: HOTKEY_TARGETS.map((target) => ({ ...entry, target })),
      }),
      true,
    );
    const failedEntry = {
      ...entry,
      bindingAuthority: HotkeyBindingAuthority.None,
      configuredAccelerator: null,
      effectiveAccelerator: null,
      failureCode: HotkeyRegistrationFailureCode.ReconciliationFailed,
      registrationStatus: HotkeyRegistrationStatus.Failed,
    } as const;
    assert.equal(isHotkeyRuntimeSnapshotEntry(failedEntry), true);
    assert.equal(isHotkeyRuntimeSnapshotEntry({ ...failedEntry, effectiveAccelerator: 'Ctrl+F9' }), false);
    assert.equal(
      isHotkeyRuntimeSnapshotEntry({ ...failedEntry, bindingAuthority: HotkeyBindingAuthority.Application }),
      false,
    );
    assert.equal(isHotkeyRuntimeSnapshot({ entries: [{ ...entry, target: 'stop' }] }), false);
  });

  it('recognizes every supported hotkey target', () => {
    assert.deepEqual(HOTKEY_TARGETS, [
      'record',
      'stop',
      'cancel',
      'translate',
      'prettify',
      'prettifyQuick',
      'retryTranscription',
    ]);
    assert.equal(isHotkeyTarget('record'), true);
    assert.equal(isHotkeyTarget('stop'), true);
    assert.equal(isHotkeyTarget('cancel'), true);
    assert.equal(isHotkeyTarget('translate'), true);
    assert.equal(isHotkeyTarget('prettify'), true);
    assert.equal(isHotkeyTarget('prettifyQuick'), true);
    assert.equal(isHotkeyTarget('retryTranscription'), true);
    assert.equal(isHotkeyTarget('missing'), false);
  });

  it('captures and normalizes hotkey combinations without accepting modifier-only input', () => {
    assert.equal(
      getHotkeyFromKeyboardEvent({ altKey: false, ctrlKey: true, key: 'F9', metaKey: false, shiftKey: false }, 'linux'),
      'Ctrl+F9',
    );
    assert.equal(
      getHotkeyFromKeyboardEvent({ altKey: false, ctrlKey: false, key: 'f9', metaKey: false, shiftKey: true }, 'linux'),
      'Shift+F9',
    );
    assert.equal(
      getHotkeyFromKeyboardEvent(
        { altKey: false, ctrlKey: true, key: 'Control', metaKey: false, shiftKey: false },
        'linux',
      ),
      null,
    );
    assert.equal(normalizeHotkey('shift + ctrl + f9'), 'Ctrl+Shift+F9');
  });

  it('rejects bare and modified shortcuts that share the same key', () => {
    const settings = {
      cancelHotkey: 'Escape',
      hotkey: 'F9',
      prettifyHotkey: 'F12',
      prettifyQuickHotkey: 'Ctrl+F12',
      retryTranscriptionHotkey: 'Ctrl+F8',
      stopHotkey: 'F10',
      translateHotkey: 'F11',
    };

    assert.equal(getHotkeyConflict('retryTranscription', 'Ctrl+F9', settings, 'linux'), 'record');
    assert.equal(getHotkeyConflict('retryTranscription', 'Shift+F9', settings, 'linux'), 'record');
    assert.equal(getHotkeyConflict('retryTranscription', 'Ctrl+F8', settings, 'linux'), null);
  });

  it('ignores unassigned settings during conflict detection', () => {
    const settings = {
      cancelHotkey: null,
      hotkey: 'F9',
      prettifyHotkey: null,
      prettifyQuickHotkey: null,
      retryTranscriptionHotkey: null,
      stopHotkey: null,
      translateHotkey: null,
    };

    assert.equal(isHotkeySettings(settings), true);
    assert.equal(getHotkeyConflict('translate', 'Ctrl+F9', settings, 'linux'), 'record');
    assert.equal(getHotkeyConflict('translate', 'F12', settings, 'linux'), null);
  });

  it('allows only distinct Prettify sibling accelerators to share F12', () => {
    const settings = {
      cancelHotkey: 'Escape',
      hotkey: 'F9',
      prettifyHotkey: 'F12',
      prettifyQuickHotkey: 'Ctrl+F12',
      retryTranscriptionHotkey: 'Ctrl+F8',
      stopHotkey: 'F10',
      translateHotkey: 'F11',
    };

    assert.equal(getHotkeyConflict('prettify', settings.prettifyHotkey, settings, 'linux'), null);
    assert.equal(getHotkeyConflict('prettifyQuick', settings.prettifyQuickHotkey, settings, 'linux'), null);
    assert.equal(getHotkeyConflict('prettifyQuick', 'F12', settings, 'linux'), 'prettify');
    assert.equal(getHotkeyConflict('prettify', 'Ctrl+F12', settings, 'linux'), 'prettifyQuick');

    const thirdTargetOwnsF12 = { ...settings, hotkey: 'F12' };
    assert.equal(getHotkeyConflict('prettify', 'Alt+F12', thirdTargetOwnsF12, 'linux'), 'record');
    assert.equal(getHotkeyConflict('prettifyQuick', 'Ctrl+F12', thirdTargetOwnsF12, 'linux'), 'record');
  });

  it('detects accelerators that become identical after platform normalization', () => {
    const settings = {
      cancelHotkey: 'Escape',
      hotkey: 'CommandOrControl+K',
      prettifyHotkey: 'F12',
      prettifyQuickHotkey: 'Ctrl+F12',
      retryTranscriptionHotkey: 'Ctrl+F8',
      stopHotkey: 'F10',
      translateHotkey: 'F11',
    };

    assert.equal(normalizeHotkeyForPlatform('Super+K', 'darwin'), 'Command+K');
    assert.equal(normalizeHotkeyForPlatform('CommandOrControl+K', 'darwin'), 'Command+K');
    assert.equal(getHotkeyConflict('translate', 'Super+K', settings, 'darwin'), 'record');

    assert.equal(normalizeHotkeyForPlatform('Command+K', 'linux'), 'Super+K');
    assert.equal(normalizeHotkeyForPlatform('CommandOrControl+K', 'linux'), 'Ctrl+K');
    assert.equal(getHotkeyConflict('translate', 'Ctrl+K', settings, 'linux'), 'record');
    assert.equal(getHotkeyConflict('translate', 'Super+K', settings, 'linux'), null);

    assert.equal(normalizeHotkeyForPlatform('Command+K', 'win32'), 'Super+K');
    assert.equal(normalizeHotkeyForPlatform('CommandOrControl+K', 'win32'), 'Ctrl+K');
    assert.equal(getHotkeyConflict('translate', 'Ctrl+K', settings, 'win32'), 'record');
    assert.equal(getHotkeyConflict('translate', 'Super+K', settings, 'win32'), null);
  });

  it('allows selected-text hotkeys only when recording is idle', () => {
    assert.equal(canRunTranslateHotkey(false), true);
    assert.equal(canRunTranslateHotkey(true), false);
    assert.equal(canRunTextActionHotkey(false), true);
    assert.equal(canRunTextActionHotkey(true), false);
  });

  it('allows retry transcription only when retryable audio is available and recording is idle', () => {
    assert.equal(canRunRetryTranscriptionHotkey(false, true), true);
    assert.equal(canRunRetryTranscriptionHotkey(false, false), false);
    assert.equal(canRunRetryTranscriptionHotkey(true, true), false);
  });
});
