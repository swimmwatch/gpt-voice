import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext } from 'playwright-core';
import type { CloakBrowserSettingsRepository, CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';

import {
  BaseTranslateProvider,
  TRANSLATION_RESULT_POLL_INTERVAL_MS,
  TRANSLATION_RESULT_STABILITY_DELAY_MS,
  TRANSLATION_RESULT_TIMEOUT_MS,
  type BaseTranslateProviderDependencies,
} from './BaseTranslateProvider';
import { BingTranslateProvider, type BingTranslatePageAdapterFactory } from './BingTranslateProvider';
import { GoogleTranslateProvider, type GoogleTranslatePageAdapterFactory } from './GoogleTranslateProvider';
import type { TranslationBrowserResourceCoordinator } from './TranslationBrowserResourceCoordinator';
import { YandexTranslateProvider, type YandexTranslatePageAdapterFactory } from './YandexTranslateProvider';
import {
  TRANSLATION_PROVIDER_INFO,
  type TranslationProviderId,
  type TranslationProviderInfo,
} from '@shared/translationProvider';

export interface TranslationProviderFactoryDependencies {
  readonly browserResources: TranslationBrowserResourceCoordinator;
  readonly cloakBrowserSettings: Pick<CloakBrowserSettingsRepository, 'getWithSecret'>;
  readonly createBingPageAdapter: BingTranslatePageAdapterFactory;
  readonly createContext: (options: LaunchContextOptions) => Promise<BrowserContext>;
  readonly createContextOptions: (settings: CloakBrowserSettingsWithSecret) => LaunchContextOptions;
  readonly createGooglePageAdapter: GoogleTranslatePageAdapterFactory;
  readonly createYandexPageAdapter: YandexTranslatePageAdapterFactory;
  readonly now: () => number;
  readonly sleep: (delayMs: number) => Promise<void>;
}

/** Explicit exhaustive construction boundary for Translation providers. */
export class TranslationProviderFactory {
  private readonly browserResources: TranslationBrowserResourceCoordinator;

  public constructor(private readonly dependencies: TranslationProviderFactoryDependencies) {
    this.browserResources = dependencies.browserResources;
  }

  public create(providerId: TranslationProviderId): BaseTranslateProvider {
    const baseDependencies = this.createBaseDependencies();
    switch (providerId) {
      case 'google':
        return new GoogleTranslateProvider({
          ...baseDependencies,
          createPageAdapter: this.dependencies.createGooglePageAdapter,
        });
      case 'bing':
        return new BingTranslateProvider({
          ...baseDependencies,
          createPageAdapter: this.dependencies.createBingPageAdapter,
        });
      case 'yandex':
        return new YandexTranslateProvider({
          ...baseDependencies,
          createPageAdapter: this.dependencies.createYandexPageAdapter,
        });
    }
  }

  public getProviderInfo(providerId: TranslationProviderId): TranslationProviderInfo {
    return TRANSLATION_PROVIDER_INFO[providerId];
  }

  private createBaseDependencies(): BaseTranslateProviderDependencies {
    return {
      browserResources: this.browserResources,
      cloakBrowserSettings: this.dependencies.cloakBrowserSettings,
      createContext: this.dependencies.createContext,
      createContextOptions: this.dependencies.createContextOptions,
      now: this.dependencies.now,
      resultPollIntervalMs: TRANSLATION_RESULT_POLL_INTERVAL_MS,
      resultStabilityDelayMs: TRANSLATION_RESULT_STABILITY_DELAY_MS,
      resultTimeoutMs: TRANSLATION_RESULT_TIMEOUT_MS,
      sleep: this.dependencies.sleep,
    };
  }
}
