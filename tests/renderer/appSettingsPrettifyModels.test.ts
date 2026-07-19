import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PRETTIFY_CONTROLLER_PATH = path.join(PROJECT_ROOT, 'src/renderer/hooks/usePrettifySettingsController.ts');
const PRETTIFY_SECTION_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/settings/PrettifySection.tsx');
const PRETTIFY_PANELS_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/settings/PrettifyProviderPanels.tsx');
const SEARCHABLE_SELECT_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/SearchableSelectInput.tsx');

describe('App Settings prettify models', () => {
  it('loads model metadata on initialization only for HTTP providers', () => {
    const prettifyController = readFileSync(PRETTIFY_CONTROLLER_PATH, 'utf8');

    assert.match(prettifyController, /getPrettifyProviderCapabilities\(snapshot\.providerId\)\.baseUrl/u);
    assert.match(prettifyController, /requestModels\(snapshot, false\)/u);
    assert.match(prettifyController, /createPrettifyProviderModelOptions\(snapshot\)/u);
  });

  it('runs CLI preflight only through an explicit list open or Refresh and ignores stale results', () => {
    const prettifyController = readFileSync(PRETTIFY_CONTROLLER_PATH, 'utf8');
    const prettifySection = readFileSync(PRETTIFY_SECTION_PATH, 'utf8');
    const prettifyPanels = readFileSync(PRETTIFY_PANELS_PATH, 'utf8');
    const searchableSelect = readFileSync(SEARCHABLE_SELECT_PATH, 'utf8');
    const providerChange = prettifyController.slice(
      prettifyController.indexOf('const changeProvider'),
      prettifyController.indexOf('const updateHttpSetting'),
    );
    const refresh = prettifyController.slice(
      prettifyController.indexOf('const requestModels'),
      prettifyController.indexOf('const initialize'),
    );

    assert.doesNotMatch(providerChange, /listPrettifyModels/u);
    assert.match(providerChange, /modelRequestRef\.current \+= 1/u);
    assert.match(refresh, /window\.electronAPI\.listPrettifyModels\(providerId, settingsSnapshot\)/u);
    assert.match(refresh, /requestId !== modelRequestRef\.current/u);
    assert.match(refresh, /checkStatus: result\.success \? 'available' : 'unavailable'/u);
    assert.match(prettifySection, /onOpen=\{refreshCliModelsOnOpen\}/u);
    assert.equal((prettifyPanels.match(/if \(open\) onModelsOpen\(\);/gu) || []).length, 2);
    assert.match(searchableSelect, /if \(nextOpen && !isOpenRef\.current\) onOpen\?\.\(\);/u);
  });

  it('synchronizes an external provider selection without replacing dirty provider drafts', () => {
    const prettifyController = readFileSync(PRETTIFY_CONTROLLER_PATH, 'utf8');
    const synchronization = prettifyController.slice(
      prettifyController.indexOf('onPrettifySettingsChanged((snapshot)'),
      prettifyController.indexOf('return () =>', prettifyController.indexOf('onPrettifySettingsChanged((snapshot)')),
    );

    assert.equal(
      (synchronization.match(/applyExternalPrettifyProviderSelection\(current, snapshot\.providerId\)/gu) || []).length,
      2,
    );
    assert.match(synchronization, /modelRequestRef\.current \+= 1/u);
    assert.match(synchronization, /PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS/u);
    assert.doesNotMatch(synchronization, /setPrettifySettings\(snapshot\)/u);
  });
});
