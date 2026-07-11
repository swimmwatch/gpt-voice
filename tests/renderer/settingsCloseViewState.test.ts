import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSettingsCloseDisposition } from '@renderer/settingsCloseViewState';

describe('getSettingsCloseDisposition', () => {
  it('allows a clean settings window to close immediately', () => {
    assert.equal(getSettingsCloseDisposition({ isDirty: false, isSaving: false }), 'close');
  });

  it('requires confirmation for unsaved settings', () => {
    assert.equal(getSettingsCloseDisposition({ isDirty: true, isSaving: false }), 'confirm');
  });

  it('blocks close requests while settings are saving', () => {
    assert.equal(getSettingsCloseDisposition({ isDirty: true, isSaving: true }), 'block');
  });
});
