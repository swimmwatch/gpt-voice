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
