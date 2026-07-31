import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRunTextActionHotkey,
  canRunRetryTranscriptionHotkey,
  canRunTranslateHotkey,
  DEFAULT_CANCEL_HOTKEY,
  DEFAULT_PRETTIFY_HOTKEY,
  DEFAULT_PRETTIFY_QUICK_HOTKEY,
  DEFAULT_RECORD_HOTKEY,
  DEFAULT_RETRY_TRANSCRIPTION_HOTKEY,
  DEFAULT_STOP_HOTKEY,
  DEFAULT_TRANSLATE_HOTKEY,
  getHotkeyConflict,
  getHotkeyFromKeyboardEvent,
  HOTKEY_TARGETS,
  isHotkeyTarget,
  normalizeHotkey,
  normalizeHotkeyForPlatform,
} from '@shared/hotkeys';

describe('hotkeys', () => {
  it('defines the default translation hotkey with existing recording defaults', () => {
    assert.equal(DEFAULT_RECORD_HOTKEY, 'F9');
    assert.equal(DEFAULT_STOP_HOTKEY, 'F10');
    assert.equal(DEFAULT_CANCEL_HOTKEY, 'Escape');
    assert.equal(DEFAULT_TRANSLATE_HOTKEY, 'F11');
    assert.equal(DEFAULT_PRETTIFY_HOTKEY, 'F12');
    assert.equal(DEFAULT_PRETTIFY_QUICK_HOTKEY, 'Ctrl+F12');
    assert.equal(DEFAULT_RETRY_TRANSCRIPTION_HOTKEY, 'Ctrl+F8');
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
