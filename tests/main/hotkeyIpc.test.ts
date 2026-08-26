import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isHotkeyClearRequest,
  isHotkeyMutationResponse,
  isHotkeyRuntimeState,
  isHotkeySetRequest,
  isHotkeyTestRequest,
  isHotkeyTestResponse,
} from '@shared/hotkeyIpc';

function createRuntimeState() {
  return {
    revision: 1,
    settings: {
      cancelHotkey: null,
      hotkey: 'F9',
      prettifyHotkey: null,
      prettifyQuickHotkey: null,
      retryTranscriptionHotkey: null,
      stopHotkey: null,
      translateHotkey: null,
    },
    snapshot: {
      entries: [
        {
          bindingAuthority: 'application',
          configuredAccelerator: 'F9',
          dispatchStatus: 'enabled',
          effectiveAccelerator: 'F9',
          registrationStatus: 'registered',
          target: 'record',
        },
        ...['stop', 'cancel', 'translate', 'prettify', 'prettifyQuick', 'retryTranscription'].map((target) => ({
          bindingAuthority: 'none',
          configuredAccelerator: null,
          dispatchStatus: 'enabled',
          effectiveAccelerator: null,
          registrationStatus: 'unassigned',
          target,
        })),
      ],
    },
  };
}

describe('hotkey IPC contracts', () => {
  it('accepts only canonical request payloads', () => {
    assert.equal(isHotkeySetRequest({ accelerator: 'Ctrl+F9', target: 'record' }), true);
    assert.equal(isHotkeySetRequest({ accelerator: '', target: 'record' }), false);
    assert.equal(isHotkeySetRequest({ accelerator: 'F9', target: 'record', extra: true }), false);
    assert.equal(isHotkeyClearRequest({ target: 'stop' }), true);
    assert.equal(isHotkeyClearRequest({ target: 'unknown' }), false);
    assert.equal(isHotkeyTestRequest({ target: 'prettifyQuick' }), true);
  });

  it('rejects malformed runtime states, target order changes, and invalid authority/effective combinations', () => {
    const state = createRuntimeState();
    assert.equal(isHotkeyRuntimeState(state), true);
    assert.equal(isHotkeyRuntimeState({ ...state, extra: true }), false);
    assert.equal(isHotkeyRuntimeState({ ...state, revision: -1 }), false);
    assert.equal(
      isHotkeyRuntimeState({
        ...state,
        snapshot: { entries: [...state.snapshot.entries].reverse() },
      }),
      false,
    );
    assert.equal(
      isHotkeyRuntimeState({
        ...state,
        snapshot: {
          entries: [{ ...state.snapshot.entries[0], effectiveAccelerator: null }, ...state.snapshot.entries.slice(1)],
        },
      }),
      false,
    );
    assert.equal(isHotkeyRuntimeState(Object.assign(Object.create(null), state)), false);
  });

  it('requires bounded mutation and physical-test results', () => {
    const state = createRuntimeState();
    assert.equal(isHotkeyMutationResponse({ state, status: 'success' }), true);
    assert.equal(isHotkeyMutationResponse({ failureCode: 'registration-rejected', state, status: 'failure' }), true);
    assert.equal(isHotkeyMutationResponse({ failureCode: 'private-error', state, status: 'failure' }), false);
    assert.equal(isHotkeyTestResponse({ result: 'unavailable', state }), true);
    assert.equal(isHotkeyTestResponse({ result: 'unavailable', state, stack: 'private' }), false);
  });
});
