import { BaseTranslateProvider } from '@main/translateProviders/BaseTranslateProvider';
import { BingTranslateProvider } from '@main/translateProviders/BingTranslateProvider';
import { GoogleTranslateProvider } from '@main/translateProviders/GoogleTranslateProvider';
import { YandexTranslateProvider } from '@main/translateProviders/YandexTranslateProvider';
import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  isTranslationProviderId,
  type TranslationProviderId,
  type TranslationProviderInfo,
} from '@shared/translationProvider';

export interface TranslationProviderDefinition {
  readonly factory: () => BaseTranslateProvider;
  readonly info: TranslationProviderInfo;
}

export type TranslationProviderDefinitions = Readonly<Record<TranslationProviderId, TranslationProviderDefinition>>;

export const TRANSLATION_PROVIDER_DEFINITIONS: TranslationProviderDefinitions = Object.freeze({
  google: Object.freeze({
    factory: () => new GoogleTranslateProvider(),
    info: TRANSLATION_PROVIDER_INFO.google,
  }),
  bing: Object.freeze({
    factory: () => new BingTranslateProvider(),
    info: TRANSLATION_PROVIDER_INFO.bing,
  }),
  yandex: Object.freeze({
    factory: () => new YandexTranslateProvider(),
    info: TRANSLATION_PROVIDER_INFO.yandex,
  }),
});

/** Exhaustive lazy owner for one reusable translation provider instance per provider ID. */
export class TranslationProviderRegistry {
  private readonly instances = new Map<TranslationProviderId, BaseTranslateProvider>();

  constructor(private readonly definitions: TranslationProviderDefinitions = TRANSLATION_PROVIDER_DEFINITIONS) {}

  getAvailableProviderInfo(): readonly TranslationProviderInfo[] {
    return Object.freeze(TRANSLATION_PROVIDER_IDS.map((providerId) => this.definitions[providerId].info));
  }

  getProvider(providerId: unknown): BaseTranslateProvider {
    if (!isTranslationProviderId(providerId)) {
      throw new Error('Unknown translation provider');
    }
    const current = this.instances.get(providerId);
    if (current) return current;

    const definition = this.definitions[providerId];
    const provider = definition.factory();
    if (
      !(provider instanceof BaseTranslateProvider) ||
      provider.info !== definition.info ||
      provider.info.id !== providerId
    ) {
      throw new Error('Invalid translation provider definition');
    }
    this.instances.set(providerId, provider);
    return provider;
  }

  async shutdown(): Promise<void> {
    const providers = [...this.instances.values()];
    this.instances.clear();
    await Promise.all(providers.map(async (provider) => provider.shutdown()));
  }
}

export const translationProviderRegistry = new TranslationProviderRegistry();
