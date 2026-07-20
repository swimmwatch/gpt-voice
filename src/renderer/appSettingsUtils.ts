import {
  CLOAK_BROWSER_BACKGROUND_MODES,
  CLOAK_BROWSER_HUMAN_PRESETS,
  CLOAK_BROWSER_LOCALE_VALUES,
  isSocks5ProxyServer,
  type CloakBrowserSettingsInput,
  type CloakBrowserSettingsView,
} from '@shared/cloakBrowserSettings';
import {
  MAX_PRETTIFY_CLI_TIMEOUT_SECONDS,
  MAX_PRETTIFY_PROMPT_LENGTH,
  MIN_PRETTIFY_CLI_TIMEOUT_SECONDS,
  getPrettifyBaseUrlValidationErrorCode,
  getPrettifyProviderCapabilities,
  isClaudeCliPrettifyEffort,
  isCodexCliPrettifyReasoningEffort,
  isCodexCliPrettifyVerbosity,
  isKnownPrettifyProviderId,
  isValidClaudeCliPrettifyModel,
  isValidCodexCliPrettifyModel,
  isValidPrettifyCliExecutablePath,
  type ClaudeCliPrettifyEffort,
  type CodexCliPrettifyReasoningEffort,
  type CodexCliPrettifyVerbosity,
  type KnownPrettifyProviderId,
  type PrettifySettings,
  type PrettifySettingsInput,
  type PrettifyBaseUrlValidationErrorCode,
} from '@shared/prettifySettings';
import type { TextActionSettings } from '@shared/textActionSettings';

const SUPPORTED_PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks5:']);
const FINGERPRINT_SEED_PATTERN = /^\d+$/;

export const CLOAK_BROWSER_FALLBACK_TIMEZONE_VALUES = [
  'UTC',
  'Europe/Moscow',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
] as const;

export type AppSettingsFieldKey =
  | 'prettifyPrompt'
  | 'prettifyProvider'
  | 'prettifyBaseUrl'
  | 'prettifyModel'
  | 'prettifyTemperature'
  | 'prettifyTopP'
  | 'prettifyTopK'
  | 'prettifyMinP'
  | 'prettifyRepeatPenalty'
  | 'prettifyMaxOutputTokens'
  | 'prettifySeed'
  | 'prettifyApiKey'
  | 'prettifyExecutablePath'
  | 'prettifyFallbackModel'
  | 'prettifyEffort'
  | 'prettifyReasoningEffort'
  | 'prettifyVerbosity'
  | 'prettifyTimeout'
  | 'humanPreset'
  | 'backgroundMode'
  | 'fingerprintSeed'
  | 'locale'
  | 'timezone'
  | 'proxyServer'
  | 'proxyBypass'
  | 'proxyUsername'
  | 'proxyPassword';

export type AppSettingsValidationErrorCode =
  | PrettifyBaseUrlValidationErrorCode
  | 'prettify-temperature-range'
  | 'prettify-top-p-range'
  | 'prettify-top-k-range'
  | 'prettify-min-p-range'
  | 'prettify-repeat-penalty-range'
  | 'prettify-max-output-tokens-range'
  | 'prettify-seed-range'
  | 'prettify-base-url-required'
  | 'prettify-model-required'
  | 'prettify-model-unavailable'
  | 'prettify-executable-path-invalid'
  | 'prettify-claude-model-invalid'
  | 'prettify-claude-fallback-model-invalid'
  | 'prettify-claude-effort-invalid'
  | 'prettify-cli-timeout-range'
  | 'prettify-codex-model-invalid'
  | 'prettify-codex-reasoning-invalid'
  | 'prettify-codex-verbosity-invalid'
  | 'prettify-prompt-required'
  | 'prettify-prompt-too-long'
  | 'prettify-provider-invalid'
  | 'locale-required'
  | 'locale-unsupported'
  | 'timezone-required'
  | 'timezone-unsupported'
  | 'proxy-server-required'
  | 'proxy-protocol-invalid'
  | 'proxy-credentials-in-url'
  | 'proxy-url-invalid'
  | 'proxy-socks5-credentials-unsupported'
  | 'human-preset-invalid'
  | 'background-mode-invalid'
  | 'fingerprint-seed-required'
  | 'fingerprint-seed-digits';

export const APP_SETTINGS_VALIDATION_ERROR_CODES = [
  'prettify-temperature-range',
  'prettify-top-p-range',
  'prettify-top-k-range',
  'prettify-min-p-range',
  'prettify-repeat-penalty-range',
  'prettify-max-output-tokens-range',
  'prettify-seed-range',
  'prettify-base-url-required',
  'prettify-base-url-invalid',
  'prettify-base-url-credentials',
  'prettify-base-url-insecure-remote',
  'prettify-model-required',
  'prettify-model-unavailable',
  'prettify-executable-path-invalid',
  'prettify-claude-model-invalid',
  'prettify-claude-fallback-model-invalid',
  'prettify-claude-effort-invalid',
  'prettify-cli-timeout-range',
  'prettify-codex-model-invalid',
  'prettify-codex-reasoning-invalid',
  'prettify-codex-verbosity-invalid',
  'prettify-prompt-required',
  'prettify-prompt-too-long',
  'prettify-provider-invalid',
  'locale-required',
  'locale-unsupported',
  'timezone-required',
  'timezone-unsupported',
  'proxy-server-required',
  'proxy-protocol-invalid',
  'proxy-credentials-in-url',
  'proxy-url-invalid',
  'proxy-socks5-credentials-unsupported',
  'human-preset-invalid',
  'background-mode-invalid',
  'fingerprint-seed-required',
  'fingerprint-seed-digits',
] as const satisfies readonly AppSettingsValidationErrorCode[];

export interface AppSettingsValidationError {
  code: AppSettingsValidationErrorCode;
  params?: Record<string, string>;
}

export type AppSettingsFieldErrors = Partial<Record<AppSettingsFieldKey, AppSettingsValidationError>>;

export function createAppSettingsValidationError(
  code: AppSettingsValidationErrorCode,
  params?: Record<string, string>,
): AppSettingsValidationError {
  return params ? { code, params } : { code };
}

export type PrettifySettingsDraft = Omit<PrettifySettings, 'providerId'> & {
  providerId: KnownPrettifyProviderId;
};

export const PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS = [
  'prettifyBaseUrl',
  'prettifyModel',
  'prettifyTemperature',
  'prettifyTopP',
  'prettifyTopK',
  'prettifyMinP',
  'prettifyRepeatPenalty',
  'prettifyMaxOutputTokens',
  'prettifySeed',
  'prettifyApiKey',
  'prettifyExecutablePath',
  'prettifyFallbackModel',
  'prettifyEffort',
  'prettifyReasoningEffort',
  'prettifyVerbosity',
  'prettifyTimeout',
] as const satisfies readonly AppSettingsFieldKey[];

export interface PrettifyProviderTransitionState {
  clearFieldErrors: readonly AppSettingsFieldKey[];
  resetModelState: true;
  settings: PrettifySettingsDraft;
}

export interface EditableCloakBrowserSettings extends Omit<CloakBrowserSettingsView, 'proxy'> {
  proxy: CloakBrowserSettingsView['proxy'] & {
    password: string;
    clearPassword: boolean;
  };
}

export interface AppSettingsSaveDependencies {
  saveCloakBrowserSettings: (
    settings: CloakBrowserSettingsInput,
  ) => Promise<{ success: boolean; settings?: CloakBrowserSettingsView; error?: string }>;
  setPrettifySettings: (
    settings: PrettifySettingsInput,
  ) => Promise<{ success: boolean; settings?: PrettifySettings; error?: string }>;
  setTextActionSettings: (
    settings: TextActionSettings,
  ) => Promise<{ success: boolean; settings?: TextActionSettings; error?: string }>;
}

export interface AppSettingsSaveInput {
  initialPrettifySettings: PrettifySettingsDraft;
  initialSettings: EditableCloakBrowserSettings;
  initialTextActionSettings: TextActionSettings;
  localeValues?: readonly string[];
  prettifySettings: PrettifySettingsDraft;
  settings: EditableCloakBrowserSettings;
  textActionSettings: TextActionSettings;
  timezoneValues?: readonly string[];
}

export interface AppSettingsSaveResult {
  success: boolean;
  error?: string;
  fieldErrors?: AppSettingsFieldErrors;
  prettifySettingsSaved?: boolean;
  prettifySettings?: PrettifySettings;
  textActionSettingsSaved?: boolean;
  textActionSettings?: TextActionSettings;
  settingsSaved?: boolean;
  settings?: EditableCloakBrowserSettings;
}

export interface AppSettingsFormState {
  isDirty: boolean;
  isValid: boolean;
  validationErrors: AppSettingsFieldErrors;
}

export type AppSettingsChangedGroup = 'prettify' | 'textActions' | 'cloakBrowser';

export interface SanitizedCloakBrowserSettingsSummary {
  humanize: boolean;
  humanPreset: string;
  backgroundMode: string;
  fingerprintSeedLength: number;
  hasLocale: boolean;
  hasTimezone: boolean;
  proxyEnabled: boolean;
  proxyGeoip: boolean;
  hasProxyServer: boolean;
  hasProxyBypass: boolean;
  hasProxyUsername: boolean;
  hasSavedProxyPassword: boolean;
  hasProxyPasswordUpdate: boolean;
  clearProxyPassword: boolean;
}

export interface SanitizedPrettifyProviderSummary {
  prettifyModelLength: number;
  prettifyFallbackModelLength?: number;
  prettifyHasExecutablePath?: boolean;
  prettifyEffort?: ClaudeCliPrettifyEffort | CodexCliPrettifyReasoningEffort;
  prettifyVerbosity?: CodexCliPrettifyVerbosity;
  prettifyTimeoutSeconds?: number;
  prettifyTemperature?: number;
  prettifyTopP?: number;
  prettifyTopK?: number;
  prettifyMinP?: number;
  prettifyRepeatPenalty?: number;
  prettifyMaxOutputTokens?: number;
  prettifyHasSeed?: boolean;
  prettifyHasVllmApiKey?: boolean;
  prettifyVllmApiKeyUpdated?: boolean;
  prettifyVllmApiKeyCleared?: boolean;
}

export interface AppSettingsLogSummary extends SanitizedPrettifyProviderSummary {
  changedGroups: AppSettingsChangedGroup[];
  changedFields: string[];
  prettifyPromptChanged: boolean;
  prettifyPromptLength: number;
  prettifyProviderId: KnownPrettifyProviderId;
  textActions: TextActionSettings;
  cloakBrowser: SanitizedCloakBrowserSettingsSummary;
}

export function createEditableSettings(settings: CloakBrowserSettingsView): EditableCloakBrowserSettings {
  return {
    ...settings,
    proxy: {
      ...settings.proxy,
      password: '',
      clearPassword: false,
    },
  };
}

export function createSanitizedCloakBrowserSettingsSummary(
  settings: EditableCloakBrowserSettings,
): SanitizedCloakBrowserSettingsSummary {
  return {
    humanize: settings.humanize,
    humanPreset: settings.humanPreset,
    backgroundMode: settings.backgroundMode,
    fingerprintSeedLength: settings.fingerprintSeed.trim().length,
    hasLocale: Boolean(settings.locale.trim()),
    hasTimezone: Boolean(settings.timezone.trim()),
    proxyEnabled: settings.proxy.enabled,
    proxyGeoip: settings.proxy.geoip,
    hasProxyServer: Boolean(settings.proxy.server.trim()),
    hasProxyBypass: Boolean(settings.proxy.bypass.trim()),
    hasProxyUsername: Boolean(settings.proxy.username.trim()),
    hasSavedProxyPassword: settings.proxy.hasPassword,
    hasProxyPasswordUpdate: Boolean(settings.proxy.password.trim()),
    clearProxyPassword: settings.proxy.clearPassword,
  };
}

export function createPrettifyProviderTransitionState(
  settings: PrettifySettingsDraft,
  providerId: KnownPrettifyProviderId,
): PrettifyProviderTransitionState {
  return {
    clearFieldErrors: PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS,
    resetModelState: true,
    settings: { ...settings, providerId },
  };
}

/** Applies an externally persisted provider choice without replacing any unsaved provider drafts. */
export function applyExternalPrettifyProviderSelection(
  settings: PrettifySettingsDraft,
  providerId: KnownPrettifyProviderId,
): PrettifySettingsDraft {
  return settings.providerId === providerId ? settings : { ...settings, providerId };
}

function hasVllmApiKeyUpdate(settings: PrettifySettingsDraft): boolean {
  return Boolean(settings.vllm.apiKey?.trim());
}

function hasVllmApiKeyChange(settings: PrettifySettingsDraft, initialSettings: PrettifySettingsDraft): boolean {
  return (
    settings.vllm.hasApiKey !== initialSettings.vllm.hasApiKey ||
    hasVllmApiKeyUpdate(settings) ||
    Boolean(settings.vllm.clearApiKey)
  );
}

function collectChangedFields(changes: ReadonlyArray<readonly [boolean, string]>): string[] {
  return changes.filter(([changed]) => changed).map(([, field]) => field);
}

function collectPrettifyChangedFields(input: AppSettingsSaveInput): string[] {
  const { initialPrettifySettings: initial, prettifySettings: current } = input;
  const commonChanges = collectChangedFields([
    [current.prompt !== initial.prompt, 'prettifyPrompt'],
    [current.providerId !== initial.providerId, 'prettifyProvider'],
  ]);

  const httpGenerationChanges = (): string[] =>
    collectChangedFields([
      [current.temperature !== initial.temperature, 'prettifyTemperature'],
      [current.topP !== initial.topP, 'prettifyTopP'],
      [current.topK !== initial.topK, 'prettifyTopK'],
      [current.minP !== initial.minP, 'prettifyMinP'],
      [current.repeatPenalty !== initial.repeatPenalty, 'prettifyRepeatPenalty'],
      [current.maxOutputTokens !== initial.maxOutputTokens, 'prettifyMaxOutputTokens'],
      [current.seed !== initial.seed, 'prettifySeed'],
    ]);

  switch (current.providerId) {
    case 'ollama':
      return [
        ...commonChanges,
        ...httpGenerationChanges(),
        ...collectChangedFields([
          [current.ollama.baseUrl !== initial.ollama.baseUrl, 'prettifyBaseUrl'],
          [current.ollama.model !== initial.ollama.model, 'prettifyModel'],
        ]),
      ];
    case 'vllm':
      return [
        ...commonChanges,
        ...httpGenerationChanges(),
        ...collectChangedFields([
          [current.vllm.baseUrl !== initial.vllm.baseUrl, 'prettifyBaseUrl'],
          [current.vllm.model !== initial.vllm.model, 'prettifyModel'],
          [hasVllmApiKeyChange(current, initial), 'prettifyApiKey'],
        ]),
      ];
    case 'claude-cli':
      return [
        ...commonChanges,
        ...collectChangedFields([
          [current.claudeCli.executablePath !== initial.claudeCli.executablePath, 'prettifyExecutablePath'],
          [current.claudeCli.model !== initial.claudeCli.model, 'prettifyModel'],
          [current.claudeCli.fallbackModel !== initial.claudeCli.fallbackModel, 'prettifyFallbackModel'],
          [current.claudeCli.effort !== initial.claudeCli.effort, 'prettifyEffort'],
          [current.claudeCli.timeoutSeconds !== initial.claudeCli.timeoutSeconds, 'prettifyTimeout'],
        ]),
      ];
    case 'codex-cli':
      return [
        ...commonChanges,
        ...collectChangedFields([
          [current.codexCli.executablePath !== initial.codexCli.executablePath, 'prettifyExecutablePath'],
          [current.codexCli.model !== initial.codexCli.model, 'prettifyModel'],
          [current.codexCli.reasoningEffort !== initial.codexCli.reasoningEffort, 'prettifyReasoningEffort'],
          [current.codexCli.verbosity !== initial.codexCli.verbosity, 'prettifyVerbosity'],
          [current.codexCli.timeoutSeconds !== initial.codexCli.timeoutSeconds, 'prettifyTimeout'],
        ]),
      ];
  }
}

function collectTextActionChangedFields(input: AppSettingsSaveInput): string[] {
  return collectChangedFields([
    [
      input.textActionSettings.translateEnabled !== input.initialTextActionSettings.translateEnabled,
      'translateEnabled',
    ],
    [input.textActionSettings.prettifyEnabled !== input.initialTextActionSettings.prettifyEnabled, 'prettifyEnabled'],
  ]);
}

function collectCloakBrowserChangedFields(input: AppSettingsSaveInput): string[] {
  const { initialSettings: initial, settings: current } = input;
  return collectChangedFields([
    [current.humanize !== initial.humanize, 'humanize'],
    [current.humanPreset !== initial.humanPreset, 'humanPreset'],
    [current.backgroundMode !== initial.backgroundMode, 'backgroundMode'],
    [current.fingerprintSeed !== initial.fingerprintSeed, 'fingerprintSeed'],
    [current.locale !== initial.locale, 'locale'],
    [current.timezone !== initial.timezone, 'timezone'],
    [current.proxy.enabled !== initial.proxy.enabled, 'proxyEnabled'],
    [current.proxy.server !== initial.proxy.server, 'proxyServer'],
    [current.proxy.bypass !== initial.proxy.bypass, 'proxyBypass'],
    [current.proxy.username !== initial.proxy.username, 'proxyUsername'],
    [current.proxy.geoip !== initial.proxy.geoip, 'proxyGeoip'],
    [
      current.proxy.hasPassword !== initial.proxy.hasPassword ||
        Boolean(current.proxy.password.trim()) ||
        current.proxy.clearPassword,
      'proxyPassword',
    ],
  ]);
}

function appendChangedGroup(
  changedGroups: AppSettingsChangedGroup[],
  changedFields: string[],
  group: AppSettingsChangedGroup,
  fields: string[],
): void {
  if (!fields.length) return;
  changedGroups.push(group);
  changedFields.push(...fields);
}

function getHttpGenerationLogSummary(settings: PrettifySettingsDraft): SanitizedPrettifyProviderSummary {
  return {
    prettifyModelLength: 0,
    prettifyTemperature: settings.temperature,
    prettifyTopP: settings.topP,
    prettifyTopK: settings.topK,
    prettifyMinP: settings.minP,
    prettifyRepeatPenalty: settings.repeatPenalty,
    prettifyMaxOutputTokens: settings.maxOutputTokens,
    prettifyHasSeed: settings.seed !== null,
  };
}

function createSanitizedPrettifyProviderSummary(settings: PrettifySettingsDraft): SanitizedPrettifyProviderSummary {
  switch (settings.providerId) {
    case 'ollama':
      return {
        ...getHttpGenerationLogSummary(settings),
        prettifyModelLength: settings.ollama.model.length,
      };
    case 'vllm':
      return {
        ...getHttpGenerationLogSummary(settings),
        prettifyModelLength: settings.vllm.model.length,
        prettifyHasVllmApiKey: settings.vllm.hasApiKey,
        prettifyVllmApiKeyUpdated: hasVllmApiKeyUpdate(settings),
        prettifyVllmApiKeyCleared: Boolean(settings.vllm.clearApiKey),
      };
    case 'claude-cli':
      return {
        prettifyModelLength: settings.claudeCli.model.length,
        prettifyFallbackModelLength: settings.claudeCli.fallbackModel.length,
        prettifyHasExecutablePath: Boolean(settings.claudeCli.executablePath.trim()),
        prettifyEffort: settings.claudeCli.effort,
        prettifyTimeoutSeconds: settings.claudeCli.timeoutSeconds,
      };
    case 'codex-cli':
      return {
        prettifyModelLength: settings.codexCli.model.length,
        prettifyHasExecutablePath: Boolean(settings.codexCli.executablePath.trim()),
        prettifyEffort: settings.codexCli.reasoningEffort,
        prettifyVerbosity: settings.codexCli.verbosity,
        prettifyTimeoutSeconds: settings.codexCli.timeoutSeconds,
      };
  }
}

// Logging each setting explicitly keeps secrets excluded while preserving an auditable list of user-visible changes.
export function createAppSettingsLogSummary(input: AppSettingsSaveInput): AppSettingsLogSummary {
  const changedGroups: AppSettingsChangedGroup[] = [];
  const changedFields: string[] = [];
  const prettifyChangedFields = collectPrettifyChangedFields(input);
  if (!arePrettifySettingsEqual(input.prettifySettings, input.initialPrettifySettings)) {
    changedGroups.push('prettify');
    changedFields.push(...prettifyChangedFields);
  }
  appendChangedGroup(changedGroups, changedFields, 'textActions', collectTextActionChangedFields(input));
  appendChangedGroup(changedGroups, changedFields, 'cloakBrowser', collectCloakBrowserChangedFields(input));

  return {
    ...createSanitizedPrettifyProviderSummary(input.prettifySettings),
    changedGroups,
    changedFields,
    prettifyPromptChanged: input.prettifySettings.prompt !== input.initialPrettifySettings.prompt,
    prettifyPromptLength: input.prettifySettings.prompt.length,
    prettifyProviderId: input.prettifySettings.providerId,
    textActions: input.textActionSettings,
    cloakBrowser: createSanitizedCloakBrowserSettingsSummary(input.settings),
  };
}

export function createCloakBrowserSettingsInput(settings: EditableCloakBrowserSettings): CloakBrowserSettingsInput {
  return {
    humanize: settings.humanize,
    humanPreset: settings.humanPreset,
    backgroundMode: settings.backgroundMode,
    fingerprintSeed: settings.fingerprintSeed,
    locale: settings.locale,
    timezone: settings.timezone,
    proxy: {
      enabled: settings.proxy.enabled,
      server: settings.proxy.server,
      bypass: settings.proxy.bypass,
      username: settings.proxy.username,
      password: settings.proxy.password,
      clearPassword: settings.proxy.clearPassword,
      geoip: settings.proxy.geoip,
    },
  };
}

function isValidLocale(value: string): boolean {
  try {
    new Intl.Locale(value);
    return true;
  } catch {
    return false;
  }
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function uniqueValues(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim())));
}

function appendCurrentValue(
  values: readonly string[],
  currentValue: string | undefined,
  isValidValue: (value: string) => boolean,
): string[] {
  const nextValues = uniqueValues(values);
  const trimmedCurrentValue = currentValue?.trim() || '';
  if (trimmedCurrentValue && !nextValues.includes(trimmedCurrentValue) && isValidValue(trimmedCurrentValue)) {
    nextValues.push(trimmedCurrentValue);
  }
  return nextValues;
}

function getIntlTimezoneValues(): string[] {
  try {
    const intlWithSupportedValues = Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    };
    if (typeof intlWithSupportedValues.supportedValuesOf !== 'function') {
      return [];
    }
    return intlWithSupportedValues.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

export function getCloakBrowserLocaleOptions(currentLocale?: string): string[] {
  return appendCurrentValue(CLOAK_BROWSER_LOCALE_VALUES, currentLocale, isValidLocale);
}

export function getCloakBrowserTimezoneOptions(currentTimezone?: string): string[] {
  return appendCurrentValue(
    [...CLOAK_BROWSER_FALLBACK_TIMEZONE_VALUES, ...getIntlTimezoneValues()],
    currentTimezone,
    isValidTimezone,
  );
}

export function hasAppSettingsFieldErrors(fieldErrors: AppSettingsFieldErrors): boolean {
  return Object.values(fieldErrors).some(Boolean);
}

export interface ValidateAppSettingsInput {
  localeValues?: readonly string[];
  prettifySettings: PrettifySettingsDraft;
  settings: EditableCloakBrowserSettings;
  timezoneValues?: readonly string[];
}

function addNumericPrettifyErrors(settings: PrettifySettingsDraft, errors: AppSettingsFieldErrors): void {
  const numericRules: Array<[AppSettingsFieldKey, boolean, AppSettingsValidationErrorCode]> = [
    [
      'prettifyTemperature',
      Number.isFinite(settings.temperature) && settings.temperature >= 0 && settings.temperature <= 1,
      'prettify-temperature-range',
    ],
    [
      'prettifyTopP',
      Number.isFinite(settings.topP) && settings.topP >= 0.05 && settings.topP <= 1,
      'prettify-top-p-range',
    ],
    [
      'prettifyTopK',
      Number.isInteger(settings.topK) && settings.topK >= 1 && settings.topK <= 200,
      'prettify-top-k-range',
    ],
    [
      'prettifyMinP',
      Number.isFinite(settings.minP) && settings.minP >= 0 && settings.minP <= 1,
      'prettify-min-p-range',
    ],
    [
      'prettifyRepeatPenalty',
      Number.isFinite(settings.repeatPenalty) && settings.repeatPenalty >= 0.8 && settings.repeatPenalty <= 1.5,
      'prettify-repeat-penalty-range',
    ],
    [
      'prettifyMaxOutputTokens',
      Number.isInteger(settings.maxOutputTokens) && settings.maxOutputTokens >= 1 && settings.maxOutputTokens <= 8192,
      'prettify-max-output-tokens-range',
    ],
    [
      'prettifySeed',
      settings.seed === null ||
        (Number.isInteger(settings.seed) && settings.seed >= 0 && settings.seed <= 2_147_483_647),
      'prettify-seed-range',
    ],
  ];
  for (const [field, valid, code] of numericRules) {
    if (!valid) errors[field] = createAppSettingsValidationError(code);
  }
}

function isValidCliTimeout(timeoutSeconds: number): boolean {
  return (
    Number.isInteger(timeoutSeconds) &&
    timeoutSeconds >= MIN_PRETTIFY_CLI_TIMEOUT_SECONDS &&
    timeoutSeconds <= MAX_PRETTIFY_CLI_TIMEOUT_SECONDS
  );
}

function validateHttpPrettifyProvider(
  provider: PrettifySettingsDraft['ollama'] | PrettifySettingsDraft['vllm'],
  errors: AppSettingsFieldErrors,
): void {
  if (!provider.baseUrl.trim()) errors.prettifyBaseUrl = createAppSettingsValidationError('prettify-base-url-required');
  else {
    const baseUrlErrorCode = getPrettifyBaseUrlValidationErrorCode(provider.baseUrl);
    if (baseUrlErrorCode) errors.prettifyBaseUrl = createAppSettingsValidationError(baseUrlErrorCode);
  }
  if (!provider.model.trim()) errors.prettifyModel = createAppSettingsValidationError('prettify-model-required');
}

function validateClaudeCliPrettifyProvider(
  settings: PrettifySettingsDraft['claudeCli'],
  errors: AppSettingsFieldErrors,
): void {
  if (!isValidPrettifyCliExecutablePath(settings.executablePath)) {
    errors.prettifyExecutablePath = createAppSettingsValidationError('prettify-executable-path-invalid');
  }
  const model = settings.model.trim();
  if (model && !isValidClaudeCliPrettifyModel(model)) {
    errors.prettifyModel = createAppSettingsValidationError('prettify-claude-model-invalid');
  }
  const fallbackModel = settings.fallbackModel.trim();
  if (fallbackModel && !isValidClaudeCliPrettifyModel(fallbackModel)) {
    errors.prettifyFallbackModel = createAppSettingsValidationError('prettify-claude-fallback-model-invalid');
  }
  if (!isClaudeCliPrettifyEffort(settings.effort)) {
    errors.prettifyEffort = createAppSettingsValidationError('prettify-claude-effort-invalid');
  }
  if (!isValidCliTimeout(settings.timeoutSeconds)) {
    errors.prettifyTimeout = createAppSettingsValidationError('prettify-cli-timeout-range', {
      min: String(MIN_PRETTIFY_CLI_TIMEOUT_SECONDS),
      max: String(MAX_PRETTIFY_CLI_TIMEOUT_SECONDS),
    });
  }
}

function validateCodexCliPrettifyProvider(
  settings: PrettifySettingsDraft['codexCli'],
  errors: AppSettingsFieldErrors,
): void {
  if (!isValidPrettifyCliExecutablePath(settings.executablePath)) {
    errors.prettifyExecutablePath = createAppSettingsValidationError('prettify-executable-path-invalid');
  }
  const model = settings.model.trim();
  if (model && !isValidCodexCliPrettifyModel(model)) {
    errors.prettifyModel = createAppSettingsValidationError('prettify-codex-model-invalid');
  }
  if (!isCodexCliPrettifyReasoningEffort(settings.reasoningEffort)) {
    errors.prettifyReasoningEffort = createAppSettingsValidationError('prettify-codex-reasoning-invalid');
  }
  if (!isCodexCliPrettifyVerbosity(settings.verbosity)) {
    errors.prettifyVerbosity = createAppSettingsValidationError('prettify-codex-verbosity-invalid');
  }
  if (!isValidCliTimeout(settings.timeoutSeconds)) {
    errors.prettifyTimeout = createAppSettingsValidationError('prettify-cli-timeout-range', {
      min: String(MIN_PRETTIFY_CLI_TIMEOUT_SECONDS),
      max: String(MAX_PRETTIFY_CLI_TIMEOUT_SECONDS),
    });
  }
}

function validatePrettifySettings(settings: PrettifySettingsDraft, errors: AppSettingsFieldErrors): void {
  const prompt = settings.prompt.trim();
  if (!prompt) errors.prettifyPrompt = createAppSettingsValidationError('prettify-prompt-required');
  else if (prompt.length > MAX_PRETTIFY_PROMPT_LENGTH) {
    errors.prettifyPrompt = createAppSettingsValidationError('prettify-prompt-too-long', {
      max: String(MAX_PRETTIFY_PROMPT_LENGTH),
    });
  }
  if (!isKnownPrettifyProviderId(settings.providerId)) {
    errors.prettifyProvider = createAppSettingsValidationError('prettify-provider-invalid');
    return;
  }

  const capabilities = getPrettifyProviderCapabilities(settings.providerId);
  if (capabilities.httpGenerationControls) {
    addNumericPrettifyErrors(settings, errors);
  }

  switch (settings.providerId) {
    case 'ollama':
      validateHttpPrettifyProvider(settings.ollama, errors);
      return;
    case 'vllm':
      validateHttpPrettifyProvider(settings.vllm, errors);
      return;
    case 'claude-cli':
      validateClaudeCliPrettifyProvider(settings.claudeCli, errors);
      return;
    case 'codex-cli':
      validateCodexCliPrettifyProvider(settings.codexCli, errors);
      return;
  }
}

function validateLocaleAndTimezone(
  settings: EditableCloakBrowserSettings,
  localeValues: readonly string[],
  timezoneValues: readonly string[],
  errors: AppSettingsFieldErrors,
): void {
  if (settings.proxy.enabled && settings.proxy.geoip) return;
  const locale = settings.locale.trim();
  const timezone = settings.timezone.trim();
  if (!locale) errors.locale = createAppSettingsValidationError('locale-required');
  else if (!localeValues.includes(locale)) errors.locale = createAppSettingsValidationError('locale-unsupported');
  if (!timezone) errors.timezone = createAppSettingsValidationError('timezone-required');
  else if (!timezoneValues.includes(timezone))
    errors.timezone = createAppSettingsValidationError('timezone-unsupported');
}

function validateProxy(settings: EditableCloakBrowserSettings, errors: AppSettingsFieldErrors): void {
  if (!settings.proxy.enabled) return;
  const server = settings.proxy.server.trim();
  if (!server) {
    errors.proxyServer = createAppSettingsValidationError('proxy-server-required');
    return;
  }

  try {
    const proxyUrl = new URL(server);
    if (!SUPPORTED_PROXY_PROTOCOLS.has(proxyUrl.protocol)) {
      errors.proxyServer = createAppSettingsValidationError('proxy-protocol-invalid');
    } else if (proxyUrl.username || proxyUrl.password) {
      errors.proxyServer = createAppSettingsValidationError('proxy-credentials-in-url');
    }
  } catch {
    errors.proxyServer = createAppSettingsValidationError('proxy-url-invalid');
  }

  if (!isSocks5ProxyServer(server)) return;
  const socks5Error = createAppSettingsValidationError('proxy-socks5-credentials-unsupported');
  if (settings.proxy.username.trim()) errors.proxyUsername = socks5Error;
  if (settings.proxy.password.trim() || (settings.proxy.hasPassword && !settings.proxy.clearPassword)) {
    errors.proxyPassword = socks5Error;
  }
}

function validateCloakBrowserSettings(
  settings: EditableCloakBrowserSettings,
  localeValues: readonly string[],
  timezoneValues: readonly string[],
  errors: AppSettingsFieldErrors,
): void {
  if (!CLOAK_BROWSER_HUMAN_PRESETS.includes(settings.humanPreset)) {
    errors.humanPreset = createAppSettingsValidationError('human-preset-invalid');
  }
  if (!CLOAK_BROWSER_BACKGROUND_MODES.includes(settings.backgroundMode)) {
    errors.backgroundMode = createAppSettingsValidationError('background-mode-invalid');
  }
  const fingerprintSeed = settings.fingerprintSeed.trim();
  if (!fingerprintSeed) errors.fingerprintSeed = createAppSettingsValidationError('fingerprint-seed-required');
  else if (!FINGERPRINT_SEED_PATTERN.test(fingerprintSeed))
    errors.fingerprintSeed = createAppSettingsValidationError('fingerprint-seed-digits');
  validateLocaleAndTimezone(settings, localeValues, timezoneValues, errors);
  validateProxy(settings, errors);
}

// Field errors are intentionally accumulated in one pass so Save can show every correction at once.
export function validateAppSettings(input: ValidateAppSettingsInput): AppSettingsFieldErrors {
  const errors: AppSettingsFieldErrors = {};
  const localeValues = input.localeValues ?? getCloakBrowserLocaleOptions(input.settings.locale);
  const timezoneValues = input.timezoneValues ?? getCloakBrowserTimezoneOptions(input.settings.timezone);
  validatePrettifySettings(input.prettifySettings, errors);
  validateCloakBrowserSettings(input.settings, localeValues, timezoneValues, errors);
  return errors;
}

export function getAppSettingsFormState(input: AppSettingsSaveInput): AppSettingsFormState {
  const validationErrors = validateAppSettings({
    localeValues: input.localeValues,
    prettifySettings: input.prettifySettings,
    settings: input.settings,
    timezoneValues: input.timezoneValues,
  });

  return {
    isDirty:
      !arePrettifySettingsEqual(input.prettifySettings, input.initialPrettifySettings) ||
      !areTextActionSettingsEqual(input.textActionSettings, input.initialTextActionSettings) ||
      !areCloakBrowserSettingsEqual(input.settings, input.initialSettings),
    isValid: !hasAppSettingsFieldErrors(validationErrors),
    validationErrors,
  };
}

export function arePrettifySettingsEqual(left: PrettifySettingsDraft, right: PrettifySettingsDraft): boolean {
  return (
    left.prompt === right.prompt &&
    left.providerId === right.providerId &&
    left.temperature === right.temperature &&
    left.topP === right.topP &&
    left.topK === right.topK &&
    left.minP === right.minP &&
    left.repeatPenalty === right.repeatPenalty &&
    left.maxOutputTokens === right.maxOutputTokens &&
    left.seed === right.seed &&
    left.claudeCli.executablePath === right.claudeCli.executablePath &&
    left.claudeCli.model === right.claudeCli.model &&
    left.claudeCli.fallbackModel === right.claudeCli.fallbackModel &&
    left.claudeCli.effort === right.claudeCli.effort &&
    left.claudeCli.timeoutSeconds === right.claudeCli.timeoutSeconds &&
    left.codexCli.executablePath === right.codexCli.executablePath &&
    left.codexCli.model === right.codexCli.model &&
    left.codexCli.reasoningEffort === right.codexCli.reasoningEffort &&
    left.codexCli.verbosity === right.codexCli.verbosity &&
    left.codexCli.timeoutSeconds === right.codexCli.timeoutSeconds &&
    left.ollama.baseUrl === right.ollama.baseUrl &&
    left.ollama.model === right.ollama.model &&
    left.vllm.baseUrl === right.vllm.baseUrl &&
    left.vllm.model === right.vllm.model &&
    left.vllm.hasApiKey === right.vllm.hasApiKey &&
    !left.vllm.apiKey &&
    !left.vllm.clearApiKey
  );
}

export function areTextActionSettingsEqual(left: TextActionSettings, right: TextActionSettings): boolean {
  return left.translateEnabled === right.translateEnabled && left.prettifyEnabled === right.prettifyEnabled;
}

export function areCloakBrowserSettingsEqual(
  current: EditableCloakBrowserSettings,
  initial: EditableCloakBrowserSettings,
): boolean {
  return (
    current.humanize === initial.humanize &&
    current.humanPreset === initial.humanPreset &&
    current.backgroundMode === initial.backgroundMode &&
    current.fingerprintSeed === initial.fingerprintSeed &&
    current.locale === initial.locale &&
    current.timezone === initial.timezone &&
    current.proxy.enabled === initial.proxy.enabled &&
    current.proxy.server === initial.proxy.server &&
    current.proxy.bypass === initial.proxy.bypass &&
    current.proxy.username === initial.proxy.username &&
    current.proxy.geoip === initial.proxy.geoip &&
    current.proxy.hasPassword === initial.proxy.hasPassword &&
    !current.proxy.password &&
    !current.proxy.clearPassword
  );
}

export async function saveAppSettingsState(
  input: AppSettingsSaveInput,
  deps: AppSettingsSaveDependencies,
): Promise<AppSettingsSaveResult> {
  const fieldErrors = validateAppSettings({
    localeValues: input.localeValues,
    prettifySettings: input.prettifySettings,
    settings: input.settings,
    timezoneValues: input.timezoneValues,
  });
  if (hasAppSettingsFieldErrors(fieldErrors)) {
    return {
      success: false,
      fieldErrors,
    };
  }

  const shouldSavePrettify = !arePrettifySettingsEqual(input.prettifySettings, input.initialPrettifySettings);
  const shouldSaveTextActions = !areTextActionSettingsEqual(input.textActionSettings, input.initialTextActionSettings);
  const shouldSaveCloakBrowser = !areCloakBrowserSettingsEqual(input.settings, input.initialSettings);
  const result: AppSettingsSaveResult = {
    success: true,
  };

  if (shouldSavePrettify) {
    const prettifyResult = await deps.setPrettifySettings(input.prettifySettings);
    if (prettifyResult.success && prettifyResult.settings) {
      result.prettifySettings = prettifyResult.settings;
      result.prettifySettingsSaved = true;
    } else {
      result.success = false;
      result.error = prettifyResult.error;
    }
  }

  if (shouldSaveTextActions) {
    const textActionResult = await deps.setTextActionSettings(input.textActionSettings);
    if (textActionResult.success && textActionResult.settings) {
      result.textActionSettings = textActionResult.settings;
      result.textActionSettingsSaved = true;
    } else {
      result.success = false;
      result.error = textActionResult.error;
    }
  }

  if (shouldSaveCloakBrowser) {
    const cloakResult = await deps.saveCloakBrowserSettings(createCloakBrowserSettingsInput(input.settings));
    if (cloakResult.success && cloakResult.settings) {
      result.settings = createEditableSettings(cloakResult.settings);
      result.settingsSaved = true;
    } else {
      result.success = false;
      result.error = cloakResult.error;
      if (cloakResult.settings) {
        result.settings = createEditableSettings(cloakResult.settings);
      }
    }
  }

  return result;
}
