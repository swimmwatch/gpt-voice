import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  areCloakBrowserSettingsEqual,
  arePrettifySettingsEqual,
  areTextActionSettingsEqual,
  createAppSettingsLogSummary,
  createCloakBrowserSettingsInput,
  createEditableSettings,
  createSanitizedCloakBrowserSettingsSummary,
  getCloakBrowserLocaleOptions,
  getCloakBrowserTimezoneOptions,
  hasAppSettingsFieldErrors,
  saveAppSettingsState,
  validateAppSettings,
} from '@renderer/appSettingsUtils';
import type { CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';

const VALID_PRETTIFY_SETTINGS = { prompt: 'prompt', reasoning: 'instant' as const };
const VALID_TEXT_ACTION_SETTINGS = { translateEnabled: true, prettifyEnabled: true };

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

  it('summarizes App Settings changes without sensitive values', () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const changedSettings = createEditableSettings(cloakBrowserSettings({ backgroundMode: 'visible' }));
    changedSettings.proxy.enabled = true;
    changedSettings.proxy.server = 'http://secret-proxy.example.com:8080';
    changedSettings.proxy.username = 'secret-user';
    changedSettings.proxy.password = 'secret-pass';

    const summary = createAppSettingsLogSummary({
      settings: changedSettings,
      initialSettings,
      prettifySettings: { prompt: 'secret prompt text', reasoning: 'standard' },
      initialPrettifySettings: VALID_PRETTIFY_SETTINGS,
      textActionSettings: { translateEnabled: false, prettifyEnabled: true },
      initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
    });
    const serialized = JSON.stringify(summary);

    assert.deepEqual(summary.changedGroups, ['prettify', 'textActions', 'cloakBrowser']);
    assert.deepEqual(summary.changedFields, [
      'prettifyPrompt',
      'prettifyReasoning',
      'translateEnabled',
      'backgroundMode',
      'proxyEnabled',
      'proxyServer',
      'proxyUsername',
      'proxyPassword',
    ]);
    assert.equal(summary.prettifyPromptChanged, true);
    assert.equal(summary.prettifyPromptLength, 'secret prompt text'.length);
    assert.equal(summary.cloakBrowser.hasProxyServer, true);
    assert.equal(summary.cloakBrowser.hasProxyUsername, true);
    assert.equal(summary.cloakBrowser.hasProxyPasswordUpdate, true);
    assert.equal(serialized.includes('secret prompt text'), false);
    assert.equal(serialized.includes('secret-proxy.example.com'), false);
    assert.equal(serialized.includes('secret-user'), false);
    assert.equal(serialized.includes('secret-pass'), false);
  });

  it('summarizes CloakBrowser settings shape without proxy details', () => {
    const settings = createEditableSettings(
      cloakBrowserSettings({
        proxy: {
          enabled: true,
          server: 'socks5://private-proxy.example.com:1080',
          bypass: 'private-host',
          username: 'private-user',
          hasPassword: true,
          geoip: true,
        },
      }),
    );
    settings.proxy.password = 'private-password';
    const summary = createSanitizedCloakBrowserSettingsSummary(settings);
    const serialized = JSON.stringify(summary);

    assert.equal(summary.proxyEnabled, true);
    assert.equal(summary.proxyGeoip, true);
    assert.equal(summary.hasProxyServer, true);
    assert.equal(summary.hasProxyBypass, true);
    assert.equal(summary.hasProxyUsername, true);
    assert.equal(summary.hasSavedProxyPassword, true);
    assert.equal(summary.hasProxyPasswordUpdate, true);
    assert.equal(serialized.includes('private-proxy.example.com'), false);
    assert.equal(serialized.includes('private-host'), false);
    assert.equal(serialized.includes('private-user'), false);
    assert.equal(serialized.includes('private-password'), false);
  });

  it('returns no field errors for valid app settings', () => {
    const fieldErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings({ timezone: 'Europe/Moscow' })),
      prettifySettings: VALID_PRETTIFY_SETTINGS,
    });

    assert.equal(hasAppSettingsFieldErrors(fieldErrors), false);
    assert.deepEqual(fieldErrors, {});
  });

  it('validates required and structured App Settings fields', () => {
    const emptyPromptErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings()),
      prettifySettings: { prompt: '   ', reasoning: 'instant' },
    });
    assert.equal(emptyPromptErrors.prettifyPrompt, 'Prettify prompt is required');

    const invalidSeedSettings = createEditableSettings(cloakBrowserSettings());
    invalidSeedSettings.fingerprintSeed = 'abc123';
    assert.equal(
      validateAppSettings({ settings: invalidSeedSettings, prettifySettings: VALID_PRETTIFY_SETTINGS }).fingerprintSeed,
      'Fingerprint seed must contain digits only',
    );

    const invalidLocaleSettings = createEditableSettings(cloakBrowserSettings());
    invalidLocaleSettings.locale = 'fr-CA';
    assert.equal(
      validateAppSettings({
        settings: invalidLocaleSettings,
        prettifySettings: VALID_PRETTIFY_SETTINGS,
        localeValues: ['en-US'],
      }).locale,
      'Select a supported locale',
    );

    const invalidTimezoneSettings = createEditableSettings(cloakBrowserSettings());
    invalidTimezoneSettings.timezone = 'Mars/Olympus';
    assert.equal(
      validateAppSettings({ settings: invalidTimezoneSettings, prettifySettings: VALID_PRETTIFY_SETTINGS }).timezone,
      'Select a supported timezone',
    );
  });

  it('validates proxy server and SOCKS5 auth settings', () => {
    const invalidProxyUrl = createEditableSettings(cloakBrowserSettings());
    invalidProxyUrl.proxy.enabled = true;
    invalidProxyUrl.proxy.server = 'not a url';
    assert.equal(
      validateAppSettings({ settings: invalidProxyUrl, prettifySettings: VALID_PRETTIFY_SETTINGS }).proxyServer,
      'Proxy server must be a valid URL',
    );

    const proxyUrlWithCredentials = createEditableSettings(cloakBrowserSettings());
    proxyUrlWithCredentials.proxy.enabled = true;
    proxyUrlWithCredentials.proxy.server = 'http://user:pass@proxy.example.com';
    assert.equal(
      validateAppSettings({ settings: proxyUrlWithCredentials, prettifySettings: VALID_PRETTIFY_SETTINGS }).proxyServer,
      'Proxy credentials must be stored in username and password fields',
    );

    const socks5Auth = createEditableSettings(cloakBrowserSettings());
    socks5Auth.proxy.enabled = true;
    socks5Auth.proxy.server = 'socks5://proxy.example.com:1080';
    socks5Auth.proxy.username = 'user';
    socks5Auth.proxy.hasPassword = true;
    const socks5Errors = validateAppSettings({ settings: socks5Auth, prettifySettings: VALID_PRETTIFY_SETTINGS });
    assert.equal(socks5Errors.proxyUsername, 'SOCKS5 proxy username/password is not supported');
    assert.equal(socks5Errors.proxyPassword, 'SOCKS5 proxy username/password is not supported');
  });

  it('does not validate locale and timezone while proxy GeoIP owns them', () => {
    const settings = createEditableSettings(cloakBrowserSettings());
    settings.locale = '';
    settings.timezone = '';
    settings.proxy.enabled = true;
    settings.proxy.geoip = true;
    settings.proxy.server = 'http://proxy.example.com:8080';

    const fieldErrors = validateAppSettings({ settings, prettifySettings: VALID_PRETTIFY_SETTINGS });

    assert.equal(fieldErrors.locale, undefined);
    assert.equal(fieldErrors.timezone, undefined);
  });

  it('appends existing valid locale and timezone values to dropdown options', () => {
    assert.equal(getCloakBrowserLocaleOptions('fr-CA').includes('fr-CA'), true);
    assert.equal(getCloakBrowserTimezoneOptions('Etc/GMT+12').includes('Etc/GMT+12'), true);
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

  it('detects changed text action settings separately from CloakBrowser settings', () => {
    assert.equal(areTextActionSettingsEqual(VALID_TEXT_ACTION_SETTINGS, VALID_TEXT_ACTION_SETTINGS), true);
    assert.equal(
      areTextActionSettingsEqual(
        { translateEnabled: false, prettifyEnabled: true },
        { translateEnabled: true, prettifyEnabled: true },
      ),
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
        textActionSettings: VALID_TEXT_ACTION_SETTINGS,
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
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
        setTextActionSettings: async (settings) => {
          calls.push('text-actions');
          return { success: true, settings };
        },
      },
    );

    assert.equal(result.success, true);
    assert.equal(result.prettifySettingsSaved, true);
    assert.deepEqual(calls, ['prettify']);
    assert.deepEqual(result.prettifySettings, { prompt: 'new prompt', reasoning: 'instant' });
  });

  it('propagates prettify settings save errors', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const calls: string[] = [];

    const result = await saveAppSettingsState(
      {
        settings: initialSettings,
        initialSettings,
        prettifySettings: { prompt: 'new prompt', reasoning: 'instant' },
        initialPrettifySettings: { prompt: 'old prompt', reasoning: 'instant' },
        textActionSettings: VALID_TEXT_ACTION_SETTINGS,
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
      },
      {
        saveCloakBrowserSettings: async () => {
          calls.push('cloakbrowser');
          return { success: true, settings: cloakBrowserSettings() };
        },
        setPrettifySettings: async () => {
          calls.push('prettify');
          return { success: false, error: 'config save failed' };
        },
        setTextActionSettings: async (settings) => {
          calls.push('text-actions');
          return { success: true, settings };
        },
      },
    );

    assert.equal(result.success, false);
    assert.equal(result.error, 'config save failed');
    assert.deepEqual(calls, ['prettify']);
  });

  it('saves text-action-only changes without saving CloakBrowser settings', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const calls: string[] = [];

    const result = await saveAppSettingsState(
      {
        settings: initialSettings,
        initialSettings,
        prettifySettings: VALID_PRETTIFY_SETTINGS,
        initialPrettifySettings: VALID_PRETTIFY_SETTINGS,
        textActionSettings: { translateEnabled: false, prettifyEnabled: true },
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
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
        setTextActionSettings: async (settings) => {
          calls.push('text-actions');
          return { success: true, settings };
        },
      },
    );

    assert.equal(result.success, true);
    assert.equal(result.textActionSettingsSaved, true);
    assert.deepEqual(calls, ['text-actions']);
    assert.deepEqual(result.textActionSettings, {
      translateEnabled: false,
      prettifyEnabled: true,
    });
  });

  it('does not call save dependencies when field validation fails', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const calls: string[] = [];

    const result = await saveAppSettingsState(
      {
        settings: initialSettings,
        initialSettings,
        prettifySettings: { prompt: '', reasoning: 'instant' },
        initialPrettifySettings: { prompt: 'old prompt', reasoning: 'instant' },
        textActionSettings: VALID_TEXT_ACTION_SETTINGS,
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
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
        setTextActionSettings: async (settings) => {
          calls.push('text-actions');
          return { success: true, settings };
        },
      },
    );

    assert.equal(result.success, false);
    assert.equal(result.fieldErrors?.prettifyPrompt, 'Prettify prompt is required');
    assert.deepEqual(calls, []);
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
        textActionSettings: VALID_TEXT_ACTION_SETTINGS,
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
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
        setTextActionSettings: async (settings) => {
          calls.push('text-actions');
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
        textActionSettings: VALID_TEXT_ACTION_SETTINGS,
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
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
        setTextActionSettings: async (settings) => {
          calls.push('text-actions');
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
