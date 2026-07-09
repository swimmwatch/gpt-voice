import {
  CLOAK_BROWSER_BACKGROUND_MODES,
  CLOAK_BROWSER_HUMAN_PRESETS,
  CLOAK_BROWSER_LOCALE_VALUES,
  isSocks5ProxyServer,
  type CloakBrowserSettingsInput,
  type CloakBrowserSettingsView,
} from '@shared/cloakBrowserSettings';
import { isPrettifyProviderId, type PrettifySettings, type PrettifySettingsInput } from '@shared/prettifySettings';
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

export function createAppSettingsLogSummary(input: AppSettingsSaveInput): AppSettingsLogSummary {
  const changedGroups: AppSettingsChangedGroup[] = [];
  const changedFields: string[] = [];

  if (input.prettifySettings.prompt !== input.initialPrettifySettings.prompt) {
    changedFields.push('prettifyPrompt');
  }
  if (input.prettifySettings.providerId !== input.initialPrettifySettings.providerId) {
    changedFields.push('prettifyProvider');
  }
  if (input.prettifySettings.temperature !== input.initialPrettifySettings.temperature) {
    changedFields.push('prettifyTemperature');
  }
  if (input.prettifySettings.topP !== input.initialPrettifySettings.topP) {
    changedFields.push('prettifyTopP');
  }
  if (input.prettifySettings.topK !== input.initialPrettifySettings.topK) {
    changedFields.push('prettifyTopK');
  }
  if (input.prettifySettings.minP !== input.initialPrettifySettings.minP) {
    changedFields.push('prettifyMinP');
  }
  if (input.prettifySettings.repeatPenalty !== input.initialPrettifySettings.repeatPenalty) {
    changedFields.push('prettifyRepeatPenalty');
  }
  if (input.prettifySettings.maxOutputTokens !== input.initialPrettifySettings.maxOutputTokens) {
    changedFields.push('prettifyMaxOutputTokens');
  }
  if (input.prettifySettings.seed !== input.initialPrettifySettings.seed) {
    changedFields.push('prettifySeed');
  }
  if (input.prettifySettings.ollama.baseUrl !== input.initialPrettifySettings.ollama.baseUrl) {
    changedFields.push('prettifyBaseUrl');
  }
  if (input.prettifySettings.ollama.model !== input.initialPrettifySettings.ollama.model) {
    changedFields.push('prettifyModel');
  }
  if (input.prettifySettings.vllm.baseUrl !== input.initialPrettifySettings.vllm.baseUrl) {
    changedFields.push('prettifyBaseUrl');
  }
  if (input.prettifySettings.vllm.model !== input.initialPrettifySettings.vllm.model) {
    changedFields.push('prettifyModel');
  }
  if (hasVllmApiKeyChange(input.prettifySettings, input.initialPrettifySettings)) {
    changedFields.push('prettifyApiKey');
  }
  if (changedFields.length > 0) {
    changedGroups.push('prettify');
  }

  const textActionFieldStart = changedFields.length;
  if (input.textActionSettings.translateEnabled !== input.initialTextActionSettings.translateEnabled) {
    changedFields.push('translateEnabled');
  }
  if (input.textActionSettings.prettifyEnabled !== input.initialTextActionSettings.prettifyEnabled) {
    changedFields.push('prettifyEnabled');
  }
  if (changedFields.length > textActionFieldStart) {
    changedGroups.push('textActions');
  }

  const cloakBrowserFieldStart = changedFields.length;
  if (input.settings.humanize !== input.initialSettings.humanize) changedFields.push('humanize');
  if (input.settings.humanPreset !== input.initialSettings.humanPreset) changedFields.push('humanPreset');
  if (input.settings.backgroundMode !== input.initialSettings.backgroundMode) changedFields.push('backgroundMode');
  if (input.settings.fingerprintSeed !== input.initialSettings.fingerprintSeed) changedFields.push('fingerprintSeed');
  if (input.settings.locale !== input.initialSettings.locale) changedFields.push('locale');
  if (input.settings.timezone !== input.initialSettings.timezone) changedFields.push('timezone');
  if (input.settings.proxy.enabled !== input.initialSettings.proxy.enabled) changedFields.push('proxyEnabled');
  if (input.settings.proxy.server !== input.initialSettings.proxy.server) changedFields.push('proxyServer');
  if (input.settings.proxy.bypass !== input.initialSettings.proxy.bypass) changedFields.push('proxyBypass');
  if (input.settings.proxy.username !== input.initialSettings.proxy.username) changedFields.push('proxyUsername');
  if (input.settings.proxy.geoip !== input.initialSettings.proxy.geoip) changedFields.push('proxyGeoip');
  if (
    input.settings.proxy.hasPassword !== input.initialSettings.proxy.hasPassword ||
    Boolean(input.settings.proxy.password.trim()) ||
    input.settings.proxy.clearPassword
  ) {
    changedFields.push('proxyPassword');
  }
  if (changedFields.length > cloakBrowserFieldStart) {
    changedGroups.push('cloakBrowser');
  }

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

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
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

export function validateAppSettings(input: ValidateAppSettingsInput): AppSettingsFieldErrors {
  const fieldErrors: AppSettingsFieldErrors = {};
  const { prettifySettings, settings } = input;
  const localeValues = input.localeValues ?? getCloakBrowserLocaleOptions(settings.locale);
  const timezoneValues = input.timezoneValues ?? getCloakBrowserTimezoneOptions(settings.timezone);
  const proxyServer = settings.proxy.server.trim();
  const proxyUsername = settings.proxy.username.trim();
  const proxyPassword = settings.proxy.password.trim();

  if (!prettifySettings.prompt.trim()) {
    fieldErrors.prettifyPrompt = 'Prettify prompt is required';
  }
  if (!isPrettifyProviderId(prettifySettings.providerId)) {
    fieldErrors.prettifyProvider = 'Select a supported provider';
  }
  if (
    !Number.isFinite(prettifySettings.temperature) ||
    prettifySettings.temperature < 0 ||
    prettifySettings.temperature > 1
  ) {
    fieldErrors.prettifyTemperature = 'Temperature must be between 0 and 1';
  }
  if (!Number.isFinite(prettifySettings.topP) || prettifySettings.topP < 0.05 || prettifySettings.topP > 1) {
    fieldErrors.prettifyTopP = 'Top P must be between 0.05 and 1';
  }
  if (!Number.isInteger(prettifySettings.topK) || prettifySettings.topK < 1 || prettifySettings.topK > 200) {
    fieldErrors.prettifyTopK = 'Top K must be an integer between 1 and 200';
  }
  if (!Number.isFinite(prettifySettings.minP) || prettifySettings.minP < 0 || prettifySettings.minP > 1) {
    fieldErrors.prettifyMinP = 'Min P must be between 0 and 1';
  }
  if (
    !Number.isFinite(prettifySettings.repeatPenalty) ||
    prettifySettings.repeatPenalty < 0.8 ||
    prettifySettings.repeatPenalty > 1.5
  ) {
    fieldErrors.prettifyRepeatPenalty = 'Repeat penalty must be between 0.8 and 1.5';
  }
  if (
    !Number.isInteger(prettifySettings.maxOutputTokens) ||
    prettifySettings.maxOutputTokens < 0 ||
    prettifySettings.maxOutputTokens > 8192
  ) {
    fieldErrors.prettifyMaxOutputTokens = 'Max output tokens must be an integer between 0 and 8192';
  }
  if (
    prettifySettings.seed !== null &&
    (!Number.isInteger(prettifySettings.seed) || prettifySettings.seed < 0 || prettifySettings.seed > 2_147_483_647)
  ) {
    fieldErrors.prettifySeed = 'Seed must be empty or an integer between 0 and 2147483647';
  }
  const activePrettifyProviderSettings = getActivePrettifyProviderSettings(prettifySettings);
  if (!activePrettifyProviderSettings.baseUrl.trim()) {
    fieldErrors.prettifyBaseUrl = 'Base URL is required';
  } else if (!isValidHttpUrl(activePrettifyProviderSettings.baseUrl.trim())) {
    fieldErrors.prettifyBaseUrl = 'Base URL must be a valid http or https URL';
  }
  if (!activePrettifyProviderSettings.model.trim()) {
    fieldErrors.prettifyModel = 'Select a model';
  }
  if (!CLOAK_BROWSER_HUMAN_PRESETS.includes(settings.humanPreset)) {
    fieldErrors.humanPreset = 'Select a supported human preset';
  }
  if (!CLOAK_BROWSER_BACKGROUND_MODES.includes(settings.backgroundMode)) {
    fieldErrors.backgroundMode = 'Select a supported background mode';
  }
  if (!settings.fingerprintSeed.trim()) {
    fieldErrors.fingerprintSeed = 'Fingerprint seed is required';
  } else if (!FINGERPRINT_SEED_PATTERN.test(settings.fingerprintSeed.trim())) {
    fieldErrors.fingerprintSeed = 'Fingerprint seed must contain digits only';
  }

  if (!(settings.proxy.enabled && settings.proxy.geoip)) {
    if (!settings.locale.trim()) {
      fieldErrors.locale = 'Locale is required';
    } else if (!localeValues.includes(settings.locale.trim())) {
      fieldErrors.locale = 'Select a supported locale';
    }
    if (!settings.timezone.trim()) {
      fieldErrors.timezone = 'Timezone is required';
    } else if (!timezoneValues.includes(settings.timezone.trim())) {
      fieldErrors.timezone = 'Select a supported timezone';
    }
  }

  if (settings.proxy.enabled) {
    if (!proxyServer) {
      fieldErrors.proxyServer = 'Proxy server is required when proxy is enabled';
    } else {
      let proxyUrl: URL | null = null;
      try {
        proxyUrl = new URL(proxyServer);
      } catch {
        fieldErrors.proxyServer = 'Proxy server must be a valid URL';
      }

      if (proxyUrl) {
        if (!SUPPORTED_PROXY_PROTOCOLS.has(proxyUrl.protocol)) {
          fieldErrors.proxyServer = 'Proxy server must use http, https, or socks5';
        } else if (proxyUrl.username || proxyUrl.password) {
          fieldErrors.proxyServer = 'Proxy credentials must be stored in username and password fields';
        }
      }
    }

    if (isSocks5ProxyServer(proxyServer)) {
      const socks5Error = 'SOCKS5 proxy username/password is not supported';
      if (proxyUsername) {
        fieldErrors.proxyUsername = socks5Error;
      }
      if (proxyPassword || (settings.proxy.hasPassword && !settings.proxy.clearPassword)) {
        fieldErrors.proxyPassword = socks5Error;
      }
    }
  }

  return fieldErrors;
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
