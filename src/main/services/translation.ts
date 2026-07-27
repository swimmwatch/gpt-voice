/* eslint-disable max-classes-per-file -- runtime and its stateful deferred audit lifecycle form one service. */
import type { I18nService } from '@main/i18n';
import type { AppConfigStore } from '@main/config';
import {
  normalizeProviderAuditExceptionType,
  type ProviderAuditPhase,
  type ProviderAuditTerminalOutcome,
} from '@main/providerAudit';
import type { TranslationProviderInstance, TranslationProviderShutdownResult } from '@main/translateProviders';
import {
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
  DIAGNOSTIC_CAPTURE_CAUSE_CODES,
  type DiagnosticCaptureAttemptResult,
  type DiagnosticCaptureService,
} from '@main/services/diagnosticCapture';
import {
  getTranslationLanguage,
  getTranslationProviderInfo,
  type TranslationProviderId,
  type TranslationProviderName,
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
  getProvider(providerId: unknown): Pick<TranslationProviderInstance, 'translate'>;
  shutdown(): Promise<TranslationProviderShutdownResult>;
}

export interface TranslationRuntimeDependencies {
  readonly audit: TranslationProviderAudit;
  readonly config: Pick<AppConfigStore, 'getTranslationSettings'>;
  readonly diagnosticCapture: Pick<DiagnosticCaptureService, 'captureTranslationProviderSuccess'>;
  readonly localization: Pick<I18nService, 'translate'>;
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
    this.lifecycle.recovery(phase, metadata);
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

/** Owns authoritative translation snapshots, cancellation generations, and provider routing. */
export class TranslationRuntime {
  private generation = 0;
  private readonly activeControllers = new Set<AbortController>();

  constructor(private readonly dependencies: TranslationRuntimeDependencies) {}

  getFailureMessage(failure: TranslationProviderFailure): string {
    const { translate } = this.dependencies.localization;
    switch (failure.code) {
      case 'unsupportedProvider':
      case 'unsupportedTargetLanguage':
        return translate('error.translationUnsupportedSelection');
      case 'emptyInput':
        return translate('error.noTextSelectedToTranslate');
      case 'inputTooLong': {
        const provider = getTranslationProviderInfo(failure.metadata.providerId);
        return translate('error.translationTextTooLong', {
          actual: String(failure.metadata.sourceLength ?? 0),
          max: String(provider?.maxInputCharacters ?? 0),
          provider: provider?.name ?? 'Translation provider',
        });
      }
      case 'navigationFailure':
        return translate('error.translationConnectionFailed');
      case 'consentOrChallenge':
        return translate('error.translationConsentOrChallenge');
      case 'pageContractFailure':
        return translate('error.translationPageChanged');
      case 'resultTimeoutOrEmpty':
        return translate('error.translationResultUnavailable');
      case 'cancelledOrStaleOperation':
        return translate('status.translationCancelled');
      case 'cleanupFailure':
        return translate('error.translationCleanupFailed');
    }
  }

  /** Captures and audits one validated immutable Translation settings snapshot. */
  getSnapshot(): TranslationExecutionSnapshotResult {
    const startedAt = this.dependencies.now();
    let candidate: unknown;
    try {
      candidate = this.dependencies.config.getTranslationSettings();
    } catch (error: unknown) {
      const auditLifecycle = this.dependencies.audit.startOperation(undefined, 'settings-readiness', 'validation', {
        attemptCount: 0,
      }).lifecycle;
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.dependencies.audit.terminalFailure(auditLifecycle, failure, {
        exceptionType: normalizeProviderAuditExceptionType(error),
      });
      throw error;
    }

    const provider = isRecord(candidate) ? getTranslationProviderInfo(candidate.providerId) : undefined;
    const initialAuditMetadata = provider
      ? this.dependencies.audit.createMetadata({
          providerId: provider.id,
          contractVersion: provider.contractVersion,
          durationMs: 0,
          attemptCount: 0,
          phase: 'validation',
        })
      : { attemptCount: 0, providerKnown: false };
    const auditLifecycle = this.dependencies.audit.startOperation(
      provider?.id,
      'settings-readiness',
      'validation',
      initialAuditMetadata,
    ).lifecycle;

    if (!isRecord(candidate)) {
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.dependencies.audit.terminalFailure(auditLifecycle, failure);
      return failure;
    }

    if (!provider) {
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.dependencies.audit.terminalFailure(auditLifecycle, failure);
      return failure;
    }

    const targets = candidate.targetLanguageByProvider;
    const targetLanguage = isRecord(targets) ? targets[provider.id] : undefined;
    if (typeof targetLanguage !== 'string' || !getTranslationLanguage(provider.id, targetLanguage)) {
      const failure = createFailure('unsupportedTargetLanguage', 'validation', startedAt, this.dependencies.now, {
        providerId: provider.id,
        contractVersion: provider.contractVersion,
      });
      this.dependencies.audit.terminalFailure(auditLifecycle, failure);
      return failure;
    }

    const terminalMetadata = this.dependencies.audit.createMetadata({
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

    const auditMetadata = this.dependencies.audit.createMetadata(failure.metadata);
    const auditLifecycle = this.dependencies.audit.startTranslate(snapshot.providerId, auditMetadata).lifecycle;
    this.dependencies.audit.terminalFailure(auditLifecycle, failure);
    return failure;
  }

  /** Validates and dispatches one non-cache Translation provider operation. */
  async translateWithSnapshot(
    sourceText: unknown,
    snapshot: TranslationExecutionSnapshot,
  ): Promise<TranslationProviderOutcome> {
    const startedAt = this.dependencies.now();
    const sourceLength = typeof sourceText === 'string' ? sourceText.length : undefined;
    const startMetadata = this.dependencies.audit.createMetadata({
      providerId: snapshot.providerId,
      targetLanguage: snapshot.targetLanguage,
      contractVersion: snapshot.contractVersion,
      ...(sourceLength === undefined ? {} : { sourceLength }),
      durationMs: 0,
      attemptCount: 0,
      phase: 'validation',
    });
    const auditContext = this.dependencies.audit.startTranslate(snapshot.providerId, startMetadata);
    const { lifecycle: auditLifecycle } = auditContext;

    const validationFailure = this.validateInputWithoutAudit(sourceText, snapshot, startedAt);
    if (validationFailure) {
      this.dependencies.audit.terminalFailure(auditLifecycle, validationFailure);
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
        audit: this.dependencies.audit,
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
        this.dependencies.audit.terminalFailure(auditLifecycle, failure, {
          signalAborted: controller.signal.aborted,
        });
        return failure;
      }
      if (outcome.success) {
        const captureResult = await this.captureTranslationProviderSuccess(
          sourceText as string,
          outcome.text,
          snapshot,
          auditContext.operationId,
        );
        if (captureResult.status === 'failure') {
          this.dependencies.audit.recordDiagnosticCaptureFailure(
            auditLifecycle,
            captureResult.causeCode,
            outcome.metadata,
          );
        }
      }
      deferredAuditTerminal.flushTerminal();
      if (outcome.success) {
        auditLifecycle.terminal(
          'cleanup',
          'success',
          this.dependencies.audit.createMetadata(outcome.metadata, {
            durationMs: Math.max(0, this.dependencies.now() - startedAt),
            postSubmission: true,
          }),
        );
      } else {
        this.dependencies.audit.terminalFailure(auditLifecycle, outcome, {
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
      this.dependencies.audit.terminalFailure(auditLifecycle, failure, {
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
      return { success: false, error: this.getFailureMessage(snapshotResult) };
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
      const auditMetadata = this.dependencies.audit.createMetadata(failure.metadata);
      const auditLifecycle = this.dependencies.audit.startTranslate(snapshot.providerId, auditMetadata).lifecycle;
      this.dependencies.audit.terminalFailure(auditLifecycle, failure);
      return { success: false, error: this.getFailureMessage(failure) };
    }

    const outcome = await this.translateWithSnapshot(sourceText, snapshot);
    if (outcome.success) {
      return { success: true, text: outcome.text };
    }
    return { success: false, error: this.getFailureMessage(outcome) };
  }

  private async captureTranslationProviderSuccess(
    sourceText: string,
    resultText: string,
    snapshot: TranslationExecutionSnapshot,
    providerOperationId?: string,
  ): Promise<DiagnosticCaptureAttemptResult> {
    try {
      return await this.dependencies.diagnosticCapture.captureTranslationProviderSuccess({
        contractVersion: snapshot.contractVersion,
        providerId: snapshot.providerId,
        providerOperationId,
        resultText,
        sourceText,
        targetLanguage: snapshot.targetLanguage,
      });
    } catch {
      return {
        causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed,
        status: 'failure',
      };
    }
  }

  async shutdown(): Promise<TranslationProviderShutdownResult> {
    this.generation += 1;
    for (const controller of this.activeControllers) controller.abort();

    return this.dependencies.registry.shutdown();
  }
}
