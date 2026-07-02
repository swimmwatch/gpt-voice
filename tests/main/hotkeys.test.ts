import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRunTranslateHotkey,
  DEFAULT_CANCEL_HOTKEY,
  DEFAULT_RECORD_HOTKEY,
  DEFAULT_STOP_HOTKEY,
  DEFAULT_TRANSLATE_HOTKEY,
  HOTKEY_TARGETS,
  isHotkeyTarget,
} from '@shared/hotkeys';

describe('hotkeys', () => {
  it('defines the default translation hotkey with existing recording defaults', () => {
    assert.equal(DEFAULT_RECORD_HOTKEY, 'F9');
    assert.equal(DEFAULT_STOP_HOTKEY, 'F10');
    assert.equal(DEFAULT_CANCEL_HOTKEY, 'Escape');
    assert.equal(DEFAULT_TRANSLATE_HOTKEY, 'F11');
  });

  it('recognizes every supported hotkey target', () => {
    assert.deepEqual(HOTKEY_TARGETS, ['record', 'stop', 'cancel', 'translate']);
    assert.equal(isHotkeyTarget('record'), true);
    assert.equal(isHotkeyTarget('stop'), true);
    assert.equal(isHotkeyTarget('cancel'), true);
    assert.equal(isHotkeyTarget('translate'), true);
    assert.equal(isHotkeyTarget('missing'), false);
  });

  it('allows translate hotkey only when recording is idle', () => {
    assert.equal(canRunTranslateHotkey(false), true);
    assert.equal(canRunTranslateHotkey(true), false);
  });
});
