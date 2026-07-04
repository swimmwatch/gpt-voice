import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  areCloakBrowserSettingsEqual,
  arePrettifySettingsEqual,
  createCloakBrowserSettingsInput,
  createEditableSettings,
  saveAppSettingsState,
} from '@renderer/appSettingsUtils';
import type { CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';

function cloakBrowserSettings(overrides: Partial<CloakBrowserSettingsView> = {}): CloakBrowserSettingsView {
  return {
    humanize: true,
    humanPreset: 'default',
    backgroundMode: 'hidden',
    fingerprintSeed: '12345',
    locale: 'en-US',
    timezone: 'UTC',
    proxy: {
      enabled: false,
      server: '',
      bypass: '',
      username: '',
      hasPassword: false,
      geoip: false,
    },
    ...overrides,
  };
}

describe('appSettingsUtils', () => {
  it('detects unchanged CloakBrowser settings', () => {
    const initial = createEditableSettings(cloakBrowserSettings());
    const current = createEditableSettings(cloakBrowserSettings());

    assert.equal(areCloakBrowserSettingsEqual(current, initial), true);
  });

  it('detects changed CloakBrowser settings and proxy password edits', () => {
    const initial = createEditableSettings(cloakBrowserSettings());
    const changedMode = createEditableSettings(cloakBrowserSettings({ backgroundMode: 'visible' }));
    const changedPassword = createEditableSettings(cloakBrowserSettings());
    changedPassword.proxy.password = 'secret';

    assert.equal(areCloakBrowserSettingsEqual(changedMode, initial), false);
    assert.equal(areCloakBrowserSettingsEqual(changedPassword, initial), false);
  });

  it('builds the CloakBrowser settings save input from editable state', () => {
    const current = createEditableSettings(
      cloakBrowserSettings({
        proxy: {
          enabled: true,
          server: 'http://localhost:8080',
          bypass: 'localhost',
          username: 'user',
          hasPassword: true,
          geoip: true,
        },
      }),
    );
    current.proxy.password = 'secret';

    assert.deepEqual(createCloakBrowserSettingsInput(current), {
      humanize: true,
      humanPreset: 'default',
      backgroundMode: 'hidden',
      fingerprintSeed: '12345',
      locale: 'en-US',
      timezone: 'UTC',
      proxy: {
        enabled: true,
        server: 'http://localhost:8080',
        bypass: 'localhost',
        username: 'user',
        password: 'secret',
        clearPassword: false,
        geoip: true,
      },
    });
  });

  it('detects changed prettify settings separately from CloakBrowser settings', () => {
    assert.equal(
      arePrettifySettingsEqual({ prompt: 'prompt', reasoning: 'instant' }, { prompt: 'prompt', reasoning: 'instant' }),
      true,
    );
    assert.equal(
      arePrettifySettingsEqual({ prompt: 'prompt', reasoning: 'standard' }, { prompt: 'prompt', reasoning: 'instant' }),
      false,
    );
  });

  it('saves prettify-only changes without saving CloakBrowser settings', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const calls: string[] = [];

    const result = await saveAppSettingsState(
      {
        settings: initialSettings,
        initialSettings,
        prettifySettings: { prompt: 'new prompt', reasoning: 'instant' },
        initialPrettifySettings: { prompt: 'old prompt', reasoning: 'instant' },
      },
      {
        saveCloakBrowserSettings: async () => {
          calls.push('cloakbrowser');
          return { success: true, settings: cloakBrowserSettings() };
        },
        setPrettifySettings: async (settings) => {
          calls.push('prettify');
          return { success: true, settings };
        },
      },
    );

    assert.equal(result.success, true);
    assert.equal(result.prettifySettingsSaved, true);
    assert.deepEqual(calls, ['prettify']);
    assert.deepEqual(result.prettifySettings, { prompt: 'new prompt', reasoning: 'instant' });
  });

  it('saves CloakBrowser-only changes through the CloakBrowser restart path', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const changedSettings = createEditableSettings(cloakBrowserSettings({ backgroundMode: 'visible' }));
    const calls: string[] = [];

    const result = await saveAppSettingsState(
      {
        settings: changedSettings,
        initialSettings,
        prettifySettings: { prompt: 'prompt', reasoning: 'instant' },
        initialPrettifySettings: { prompt: 'prompt', reasoning: 'instant' },
      },
      {
        saveCloakBrowserSettings: async () => {
          calls.push('cloakbrowser');
          return { success: true, settings: cloakBrowserSettings({ backgroundMode: 'visible' }) };
        },
        setPrettifySettings: async (settings) => {
          calls.push('prettify');
          return { success: true, settings };
        },
      },
    );

    assert.equal(result.success, true);
    assert.equal(result.settingsSaved, true);
    assert.deepEqual(calls, ['cloakbrowser']);
    assert.equal(result.settings?.backgroundMode, 'visible');
  });

  it('preserves saved prettify changes when CloakBrowser save fails', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const changedSettings = createEditableSettings(cloakBrowserSettings({ backgroundMode: 'visible' }));
    const calls: string[] = [];

    const result = await saveAppSettingsState(
      {
        settings: changedSettings,
        initialSettings,
        prettifySettings: { prompt: 'new prompt', reasoning: 'standard' },
        initialPrettifySettings: { prompt: 'old prompt', reasoning: 'instant' },
      },
      {
        saveCloakBrowserSettings: async () => {
          calls.push('cloakbrowser');
          return {
            success: false,
            error: 'restart failed',
            settings: cloakBrowserSettings({ backgroundMode: 'visible' }),
          };
        },
        setPrettifySettings: async (settings) => {
          calls.push('prettify');
          return { success: true, settings };
        },
      },
    );

    assert.equal(result.success, false);
    assert.equal(result.error, 'restart failed');
    assert.equal(result.prettifySettingsSaved, true);
    assert.equal(result.settingsSaved, undefined);
    assert.deepEqual(calls, ['prettify', 'cloakbrowser']);
    assert.deepEqual(result.prettifySettings, { prompt: 'new prompt', reasoning: 'standard' });
  });
});
