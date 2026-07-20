import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_SETTINGS_SECTION_IDS, isAppSettingsSectionId } from '@shared/appSettings';

describe('App Settings sections', () => {
  it('accepts only the five trusted section identifiers', () => {
    assert.deepEqual(APP_SETTINGS_SECTION_IDS, ['system', 'shortcuts', 'prettify', 'browser', 'network']);
    for (const sectionId of APP_SETTINGS_SECTION_IDS) assert.equal(isAppSettingsSectionId(sectionId), true);
    for (const value of ['', 'providers', 'prettify?next=network', null, 1]) {
      assert.equal(isAppSettingsSectionId(value), false);
    }
  });
});
