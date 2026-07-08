import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRunTextActionHotkey,
  canRunRetryTranscriptionHotkey,
  canRunTranslateHotkey,
  DEFAULT_CANCEL_HOTKEY,
  DEFAULT_PRETTIFY_HOTKEY,
  DEFAULT_PROMPT_COMPRESSION_HOTKEY,
  DEFAULT_RECORD_HOTKEY,
  DEFAULT_RETRY_TRANSCRIPTION_HOTKEY,
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
    assert.equal(DEFAULT_PRETTIFY_HOTKEY, 'F12');
    assert.equal(DEFAULT_PROMPT_COMPRESSION_HOTKEY, 'Ctrl+F12');
    assert.equal(DEFAULT_RETRY_TRANSCRIPTION_HOTKEY, 'Ctrl+F9');
  });

  it('recognizes every supported hotkey target', () => {
    assert.deepEqual(HOTKEY_TARGETS, [
      'record',
      'stop',
      'cancel',
      'translate',
      'prettify',
      'promptCompression',
      'retryTranscription',
    ]);
    assert.equal(isHotkeyTarget('record'), true);
    assert.equal(isHotkeyTarget('stop'), true);
    assert.equal(isHotkeyTarget('cancel'), true);
    assert.equal(isHotkeyTarget('translate'), true);
    assert.equal(isHotkeyTarget('prettify'), true);
    assert.equal(isHotkeyTarget('promptCompression'), true);
    assert.equal(isHotkeyTarget('retryTranscription'), true);
    assert.equal(isHotkeyTarget('missing'), false);
  });

  it('allows selected-text hotkeys only when recording is idle', () => {
    assert.equal(canRunTranslateHotkey(false), true);
    assert.equal(canRunTranslateHotkey(true), false);
    assert.equal(canRunTextActionHotkey(false), true);
    assert.equal(canRunTextActionHotkey(true), false);
  });

  it('allows retry transcription only when failed audio is available and recording is idle', () => {
    assert.equal(canRunRetryTranscriptionHotkey(false, true), true);
    assert.equal(canRunRetryTranscriptionHotkey(false, false), false);
    assert.equal(canRunRetryTranscriptionHotkey(true, true), false);
  });
});
