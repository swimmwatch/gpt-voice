/* eslint-disable max-classes-per-file -- runtime and its stateful deferred audit lifecycle form one service. */
import { getTranslationSettingsSnapshot } from '@main/config';
import { t } from '@main/i18n';
import {
  normalizeProviderAuditExceptionType,
  type ProviderAuditPhase,
  type ProviderAuditTerminalOutcome,
} from '@main/providerAudit';
import { translationProviderRegistry, type TranslationProviderShutdownResult } from '@main/translateProviders';
import type { BaseTranslateProvider } from '@main/translateProviders/BaseTranslateProvider';
import {
  translationProviderAudit,
  type TranslationProviderAudit,
  type TranslationProviderAuditLifecycle,
  type TranslationProviderAuditMetadata,
} from '@main/translateProviders/translationProviderAudit';
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
  readonly audit?: TranslationProviderAudit;
  readonly getSettings: () => TranslationSettings;
  readonly now: () => number;
  readonly registry: TranslationRuntimeRegistry;
}

interface DeferredTranslationAuditTerminal {
  readonly metadata?: TranslationProviderAuditMetadata;
  readonly outcome: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

/** Defers one provider terminal until the runtime accepts the provider outcome. */
class DeferredTranslationAuditLifecycle implements TranslationProviderAuditLifecycle {
  private deferredTerminal: DeferredTranslationAuditTerminal | null = null;

  public constructor(private readonly lifecycle: TranslationProviderAuditLifecycle) {}

  public started(metadata?: TranslationProviderAuditMetadata): void {
    this.lifecycle.started(metadata);
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.phaseEntered(phase, metadata);
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.phaseCompleted(phase, metadata);
  }

  public retry(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.retry(phase, metadata);
  }

  public recovery(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.recovery(phase, metadata);
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: TranslationProviderAuditMetadata,
  ): void {
    if (this.deferredTerminal !== null) return;
    this.deferredTerminal = { phase, outcome, ...(metadata === undefined ? {} : { metadata }) };
  }

  public flushTerminal(): boolean {
    if (this.deferredTerminal === null) return false;
    const { metadata, outcome, phase } = this.deferredTerminal;
    this.deferredTerminal = null;
    this.lifecycle.terminal(phase, outcome, metadata);
    return true;
  }
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
  private readonly audit: TranslationProviderAudit;

  constructor(private readonly dependencies: TranslationRuntimeDependencies) {
    this.audit = dependencies.audit ?? translationProviderAudit;
  }

  /** Captures and audits one validated immutable Translation settings snapshot. */
  getSnapshot(): TranslationExecutionSnapshotResult {
    const startedAt = this.dependencies.now();
    let candidate: unknown;
    try {
      candidate = this.dependencies.getSettings();
    } catch (error: unknown) {
      const auditLifecycle = this.audit.startOperation(undefined, 'settings-readiness', 'validation', {
        attemptCount: 0,
      }).lifecycle;
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.audit.terminalFailure(auditLifecycle, failure, {
        exceptionType: normalizeProviderAuditExceptionType(error),
      });
      throw error;
    }

    const provider = isRecord(candidate) ? getTranslationProviderInfo(candidate.providerId) : undefined;
    const initialAuditMetadata = provider
      ? this.audit.createMetadata({
          providerId: provider.id,
          contractVersion: provider.contractVersion,
          durationMs: 0,
          attemptCount: 0,
          phase: 'validation',
        })
      : { attemptCount: 0, providerKnown: false };
    const auditLifecycle = this.audit.startOperation(
      provider?.id,
      'settings-readiness',
      'validation',
      initialAuditMetadata,
    ).lifecycle;

    if (!isRecord(candidate)) {
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.audit.terminalFailure(auditLifecycle, failure);
      return failure;
    }

    if (!provider) {
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.audit.terminalFailure(auditLifecycle, failure);
      return failure;
    }

    const targets = candidate.targetLanguageByProvider;
    const targetLanguage = isRecord(targets) ? targets[provider.id] : undefined;
    if (typeof targetLanguage !== 'string' || !getTranslationLanguage(provider.id, targetLanguage)) {
      const failure = createFailure('unsupportedTargetLanguage', 'validation', startedAt, this.dependencies.now, {
        providerId: provider.id,
        contractVersion: provider.contractVersion,
      });
      this.audit.terminalFailure(auditLifecycle, failure);
      return failure;
    }

    const terminalMetadata = this.audit.createMetadata({
      providerId: provider.id,
      targetLanguage,
      contractVersion: provider.contractVersion,
      durationMs: Math.max(0, this.dependencies.now() - startedAt),
      attemptCount: 0,
      phase: 'validation',
    });
    auditLifecycle.phaseCompleted('validation', terminalMetadata);
    auditLifecycle.terminal('validation', 'success', terminalMetadata);
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

  private validateInputWithoutAudit(
    sourceText: unknown,
    snapshot: TranslationExecutionSnapshot,
    startedAt: number,
  ): TranslationProviderFailure | null {
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

  validateInput(sourceText: unknown, snapshot: TranslationExecutionSnapshot): TranslationProviderFailure | null {
    const startedAt = this.dependencies.now();
    const failure = this.validateInputWithoutAudit(sourceText, snapshot, startedAt);
    if (!failure) return null;

    const auditMetadata = this.audit.createMetadata(failure.metadata);
    const auditLifecycle = this.audit.startTranslate(snapshot.providerId, auditMetadata).lifecycle;
    this.audit.terminalFailure(auditLifecycle, failure);
    return failure;
  }

  /** Validates and dispatches one non-cache Translation provider operation. */
  async translateWithSnapshot(
    sourceText: unknown,
    snapshot: TranslationExecutionSnapshot,
  ): Promise<TranslationProviderOutcome> {
    const startedAt = this.dependencies.now();
    const sourceLength = typeof sourceText === 'string' ? sourceText.length : undefined;
    const startMetadata = this.audit.createMetadata({
      providerId: snapshot.providerId,
      targetLanguage: snapshot.targetLanguage,
      contractVersion: snapshot.contractVersion,
      ...(sourceLength === undefined ? {} : { sourceLength }),
      durationMs: 0,
      attemptCount: 0,
      phase: 'validation',
    });
    const auditContext = this.audit.startTranslate(snapshot.providerId, startMetadata);
    const { lifecycle: auditLifecycle } = auditContext;

    const validationFailure = this.validateInputWithoutAudit(sourceText, snapshot, startedAt);
    if (validationFailure) {
      this.audit.terminalFailure(auditLifecycle, validationFailure);
      return validationFailure;
    }
    auditLifecycle.phaseCompleted('validation', startMetadata);

    const controller = new AbortController();
    this.activeControllers.add(controller);
    try {
      auditLifecycle.phaseEntered('dispatch', startMetadata);
      const provider = this.dependencies.registry.getProvider(snapshot.providerId);
      auditLifecycle.phaseCompleted('dispatch', startMetadata);
      const deferredAuditTerminal = new DeferredTranslationAuditLifecycle(auditLifecycle);
      const outcome = await provider.translate({
        audit: this.audit,
        auditContext: Object.freeze({
          ...auditContext,
          lifecycle: deferredAuditTerminal,
        }),
        providerId: snapshot.providerId,
        targetLanguage: snapshot.targetLanguage,
        sourceText: sourceText as string,
        signal: controller.signal,
      });

      if (!this.isCurrent(snapshot) || controller.signal.aborted) {
        const failure = createFailure(
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
        this.audit.terminalFailure(auditLifecycle, failure, {
          signalAborted: controller.signal.aborted,
        });
        return failure;
      }
      deferredAuditTerminal.flushTerminal();
      if (outcome.success) {
        auditLifecycle.terminal(
          'cleanup',
          'success',
          this.audit.createMetadata(outcome.metadata, {
            durationMs: Math.max(0, this.dependencies.now() - startedAt),
            postSubmission: true,
          }),
        );
      } else {
        this.audit.terminalFailure(auditLifecycle, outcome, {
          signalAborted: controller.signal.aborted,
        });
      }
      return outcome;
    } catch (error: unknown) {
      const failure = createFailure('pageContractFailure', 'result', startedAt, this.dependencies.now, {
        providerId: snapshot.providerId,
        targetLanguage: snapshot.targetLanguage,
        contractVersion: snapshot.contractVersion,
        sourceLength: (sourceText as string).length,
      });
      this.audit.terminalFailure(auditLifecycle, failure, {
        exceptionType: normalizeProviderAuditExceptionType(error),
      });
      return failure;
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
      const auditMetadata = this.audit.createMetadata(failure.metadata);
      const auditLifecycle = this.audit.startTranslate(snapshot.providerId, auditMetadata).lifecycle;
      this.audit.terminalFailure(auditLifecycle, failure);
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

    return this.dependencies.registry.shutdown();
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
