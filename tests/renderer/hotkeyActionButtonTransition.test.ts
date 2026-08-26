import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatHotkeyLegend,
  getHotkeyActionButtonRegistrationPresentation,
  getHotkeyActionButtonVisualTransition,
  getInitialHotkeyActionButtonVisualState,
  HOTKEY_ACTION_BUTTON_LOCK_GRACE_MS,
  HOTKEY_ACTION_BUTTON_MAX_LOCK_TRANSITION_MS,
  isHotkeyActionButtonUnavailable,
  type HotkeyActionButtonSemanticState,
} from '@renderer/hotkeyActionButtonState';
import {
  HotkeyBindingAuthority,
  HotkeyDispatchStatus,
  HotkeyRegistrationFailureCode,
  HotkeyRegistrationStatus,
  type HotkeyRuntimeSnapshotEntry,
} from '@shared/hotkeys';

const ENABLED: HotkeyActionButtonSemanticState = Object.freeze({
  active: false,
  busy: false,
  disabled: false,
  locked: false,
});

const LOCKED: HotkeyActionButtonSemanticState = Object.freeze({ ...ENABLED, locked: true });
const DISABLED: HotkeyActionButtonSemanticState = Object.freeze({ ...ENABLED, disabled: true });
const BUSY: HotkeyActionButtonSemanticState = Object.freeze({ ...ENABLED, busy: true });
const ACTIVE_LOCKED: HotkeyActionButtonSemanticState = Object.freeze({ ...LOCKED, active: true });

function createRegisteredEntry(): HotkeyRuntimeSnapshotEntry {
  return {
    bindingAuthority: HotkeyBindingAuthority.Application,
    configuredAccelerator: 'Ctrl+Shift+R',
    dispatchStatus: HotkeyDispatchStatus.Enabled,
    effectiveAccelerator: 'Ctrl+Shift+R',
    registrationStatus: HotkeyRegistrationStatus.Registered,
    target: 'record',
  };
}

class FakeClock {
  public elapsedMs = 0;

  public advance(delayMs: number): void {
    this.elapsedMs += delayMs;
  }
}

describe('HotkeyActionButton visual-state transitions', () => {
  it('retains a raised visual for the 110 ms lock grace and reaches Disabled inside the 200 ms limit', () => {
    const clock = new FakeClock();
    const transition = getHotkeyActionButtonVisualTransition(ENABLED, LOCKED);

    assert.deepEqual(transition, { delayMs: HOTKEY_ACTION_BUTTON_LOCK_GRACE_MS, state: 'locking' });
    assert.equal(isHotkeyActionButtonUnavailable(LOCKED), true, 'semantic availability changes immediately');
    clock.advance(transition.delayMs ?? 0);
    assert.equal(clock.elapsedMs, HOTKEY_ACTION_BUTTON_LOCK_GRACE_MS);
    assert.ok(clock.elapsedMs <= HOTKEY_ACTION_BUTTON_MAX_LOCK_TRANSITION_MS);
    assert.equal(getInitialHotkeyActionButtonVisualState(LOCKED), 'disabled');
  });

  it('renders an initially locked key directly Disabled and cancels a pending lock presentation when the lock clears', () => {
    assert.equal(getInitialHotkeyActionButtonVisualState(LOCKED), 'disabled');
    assert.deepEqual(getHotkeyActionButtonVisualTransition(LOCKED, ENABLED), { delayMs: null, state: 'enabled' });
  });

  it('gives busy and active ownership their defined visual precedence while retaining unavailable semantics', () => {
    assert.equal(getInitialHotkeyActionButtonVisualState(BUSY), 'busy');
    assert.equal(isHotkeyActionButtonUnavailable(BUSY), true);
    assert.equal(getInitialHotkeyActionButtonVisualState(ACTIVE_LOCKED), 'active');
    assert.equal(isHotkeyActionButtonUnavailable(ACTIVE_LOCKED), true);
    assert.equal(getInitialHotkeyActionButtonVisualState(DISABLED), 'disabled');
  });

  it('formats only visible separator spacing and leaves raw accelerator values untouched', () => {
    const hotkey = 'Ctrl + Shift + F12';

    assert.deepEqual(formatHotkeyLegend(hotkey), [
      { id: 'key-0', kind: 'key', text: 'Ctrl' },
      { id: 'separator-1', kind: 'separator', text: ' + ' },
      { id: 'key-1', kind: 'key', text: 'Shift' },
      { id: 'separator-2', kind: 'separator', text: ' + ' },
      { id: 'key-2', kind: 'key', text: 'F12' },
    ]);
    assert.deepEqual(formatHotkeyLegend('F9'), [{ id: 'key-0', kind: 'key', text: 'F9' }]);
    assert.deepEqual(formatHotkeyLegend(null), []);
  });

  it('keeps configured, effective, authority, and registration presentation distinct', () => {
    const application = createRegisteredEntry();
    const desktopManaged: HotkeyRuntimeSnapshotEntry = {
      ...application,
      bindingAuthority: HotkeyBindingAuthority.DesktopEnvironment,
      effectiveAccelerator: null,
    };
    const failed: HotkeyRuntimeSnapshotEntry = {
      ...application,
      bindingAuthority: HotkeyBindingAuthority.None,
      effectiveAccelerator: null,
      failureCode: HotkeyRegistrationFailureCode.RegistrationRejected,
      registrationStatus: HotkeyRegistrationStatus.Failed,
    };
    const suppressed: HotkeyRuntimeSnapshotEntry = {
      ...application,
      dispatchStatus: HotkeyDispatchStatus.Suppressed,
    };

    assert.deepEqual(getHotkeyActionButtonRegistrationPresentation(null, null), {
      configuredAccelerator: null,
      effectiveAccelerator: null,
      state: 'unassigned',
    });
    assert.equal(getHotkeyActionButtonRegistrationPresentation('F9', application).state, 'application-enabled');
    assert.equal(getHotkeyActionButtonRegistrationPresentation('F9', desktopManaged).state, 'desktop-managed');
    assert.equal(getHotkeyActionButtonRegistrationPresentation('F9', failed).state, 'failed');
    assert.equal(getHotkeyActionButtonRegistrationPresentation('F9', suppressed).state, 'application-suppressed');
    assert.equal(getHotkeyActionButtonRegistrationPresentation('F9', desktopManaged).effectiveAccelerator, null);
  });
});
