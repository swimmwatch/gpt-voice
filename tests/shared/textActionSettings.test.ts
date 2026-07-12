import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEXT_ACTION_SETTINGS,
  getTextActionSettingsInputError,
  normalizeTextActionSettings,
} from '@shared/textActionSettings';

describe('textActionSettings', () => {
  it('normalizes legacy settings safely on read', () => {
    assert.deepEqual(normalizeTextActionSettings({ translateEnabled: 'yes' }), DEFAULT_TEXT_ACTION_SETTINGS);
  });

  it('rejects malformed settings writes', () => {
    assert.equal(getTextActionSettingsInputError(null), 'Text action settings must be an object');
    assert.equal(getTextActionSettingsInputError({ translateEnabled: 'yes' }), 'Translate enabled must be a boolean');
    assert.equal(getTextActionSettingsInputError({ prettifyEnabled: 1 }), 'Prettify enabled must be a boolean');
    assert.equal(getTextActionSettingsInputError({ translateEnabled: false, prettifyEnabled: true }), null);
  });
});
