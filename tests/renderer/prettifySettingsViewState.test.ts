import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getOllamaModelAction, getPrettifyAdvancedSettingsSummary } from '@renderer/prettifySettingsViewState';
import { DEFAULT_PRETTIFY_SETTINGS } from '@shared/prettifySettings';

describe('getPrettifyAdvancedSettingsSummary', () => {
  it('reports provider defaults when every advanced value matches the defaults', () => {
    assert.deepEqual(getPrettifyAdvancedSettingsSummary(DEFAULT_PRETTIFY_SETTINGS), {
      customValueCount: 0,
      usesDefaults: true,
    });
  });

  it('counts every changed advanced generation value', () => {
    assert.deepEqual(
      getPrettifyAdvancedSettingsSummary({
        ...DEFAULT_PRETTIFY_SETTINGS,
        maxOutputTokens: 256,
        seed: 42,
        topP: 0.8,
      }),
      {
        customValueCount: 3,
        usesDefaults: false,
      },
    );
  });
});

describe('getOllamaModelAction', () => {
  it('offers Load VRAM only when the selected model is not loaded', () => {
    assert.equal(getOllamaModelAction(false), 'load');
  });

  it('offers Free VRAM only when the selected model is loaded', () => {
    assert.equal(getOllamaModelAction(true), 'unload');
  });
});
