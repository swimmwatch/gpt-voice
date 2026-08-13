import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatHotkeyLegend,
  getHotkeyActionButtonVisualTransition,
  getInitialHotkeyActionButtonVisualState,
  HOTKEY_ACTION_BUTTON_LOCK_GRACE_MS,
  HOTKEY_ACTION_BUTTON_MAX_LOCK_TRANSITION_MS,
  isHotkeyActionButtonUnavailable,
  type HotkeyActionButtonSemanticState,
} from '@renderer/hotkeyActionButtonState';

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
  });
});
