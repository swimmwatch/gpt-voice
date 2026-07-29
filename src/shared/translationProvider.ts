import { BING_TRANSLATION_LANGUAGES } from '@shared/translationLanguages/bing';
import { GOOGLE_TRANSLATION_LANGUAGES } from '@shared/translationLanguages/google';
import { YANDEX_TRANSLATION_LANGUAGES } from '@shared/translationLanguages/yandex';

export const TRANSLATION_PROVIDER_IDS = ['google', 'bing', 'yandex'] as const;

export type TranslationProviderId = (typeof TRANSLATION_PROVIDER_IDS)[number];
export type TranslationProviderName = 'Google' | 'Bing' | 'Yandex';

export interface TranslationLanguage {
  readonly code: string;
  readonly providerLabel: string;
}

export interface TranslationProviderInfo {
  readonly id: TranslationProviderId;
  readonly name: TranslationProviderName;
  readonly contractVersion: string;
  readonly defaultTargetLanguage: string;
  readonly maxInputCharacters: number;
  readonly targetLanguages: readonly TranslationLanguage[];
}

export interface TranslationSettings {
  readonly providerId: TranslationProviderId;
  readonly targetLanguageByProvider: Record<TranslationProviderId, string>;
}

export interface TranslationSettingsSaveResult {
  readonly error?: string;
  readonly settings: TranslationSettings;
  readonly success: boolean;
}

export const TRANSLATION_PROVIDER_CONNECTION_STATUSES = {
  Checking: 'checking',
  Connected: 'connected',
  NotConnected: 'not-connected',
} as const;

export type TranslationProviderConnectionStatus =
  (typeof TRANSLATION_PROVIDER_CONNECTION_STATUSES)[keyof typeof TRANSLATION_PROVIDER_CONNECTION_STATUSES];

export const TRANSLATION_PROVIDER_CONNECTION_DETAILS = {
  Cancelled: 'cancelled',
  CleanupFailed: 'cleanup-failed',
  ConsentOrChallenge: 'consent-or-challenge',
  InvalidSettings: 'invalid-settings',
  NavigationFailed: 'navigation-failed',
  NotStarted: 'not-started',
  OpeningProvider: 'opening-provider',
  PageChanged: 'page-changed',
  Ready: 'ready',
  TranslationDisabled: 'translation-disabled',
  UnexpectedFailure: 'unexpected-failure',
} as const;

export type TranslationProviderConnectionDetail =
  (typeof TRANSLATION_PROVIDER_CONNECTION_DETAILS)[keyof typeof TRANSLATION_PROVIDER_CONNECTION_DETAILS];

export interface TranslationProviderConnectionState {
  readonly detail: TranslationProviderConnectionDetail;
  readonly providerId: TranslationProviderId | null;
  readonly status: TranslationProviderConnectionStatus;
  readonly targetLanguage: string | null;
}

export const TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS = {
  changed: 'translation-provider-connection-changed',
  get: 'get-translation-provider-connection',
} as const;

export const INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE: TranslationProviderConnectionState = Object.freeze({
  detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.NotStarted,
  providerId: null,
  status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
  targetLanguage: null,
});

const TRANSLATION_PROVIDER_CONNECTION_STATE_KEYS = ['detail', 'providerId', 'status', 'targetLanguage'] as const;

export const TRANSLATION_PROVIDER_INFO = Object.freeze({
  google: {
    id: 'google',
    name: 'Google',
    contractVersion: '2026-07-25',
    defaultTargetLanguage: 'en',
    maxInputCharacters: 5_000,
    targetLanguages: GOOGLE_TRANSLATION_LANGUAGES,
  },
  bing: {
    id: 'bing',
    name: 'Bing',
    contractVersion: '2026-07-25',
    defaultTargetLanguage: 'en',
    maxInputCharacters: 1_000,
    targetLanguages: BING_TRANSLATION_LANGUAGES,
  },
  yandex: {
    id: 'yandex',
    name: 'Yandex',
    contractVersion: '2026-07-25',
    defaultTargetLanguage: 'en',
    maxInputCharacters: 10_000,
    targetLanguages: YANDEX_TRANSLATION_LANGUAGES,
  },
} as const satisfies Readonly<Record<TranslationProviderId, TranslationProviderInfo>>);

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = Object.freeze({
  providerId: 'google',
  targetLanguageByProvider: Object.freeze({
    google: TRANSLATION_PROVIDER_INFO.google.defaultTargetLanguage,
    bing: TRANSLATION_PROVIDER_INFO.bing.defaultTargetLanguage,
    yandex: TRANSLATION_PROVIDER_INFO.yandex.defaultTargetLanguage,
  }),
});

export function isTranslationProviderId(value: unknown): value is TranslationProviderId {
  return typeof value === 'string' && TRANSLATION_PROVIDER_IDS.some((providerId) => providerId === value);
}

export function getTranslationProviderInfo(providerId: unknown): TranslationProviderInfo | undefined {
  return isTranslationProviderId(providerId) ? TRANSLATION_PROVIDER_INFO[providerId] : undefined;
}

export function getTranslationLanguage(providerId: unknown, code: unknown): TranslationLanguage | undefined {
  const provider = getTranslationProviderInfo(providerId);
  if (!provider || typeof code !== 'string') return undefined;
  return provider.targetLanguages.find((language) => language.code === code);
}

export function isTranslationTargetLanguage(providerId: unknown, code: unknown): code is string {
  return getTranslationLanguage(providerId, code) !== undefined;
}

export function isTranslationProviderConnectionState(value: unknown): value is TranslationProviderConnectionState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    keys.length !== TRANSLATION_PROVIDER_CONNECTION_STATE_KEYS.length ||
    !keys.every((key) => (TRANSLATION_PROVIDER_CONNECTION_STATE_KEYS as readonly string[]).includes(key))
  ) {
    return false;
  }
  if (
    !Object.values(TRANSLATION_PROVIDER_CONNECTION_STATUSES).includes(
      candidate.status as TranslationProviderConnectionStatus,
    ) ||
    !Object.values(TRANSLATION_PROVIDER_CONNECTION_DETAILS).includes(
      candidate.detail as TranslationProviderConnectionDetail,
    )
  ) {
    return false;
  }

  const validSelection =
    candidate.providerId === null
      ? candidate.targetLanguage === null
      : isTranslationProviderId(candidate.providerId) &&
        isTranslationTargetLanguage(candidate.providerId, candidate.targetLanguage);
  if (!validSelection) return false;

  switch (candidate.status) {
    case TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking:
      return candidate.detail === TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider;
    case TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected:
      return candidate.detail === TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready;
    case TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected:
      return (
        candidate.detail !== TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider &&
        candidate.detail !== TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready
      );
    default:
      return false;
  }
}

export function sanitizeTranslationProviderConnectionState(value: unknown): TranslationProviderConnectionState {
  return isTranslationProviderConnectionState(value)
    ? Object.freeze({ ...value })
    : INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE;
}
