import {
  CLOAK_BROWSER_BACKGROUND_MODES,
  CLOAK_BROWSER_HUMAN_PRESETS,
  CLOAK_BROWSER_LOCALE_VALUES,
  isSocks5ProxyServer,
  type CloakBrowserSettingsInput,
  type CloakBrowserSettingsView,
} from '@shared/cloakBrowserSettings';
import {
  MAX_PRETTIFY_PROMPT_LENGTH,
  getPrettifyBaseUrlValidationError,
  isPrettifyProviderId,
  type PrettifySettings,
  type PrettifySettingsInput,
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
  | 'humanPreset'
  | 'backgroundMode'
  | 'fingerprintSeed'
  | 'locale'
  | 'timezone'
  | 'proxyServer'
  | 'proxyBypass'
  | 'proxyUsername'
  | 'proxyPassword';

export type AppSettingsFieldErrors = Partial<Record<AppSettingsFieldKey, string>>;

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
  initialPrettifySettings: PrettifySettings;
  initialSettings: EditableCloakBrowserSettings;
  initialTextActionSettings: TextActionSettings;
  localeValues?: readonly string[];
  prettifySettings: PrettifySettings;
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

export interface AppSettingsLogSummary {
  changedGroups: AppSettingsChangedGroup[];
  changedFields: string[];
  prettifyPromptChanged: boolean;
  prettifyPromptLength: number;
  prettifyProviderId: PrettifySettings['providerId'];
  prettifyModel: string;
  prettifyTemperature: number;
  prettifyTopP: number;
  prettifyTopK: number;
  prettifyMinP: number;
  prettifyRepeatPenalty: number;
  prettifyMaxOutputTokens: number;
  prettifyHasSeed: boolean;
  prettifyHasVllmApiKey: boolean;
  prettifyVllmApiKeyUpdated: boolean;
  prettifyVllmApiKeyCleared: boolean;
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

function getActivePrettifyProviderSettings(settings: PrettifySettings) {
  return settings.providerId === 'vllm' ? settings.vllm : settings.ollama;
}

function hasVllmApiKeyUpdate(settings: PrettifySettings): boolean {
  return Boolean(settings.vllm.apiKey?.trim());
}

function hasVllmApiKeyChange(settings: PrettifySettings, initialSettings: PrettifySettings): boolean {
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
  return collectChangedFields([
    [current.prompt !== initial.prompt, 'prettifyPrompt'],
    [current.providerId !== initial.providerId, 'prettifyProvider'],
    [current.temperature !== initial.temperature, 'prettifyTemperature'],
    [current.topP !== initial.topP, 'prettifyTopP'],
    [current.topK !== initial.topK, 'prettifyTopK'],
    [current.minP !== initial.minP, 'prettifyMinP'],
    [current.repeatPenalty !== initial.repeatPenalty, 'prettifyRepeatPenalty'],
    [current.maxOutputTokens !== initial.maxOutputTokens, 'prettifyMaxOutputTokens'],
    [current.seed !== initial.seed, 'prettifySeed'],
    [current.ollama.baseUrl !== initial.ollama.baseUrl, 'prettifyBaseUrl'],
    [current.ollama.model !== initial.ollama.model, 'prettifyModel'],
    [current.vllm.baseUrl !== initial.vllm.baseUrl, 'prettifyBaseUrl'],
    [current.vllm.model !== initial.vllm.model, 'prettifyModel'],
    [hasVllmApiKeyChange(current, initial), 'prettifyApiKey'],
  ]);
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

// Logging each setting explicitly keeps secrets excluded while preserving an auditable list of user-visible changes.
export function createAppSettingsLogSummary(input: AppSettingsSaveInput): AppSettingsLogSummary {
  const changedGroups: AppSettingsChangedGroup[] = [];
  const changedFields: string[] = [];
  appendChangedGroup(changedGroups, changedFields, 'prettify', collectPrettifyChangedFields(input));
  appendChangedGroup(changedGroups, changedFields, 'textActions', collectTextActionChangedFields(input));
  appendChangedGroup(changedGroups, changedFields, 'cloakBrowser', collectCloakBrowserChangedFields(input));

  return {
    changedGroups,
    changedFields,
    prettifyPromptChanged: input.prettifySettings.prompt !== input.initialPrettifySettings.prompt,
    prettifyPromptLength: input.prettifySettings.prompt.length,
    prettifyProviderId: input.prettifySettings.providerId,
    prettifyModel: getActivePrettifyProviderSettings(input.prettifySettings).model,
    prettifyTemperature: input.prettifySettings.temperature,
    prettifyTopP: input.prettifySettings.topP,
    prettifyTopK: input.prettifySettings.topK,
    prettifyMinP: input.prettifySettings.minP,
    prettifyRepeatPenalty: input.prettifySettings.repeatPenalty,
    prettifyMaxOutputTokens: input.prettifySettings.maxOutputTokens,
    prettifyHasSeed: input.prettifySettings.seed !== null,
    prettifyHasVllmApiKey: input.prettifySettings.vllm.hasApiKey,
    prettifyVllmApiKeyUpdated: hasVllmApiKeyUpdate(input.prettifySettings),
    prettifyVllmApiKeyCleared: Boolean(input.prettifySettings.vllm.clearApiKey),
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
  prettifySettings: PrettifySettings;
  settings: EditableCloakBrowserSettings;
  timezoneValues?: readonly string[];
}

function addNumericPrettifyErrors(settings: PrettifySettings, errors: AppSettingsFieldErrors): void {
  const numericRules: Array<[AppSettingsFieldKey, boolean, string]> = [
    [
      'prettifyTemperature',
      Number.isFinite(settings.temperature) && settings.temperature >= 0 && settings.temperature <= 1,
      'Temperature must be between 0 and 1',
    ],
    [
      'prettifyTopP',
      Number.isFinite(settings.topP) && settings.topP >= 0.05 && settings.topP <= 1,
      'Top P must be between 0.05 and 1',
    ],
    [
      'prettifyTopK',
      Number.isInteger(settings.topK) && settings.topK >= 1 && settings.topK <= 200,
      'Top K must be an integer between 1 and 200',
    ],
    [
      'prettifyMinP',
      Number.isFinite(settings.minP) && settings.minP >= 0 && settings.minP <= 1,
      'Min P must be between 0 and 1',
    ],
    [
      'prettifyRepeatPenalty',
      Number.isFinite(settings.repeatPenalty) && settings.repeatPenalty >= 0.8 && settings.repeatPenalty <= 1.5,
      'Repeat penalty must be between 0.8 and 1.5',
    ],
    [
      'prettifyMaxOutputTokens',
      Number.isInteger(settings.maxOutputTokens) && settings.maxOutputTokens >= 1 && settings.maxOutputTokens <= 8192,
      'Max output tokens must be an integer between 1 and 8192',
    ],
    [
      'prettifySeed',
      settings.seed === null ||
        (Number.isInteger(settings.seed) && settings.seed >= 0 && settings.seed <= 2_147_483_647),
      'Seed must be empty or an integer between 0 and 2147483647',
    ],
  ];
  for (const [field, valid, message] of numericRules) {
    if (!valid) errors[field] = message;
  }
}

function validatePrettifySettings(settings: PrettifySettings, errors: AppSettingsFieldErrors): void {
  const prompt = settings.prompt.trim();
  if (!prompt) errors.prettifyPrompt = 'Prettify prompt is required';
  else if (prompt.length > MAX_PRETTIFY_PROMPT_LENGTH) {
    errors.prettifyPrompt = `Prettify prompt must be at most ${MAX_PRETTIFY_PROMPT_LENGTH} characters`;
  }
  if (!isPrettifyProviderId(settings.providerId)) errors.prettifyProvider = 'Select a supported provider';
  addNumericPrettifyErrors(settings, errors);

  const provider = getActivePrettifyProviderSettings(settings);
  if (!provider.baseUrl.trim()) errors.prettifyBaseUrl = 'Base URL is required';
  else {
    const baseUrlError = getPrettifyBaseUrlValidationError(provider.baseUrl);
    if (baseUrlError) errors.prettifyBaseUrl = baseUrlError;
  }
  if (!provider.model.trim()) errors.prettifyModel = 'Select a model';
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
  if (!locale) errors.locale = 'Locale is required';
  else if (!localeValues.includes(locale)) errors.locale = 'Select a supported locale';
  if (!timezone) errors.timezone = 'Timezone is required';
  else if (!timezoneValues.includes(timezone)) errors.timezone = 'Select a supported timezone';
}

function validateProxy(settings: EditableCloakBrowserSettings, errors: AppSettingsFieldErrors): void {
  if (!settings.proxy.enabled) return;
  const server = settings.proxy.server.trim();
  if (!server) {
    errors.proxyServer = 'Proxy server is required when proxy is enabled';
    return;
  }

  try {
    const proxyUrl = new URL(server);
    if (!SUPPORTED_PROXY_PROTOCOLS.has(proxyUrl.protocol)) {
      errors.proxyServer = 'Proxy server must use http, https, or socks5';
    } else if (proxyUrl.username || proxyUrl.password) {
      errors.proxyServer = 'Proxy credentials must be stored in username and password fields';
    }
  } catch {
    errors.proxyServer = 'Proxy server must be a valid URL';
  }

  if (!isSocks5ProxyServer(server)) return;
  const socks5Error = 'SOCKS5 proxy username/password is not supported';
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
    errors.humanPreset = 'Select a supported human preset';
  }
  if (!CLOAK_BROWSER_BACKGROUND_MODES.includes(settings.backgroundMode)) {
    errors.backgroundMode = 'Select a supported background mode';
  }
  const fingerprintSeed = settings.fingerprintSeed.trim();
  if (!fingerprintSeed) errors.fingerprintSeed = 'Fingerprint seed is required';
  else if (!FINGERPRINT_SEED_PATTERN.test(fingerprintSeed))
    errors.fingerprintSeed = 'Fingerprint seed must contain digits only';
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
    isDirty: createAppSettingsLogSummary(input).changedGroups.length > 0,
    isValid: !hasAppSettingsFieldErrors(validationErrors),
    validationErrors,
  };
}

export function arePrettifySettingsEqual(left: PrettifySettings, right: PrettifySettings): boolean {
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
