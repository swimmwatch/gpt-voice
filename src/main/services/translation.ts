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
  type TranslationProviderAuditOperationContext,
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
  InitialProviderReadinessDeadline,
  type InitialProviderReadinessDeadlineDependencies,
} from '@main/services/initialProviderReadinessDeadline';
import {
  INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE,
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  getTranslationLanguage,
  getTranslationProviderInfo,
  type TranslationProviderConnectionDetail,
  type TranslationProviderConnectionState,
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
  getProvider(
    providerId: unknown,
  ): Pick<TranslationProviderInstance, 'cancelInitialization' | 'initialize' | 'translate'>;
  shutdown(): Promise<TranslationProviderShutdownResult>;
}

export interface TranslationRuntimeDependencies {
  readonly audit: TranslationProviderAudit;
  readonly config: Pick<AppConfigStore, 'getTextActionSettings' | 'getTranslationSettings'>;
  readonly diagnosticCapture: Pick<DiagnosticCaptureService, 'captureTranslationProviderSuccess'>;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly now: () => number;
  readonly readinessDeadline: InitialProviderReadinessDeadlineDependencies;
  readonly registry: TranslationRuntimeRegistry;
}

export type TranslationProviderConnectionListener = (state: TranslationProviderConnectionState) => void;

type AuditedTranslationExecutionSnapshotResult =
  | {
      readonly auditContext: TranslationProviderAuditOperationContext;
      readonly result: {
        readonly success: true;
        readonly snapshot: TranslationExecutionSnapshot;
      };
    }
  | {
      readonly result: TranslationProviderFailure;
    };

interface DeferredTranslationAuditTerminal {
  readonly metadata?: TranslationProviderAuditMetadata;
  readonly outcome: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

/** Defers one provider terminal until the runtime accepts the provider outcome. */
class DeferredTranslationAuditLifecycle implements TranslationProviderAuditLifecycle {
  private deferredTerminal: DeferredTranslationAuditTerminal | null = null;

  public constructor(
    private readonly lifecycle: TranslationProviderAuditLifecycle,
    private readonly isActive: () => boolean = () => true,
  ) {}

  public started(metadata?: TranslationProviderAuditMetadata): void {
    if (this.isActive()) this.lifecycle.started(metadata);
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.isActive() && this.deferredTerminal === null) this.lifecycle.phaseEntered(phase, metadata);
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.isActive() && this.deferredTerminal === null) this.lifecycle.phaseCompleted(phase, metadata);
  }

  public retry(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.isActive() && this.deferredTerminal === null) this.lifecycle.retry(phase, metadata);
  }

  public recovery(phase: ProviderAuditPhase, metadata?: TranslationProviderAuditMetadata): void {
    if (this.isActive()) this.lifecycle.recovery(phase, metadata);
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: TranslationProviderAuditMetadata,
  ): void {
    if (!this.isActive() || this.deferredTerminal !== null) return;
    this.deferredTerminal = { phase, outcome, ...(metadata === undefined ? {} : { metadata }) };
  }

  public flushTerminal(): boolean {
    if (!this.isActive() || this.deferredTerminal === null) {
      this.deferredTerminal = null;
      return false;
    }
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
  private connectionInitializationGeneration = 0;
  private connectionInitializationDeadline: InitialProviderReadinessDeadline | null = null;
  private connectionState = INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE;
  private readonly connectionListeners = new Set<TranslationProviderConnectionListener>();

  constructor(private readonly dependencies: TranslationRuntimeDependencies) {}

  getConnectionState(): TranslationProviderConnectionState {
    return this.connectionState;
  }

  subscribeConnectionState(listener: TranslationProviderConnectionListener): void {
    this.connectionListeners.add(listener);
  }

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
    return this.captureSnapshot(true).result;
  }

  /** Opens and prepares the selected provider page without submitting user text. */
  async initializeSelectedProvider(): Promise<TranslationProviderConnectionState> {
    const initializationGeneration = ++this.connectionInitializationGeneration;
    this.connectionInitializationDeadline?.cancel();
    this.connectionInitializationDeadline = null;

    if (!this.isTranslationEnabled()) {
      const selection = this.getConfiguredConnectionSelection();
      return this.publishConnectionState({
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.TranslationDisabled,
        providerId: selection?.providerId ?? null,
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
        targetLanguage: selection?.targetLanguage ?? null,
      });
    }

    let captured: AuditedTranslationExecutionSnapshotResult;
    try {
      captured = this.captureSnapshot(false);
    } catch {
      return this.publishConnectionState({
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.InvalidSettings,
        providerId: null,
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
        targetLanguage: null,
      });
    }
    if (!captured.result.success || !('auditContext' in captured)) {
      return this.publishConnectionState({
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.InvalidSettings,
        providerId: null,
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
        targetLanguage: null,
      });
    }

    const { auditContext } = captured;
    const { snapshot } = captured.result;
    const metadata = this.dependencies.audit.createMetadata({
      providerId: snapshot.providerId,
      targetLanguage: snapshot.targetLanguage,
      contractVersion: snapshot.contractVersion,
      durationMs: this.dependencies.audit.durationMs(auditContext),
      attemptCount: 0,
      phase: 'validation',
    });
    const deadline = new InitialProviderReadinessDeadline(this.dependencies.readinessDeadline);
    this.connectionInitializationDeadline = deadline;
    const startedAt = this.dependencies.now();
    this.publishConnectionState({
      detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider,
      providerId: snapshot.providerId,
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking,
      targetLanguage: snapshot.targetLanguage,
    });

    let provider: ReturnType<TranslationRuntimeRegistry['getProvider']> | null = null;
    try {
      const deferredAuditTerminal = new DeferredTranslationAuditLifecycle(
        auditContext.lifecycle,
        () =>
          initializationGeneration === this.connectionInitializationGeneration &&
          !deadline.signal.aborted &&
          this.isCurrent(snapshot),
      );
      const readiness = await deadline.run(async (signal) => {
        auditContext.lifecycle.phaseEntered('dispatch', metadata);
        provider = this.dependencies.registry.getProvider(snapshot.providerId);
        auditContext.lifecycle.phaseCompleted('dispatch', metadata);
        return provider.initialize({
          audit: this.dependencies.audit,
          auditContext: Object.freeze({
            ...auditContext,
            lifecycle: deferredAuditTerminal,
          }),
          providerId: snapshot.providerId,
          targetLanguage: snapshot.targetLanguage,
          signal,
        });
      });
      if (readiness.status === 'stopped') {
        this.cancelProviderInitialization(provider);
        if (readiness.cause === 'timed-out') {
          this.dependencies.audit.terminalReadinessTimedOut(auditContext, {
            providerId: snapshot.providerId,
            targetLanguage: snapshot.targetLanguage,
            contractVersion: snapshot.contractVersion,
            durationMs: Math.max(0, this.dependencies.now() - startedAt),
            attemptCount: 0,
            phase: 'readiness',
          });
          if (initializationGeneration === this.connectionInitializationGeneration && this.isCurrent(snapshot)) {
            return this.publishConnectionState({
              detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
              providerId: snapshot.providerId,
              status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
              targetLanguage: snapshot.targetLanguage,
            });
          }
          return this.connectionState;
        }

        const failure = createFailure(
          'cancelledOrStaleOperation',
          'shutdown',
          startedAt,
          this.dependencies.now,
          {
            providerId: snapshot.providerId,
            targetLanguage: snapshot.targetLanguage,
            contractVersion: snapshot.contractVersion,
          },
          true,
        );
        this.dependencies.audit.terminalFailure(auditContext.lifecycle, failure, {
          signalAborted: true,
        });
        return this.connectionState;
      }
      const outcome = readiness.value;
      if (!this.isCurrent(snapshot) || initializationGeneration !== this.connectionInitializationGeneration) {
        const failure = createFailure(
          'cancelledOrStaleOperation',
          'shutdown',
          startedAt,
          this.dependencies.now,
          {
            providerId: snapshot.providerId,
            targetLanguage: snapshot.targetLanguage,
            contractVersion: snapshot.contractVersion,
          },
          true,
        );
        this.dependencies.audit.terminalFailure(auditContext.lifecycle, failure, {
          signalAborted: deadline.signal.aborted,
        });
        return this.connectionState;
      }

      deferredAuditTerminal.flushTerminal();
      if (outcome.success) {
        auditContext.lifecycle.terminal(
          'target-selection',
          'success',
          this.dependencies.audit.createMetadata(outcome.metadata, {
            durationMs: this.dependencies.audit.durationMs(auditContext),
            pageClosed: false,
          }),
        );
        return this.publishConnectionState({
          detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
          providerId: snapshot.providerId,
          status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
          targetLanguage: snapshot.targetLanguage,
        });
      } else {
        this.dependencies.audit.terminalFailure(auditContext.lifecycle, outcome, {
          signalAborted: deadline.signal.aborted,
        });
        return this.publishConnectionFailure(outcome.code, snapshot);
      }
    } catch (error: unknown) {
      const failure = createFailure('pageContractFailure', 'readiness', startedAt, this.dependencies.now, {
        providerId: snapshot.providerId,
        targetLanguage: snapshot.targetLanguage,
        contractVersion: snapshot.contractVersion,
      });
      this.dependencies.audit.terminalFailure(auditContext.lifecycle, failure, {
        exceptionType: normalizeProviderAuditExceptionType(error),
        signalAborted: deadline.signal.aborted,
      });
      if (deadline.signal.aborted || initializationGeneration !== this.connectionInitializationGeneration) {
        return this.connectionState;
      }
      return this.publishConnectionState({
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
        providerId: snapshot.providerId,
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
        targetLanguage: snapshot.targetLanguage,
      });
    } finally {
      if (this.connectionInitializationDeadline === deadline) {
        this.connectionInitializationDeadline = null;
      }
    }
  }

  private isTranslationEnabled(): boolean {
    try {
      return this.dependencies.config.getTextActionSettings().translateEnabled;
    } catch {
      return false;
    }
  }

  private getConfiguredConnectionSelection(): {
    readonly providerId: TranslationProviderId;
    readonly targetLanguage: string;
  } | null {
    try {
      const settings = this.dependencies.config.getTranslationSettings();
      const provider = getTranslationProviderInfo(settings.providerId);
      const targetLanguage = settings.targetLanguageByProvider[settings.providerId];
      return provider && getTranslationLanguage(provider.id, targetLanguage)
        ? { providerId: provider.id, targetLanguage }
        : null;
    } catch {
      return null;
    }
  }

  private isConfiguredConnectionSelection(
    snapshot: Pick<TranslationExecutionSnapshot, 'providerId' | 'targetLanguage'>,
  ): boolean {
    if (!this.isTranslationEnabled()) return false;
    const selection = this.getConfiguredConnectionSelection();
    return selection?.providerId === snapshot.providerId && selection.targetLanguage === snapshot.targetLanguage;
  }

  private publishConnectionFailure(
    code: TranslationProviderFailureCode,
    snapshot: Pick<TranslationExecutionSnapshot, 'providerId' | 'targetLanguage'>,
  ): TranslationProviderConnectionState {
    const detail = this.getConnectionFailureDetail(code);
    if (detail === null) return this.connectionState;
    return this.publishConnectionState({
      detail,
      providerId: snapshot.providerId,
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
      targetLanguage: snapshot.targetLanguage,
    });
  }

  private getConnectionFailureDetail(code: TranslationProviderFailureCode): TranslationProviderConnectionDetail | null {
    switch (code) {
      case 'unsupportedProvider':
      case 'unsupportedTargetLanguage':
        return TRANSLATION_PROVIDER_CONNECTION_DETAILS.InvalidSettings;
      case 'navigationFailure':
        return TRANSLATION_PROVIDER_CONNECTION_DETAILS.NavigationFailed;
      case 'consentOrChallenge':
        return TRANSLATION_PROVIDER_CONNECTION_DETAILS.ConsentOrChallenge;
      case 'pageContractFailure':
        return TRANSLATION_PROVIDER_CONNECTION_DETAILS.PageChanged;
      case 'cleanupFailure':
        return TRANSLATION_PROVIDER_CONNECTION_DETAILS.CleanupFailed;
      case 'cancelledOrStaleOperation':
        return TRANSLATION_PROVIDER_CONNECTION_DETAILS.Cancelled;
      case 'emptyInput':
      case 'inputTooLong':
      case 'resultTimeoutOrEmpty':
        return null;
    }
  }

  private publishConnectionState(state: TranslationProviderConnectionState): TranslationProviderConnectionState {
    const next = Object.freeze({ ...state });
    if (
      next.detail === this.connectionState.detail &&
      next.providerId === this.connectionState.providerId &&
      next.status === this.connectionState.status &&
      next.targetLanguage === this.connectionState.targetLanguage
    ) {
      return this.connectionState;
    }

    this.connectionState = next;
    for (const listener of this.connectionListeners) {
      try {
        listener(next);
      } catch {
        // Connection presentation is fail-open and cannot affect provider behavior.
      }
    }
    return next;
  }

  private cancelProviderInitialization(provider: ReturnType<TranslationRuntimeRegistry['getProvider']> | null): void {
    try {
      provider?.cancelInitialization();
    } catch {
      // Provider cancellation is fail-open; the runtime generation is already terminal.
    }
  }

  private captureSnapshot(terminalOnSuccess: boolean): AuditedTranslationExecutionSnapshotResult {
    const startedAt = this.dependencies.now();
    let candidate: unknown;
    try {
      candidate = this.dependencies.config.getTranslationSettings();
    } catch (error: unknown) {
      const auditLifecycle = this.dependencies.audit.startSettingsReadiness(undefined, {
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
    const auditContext = this.dependencies.audit.startSettingsReadiness(provider?.id, initialAuditMetadata);
    const { lifecycle: auditLifecycle } = auditContext;

    if (!isRecord(candidate)) {
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.dependencies.audit.terminalFailure(auditLifecycle, failure);
      return { result: failure };
    }

    if (!provider) {
      const failure = createFailure('unsupportedProvider', 'validation', startedAt, this.dependencies.now);
      this.dependencies.audit.terminalFailure(auditLifecycle, failure);
      return { result: failure };
    }

    const targets = candidate.targetLanguageByProvider;
    const targetLanguage = isRecord(targets) ? targets[provider.id] : undefined;
    if (typeof targetLanguage !== 'string' || !getTranslationLanguage(provider.id, targetLanguage)) {
      const failure = createFailure('unsupportedTargetLanguage', 'validation', startedAt, this.dependencies.now, {
        providerId: provider.id,
        contractVersion: provider.contractVersion,
      });
      this.dependencies.audit.terminalFailure(auditLifecycle, failure);
      return { result: failure };
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
    if (terminalOnSuccess) {
      auditLifecycle.terminal('validation', 'success', terminalMetadata);
    }
    return {
      auditContext,
      result: {
        success: true,
        snapshot: Object.freeze({
          contractVersion: provider.contractVersion,
          generation: this.generation,
          maxInputCharacters: provider.maxInputCharacters,
          providerId: provider.id,
          providerName: provider.name,
          targetLanguage,
        }),
      },
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
      const deferredAuditTerminal = new DeferredTranslationAuditLifecycle(
        auditLifecycle,
        () => this.isCurrent(snapshot) && !controller.signal.aborted,
      );
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
      if (this.isConfiguredConnectionSelection(snapshot)) {
        if (outcome.success) {
          this.publishConnectionState({
            detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
            providerId: snapshot.providerId,
            status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
            targetLanguage: snapshot.targetLanguage,
          });
        } else {
          this.publishConnectionFailure(outcome.code, snapshot);
        }
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
      if (this.isConfiguredConnectionSelection(snapshot)) {
        this.publishConnectionState({
          detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
          providerId: snapshot.providerId,
          status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
          targetLanguage: snapshot.targetLanguage,
        });
      }
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

  /**
   * Invalidates active work and releases provider ownership while preserving
   * connection listeners for a reusable settings reset.
   */
  async reset(): Promise<TranslationProviderShutdownResult> {
    this.invalidateActiveOperations();
    this.publishResetState(
      TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking,
      TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider,
    );

    try {
      const result = await this.dependencies.registry.shutdown();
      if (!result.success) this.settleResetCleanupFailure();
      return result;
    } catch {
      this.settleResetCleanupFailure();
      return Object.freeze({
        failedProviderIds: Object.freeze([]),
        success: false,
      });
    }
  }

  public settleResetCleanupFailure(): TranslationProviderConnectionState {
    return this.publishResetState(
      TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
      TRANSLATION_PROVIDER_CONNECTION_DETAILS.CleanupFailed,
    );
  }

  public settleResetUnexpectedFailure(): TranslationProviderConnectionState {
    return this.publishResetState(
      TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
      TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
    );
  }

  async shutdown(): Promise<TranslationProviderShutdownResult> {
    this.invalidateActiveOperations();

    try {
      return await this.dependencies.registry.shutdown();
    } finally {
      this.publishConnectionState({
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Cancelled,
        providerId: this.connectionState.providerId,
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
        targetLanguage: this.connectionState.targetLanguage,
      });
      this.connectionListeners.clear();
    }
  }

  private invalidateActiveOperations(): void {
    this.generation += 1;
    this.connectionInitializationGeneration += 1;
    this.connectionInitializationDeadline?.cancel();
    this.connectionInitializationDeadline = null;
    for (const controller of this.activeControllers) controller.abort();
  }

  private publishResetState(
    status: TranslationProviderConnectionState['status'],
    detail: TranslationProviderConnectionDetail,
  ): TranslationProviderConnectionState {
    const selection = this.getConfiguredConnectionSelection();
    return this.publishConnectionState({
      detail,
      providerId: selection?.providerId ?? this.connectionState.providerId,
      status,
      targetLanguage: selection?.targetLanguage ?? this.connectionState.targetLanguage,
    });
  }
}
