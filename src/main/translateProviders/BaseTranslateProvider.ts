import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';
import type { CloakBrowserSettingsRepository, CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';

import { normalizeProviderAuditExceptionType, type ProviderAuditExceptionType } from '@main/providerAudit';
import {
  getTranslationLanguage,
  getTranslationProviderInfo,
  type TranslationProviderInfo,
} from '@shared/translationProvider';
import {
  translationHookFailure,
  translationHookSuccess,
  type TranslationProviderInitializationOutcome,
  type TranslationProviderInitializationRequest,
  type TranslationProviderFailure,
  type TranslationProviderFailureCode,
  type TranslationProviderHookResult,
  type TranslationProviderOperationMetadata,
  type TranslationProviderOutcome,
  type TranslationProviderPhase,
  type TranslationProviderRequest,
  type TranslationProviderResultObservation,
} from './translationProviderContracts';
import {
  type TranslationProviderAudit,
  type TranslationProviderAuditOperationContext,
} from './translationProviderAudit';
import {
  type TranslationOperationLifecycle,
  type TranslationOperationLifecycleDecision,
} from './translationOperationLifecycle';
import { matchTranslationResultLineEndings } from './translationResultText';
import {
  TranslationBrowserResourceCoordinator,
  type TranslationBrowserPageResult,
} from './TranslationBrowserResourceCoordinator';

export { TRANSLATION_RESULT_TIMEOUT_MS } from './translationOperationLifecycle';
export const TRANSLATION_RESULT_POLL_INTERVAL_MS = 100;
export const TRANSLATION_RESULT_STABILITY_DELAY_MS = 500;

export interface BaseTranslateProviderDependencies {
  readonly browserResources?: TranslationBrowserResourceCoordinator;
  readonly cloakBrowserSettings: Pick<CloakBrowserSettingsRepository, 'getWithSecret'>;
  readonly createContext: (options: LaunchContextOptions) => Promise<BrowserContext>;
  readonly createContextOptions: (settings: CloakBrowserSettingsWithSecret) => LaunchContextOptions;
  readonly now: () => number;
  readonly resultPollIntervalMs: number;
  readonly resultStabilityDelayMs: number;
  readonly resultTimeoutMs: number;
  readonly sleep: (delayMs: number) => Promise<void>;
}

interface OperationState {
  readonly audit: TranslationProviderAudit;
  readonly auditContext: TranslationProviderAuditOperationContext;
  readonly attemptCount: number;
  readonly generation: number;
  readonly kind: 'initialization' | 'translation';
  readonly lifecycle?: TranslationOperationLifecycle;
  readonly operationKey: string;
  readonly signal?: AbortSignal;
  readonly sourceLength?: number;
  readonly startedAt: number;
  readonly targetLanguage?: string;
}

interface ValidatedOperationState extends OperationState {
  readonly sourceLength: number;
  readonly targetLanguage: string;
}

interface PreparedOperationState extends OperationState {
  readonly targetLanguage: string;
}

enum TranslationPreparationPurpose {
  Initialization = 'initialization',
  Translation = 'translation',
}

interface PreparationSuccess {
  readonly success: true;
  readonly page: Page;
  readonly previousResult: string;
  readonly attemptCount: number;
}

interface PreparationFailure {
  readonly success: false;
  readonly outcome: TranslationProviderFailure;
}

type PreparationResult = PreparationSuccess | PreparationFailure;

type PreparationStepsResult =
  | {
      readonly success: true;
      readonly recover: boolean;
    }
  | PreparationFailure;

type StaleStatePreparationResult =
  | {
      readonly status: 'success';
      readonly previousResult: string;
    }
  | {
      readonly status: 'recover';
    }
  | {
      readonly status: 'failure';
      readonly outcome: TranslationProviderFailure;
    };

type ResultCandidateConfirmation =
  | {
      readonly kind: 'continue';
    }
  | {
      readonly kind: 'failure';
      readonly outcome: TranslationProviderFailure;
    }
  | {
      readonly kind: 'success';
      readonly text: string;
    };

interface FailureAuditOptions {
  readonly auditPhase?: 'consent-or-challenge';
  readonly exceptionType?: ProviderAuditExceptionType;
  readonly pageClosed?: boolean;
}

/** Shared main-process lifecycle; subclasses implement only public-page behavior. */
export abstract class BaseTranslateProvider {
  public readonly cancelInitialization: () => void;
  public readonly info: TranslationProviderInfo;
  public readonly initialize: (
    request: TranslationProviderInitializationRequest,
  ) => Promise<TranslationProviderInitializationOutcome>;
  public readonly translate: (request: TranslationProviderRequest) => Promise<TranslationProviderOutcome>;
  public readonly shutdown: () => Promise<void>;

  private readonly dependencies: BaseTranslateProviderDependencies;
  private readonly browserResources: TranslationBrowserResourceCoordinator;
  private activeVisibleCleanupOperationKey: string | null = null;
  private generation = 0;
  private initializationGeneration = 0;
  private shutDown = false;
  private translationSequence = 0;

  protected constructor(info: TranslationProviderInfo, dependencies: BaseTranslateProviderDependencies) {
    this.info = info;
    this.dependencies = dependencies;
    this.browserResources =
      dependencies.browserResources ??
      new TranslationBrowserResourceCoordinator({
        cloakBrowserSettings: dependencies.cloakBrowserSettings,
        createContext: dependencies.createContext,
        createContextOptions: dependencies.createContextOptions,
        retainContextAfterPageClose: false,
      });
    this.cancelInitialization = () => this.cancelInitializationNow();
    this.initialize = (request) => this.enqueueInitialization(request);
    this.translate = (request) => this.enqueueTranslation(request);
    this.shutdown = () => this.shutdownProvider();
    Object.defineProperties(this, {
      cancelInitialization: { configurable: false, writable: false },
      initialize: { configurable: false, writable: false },
      shutdown: { configurable: false, writable: false },
      translate: { configurable: false, writable: false },
    });
  }

  protected abstract navigateAndHandleConsent(
    page: Page,
    targetLanguage: string,
  ): Promise<TranslationProviderHookResult>;

  protected abstract inspectReadiness(page: Page): Promise<TranslationProviderHookResult>;

  protected abstract enableAutomaticSourceDetection(page: Page): Promise<TranslationProviderHookResult>;

  protected abstract selectAndVerifyTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult>;

  protected abstract clearStaleState(page: Page): Promise<TranslationProviderHookResult<string>>;

  protected abstract insertSourceText(page: Page, sourceText: string): Promise<TranslationProviderHookResult>;

  protected abstract readNormalizedResult(page: Page): Promise<TranslationProviderHookResult<string>>;

  protected abstract verifySelectedTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult>;

  /**
   * Provider adapters override this with one coherent public-page snapshot.
   * The default preserves the validation contract for focused legacy test doubles.
   */
  protected async observeResult(
    page: Page,
    _targetLanguage: string,
  ): Promise<TranslationProviderHookResult<TranslationProviderResultObservation>> {
    const result = await this.readNormalizedResult(page);
    if (!result.success) return result;
    return translationHookSuccess({
      completion: 'unavailable',
      targetVerified: false,
      text: result.value,
    });
  }

  /**
   * An adapter may wait for a public result candidate without returning provider
   * text. The base still reads and validates one complete snapshot.
   */
  protected readonly waitForResultCandidate:
    | ((page: Page, targetLanguage: string, timeoutMs: number) => Promise<TranslationProviderHookResult<boolean>>)
    | undefined;

  protected abstract clearVisibleState(page: Page): Promise<TranslationProviderHookResult>;

  /** A provider may retain a responsive dirty page after a request-level terminal. */
  protected retainResourceOnTerminalFailure(): boolean {
    return false;
  }

  protected isActiveResourceHealthy(_page: Page): Promise<boolean> {
    return Promise.resolve(false);
  }

  /** Google alone acknowledges selected-text delivery before visible cleanup. */
  protected deliverResultBeforeVisibleCleanup(): boolean {
    return false;
  }

  private enqueueInitialization(
    request: TranslationProviderInitializationRequest,
  ): Promise<TranslationProviderInitializationOutcome> {
    const generation = this.initializationGeneration;
    return this.browserResources.enqueue(() => this.runInitialization(request, generation));
  }

  private enqueueTranslation(request: TranslationProviderRequest): Promise<TranslationProviderOutcome> {
    const generation = this.generation;
    const operationKey = this.createOperationKey('translation', ++this.translationSequence);
    const operation = this.browserResources.enqueue(() => this.runTranslation(request, generation, operationKey));
    if (!request.lifecycle) return operation;

    const removeAbortListener = this.bindLifecycleCleanup(request.lifecycle, operationKey);
    const completion = operation.then((outcome) =>
      this.completeOperationLifecycle(request, generation, operationKey, outcome),
    );
    const terminalOutcome = this.awaitLifecycleFailure(request, generation, operationKey);
    return Promise.race([completion, terminalOutcome]).finally(removeAbortListener);
  }

  private createOperationKey(kind: OperationState['kind'], generation: number): string {
    return `${kind}:${generation}`;
  }

  private bindLifecycleCleanup(lifecycle: TranslationOperationLifecycle, operationKey: string): () => void {
    const onAbort = (): void => {
      this.browserResources.interruptOperation(this.info.id, operationKey);
      void this.completeLifecycleCleanup(lifecycle, operationKey);
    };
    try {
      lifecycle.signal.addEventListener('abort', onAbort, { once: true });
      if (lifecycle.signal.aborted) onAbort();
    } catch {
      lifecycle.completeCleanup(false);
    }
    return () => {
      try {
        lifecycle.signal.removeEventListener('abort', onAbort);
      } catch {
        // The lifecycle is already authoritative when listener disposal fails.
      }
    };
  }

  private async completeOperationLifecycle(
    request: TranslationProviderRequest,
    generation: number,
    operationKey: string,
    outcome: TranslationProviderOutcome,
  ): Promise<TranslationProviderOutcome> {
    const lifecycle = request.lifecycle;
    if (!lifecycle) return outcome;
    const accepted = lifecycle.acceptValidOutcome();
    if (accepted.kind === 'completed' && outcome.success && this.hasReusableActiveResource(operationKey)) {
      const decision = lifecycle.completeCleanup(true);
      return decision.kind === 'completed'
        ? outcome
        : this.createLifecycleFailure(request, generation, operationKey, decision);
    }
    const decision = await this.completeLifecycleCleanup(lifecycle, operationKey);
    return decision.kind === 'completed'
      ? outcome
      : this.createLifecycleFailure(request, generation, operationKey, decision);
  }

  /**
   * A successful translation has already cleared its provider page. Keeping that
   * proven-clean owner avoids a cold browser navigation and repeat consent flow
   * for the next selected-text request.
   */
  private hasReusableActiveResource(operationKey: string): boolean {
    return this.browserResources.hasReusablePage(this.info.id, operationKey);
  }

  private async completeLifecycleCleanup(
    lifecycle: TranslationOperationLifecycle,
    operationKey: string,
  ): Promise<TranslationOperationLifecycleDecision> {
    lifecycle.startCleanupPhase();
    const active = this.browserResources.getActivePage(this.info.id, operationKey);
    if (
      this.activeVisibleCleanupOperationKey !== operationKey &&
      this.retainResourceOnTerminalFailure() &&
      active !== null &&
      !active.isClosed()
    ) {
      try {
        if (await this.isActiveResourceHealthy(active)) return lifecycle.completeCleanup(true);
      } catch {
        // A health-check failure falls through to the established close/quarantine path.
      }
    }
    const closed = await this.closeOwnedResources(operationKey);
    return lifecycle.completeCleanup(closed);
  }

  private async awaitLifecycleFailure(
    request: TranslationProviderRequest,
    generation: number,
    operationKey: string,
  ): Promise<TranslationProviderOutcome> {
    const lifecycle = request.lifecycle;
    if (!lifecycle) return new Promise<TranslationProviderOutcome>(() => undefined);
    return new Promise((resolve) => {
      lifecycle.subscribeTerminal((decision) => {
        if (decision.kind === 'completed') return;
        resolve(this.createLifecycleFailure(request, generation, operationKey, decision));
      });
    });
  }

  private createLifecycleFailure(
    request: TranslationProviderRequest,
    generation: number,
    operationKey: string,
    decision: Exclude<TranslationOperationLifecycleDecision, { readonly kind: 'completed' }>,
  ): TranslationProviderFailure {
    const state: OperationState = {
      audit: request.audit,
      auditContext: request.auditContext,
      attemptCount: 1,
      generation,
      kind: 'translation',
      lifecycle: request.lifecycle,
      operationKey,
      signal: request.signal,
      sourceLength: request.sourceText.length,
      startedAt: this.dependencies.now(),
      targetLanguage: request.targetLanguage,
    };
    switch (decision.kind) {
      case 'cancelled':
        return this.createStaleFailure('shutdown', state);
      case 'timed-out':
        return this.createFailure('timed-out', decision.deadline === 'result' ? 'result' : 'cleanup', state);
      case 'cleanup-failure':
        return this.createFailure('cleanupFailure', 'cleanup', state);
    }
  }

  private async runInitialization(
    request: TranslationProviderInitializationRequest,
    generation: number,
  ): Promise<TranslationProviderInitializationOutcome> {
    const startedAt = this.dependencies.now();
    const initialState: OperationState = {
      audit: request.audit,
      auditContext: request.auditContext,
      attemptCount: 1,
      generation,
      kind: 'initialization',
      operationKey: this.createOperationKey('initialization', generation),
      signal: request.signal,
      startedAt,
    };
    request.auditContext.lifecycle.started({ attemptCount: 1 });
    const canonicalInfo = getTranslationProviderInfo(this.info.id);

    if (!this.isOperationActive(initialState)) {
      return this.createStaleFailure('validation', initialState);
    }
    if (canonicalInfo !== this.info || request.providerId !== this.info.id) {
      return this.createFailure('unsupportedProvider', 'validation', initialState);
    }

    const targetLanguage: unknown = request.targetLanguage;
    if (typeof targetLanguage !== 'string' || !getTranslationLanguage(this.info.id, targetLanguage)) {
      return this.createFailure('unsupportedTargetLanguage', 'validation', initialState);
    }

    const state: PreparedOperationState = {
      ...initialState,
      targetLanguage,
    };
    const preparation = await this.preparePage(state, TranslationPreparationPurpose.Initialization);
    if (!preparation.success) return preparation.outcome;
    return this.createInitializationSuccess(
      {
        ...state,
        attemptCount: preparation.attemptCount,
      },
      'targetSelection',
    );
  }

  /** Executes one generation after it reaches the serialized provider queue. */
  private async runTranslation(
    request: TranslationProviderRequest,
    generation: number,
    operationKey: string,
  ): Promise<TranslationProviderOutcome> {
    const startedAt = this.dependencies.now();
    const rawSourceText: unknown = request.sourceText;
    const sourceLength = typeof rawSourceText === 'string' ? rawSourceText.length : 0;
    const initialState: OperationState = {
      audit: request.audit,
      auditContext: request.auditContext,
      attemptCount: 1,
      generation,
      kind: 'translation',
      lifecycle: request.lifecycle,
      operationKey,
      signal: request.signal,
      sourceLength,
      startedAt,
    };
    request.auditContext.lifecycle.started({
      attemptCount: 1,
      sourceLength,
    });
    const canonicalInfo = getTranslationProviderInfo(this.info.id);

    if (!this.isOperationActive(initialState)) {
      return this.createStaleFailure('validation', initialState);
    }
    if (canonicalInfo !== this.info || request.providerId !== this.info.id) {
      return this.createFailure('unsupportedProvider', 'validation', initialState);
    }

    const targetLanguage: unknown = request.targetLanguage;
    if (typeof targetLanguage !== 'string' || !getTranslationLanguage(this.info.id, targetLanguage)) {
      return this.createFailure('unsupportedTargetLanguage', 'validation', initialState);
    }

    const state: ValidatedOperationState = {
      ...initialState,
      sourceLength,
      targetLanguage,
    };
    if (typeof rawSourceText !== 'string' || rawSourceText.trim().length === 0) {
      return this.createFailure('emptyInput', 'validation', state);
    }
    if (sourceLength > this.info.maxInputCharacters) {
      return this.createFailure('inputTooLong', 'validation', state);
    }
    if (!this.isOperationActive(state)) {
      return this.createStaleFailure('validation', state);
    }

    const preparation = await this.preparePage(state, TranslationPreparationPurpose.Translation);
    if (!preparation.success) return preparation.outcome;

    const activeState: ValidatedOperationState = {
      ...state,
      attemptCount: preparation.attemptCount,
    };
    if (!this.isOperationActive(activeState)) {
      return this.createStaleFailure('submission', activeState);
    }

    this.phaseEntered('submission', activeState);
    const insertion = await this.invokeHook(
      () => this.insertSourceText(preparation.page, rawSourceText),
      'pageContractFailure',
    );
    if (!insertion.success) {
      return this.createTerminalFailure(insertion.code, 'submission', activeState, insertion.exceptionType);
    }
    if (!this.isOperationActive(activeState)) {
      await this.closeOwnedResources(activeState.operationKey);
      return this.createStaleFailure('submission', activeState);
    }
    this.phaseCompleted('submission', activeState, { postSubmission: true });

    this.phaseEntered('result', activeState, { postSubmission: true });
    const lifecycleDecision = activeState.lifecycle?.startResultPhase();
    if (lifecycleDecision !== undefined && lifecycleDecision !== null && lifecycleDecision.kind !== 'completed') {
      return this.createLifecycleFailure(request, generation, activeState.operationKey, lifecycleDecision);
    }
    const result = await this.awaitStableResult(preparation.page, preparation.previousResult, activeState);
    if (!result.success) return result;
    const resultText = matchTranslationResultLineEndings(rawSourceText, result.text);
    this.phaseCompleted('result', activeState, {
      postSubmission: true,
      resultLength: resultText.length,
    });
    if (this.deliverResultBeforeVisibleCleanup()) {
      const delivery = this.notifyResultReady(request, resultText, activeState);
      if (!delivery.success) {
        return this.createTerminalFailure(delivery.code, 'result', activeState, delivery.exceptionType);
      }
    }

    this.phaseEntered('cleanup', activeState, {
      postSubmission: true,
      resultLength: resultText.length,
    });
    this.activeVisibleCleanupOperationKey = activeState.operationKey;
    try {
      const clear = await this.invokeHook(() => this.clearVisibleState(preparation.page), 'cleanupFailure');
      if (!this.isOperationActive(activeState)) {
        await this.closeOwnedResources(activeState.operationKey);
        return this.createStaleFailure('cleanup', activeState);
      }
      if (!clear.success) {
        const closed = await this.closeOwnedResources(activeState.operationKey);
        if (!closed) {
          return this.createFailure('cleanupFailure', 'cleanup', activeState, resultText.length, {
            exceptionType: clear.exceptionType,
            pageClosed: false,
          });
        }
      }
      this.phaseCompleted('cleanup', activeState, {
        pageClosed: !clear.success,
        postSubmission: true,
        resultLength: resultText.length,
      });

      return this.createSuccess(resultText, activeState, !clear.success, request.lifecycle === undefined);
    } finally {
      if (this.activeVisibleCleanupOperationKey === activeState.operationKey) {
        this.activeVisibleCleanupOperationKey = null;
      }
    }
  }

  /**
   * A selected-text hand-off acknowledges that clipboard delivery completed before
   * browser-visible cleanup. Direct internal requests have no hand-off and proceed.
   */
  private notifyResultReady(
    request: TranslationProviderRequest,
    resultText: string,
    state: ValidatedOperationState,
  ): TranslationProviderHookResult {
    if (!this.isOperationActive(state)) return translationHookFailure('cancelledOrStaleOperation');
    if (!request.onResultReady) return translationHookSuccess();
    try {
      const delivered = request.onResultReady(resultText);
      if (!this.isOperationActive(state)) return translationHookFailure('cancelledOrStaleOperation');
      return delivered ? translationHookSuccess() : translationHookFailure('resultDeliveryFailure');
    } catch (error: unknown) {
      return translationHookFailure('resultDeliveryFailure', {
        exceptionType: normalizeProviderAuditExceptionType(error),
      });
    }
  }

  /** Runs the bounded pre-submission page preparation and recovery sequence. */
  private async preparePage(
    state: PreparedOperationState,
    purpose: TranslationPreparationPurpose,
  ): Promise<PreparationResult> {
    for (let attemptCount = 1; attemptCount <= 2; attemptCount += 1) {
      const activeState: PreparedOperationState = {
        ...state,
        attemptCount,
      };
      this.phaseEntered('context', activeState);
      const pageResult = await this.ensurePage(activeState);
      if (!pageResult.success) return pageResult;
      const page = pageResult.page;
      this.phaseCompleted('context', activeState);

      const preparationSteps = await this.runPreparationSteps(page, activeState);
      if (!preparationSteps.success) return preparationSteps;
      if (preparationSteps.recover) {
        const recoveryFailure = await this.recoverPreparation(activeState);
        if (recoveryFailure) return recoveryFailure;
        continue;
      }

      if (purpose === TranslationPreparationPurpose.Initialization) {
        return {
          success: true,
          page,
          previousResult: '',
          attemptCount,
        };
      }

      const staleState = await this.prepareStaleState(page, activeState);
      if (staleState.status === 'failure') {
        return { success: false, outcome: staleState.outcome };
      }
      if (staleState.status === 'recover') {
        const recoveryFailure = await this.recoverPreparation(activeState);
        if (recoveryFailure) return recoveryFailure;
        continue;
      }

      return {
        success: true,
        page,
        previousResult: staleState.previousResult,
        attemptCount,
      };
    }

    return {
      success: false,
      outcome: await this.createTerminalFailure('pageContractFailure', 'readiness', { ...state, attemptCount: 2 }),
    };
  }

  private async runPreparationSteps(page: Page, state: PreparedOperationState): Promise<PreparationStepsResult> {
    const steps: ReadonlyArray<{
      phase: TranslationProviderPhase;
      fallbackCode: TranslationProviderFailureCode;
      run: () => Promise<TranslationProviderHookResult>;
    }> = [
      {
        phase: 'navigation',
        fallbackCode: 'navigationFailure',
        run: () => this.navigateAndHandleConsent(page, state.targetLanguage),
      },
      {
        phase: 'readiness',
        fallbackCode: 'pageContractFailure',
        run: () => this.inspectReadiness(page),
      },
      {
        phase: 'sourceDetection',
        fallbackCode: 'pageContractFailure',
        run: () => this.enableAutomaticSourceDetection(page),
      },
      {
        phase: 'targetSelection',
        fallbackCode: 'pageContractFailure',
        run: () => this.selectAndVerifyTarget(page, state.targetLanguage),
      },
    ];

    for (const step of steps) {
      this.phaseEntered(step.phase, state);
      const hookResult = await this.invokeHook(step.run, step.fallbackCode);
      if (!this.isOperationActive(state)) {
        return {
          success: false,
          outcome: this.createStaleFailure(step.phase, state),
        };
      }
      if (!hookResult.success) {
        if (state.attemptCount === 1 && hookResult.recoverableBeforeSubmission === true) {
          this.retry(step.phase, state);
          return { success: true, recover: true };
        }
        const auditPhase = hookResult.code === 'consentOrChallenge' ? 'consent-or-challenge' : undefined;
        if (auditPhase !== undefined) {
          this.phaseCompleted('navigation', state);
          state.auditContext.lifecycle.phaseEntered(auditPhase, this.createAuditMetadata(state));
        }
        return {
          success: false,
          outcome: await this.createTerminalFailure(
            hookResult.code,
            step.phase,
            state,
            hookResult.exceptionType,
            auditPhase,
          ),
        };
      }
      this.phaseCompleted(step.phase, state);
      if (step.phase === 'navigation') this.completeConsentOrChallengePhase(state);
    }

    return { success: true, recover: false };
  }

  private completeConsentOrChallengePhase(state: OperationState): void {
    const metadata = this.createAuditMetadata(state);
    state.auditContext.lifecycle.phaseEntered('consent-or-challenge', metadata);
    state.auditContext.lifecycle.phaseCompleted('consent-or-challenge', metadata);
  }

  private async prepareStaleState(page: Page, state: PreparedOperationState): Promise<StaleStatePreparationResult> {
    this.phaseEntered('staleState', state);
    const staleState = await this.invokeHook(() => this.clearStaleState(page), 'pageContractFailure');
    if (!this.isOperationActive(state)) {
      return {
        status: 'failure',
        outcome: this.createStaleFailure('staleState', state),
      };
    }
    if (!staleState.success) {
      if (state.attemptCount === 1 && staleState.recoverableBeforeSubmission === true) {
        this.retry('staleState', state);
        return { status: 'recover' };
      }
      return {
        status: 'failure',
        outcome: await this.createTerminalFailure(staleState.code, 'staleState', state, staleState.exceptionType),
      };
    }

    this.phaseCompleted('staleState', state);
    return {
      status: 'success',
      previousResult: staleState.value,
    };
  }

  private async recoverPreparation(state: OperationState): Promise<PreparationFailure | null> {
    const closed = await this.closeOwnedResources(state.operationKey);
    if (!closed) {
      return {
        success: false,
        outcome: this.createFailure('cleanupFailure', 'cleanup', state),
      };
    }
    this.recovery(state);
    return null;
  }

  /** Obtains resources only for the current generation and never bypasses quarantine. */
  private async ensurePage(
    state: OperationState,
  ): Promise<{ readonly success: true; readonly page: Page } | PreparationFailure> {
    const result = await this.browserResources.ensurePage({
      isOperationActive: () => this.isOperationActive(state),
      operationKey: state.operationKey,
      providerId: this.info.id,
    });
    if (result.status === 'ready') return { success: true, page: result.page };
    return this.createPageAcquisitionFailure(result, state);
  }

  private async createPageAcquisitionFailure(
    result: Exclude<TranslationBrowserPageResult, { readonly status: 'ready' }>,
    state: OperationState,
  ): Promise<PreparationFailure> {
    switch (result.status) {
      case 'stale':
        return { success: false, outcome: this.createStaleFailure('context', state) };
      case 'cleanup-failure':
        return { success: false, outcome: this.createFailure('cleanupFailure', 'cleanup', state) };
      case 'navigation-failure':
        return {
          success: false,
          outcome: await this.createTerminalFailure('navigationFailure', 'context', state),
        };
    }
  }

  private async awaitStableResult(
    page: Page,
    previousResult: string,
    state: ValidatedOperationState,
  ): Promise<{ readonly success: true; readonly text: string } | TranslationProviderFailure> {
    const resultStartedAt = this.dependencies.now();
    const resultDeadlineAt = resultStartedAt + this.dependencies.resultTimeoutMs;
    if (this.waitForResultCandidate !== undefined) {
      const candidate = await this.invokeHook(
        async () =>
          this.waitForResultCandidate?.(
            page,
            state.targetLanguage,
            Math.max(0, resultDeadlineAt - this.dependencies.now()),
          ) ?? translationHookSuccess(false),
        'pageContractFailure',
      );
      if (!candidate.success) {
        if (!this.isResultPhaseActive(state, resultDeadlineAt)) {
          await this.closeOwnedResources(state.operationKey);
          return this.createResultDeadlineFailure(state, resultDeadlineAt);
        }
        return this.createTerminalFailure(candidate.code, 'result', state, candidate.exceptionType);
      }
    }
    const readAttempts = Math.max(
      1,
      Math.ceil(this.dependencies.resultTimeoutMs / this.dependencies.resultPollIntervalMs),
    );

    for (let attempt = 0; attempt < readAttempts; attempt += 1) {
      if (!this.isResultPhaseActive(state, resultDeadlineAt)) {
        await this.closeOwnedResources(state.operationKey);
        return this.createResultDeadlineFailure(state, resultDeadlineAt);
      }

      const firstObservation = await this.invokeHook(
        () => this.observeResult(page, state.targetLanguage),
        'pageContractFailure',
      );
      if (!firstObservation.success) {
        return this.createTerminalFailure(firstObservation.code, 'result', state, firstObservation.exceptionType);
      }

      const confirmation = await this.confirmResultCandidate(
        page,
        previousResult,
        firstObservation.value,
        state,
        resultDeadlineAt,
      );
      if (confirmation.kind === 'failure') return confirmation.outcome;
      if (confirmation.kind === 'success') return { success: true, text: confirmation.text };

      if (attempt + 1 < readAttempts) {
        await this.sleepWithinResultDeadline(this.dependencies.resultPollIntervalMs, resultDeadlineAt);
      }
    }

    return this.createTerminalFailure('resultTimeoutOrEmpty', 'result', state);
  }

  private async confirmResultCandidate(
    page: Page,
    previousResult: string,
    candidate: TranslationProviderResultObservation,
    state: ValidatedOperationState,
    resultDeadlineAt: number,
  ): Promise<ResultCandidateConfirmation> {
    if (candidate.text.trim().length === 0) return { kind: 'continue' };
    if (
      candidate.targetVerified &&
      (candidate.generation === 'changed-after-submission' || candidate.generation === 'renewed-identical')
    ) {
      return this.createConfirmedResult(candidate.text, state, resultDeadlineAt);
    }
    if (candidate.text === previousResult) return { kind: 'continue' };
    if (candidate.targetVerified && candidate.completion === 'verified-complete') {
      return this.createConfirmedResult(candidate.text, state, resultDeadlineAt);
    }
    if (candidate.completion === 'incomplete') return { kind: 'continue' };

    await this.sleepWithinResultDeadline(this.dependencies.resultStabilityDelayMs, resultDeadlineAt);
    if (!this.isResultPhaseActive(state, resultDeadlineAt)) {
      await this.closeOwnedResources(state.operationKey);
      return { kind: 'failure', outcome: this.createResultDeadlineFailure(state, resultDeadlineAt) };
    }

    const secondObservation = await this.invokeHook(
      () => this.observeResult(page, state.targetLanguage),
      'pageContractFailure',
    );
    if (!secondObservation.success) {
      return {
        kind: 'failure',
        outcome: await this.createTerminalFailure(
          secondObservation.code,
          'result',
          state,
          secondObservation.exceptionType,
        ),
      };
    }
    if (candidate.text !== secondObservation.value.text) return { kind: 'continue' };
    if (!secondObservation.value.targetVerified) {
      const target = await this.invokeHook(
        () => this.verifySelectedTarget(page, state.targetLanguage),
        'pageContractFailure',
      );
      if (!target.success) {
        return {
          kind: 'failure',
          outcome: await this.createTerminalFailure(target.code, 'result', state, target.exceptionType),
        };
      }
    }
    return this.createConfirmedResult(candidate.text, state, resultDeadlineAt);
  }

  private async createConfirmedResult(
    text: string,
    state: ValidatedOperationState,
    resultDeadlineAt: number,
  ): Promise<ResultCandidateConfirmation> {
    if (this.isResultPhaseActive(state, resultDeadlineAt)) return { kind: 'success', text };
    await this.closeOwnedResources(state.operationKey);
    return { kind: 'failure', outcome: this.createResultDeadlineFailure(state, resultDeadlineAt) };
  }

  private isResultPhaseActive(state: OperationState, resultDeadlineAt: number): boolean {
    state.lifecycle?.check();
    return this.isOperationActive(state) && this.dependencies.now() < resultDeadlineAt;
  }

  private createResultDeadlineFailure(
    state: ValidatedOperationState,
    resultDeadlineAt: number,
  ): TranslationProviderFailure {
    if (this.dependencies.now() >= resultDeadlineAt && state.lifecycle === undefined) {
      return this.createFailure('resultTimeoutOrEmpty', 'result', state);
    }
    return this.createStaleFailure('result', state);
  }

  private async sleepWithinResultDeadline(delayMs: number, resultDeadlineAt: number): Promise<void> {
    const remainingMs = Math.max(0, resultDeadlineAt - this.dependencies.now());
    await this.dependencies.sleep(Math.min(Math.max(0, delayMs), remainingMs));
  }

  private async createTerminalFailure(
    code: TranslationProviderFailureCode,
    phase: TranslationProviderPhase,
    state: OperationState,
    exceptionType?: ProviderAuditExceptionType,
    auditPhase?: 'consent-or-challenge',
  ): Promise<TranslationProviderFailure> {
    if (state.lifecycle !== undefined) {
      state.lifecycle.acceptValidOutcome();
      void this.completeLifecycleCleanup(state.lifecycle, state.operationKey);
      return this.createFailure(code, phase, state, undefined, {
        auditPhase,
        exceptionType,
      });
    }
    const closed = await this.closeOwnedResources(state.operationKey);
    return this.createFailure(closed ? code : 'cleanupFailure', closed ? phase : 'cleanup', state, undefined, {
      auditPhase,
      exceptionType,
      pageClosed: closed,
    });
  }

  private async invokeHook<T>(
    hook: () => Promise<TranslationProviderHookResult<T>>,
    fallbackCode: TranslationProviderFailureCode,
  ): Promise<TranslationProviderHookResult<T>> {
    try {
      return await hook();
    } catch (error: unknown) {
      return translationHookFailure(fallbackCode, {
        exceptionType: normalizeProviderAuditExceptionType(error),
      });
    }
  }

  private isOperationActive(state: OperationState): boolean {
    const generationCurrent =
      state.kind === 'initialization'
        ? state.generation === this.initializationGeneration
        : state.generation === this.generation;
    return !this.shutDown && generationCurrent && state.signal?.aborted !== true;
  }

  private createInitializationSuccess(
    state: PreparedOperationState,
    phase: TranslationProviderPhase,
  ): TranslationProviderInitializationOutcome {
    const metadata = {
      ...this.createMetadata(phase, state),
      providerId: this.info.id,
      targetLanguage: state.targetLanguage,
      contractVersion: this.info.contractVersion,
    };
    state.auditContext.lifecycle.terminal(
      state.audit.toPhase(phase),
      'success',
      state.audit.createMetadata(metadata, {
        durationMs: this.createAuditDuration(state),
        pageClosed: false,
      }),
    );
    return {
      success: true,
      metadata,
    };
  }

  private createSuccess(
    text: string,
    state: ValidatedOperationState,
    pageClosed: boolean,
    emitTerminal = true,
  ): TranslationProviderOutcome {
    const metadata = {
      ...this.createMetadata('cleanup', state, text.length),
      providerId: this.info.id,
      targetLanguage: state.targetLanguage,
      contractVersion: this.info.contractVersion,
      sourceLength: state.sourceLength,
      resultLength: text.length,
    };
    const outcome: TranslationProviderOutcome = {
      success: true,
      text,
      metadata,
    };
    if (emitTerminal) {
      state.auditContext.lifecycle.terminal(
        'cleanup',
        'success',
        state.audit.createMetadata(metadata, {
          durationMs: this.createAuditDuration(state),
          pageClosed,
          postSubmission: true,
        }),
      );
    }
    return outcome;
  }

  private createStaleFailure(phase: TranslationProviderPhase, state: OperationState): TranslationProviderFailure {
    return this.createFailure('cancelledOrStaleOperation', phase, state);
  }

  private createFailure(
    code: TranslationProviderFailureCode,
    phase: TranslationProviderPhase,
    state: OperationState,
    resultLength?: number,
    auditOptions: FailureAuditOptions = {},
  ): TranslationProviderFailure {
    const outcome: TranslationProviderFailure = {
      success: false,
      code,
      discard: code === 'cancelledOrStaleOperation',
      metadata: this.createMetadata(phase, state, resultLength),
    };
    if (state.lifecycle === undefined) {
      state.audit.terminalFailure(state.auditContext.lifecycle, outcome, {
        durationMs: this.createAuditDuration(state),
        exceptionType: auditOptions.exceptionType,
        pageClosed: auditOptions.pageClosed,
        phase: auditOptions.auditPhase ?? state.audit.toPhase(phase),
        postSubmission: this.isPostSubmissionPhase(phase),
        signalAborted: state.signal?.aborted === true,
      });
    }
    return outcome;
  }

  private createMetadata(
    phase: TranslationProviderPhase,
    state: OperationState,
    resultLength?: number,
  ): TranslationProviderOperationMetadata {
    const canonicalInfo = getTranslationProviderInfo(this.info.id);
    const metadataValid = canonicalInfo === this.info;
    return {
      ...(metadataValid
        ? {
            providerId: this.info.id,
            contractVersion: this.info.contractVersion,
          }
        : {}),
      ...(state.targetLanguage === undefined ? {} : { targetLanguage: state.targetLanguage }),
      ...(state.sourceLength === undefined ? {} : { sourceLength: state.sourceLength }),
      ...(resultLength === undefined ? {} : { resultLength }),
      durationMs: Math.max(0, this.dependencies.now() - state.startedAt),
      attemptCount: state.attemptCount,
      phase,
    };
  }

  private createAuditDuration(state: OperationState): number {
    return state.audit.durationMs(state.auditContext);
  }

  private createAuditMetadata(
    state: OperationState,
    options: {
      readonly pageClosed?: boolean;
      readonly postSubmission?: boolean;
      readonly resultLength?: number;
      readonly retryScheduled?: boolean;
      readonly recoveryScheduled?: boolean;
    } = {},
  ) {
    return state.audit.createMetadata(this.createMetadata('validation', state, options.resultLength), {
      durationMs: this.createAuditDuration(state),
      pageClosed: options.pageClosed,
      postSubmission: options.postSubmission,
      recoveryScheduled: options.recoveryScheduled,
      retryScheduled: options.retryScheduled,
    });
  }

  private phaseEntered(
    phase: TranslationProviderPhase,
    state: OperationState,
    options: {
      readonly pageClosed?: boolean;
      readonly postSubmission?: boolean;
      readonly resultLength?: number;
    } = {},
  ): void {
    state.auditContext.lifecycle.phaseEntered(state.audit.toPhase(phase), this.createAuditMetadata(state, options));
  }

  private phaseCompleted(
    phase: TranslationProviderPhase,
    state: OperationState,
    options: {
      readonly pageClosed?: boolean;
      readonly postSubmission?: boolean;
      readonly resultLength?: number;
    } = {},
  ): void {
    state.auditContext.lifecycle.phaseCompleted(state.audit.toPhase(phase), this.createAuditMetadata(state, options));
  }

  private retry(phase: TranslationProviderPhase, state: OperationState): void {
    state.auditContext.lifecycle.retry(
      state.audit.toPhase(phase),
      this.createAuditMetadata(state, {
        recoveryScheduled: true,
        retryScheduled: true,
      }),
    );
  }

  private recovery(state: OperationState): void {
    state.auditContext.lifecycle.recovery(
      'recovery',
      this.createAuditMetadata(
        {
          ...state,
          attemptCount: state.attemptCount + 1,
        },
        {
          pageClosed: true,
          recoveryScheduled: false,
          retryScheduled: false,
        },
      ),
    );
  }

  private isPostSubmissionPhase(phase: TranslationProviderPhase): boolean {
    return phase === 'submission' || phase === 'result' || phase === 'cleanup';
  }

  private async closeOwnedResources(operationKey?: string): Promise<boolean> {
    return this.browserResources.closePage(this.info.id, operationKey);
  }

  private async shutdownProvider(): Promise<void> {
    this.shutDown = true;
    this.generation += 1;
    this.initializationGeneration += 1;
    const closed = await this.browserResources.shutdown();
    if (!closed) {
      throw new Error('Translation provider cleanup failed');
    }
  }

  private cancelInitializationNow(): void {
    const operationKey = this.createOperationKey('initialization', this.initializationGeneration);
    this.initializationGeneration += 1;
    this.generation += 1;
    this.browserResources.interruptOperation(this.info.id, operationKey);
  }
}
