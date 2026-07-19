import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  areCloakBrowserSettingsEqual,
  arePrettifySettingsEqual,
  areTextActionSettingsEqual,
  applyExternalPrettifyProviderSelection,
  createAppSettingsLogSummary,
  createCloakBrowserSettingsInput,
  createEditableSettings,
  createPrettifyProviderTransitionState,
  createSanitizedCloakBrowserSettingsSummary,
  getAppSettingsFormState,
  getCloakBrowserLocaleOptions,
  getCloakBrowserTimezoneOptions,
  hasAppSettingsFieldErrors,
  saveAppSettingsState,
  validateAppSettings,
  PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS,
  type PrettifySettingsDraft,
} from '@renderer/appSettingsUtils';
import type { CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import {
  DEFAULT_PRETTIFY_SETTINGS,
  MAX_PRETTIFY_CLI_TIMEOUT_SECONDS,
  MAX_PRETTIFY_PROMPT_LENGTH,
  MIN_PRETTIFY_CLI_TIMEOUT_SECONDS,
  type KnownPrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';

function prettifySettings(overrides: Partial<PrettifySettings> = {}): PrettifySettings {
  return {
    ...DEFAULT_PRETTIFY_SETTINGS,
    prompt: 'prompt',
    providerId: 'ollama',
    ollama: {
      ...DEFAULT_PRETTIFY_SETTINGS.ollama,
      model: 'llama3.2',
    },
    vllm: {
      ...DEFAULT_PRETTIFY_SETTINGS.vllm,
      model: 'qwen2.5',
    },
    ...overrides,
  };
}

function prettifySettingsDraft(
  providerId: KnownPrettifyProviderId,
  overrides: Partial<Omit<PrettifySettingsDraft, 'providerId'>> = {},
): PrettifySettingsDraft {
  return {
    ...prettifySettings(),
    ...overrides,
    providerId,
  };
}

const VALID_PRETTIFY_SETTINGS = prettifySettings();
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
  it('derives clean-valid and dirty-invalid form states for the settings footer', () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const initialPrettifySettings = VALID_PRETTIFY_SETTINGS;
    const initialTextActionSettings = VALID_TEXT_ACTION_SETTINGS;

    assert.deepEqual(
      getAppSettingsFormState({
        initialPrettifySettings,
        initialSettings,
        initialTextActionSettings,
        prettifySettings: initialPrettifySettings,
        settings: initialSettings,
        textActionSettings: initialTextActionSettings,
      }),
      {
        isDirty: false,
        isValid: true,
        validationErrors: {},
      },
    );

    assert.deepEqual(
      getAppSettingsFormState({
        initialPrettifySettings,
        initialSettings,
        initialTextActionSettings,
        prettifySettings: prettifySettings({ prompt: '' }),
        settings: initialSettings,
        textActionSettings: initialTextActionSettings,
      }),
      {
        isDirty: true,
        isValid: false,
        validationErrors: {
          prettifyPrompt: 'Prettify prompt is required',
        },
      },
    );
  });

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
      prettifySettings: prettifySettings({
        prompt: 'secret prompt text',
        maxOutputTokens: 512,
        minP: 0.05,
        providerId: 'vllm',
        repeatPenalty: 1.1,
        seed: 7,
        temperature: 0.4,
        topK: 32,
        topP: 0.8,
        vllm: {
          ...DEFAULT_PRETTIFY_SETTINGS.vllm,
          baseUrl: DEFAULT_PRETTIFY_SETTINGS.vllm.baseUrl,
          model: 'qwen3',
          hasApiKey: true,
          apiKey: 'secret-api-key',
        },
      }),
      initialPrettifySettings: VALID_PRETTIFY_SETTINGS,
      textActionSettings: { translateEnabled: false, prettifyEnabled: true },
      initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
    });
    const serialized = JSON.stringify(summary);

    assert.deepEqual(summary.changedGroups, ['prettify', 'textActions', 'cloakBrowser']);
    assert.deepEqual(summary.changedFields, [
      'prettifyPrompt',
      'prettifyProvider',
      'prettifyTemperature',
      'prettifyTopP',
      'prettifyTopK',
      'prettifyMinP',
      'prettifyRepeatPenalty',
      'prettifyMaxOutputTokens',
      'prettifySeed',
      'prettifyModel',
      'prettifyApiKey',
      'translateEnabled',
      'backgroundMode',
      'proxyEnabled',
      'proxyServer',
      'proxyUsername',
      'proxyPassword',
    ]);
    assert.equal(summary.prettifyPromptChanged, true);
    assert.equal(summary.prettifyPromptLength, 'secret prompt text'.length);
    assert.equal(summary.prettifyProviderId, 'vllm');
    assert.equal(summary.prettifyModelLength, 'qwen3'.length);
    assert.equal(summary.prettifyTemperature, 0.4);
    assert.equal(summary.prettifyTopP, 0.8);
    assert.equal(summary.prettifyTopK, 32);
    assert.equal(summary.prettifyMinP, 0.05);
    assert.equal(summary.prettifyRepeatPenalty, 1.1);
    assert.equal(summary.prettifyMaxOutputTokens, 512);
    assert.equal(summary.prettifyHasSeed, true);
    assert.equal(summary.prettifyVllmApiKeyUpdated, true);
    assert.equal(summary.cloakBrowser.hasProxyServer, true);
    assert.equal(summary.cloakBrowser.hasProxyUsername, true);
    assert.equal(summary.cloakBrowser.hasProxyPasswordUpdate, true);
    assert.equal(serialized.includes('secret prompt text'), false);
    assert.equal(serialized.includes('secret-proxy.example.com'), false);
    assert.equal(serialized.includes('secret-user'), false);
    assert.equal(serialized.includes('secret-pass'), false);
    assert.equal(serialized.includes('secret-api-key'), false);
    assert.equal(serialized.includes('qwen3'), false);
  });

  it('summarizes only active Claude CLI fields using privacy-safe metadata', () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const initialPrettifySettings = prettifySettingsDraft('claude-cli');
    const executablePath = '/Applications/Private Claude CLI/claude';
    const model = 'claude-private-model';
    const fallbackModel = 'claude-private-fallback';
    const current = prettifySettingsDraft('claude-cli', {
      maxOutputTokens: 9_999,
      topP: 0,
      claudeCli: {
        executablePath,
        model,
        fallbackModel,
        effort: 'high',
        timeoutSeconds: 300,
      },
    });

    const summary = createAppSettingsLogSummary({
      settings: initialSettings,
      initialSettings,
      prettifySettings: current,
      initialPrettifySettings,
      textActionSettings: VALID_TEXT_ACTION_SETTINGS,
      initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
    });
    const serialized = JSON.stringify(summary);

    assert.deepEqual(summary.changedGroups, ['prettify']);
    assert.deepEqual(summary.changedFields, [
      'prettifyExecutablePath',
      'prettifyModel',
      'prettifyFallbackModel',
      'prettifyEffort',
      'prettifyTimeout',
    ]);
    assert.equal(summary.prettifyModelLength, model.length);
    assert.equal(summary.prettifyFallbackModelLength, fallbackModel.length);
    assert.equal(summary.prettifyHasExecutablePath, true);
    assert.equal(summary.prettifyEffort, 'high');
    assert.equal(summary.prettifyTimeoutSeconds, 300);
    assert.equal(summary.prettifyTopP, undefined);
    assert.equal(summary.prettifyMaxOutputTokens, undefined);
    for (const sensitiveValue of [executablePath, model, fallbackModel]) {
      assert.equal(serialized.includes(sensitiveValue), false);
    }
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
      prettifySettings: prettifySettings({ prompt: '   ' }),
    });
    assert.equal(emptyPromptErrors.prettifyPrompt, 'Prettify prompt is required');

    const invalidBaseUrlErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings()),
      prettifySettings: prettifySettings({
        ollama: {
          ...DEFAULT_PRETTIFY_SETTINGS.ollama,
          baseUrl: 'not a url',
          model: 'llama3.2',
        },
      }),
    });
    assert.equal(invalidBaseUrlErrors.prettifyBaseUrl, 'Base URL must be a valid http or https URL');

    const insecureRemoteUrlErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings()),
      prettifySettings: prettifySettings({
        ollama: {
          ...DEFAULT_PRETTIFY_SETTINGS.ollama,
          baseUrl: 'http://models.example.com',
          model: 'llama3.2',
        },
      }),
    });
    assert.equal(insecureRemoteUrlErrors.prettifyBaseUrl, 'Non-local provider URLs must use HTTPS');

    const credentialUrlErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings()),
      prettifySettings: prettifySettings({
        ollama: {
          ...DEFAULT_PRETTIFY_SETTINGS.ollama,
          baseUrl: 'https://user:pass@models.example.com',
          model: 'llama3.2',
        },
      }),
    });
    assert.equal(credentialUrlErrors.prettifyBaseUrl, 'Base URL must not include credentials');

    const longPromptErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings()),
      prettifySettings: prettifySettings({ prompt: 'x'.repeat(MAX_PRETTIFY_PROMPT_LENGTH + 1) }),
    });
    assert.equal(
      longPromptErrors.prettifyPrompt,
      `Prettify prompt must be at most ${MAX_PRETTIFY_PROMPT_LENGTH} characters`,
    );

    const missingModelErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings()),
      prettifySettings: prettifySettings({
        ollama: {
          ...DEFAULT_PRETTIFY_SETTINGS.ollama,
          model: '',
        },
      }),
    });
    assert.equal(missingModelErrors.prettifyModel, 'Select a model');

    const invalidGenerationErrors = validateAppSettings({
      settings: createEditableSettings(cloakBrowserSettings()),
      prettifySettings: prettifySettings({
        maxOutputTokens: 8193,
        minP: 1.1,
        repeatPenalty: 0.7,
        seed: 2_147_483_648,
        topK: 0,
        topP: 0,
      }),
    });
    assert.equal(invalidGenerationErrors.prettifyTopP, 'Top P must be between 0.05 and 1');
    assert.equal(invalidGenerationErrors.prettifyTopK, 'Top K must be an integer between 1 and 200');
    assert.equal(invalidGenerationErrors.prettifyMinP, 'Min P must be between 0 and 1');
    assert.equal(invalidGenerationErrors.prettifyRepeatPenalty, 'Repeat penalty must be between 0.8 and 1.5');
    assert.equal(
      invalidGenerationErrors.prettifyMaxOutputTokens,
      'Max output tokens must be an integer between 1 and 8192',
    );
    assert.equal(invalidGenerationErrors.prettifySeed, 'Seed must be empty or an integer between 0 and 2147483647');

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

  it('validates only active Claude CLI controls and permits optional defaults', () => {
    const browserSettings = createEditableSettings(cloakBrowserSettings());
    const validErrors = validateAppSettings({
      settings: browserSettings,
      prettifySettings: prettifySettingsDraft('claude-cli', {
        maxOutputTokens: 9_999,
        topP: 0,
        claudeCli: {
          executablePath: '/Applications/Claude CLI/claude',
          model: '',
          fallbackModel: '',
          effort: 'default',
          timeoutSeconds: MIN_PRETTIFY_CLI_TIMEOUT_SECONDS,
        },
      }),
    });
    assert.deepEqual(validErrors, {});

    const invalidDraft = prettifySettingsDraft('claude-cli', {
      claudeCli: {
        executablePath: 'bin/claude --print',
        model: 'custom model',
        fallbackModel: 'fallback',
        effort: 'extended' as unknown as PrettifySettingsDraft['claudeCli']['effort'],
        timeoutSeconds: MAX_PRETTIFY_CLI_TIMEOUT_SECONDS + 1,
      },
    });
    const invalidErrors = validateAppSettings({ settings: browserSettings, prettifySettings: invalidDraft });
    assert.equal(invalidErrors.prettifyExecutablePath, 'Executable path must be empty or absolute');
    assert.equal(invalidErrors.prettifyModel, 'Enter a supported Claude CLI model');
    assert.equal(invalidErrors.prettifyFallbackModel, 'Enter a supported Claude CLI fallback model');
    assert.equal(invalidErrors.prettifyEffort, 'Select a supported Claude CLI effort');
    assert.equal(invalidErrors.prettifyTimeout, 'Timeout must be an integer between 15 and 600 seconds');

    const maximumTimeoutErrors = validateAppSettings({
      settings: browserSettings,
      prettifySettings: prettifySettingsDraft('claude-cli', {
        claudeCli: {
          ...DEFAULT_PRETTIFY_SETTINGS.claudeCli,
          timeoutSeconds: MAX_PRETTIFY_CLI_TIMEOUT_SECONDS,
        },
      }),
    });
    assert.equal(maximumTimeoutErrors.prettifyTimeout, undefined);
  });

  it('validates only active Codex CLI controls and permits optional models', () => {
    const browserSettings = createEditableSettings(cloakBrowserSettings());
    const validErrors = validateAppSettings({
      settings: browserSettings,
      prettifySettings: prettifySettingsDraft('codex-cli', {
        minP: 2,
        topK: 0,
        codexCli: {
          executablePath: 'C:\\Program Files\\Codex CLI\\codex.exe',
          model: '',
          reasoningEffort: 'default',
          timeoutSeconds: MAX_PRETTIFY_CLI_TIMEOUT_SECONDS,
          verbosity: 'low',
        },
      }),
    });
    assert.deepEqual(validErrors, {});

    const invalidDraft = prettifySettingsDraft('codex-cli', {
      codexCli: {
        executablePath: 'codex --ephemeral',
        model: 'model with spaces',
        reasoningEffort: 'ultra' as unknown as PrettifySettingsDraft['codexCli']['reasoningEffort'],
        timeoutSeconds: MIN_PRETTIFY_CLI_TIMEOUT_SECONDS - 1,
        verbosity: 'verbose' as unknown as PrettifySettingsDraft['codexCli']['verbosity'],
      },
    });
    const invalidErrors = validateAppSettings({ settings: browserSettings, prettifySettings: invalidDraft });
    assert.equal(invalidErrors.prettifyExecutablePath, 'Executable path must be empty or absolute');
    assert.equal(invalidErrors.prettifyModel, 'Enter a supported Codex CLI model');
    assert.equal(invalidErrors.prettifyReasoningEffort, 'Select a supported Codex CLI reasoning effort');
    assert.equal(invalidErrors.prettifyVerbosity, 'Select a supported Codex CLI verbosity');
    assert.equal(invalidErrors.prettifyTimeout, 'Timeout must be an integer between 15 and 600 seconds');
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

  it('keeps a GeoIP-managed browser identity valid while proxy changes are pending', () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const settings = createEditableSettings(
      cloakBrowserSettings({
        locale: '',
        timezone: '',
        proxy: {
          enabled: true,
          geoip: true,
          hasPassword: false,
          server: 'http://proxy.example.com:8080',
          bypass: '',
          username: '',
        },
      }),
    );

    assert.deepEqual(
      getAppSettingsFormState({
        initialPrettifySettings: VALID_PRETTIFY_SETTINGS,
        initialSettings,
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
        prettifySettings: VALID_PRETTIFY_SETTINGS,
        settings,
        textActionSettings: VALID_TEXT_ACTION_SETTINGS,
      }),
      {
        isDirty: true,
        isValid: true,
        validationErrors: {},
      },
    );
  });

  it('appends existing valid locale and timezone values to dropdown options', () => {
    assert.equal(getCloakBrowserLocaleOptions('fr-CA').includes('fr-CA'), true);
    assert.equal(getCloakBrowserTimezoneOptions('Etc/GMT+12').includes('Etc/GMT+12'), true);
  });

  it('transitions providers without discarding drafts and requests stale provider state cleanup', () => {
    const current = prettifySettingsDraft('claude-cli', {
      claudeCli: { ...DEFAULT_PRETTIFY_SETTINGS.claudeCli, model: 'sonnet' },
      codexCli: { ...DEFAULT_PRETTIFY_SETTINGS.codexCli, model: 'gpt-5.6-codex' },
      ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' },
      vllm: { baseUrl: 'https://models.example.com/v1', model: 'qwen3', hasApiKey: true },
    });

    const transition = createPrettifyProviderTransitionState(current, 'codex-cli');

    assert.equal(transition.settings.providerId, 'codex-cli');
    assert.deepEqual(transition.settings.claudeCli, current.claudeCli);
    assert.deepEqual(transition.settings.codexCli, current.codexCli);
    assert.deepEqual(transition.settings.ollama, current.ollama);
    assert.deepEqual(transition.settings.vllm, current.vllm);
    assert.equal(transition.resetModelState, true);
    assert.deepEqual(transition.clearFieldErrors, PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS);
  });

  it('synchronizes an external provider choice without discarding dirty provider drafts', () => {
    const current = prettifySettingsDraft('claude-cli', {
      prompt: 'unsaved prompt',
      claudeCli: { ...DEFAULT_PRETTIFY_SETTINGS.claudeCli, model: 'unsaved-claude-model' },
      codexCli: { ...DEFAULT_PRETTIFY_SETTINGS.codexCli, model: 'unsaved-codex-model' },
    });
    const initial = prettifySettingsDraft('claude-cli');

    const synchronizedCurrent = applyExternalPrettifyProviderSelection(current, 'vllm');
    const synchronizedInitial = applyExternalPrettifyProviderSelection(initial, 'vllm');

    assert.equal(synchronizedCurrent.providerId, 'vllm');
    assert.equal(synchronizedInitial.providerId, 'vllm');
    assert.equal(synchronizedCurrent.prompt, 'unsaved prompt');
    assert.equal(synchronizedCurrent.claudeCli.model, 'unsaved-claude-model');
    assert.equal(synchronizedCurrent.codexCli.model, 'unsaved-codex-model');
    assert.equal(synchronizedCurrent.claudeCli, current.claudeCli);
    assert.equal(synchronizedCurrent.codexCli, current.codexCli);
  });

  it('keeps inactive provider changes dirty without reporting them as active CLI controls', () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const initialPrettifySettings = prettifySettingsDraft('claude-cli');
    const current = prettifySettingsDraft('claude-cli', {
      topP: 0,
      ollama: { ...DEFAULT_PRETTIFY_SETTINGS.ollama, model: 'inactive-private-model' },
    });
    const input = {
      settings: initialSettings,
      initialSettings,
      prettifySettings: current,
      initialPrettifySettings,
      textActionSettings: VALID_TEXT_ACTION_SETTINGS,
      initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
    };

    assert.deepEqual(getAppSettingsFormState(input), {
      isDirty: true,
      isValid: true,
      validationErrors: {},
    });
    const summary = createAppSettingsLogSummary(input);
    assert.deepEqual(summary.changedGroups, ['prettify']);
    assert.deepEqual(summary.changedFields, []);
    assert.equal(JSON.stringify(summary).includes('inactive-private-model'), false);
  });

  it('detects changed prettify settings separately from CloakBrowser settings', () => {
    assert.equal(arePrettifySettingsEqual(prettifySettings(), prettifySettings()), true);
    assert.equal(arePrettifySettingsEqual(prettifySettings({ providerId: 'vllm' }), prettifySettings()), false);
    assert.equal(
      arePrettifySettingsEqual(
        prettifySettings({ claudeCli: { ...DEFAULT_PRETTIFY_SETTINGS.claudeCli, model: 'claude-sonnet' } }),
        prettifySettings(),
      ),
      false,
    );
    assert.equal(
      arePrettifySettingsEqual(
        prettifySettings({ codexCli: { ...DEFAULT_PRETTIFY_SETTINGS.codexCli, timeoutSeconds: 240 } }),
        prettifySettings(),
      ),
      false,
    );
    assert.equal(arePrettifySettingsEqual(prettifySettings({ temperature: 0.2 }), prettifySettings()), false);
    assert.equal(arePrettifySettingsEqual(prettifySettings({ topP: 0.8 }), prettifySettings()), false);
    assert.equal(arePrettifySettingsEqual(prettifySettings({ topK: 32 }), prettifySettings()), false);
    assert.equal(arePrettifySettingsEqual(prettifySettings({ minP: 0.05 }), prettifySettings()), false);
    assert.equal(arePrettifySettingsEqual(prettifySettings({ repeatPenalty: 1.1 }), prettifySettings()), false);
    assert.equal(arePrettifySettingsEqual(prettifySettings({ maxOutputTokens: 512 }), prettifySettings()), false);
    assert.equal(arePrettifySettingsEqual(prettifySettings({ seed: 1 }), prettifySettings()), false);
    assert.equal(
      arePrettifySettingsEqual(
        prettifySettings({
          vllm: {
            ...DEFAULT_PRETTIFY_SETTINGS.vllm,
            model: 'qwen2.5',
            hasApiKey: false,
            apiKey: 'secret',
          },
        }),
        prettifySettings(),
      ),
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
        prettifySettings: prettifySettings({ prompt: 'new prompt' }),
        initialPrettifySettings: prettifySettings({ prompt: 'old prompt' }),
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
          return { success: true, settings: settings as PrettifySettings };
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
    assert.deepEqual(result.prettifySettings, prettifySettings({ prompt: 'new prompt' }));
  });

  it('passes a valid CLI draft to persistence without enabling CLI selection', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const initialPrettifySettings = prettifySettingsDraft('claude-cli');
    const current = prettifySettingsDraft('claude-cli', {
      claudeCli: {
        ...DEFAULT_PRETTIFY_SETTINGS.claudeCli,
        executablePath: '/Applications/Claude CLI/claude',
        model: 'sonnet',
      },
    });
    let savedProviderId: unknown;
    let savedModel: unknown;

    const result = await saveAppSettingsState(
      {
        settings: initialSettings,
        initialSettings,
        prettifySettings: current,
        initialPrettifySettings,
        textActionSettings: VALID_TEXT_ACTION_SETTINGS,
        initialTextActionSettings: VALID_TEXT_ACTION_SETTINGS,
      },
      {
        saveCloakBrowserSettings: async () => ({ success: true, settings: cloakBrowserSettings() }),
        setPrettifySettings: async (settings) => {
          savedProviderId = settings.providerId;
          savedModel = settings.claudeCli?.model;
          return { success: true, settings: prettifySettings() };
        },
        setTextActionSettings: async (settings) => ({ success: true, settings }),
      },
    );

    assert.equal(result.success, true);
    assert.equal(result.prettifySettingsSaved, true);
    assert.equal(savedProviderId, 'claude-cli');
    assert.equal(savedModel, 'sonnet');
  });

  it('propagates prettify settings save errors', async () => {
    const initialSettings = createEditableSettings(cloakBrowserSettings());
    const calls: string[] = [];

    const result = await saveAppSettingsState(
      {
        settings: initialSettings,
        initialSettings,
        prettifySettings: prettifySettings({ prompt: 'new prompt' }),
        initialPrettifySettings: prettifySettings({ prompt: 'old prompt' }),
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
          return { success: true, settings: settings as PrettifySettings };
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
        prettifySettings: prettifySettings({ prompt: '' }),
        initialPrettifySettings: prettifySettings({ prompt: 'old prompt' }),
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
          return { success: true, settings: settings as PrettifySettings };
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
        prettifySettings: VALID_PRETTIFY_SETTINGS,
        initialPrettifySettings: VALID_PRETTIFY_SETTINGS,
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
          return { success: true, settings: settings as PrettifySettings };
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
        prettifySettings: prettifySettings({ prompt: 'new prompt', providerId: 'vllm' }),
        initialPrettifySettings: prettifySettings({ prompt: 'old prompt' }),
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
          return { success: true, settings: settings as PrettifySettings };
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
    assert.deepEqual(result.prettifySettings, prettifySettings({ prompt: 'new prompt', providerId: 'vllm' }));
  });
});
