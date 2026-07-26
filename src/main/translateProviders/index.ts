import { BaseTranslateProvider } from '@main/translateProviders/BaseTranslateProvider';
import { BingTranslateProvider } from '@main/translateProviders/BingTranslateProvider';
import { GoogleTranslateProvider } from '@main/translateProviders/GoogleTranslateProvider';
import { YandexTranslateProvider } from '@main/translateProviders/YandexTranslateProvider';
import { normalizeProviderAuditExceptionType } from '@main/providerAudit';
import {
  translationProviderAudit,
  type TranslationProviderAudit,
} from '@main/translateProviders/translationProviderAudit';
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

export interface TranslationProviderShutdownResult {
  readonly failedProviderIds: readonly TranslationProviderId[];
  readonly success: boolean;
}

export interface TranslationProviderRegistryDependencies {
  readonly audit: TranslationProviderAudit;
  readonly now: () => number;
}

const DEFAULT_REGISTRY_DEPENDENCIES: TranslationProviderRegistryDependencies = {
  audit: translationProviderAudit,
  now: Date.now,
};

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
  private readonly dependencies: TranslationProviderRegistryDependencies;

  constructor(
    private readonly definitions: TranslationProviderDefinitions = TRANSLATION_PROVIDER_DEFINITIONS,
    dependencies: Partial<TranslationProviderRegistryDependencies> = {},
  ) {
    this.dependencies = { ...DEFAULT_REGISTRY_DEPENDENCIES, ...dependencies };
  }

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

  async shutdown(): Promise<TranslationProviderShutdownResult> {
    const providers = [...this.instances.entries()];
    const failedProviderIds = (
      await Promise.all(
        providers.map(async ([providerId, provider]) => {
          const startedAt = this.dependencies.now();
          const startMetadata = this.dependencies.audit.createMetadata({
            providerId,
            contractVersion: this.definitions[providerId].info.contractVersion,
            durationMs: 0,
            attemptCount: 1,
            phase: 'shutdown',
          });
          const auditLifecycle = this.dependencies.audit.startOperation(
            providerId,
            'shutdown',
            'shutdown',
            startMetadata,
          ).lifecycle;
          try {
            await provider.shutdown();
            this.instances.delete(providerId);
            const terminalMetadata = this.dependencies.audit.createMetadata({
              providerId,
              contractVersion: this.definitions[providerId].info.contractVersion,
              durationMs: Math.max(0, this.dependencies.now() - startedAt),
              attemptCount: 1,
              phase: 'shutdown',
            });
            auditLifecycle.phaseCompleted('shutdown', terminalMetadata);
            auditLifecycle.terminal('shutdown', 'success', terminalMetadata);
            return null;
          } catch (error: unknown) {
            auditLifecycle.terminal(
              'shutdown',
              'failure',
              this.dependencies.audit.createMetadata(
                {
                  providerId,
                  contractVersion: this.definitions[providerId].info.contractVersion,
                  durationMs: Math.max(0, this.dependencies.now() - startedAt),
                  attemptCount: 1,
                  phase: 'shutdown',
                },
                {
                  causeCode: 'cleanupFailure',
                  exceptionType: normalizeProviderAuditExceptionType(error),
                  pageClosed: false,
                },
              ),
            );
            return providerId;
          }
        }),
      )
    ).filter((providerId): providerId is TranslationProviderId => providerId !== null);

    return Object.freeze({
      failedProviderIds: Object.freeze(failedProviderIds),
      success: failedProviderIds.length === 0,
    });
  }
}

export const translationProviderRegistry = new TranslationProviderRegistry();
