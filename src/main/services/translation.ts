import { getTranslationSettingsSnapshot } from '@main/config';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { translationProviderRegistry, type TranslationProviderShutdownResult } from '@main/translateProviders';
import type { BaseTranslateProvider } from '@main/translateProviders/BaseTranslateProvider';
import type {
  TranslationProviderFailure,
  TranslationProviderFailureCode,
  TranslationProviderOperationMetadata,
  TranslationProviderOutcome,
  TranslationProviderPhase,
} from '@main/translateProviders/translationProviderContracts';
import {
  getTranslationLanguage,
  getTranslationProviderInfo,
  type TranslationProviderId,
  type TranslationProviderName,
  type TranslationSettings,
} from '@shared/translationProvider';

const log = createLogger('translate');

export interface TranslationExecutionSnapshot {
  readonly contractVersion: string;
  readonly generation: number;
  readonly maxInputCharacters: number;
  readonly providerId: TranslationProviderId;
  readonly providerName: TranslationProviderName;
  readonly targetLanguage: string;
}

export type TranslationExecutionSnapshotResult =
  | {
      readonly success: true;
      readonly snapshot: TranslationExecutionSnapshot;
    }
  | TranslationProviderFailure;

export interface TranslationTextResult {
  readonly error?: string;
  readonly success: boolean;
  readonly text?: string;
}

export interface TranslationRuntimeRegistry {
  getProvider(providerId: unknown): Pick<BaseTranslateProvider, 'translate'>;
  shutdown(): Promise<TranslationProviderShutdownResult>;
}

export interface TranslationRuntimeDependencies {
  readonly getSettings: () => TranslationSettings;
  readonly now: () => number;
  readonly registry: TranslationRuntimeRegistry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createFailure(
  code: TranslationProviderFailureCode,
  phase: TranslationProviderPhase,
  startedAt: number,
  now: () => number,
  metadata: Partial<Omit<TranslationProviderOperationMetadata, 'attemptCount' | 'durationMs' | 'phase'>> = {},
  discard = code === 'cancelledOrStaleOperation',
): TranslationProviderFailure {
  return {
    success: false,
    code,
    discard,
    metadata: {
      ...metadata,
      attemptCount: 0,
      durationMs: Math.max(0, now() - startedAt),
      phase,
    },
  };
}

export function getTranslationFailureMessage(failure: TranslationProviderFailure): string {
  switch (failure.code) {
    case 'unsupportedProvider':
    case 'unsupportedTargetLanguage':
      return t('error.translationUnsupportedSelection');
    case 'emptyInput':
      return t('error.noTextSelectedToTranslate');
    case 'inputTooLong': {
      const provider = getTranslationProviderInfo(failure.metadata.providerId);
      return t('error.translationTextTooLong', {
        actual: String(failure.metadata.sourceLength ?? 0),
        max: String(provider?.maxInputCharacters ?? 0),
        provider: provider?.name ?? 'Translation provider',
      });
    }
    case 'navigationFailure':
      return t('error.translationConnectionFailed');
    case 'consentOrChallenge':
      return t('error.translationConsentOrChallenge');
    case 'pageContractFailure':
      return t('error.translationPageChanged');
    case 'resultTimeoutOrEmpty':
      return t('error.translationResultUnavailable');
    case 'cancelledOrStaleOperation':
      return t('status.translationCancelled');
    case 'cleanupFailure':
      return t('error.translationCleanupFailed');
  }
}

/** Owns authoritative translation snapshots, cancellation generations, and provider routing. */
export class TranslationRuntime {
  private generation = 0;
  private readonly activeControllers = new Set<AbortController>();

  constructor(private readonly dependencies: TranslationRuntimeDependencies) {}

  getSnapshot(): TranslationExecutionSnapshotResult {
    const startedAt = this.dependencies.now();
    const candidate = this.dependencies.getSettings() as unknown;
    if (!isRecord(candidate)) {
      return createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
    }

    const provider = getTranslationProviderInfo(candidate.providerId);
    if (!provider) {
      return createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
    }

    const targets = candidate.targetLanguageByProvider;
    const targetLanguage = isRecord(targets) ? targets[provider.id] : undefined;
    if (typeof targetLanguage !== 'string' || !getTranslationLanguage(provider.id, targetLanguage)) {
      return createFailure('unsupportedTargetLanguage', 'validation', startedAt, this.dependencies.now, {
        providerId: provider.id,
        contractVersion: provider.contractVersion,
      });
    }

    return {
      success: true,
      snapshot: Object.freeze({
        contractVersion: provider.contractVersion,
        generation: this.generation,
        maxInputCharacters: provider.maxInputCharacters,
        providerId: provider.id,
        providerName: provider.name,
        targetLanguage,
      }),
    };
  }

  isCurrent(snapshot: TranslationExecutionSnapshot): boolean {
    return snapshot.generation === this.generation;
  }

  validateInput(sourceText: unknown, snapshot: TranslationExecutionSnapshot): TranslationProviderFailure | null {
    const startedAt = this.dependencies.now();
    const metadata = {
      providerId: snapshot.providerId,
      targetLanguage: snapshot.targetLanguage,
      contractVersion: snapshot.contractVersion,
      ...(typeof sourceText === 'string' ? { sourceLength: sourceText.length } : {}),
    };

    if (typeof sourceText !== 'string' || !sourceText.trim()) {
      return createFailure('emptyInput', 'validation', startedAt, this.dependencies.now, metadata);
    }
    if (sourceText.length > snapshot.maxInputCharacters) {
      return createFailure('inputTooLong', 'validation', startedAt, this.dependencies.now, metadata);
    }
    if (!this.isCurrent(snapshot)) {
      return createFailure('cancelledOrStaleOperation', 'validation', startedAt, this.dependencies.now, metadata, true);
    }
    return null;
  }

  async translateWithSnapshot(
    sourceText: unknown,
    snapshot: TranslationExecutionSnapshot,
  ): Promise<TranslationProviderOutcome> {
    const validationFailure = this.validateInput(sourceText, snapshot);
    if (validationFailure) return validationFailure;

    const startedAt = this.dependencies.now();
    const controller = new AbortController();
    this.activeControllers.add(controller);
    try {
      const provider = this.dependencies.registry.getProvider(snapshot.providerId);
      const outcome = await provider.translate({
        providerId: snapshot.providerId,
        targetLanguage: snapshot.targetLanguage,
        sourceText: sourceText as string,
        signal: controller.signal,
      });

      if (!this.isCurrent(snapshot) || controller.signal.aborted) {
        return createFailure(
          'cancelledOrStaleOperation',
          'shutdown',
          startedAt,
          this.dependencies.now,
          {
            providerId: snapshot.providerId,
            targetLanguage: snapshot.targetLanguage,
            contractVersion: snapshot.contractVersion,
            sourceLength: (sourceText as string).length,
            ...(outcome.success ? { resultLength: outcome.text.length } : {}),
          },
          true,
        );
      }
      return outcome;
    } catch {
      return createFailure('pageContractFailure', 'result', startedAt, this.dependencies.now, {
        providerId: snapshot.providerId,
        targetLanguage: snapshot.targetLanguage,
        contractVersion: snapshot.contractVersion,
        sourceLength: (sourceText as string).length,
      });
    } finally {
      this.activeControllers.delete(controller);
    }
  }

  async translateText(sourceText: unknown, targetLanguage: unknown): Promise<TranslationTextResult> {
    const snapshotResult = this.getSnapshot();
    if (!snapshotResult.success) {
      return { success: false, error: getTranslationFailureMessage(snapshotResult) };
    }

    const { snapshot } = snapshotResult;
    if (targetLanguage !== snapshot.targetLanguage) {
      const failure = createFailure(
        'unsupportedTargetLanguage',
        'validation',
        this.dependencies.now(),
        this.dependencies.now,
        {
          providerId: snapshot.providerId,
          contractVersion: snapshot.contractVersion,
          ...(typeof sourceText === 'string' ? { sourceLength: sourceText.length } : {}),
        },
      );
      return { success: false, error: getTranslationFailureMessage(failure) };
    }

    const outcome = await this.translateWithSnapshot(sourceText, snapshot);
    if (outcome.success) {
      return { success: true, text: outcome.text };
    }
    return { success: false, error: getTranslationFailureMessage(outcome) };
  }

  async shutdown(): Promise<TranslationProviderShutdownResult> {
    this.generation += 1;
    for (const controller of this.activeControllers) controller.abort();

    const result = await this.dependencies.registry.shutdown();
    if (!result.success) {
      log.warn('Translation provider shutdown incomplete:', {
        failedProviderIds: result.failedProviderIds,
      });
    }
    return result;
  }
}

export const translationRuntime = new TranslationRuntime({
  getSettings: getTranslationSettingsSnapshot,
  now: Date.now,
  registry: translationProviderRegistry,
});

export function getTranslationExecutionSnapshot(): TranslationExecutionSnapshotResult {
  return translationRuntime.getSnapshot();
}

export function isTranslationExecutionCurrent(snapshot: TranslationExecutionSnapshot): boolean {
  return translationRuntime.isCurrent(snapshot);
}

export function validateTranslationInput(
  sourceText: unknown,
  snapshot: TranslationExecutionSnapshot,
): TranslationProviderFailure | null {
  return translationRuntime.validateInput(sourceText, snapshot);
}

export function translateWithSnapshot(
  sourceText: unknown,
  snapshot: TranslationExecutionSnapshot,
): Promise<TranslationProviderOutcome> {
  return translationRuntime.translateWithSnapshot(sourceText, snapshot);
}

export function translateText(sourceText: unknown, targetLanguage: unknown): Promise<TranslationTextResult> {
  return translationRuntime.translateText(sourceText, targetLanguage);
}

export function shutdownAllTranslationProviders(): Promise<TranslationProviderShutdownResult> {
  return translationRuntime.shutdown();
}
