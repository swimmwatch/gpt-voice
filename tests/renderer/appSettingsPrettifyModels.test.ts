import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const APP_SETTINGS_WINDOW_PATH = path.join(PROJECT_ROOT, 'src/renderer/AppSettingsWindow.tsx');
const PRETTIFY_SECTION_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/settings/PrettifySection.tsx');
const SEARCHABLE_SELECT_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/SearchableSelectInput.tsx');

describe('App Settings prettify models', () => {
  it('loads model metadata on initialization only for HTTP providers', () => {
    const appSettingsWindow = readFileSync(APP_SETTINGS_WINDOW_PATH, 'utf8');

    assert.match(appSettingsWindow, /if \(!getPrettifyProviderCapabilities\(providerId\)\.baseUrl\) return;/u);
    assert.match(appSettingsWindow, /listPrettifyModels\(providerId, nextPrettifySettings\)/u);
    assert.match(appSettingsWindow, /createPrettifyProviderModelOptions\(nextPrettifySettings\)/u);
  });

  it('runs CLI preflight only through an explicit list open or Refresh and ignores stale results', () => {
    const appSettingsWindow = readFileSync(APP_SETTINGS_WINDOW_PATH, 'utf8');
    const prettifySection = readFileSync(PRETTIFY_SECTION_PATH, 'utf8');
    const searchableSelect = readFileSync(SEARCHABLE_SELECT_PATH, 'utf8');
    const providerChange = appSettingsWindow.slice(
      appSettingsWindow.indexOf('const changePrettifyProvider'),
      appSettingsWindow.indexOf('const updateHttpPrettifyProviderSetting'),
    );
    const refresh = appSettingsWindow.slice(
      appSettingsWindow.indexOf('const refreshPrettifyModels'),
      appSettingsWindow.indexOf('const isSelectedOllamaModelLoaded'),
    );

    assert.doesNotMatch(providerChange, /listPrettifyModels/u);
    assert.match(providerChange, /prettifyModelRequestRef\.current \+= 1/u);
    assert.match(refresh, /window\.electronAPI\.listPrettifyModels\(providerId, settingsSnapshot\)/u);
    assert.match(refresh, /requestId !== prettifyModelRequestRef\.current/u);
    assert.match(refresh, /checkStatus: result\.success \? 'available' : 'unavailable'/u);
    assert.match(prettifySection, /onOpen=\{refreshCliModelsOnOpen\}/u);
    assert.equal((prettifySection.match(/if \(open\) refreshCliModelsOnOpen\(\);/gu) || []).length, 2);
    assert.match(searchableSelect, /if \(nextOpen && !isOpenRef\.current\) onOpen\?\.\(\);/u);
  });

  it('synchronizes an external provider selection without replacing dirty provider drafts', () => {
    const appSettingsWindow = readFileSync(APP_SETTINGS_WINDOW_PATH, 'utf8');
    const synchronization = appSettingsWindow.slice(
      appSettingsWindow.indexOf('onPrettifySettingsChanged((snapshot)'),
      appSettingsWindow.indexOf('return (', appSettingsWindow.indexOf('onPrettifySettingsChanged((snapshot)')),
    );

    assert.equal(
      (synchronization.match(/applyExternalPrettifyProviderSelection\(current, snapshot\.providerId\)/gu) || []).length,
      2,
    );
    assert.match(synchronization, /prettifyModelRequestRef\.current \+= 1/u);
    assert.match(synchronization, /PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS/u);
    assert.doesNotMatch(synchronization, /setPrettifySettings\(snapshot\)/u);
  });
});
