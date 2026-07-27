import { normalizeProviderAuditExceptionType } from '@main/providerAudit';
import type { TranslationProviderAudit } from '@main/translateProviders/translationProviderAudit';
import type {
  TranslationProviderOutcome,
  TranslationProviderRequest,
} from '@main/translateProviders/translationProviderContracts';
import {
  TRANSLATION_PROVIDER_IDS,
  isTranslationProviderId,
  type TranslationProviderId,
  type TranslationProviderInfo,
} from '@shared/translationProvider';

export interface TranslationProviderShutdownResult {
  readonly failedProviderIds: readonly TranslationProviderId[];
  readonly success: boolean;
}

export interface TranslationProviderInstance {
  readonly info: TranslationProviderInfo;
  readonly shutdown: () => Promise<void>;
  readonly translate: (request: TranslationProviderRequest) => Promise<TranslationProviderOutcome>;
}

export interface TranslationProviderFactoryContract {
  create(providerId: TranslationProviderId): TranslationProviderInstance;
  getProviderInfo(providerId: TranslationProviderId): TranslationProviderInfo;
}

/** Exhaustive lazy owner for one reusable translation provider instance per provider ID. */
export class TranslationProviderRegistry {
  private readonly instances = new Map<TranslationProviderId, TranslationProviderInstance>();

  public constructor(
    private readonly factory: TranslationProviderFactoryContract,
    private readonly audit: TranslationProviderAudit,
    private readonly now: () => number,
  ) {}

  public getAvailableProviderInfo(): readonly TranslationProviderInfo[] {
    return Object.freeze(TRANSLATION_PROVIDER_IDS.map((providerId) => this.factory.getProviderInfo(providerId)));
  }

  public getProvider(providerId: unknown): TranslationProviderInstance {
    if (!isTranslationProviderId(providerId)) {
      throw new Error('Unknown translation provider');
    }
    const current = this.instances.get(providerId);
    if (current) return current;

    const provider = this.factory.create(providerId);
    const info = this.factory.getProviderInfo(providerId);
    if (
      provider.info !== info ||
      provider.info.id !== providerId ||
      typeof provider.shutdown !== 'function' ||
      typeof provider.translate !== 'function'
    ) {
      throw new Error('Invalid translation provider definition');
    }
    this.instances.set(providerId, provider);
    return provider;
  }

  public async shutdown(): Promise<TranslationProviderShutdownResult> {
    const providers = [...this.instances.entries()];
    const failedProviderIds = (
      await Promise.all(
        providers.map(async ([providerId, provider]) => {
          const startedAt = this.now();
          const info = this.factory.getProviderInfo(providerId);
          const startMetadata = this.audit.createMetadata({
            providerId,
            contractVersion: info.contractVersion,
            durationMs: 0,
            attemptCount: 1,
            phase: 'shutdown',
          });
          const auditLifecycle = this.audit.startOperation(providerId, 'shutdown', 'shutdown', startMetadata).lifecycle;
          try {
            await provider.shutdown();
            this.instances.delete(providerId);
            const terminalMetadata = this.audit.createMetadata({
              providerId,
              contractVersion: info.contractVersion,
              durationMs: Math.max(0, this.now() - startedAt),
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
              this.audit.createMetadata(
                {
                  providerId,
                  contractVersion: info.contractVersion,
                  durationMs: Math.max(0, this.now() - startedAt),
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

export { TranslationProviderFactory } from './translationProviderFactory';
export type { TranslationProviderFactoryDependencies } from './translationProviderFactory';
