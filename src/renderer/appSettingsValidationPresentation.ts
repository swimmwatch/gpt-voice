import type { TranslationKey } from '@main/i18n';
import type {
  AppSettingsFieldErrors,
  AppSettingsFieldKey,
  AppSettingsValidationError,
  AppSettingsValidationErrorCode,
} from '@renderer/appSettingsUtils';

const VALIDATION_TRANSLATION_KEYS = {
  'prettify-temperature-range': 'appSettings.validation.temperatureRange',
  'prettify-top-p-range': 'appSettings.validation.topPRange',
  'prettify-top-k-range': 'appSettings.validation.topKRange',
  'prettify-min-p-range': 'appSettings.validation.minPRange',
  'prettify-repeat-penalty-range': 'appSettings.validation.repeatPenaltyRange',
  'prettify-max-output-tokens-range': 'appSettings.validation.maxOutputTokensRange',
  'prettify-seed-range': 'appSettings.validation.seedRange',
  'prettify-base-url-required': 'appSettings.validation.baseUrlRequired',
  'prettify-base-url-invalid': 'appSettings.validation.baseUrlInvalid',
  'prettify-base-url-credentials': 'appSettings.validation.baseUrlCredentials',
  'prettify-base-url-insecure-remote': 'appSettings.validation.baseUrlInsecureRemote',
  'prettify-model-required': 'appSettings.validation.modelRequired',
  'prettify-model-unavailable': 'prettify.noModels',
  'prettify-executable-path-invalid': 'appSettings.validation.executablePathInvalid',
  'prettify-claude-model-invalid': 'appSettings.validation.claudeModelInvalid',
  'prettify-claude-fallback-model-invalid': 'appSettings.validation.claudeFallbackModelInvalid',
  'prettify-claude-effort-invalid': 'appSettings.validation.claudeEffortInvalid',
  'prettify-cli-timeout-range': 'appSettings.validation.cliTimeoutRange',
  'prettify-codex-model-invalid': 'appSettings.validation.codexModelInvalid',
  'prettify-codex-reasoning-invalid': 'appSettings.validation.codexReasoningInvalid',
  'prettify-codex-verbosity-invalid': 'appSettings.validation.codexVerbosityInvalid',
  'prettify-prompt-required': 'appSettings.validation.promptRequired',
  'prettify-prompt-too-long': 'appSettings.validation.promptTooLong',
  'prettify-provider-invalid': 'appSettings.validation.providerInvalid',
  'locale-required': 'appSettings.validation.localeRequired',
  'locale-unsupported': 'appSettings.validation.localeUnsupported',
  'timezone-required': 'appSettings.validation.timezoneRequired',
  'timezone-unsupported': 'appSettings.validation.timezoneUnsupported',
  'proxy-server-required': 'appSettings.validation.proxyServerRequired',
  'proxy-protocol-invalid': 'appSettings.validation.proxyProtocolInvalid',
  'proxy-credentials-in-url': 'appSettings.validation.proxyCredentialsInUrl',
  'proxy-url-invalid': 'appSettings.validation.proxyUrlInvalid',
  'proxy-socks5-credentials-unsupported': 'appSettings.validation.proxySocks5CredentialsUnsupported',
  'human-preset-invalid': 'appSettings.validation.humanPresetInvalid',
  'background-mode-invalid': 'appSettings.validation.backgroundModeInvalid',
  'fingerprint-seed-required': 'appSettings.validation.fingerprintSeedRequired',
  'fingerprint-seed-digits': 'appSettings.validation.fingerprintSeedDigits',
} as const satisfies Record<AppSettingsValidationErrorCode, TranslationKey>;

type TranslateValidationError = (key: TranslationKey, params?: Record<string, string>) => string;

export function presentAppSettingsValidationError(
  error: AppSettingsValidationError | undefined,
  t: TranslateValidationError,
): string | undefined {
  return error ? t(VALIDATION_TRANSLATION_KEYS[error.code], error.params) : undefined;
}

export function presentAppSettingsFieldErrors(
  errors: AppSettingsFieldErrors,
  t: TranslateValidationError,
): Partial<Record<AppSettingsFieldKey, string>> {
  const messages: Partial<Record<AppSettingsFieldKey, string>> = {};
  for (const [field, error] of Object.entries(errors) as Array<
    [AppSettingsFieldKey, AppSettingsValidationError | undefined]
  >) {
    const message = presentAppSettingsValidationError(error, t);
    if (message) messages[field] = message;
  }
  return messages;
}
