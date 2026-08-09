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
  type TranslationProviderInitializationOutcome,
  type TranslationProviderInitializationRequest,
  type TranslationProviderFailure,
  type TranslationProviderFailureCode,
  type TranslationProviderHookResult,
  type TranslationProviderOperationMetadata,
  type TranslationProviderOutcome,
  type TranslationProviderPhase,
  type TranslationProviderRequest,
} from './translationProviderContracts';
import {
  type TranslationProviderAudit,
  type TranslationProviderAuditOperationContext,
} from './translationProviderAudit';
import { matchTranslationResultLineEndings } from './translationResultText';

export { TRANSLATION_RESULT_TIMEOUT_MS } from './translationOperationLifecycle';
export const TRANSLATION_RESULT_POLL_INTERVAL_MS = 100;
export const TRANSLATION_RESULT_STABILITY_DELAY_MS = 500;

export interface BaseTranslateProviderDependencies {
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
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private generation = 0;
  private initializationGeneration = 0;
  private operationQueue: Promise<void> = Promise.resolve();
  private closePromise: Promise<boolean> | null = null;
  private shutDown = false;

  protected constructor(info: TranslationProviderInfo, dependencies: BaseTranslateProviderDependencies) {
    this.info = info;
    this.dependencies = dependencies;
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

  protected abstract clearVisibleState(page: Page): Promise<TranslationProviderHookResult>;

  private enqueueInitialization(
    request: TranslationProviderInitializationRequest,
  ): Promise<TranslationProviderInitializationOutcome> {
    const generation = this.initializationGeneration;
    const operation = this.operationQueue.then(() => this.runInitialization(request, generation));
    this.operationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private enqueueTranslation(request: TranslationProviderRequest): Promise<TranslationProviderOutcome> {
    const generation = ++this.generation;
    const operation = this.operationQueue.then(() => this.runTranslation(request, generation));
    this.operationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
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
      await this.closeOwnedResources();
      return this.createStaleFailure('submission', activeState);
    }
    this.phaseCompleted('submission', activeState, { postSubmission: true });

    this.phaseEntered('result', activeState, { postSubmission: true });
    const result = await this.awaitStableResult(preparation.page, preparation.previousResult, activeState);
    if (!result.success) return result;
    const resultText = matchTranslationResultLineEndings(rawSourceText, result.text);
    this.phaseCompleted('result', activeState, {
      postSubmission: true,
      resultLength: resultText.length,
    });

    this.phaseEntered('cleanup', activeState, {
      postSubmission: true,
      resultLength: resultText.length,
    });
    const clear = await this.invokeHook(() => this.clearVisibleState(preparation.page), 'cleanupFailure');
    if (!this.isOperationActive(activeState)) {
      await this.closeOwnedResources();
      return this.createStaleFailure('cleanup', activeState);
    }
    if (!clear.success) {
      const closed = await this.closeOwnedResources();
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

    return this.createSuccess(resultText, activeState, !clear.success);
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
    const closed = await this.closeOwnedResources();
    if (!closed) {
      return {
        success: false,
        outcome: this.createFailure('cleanupFailure', 'cleanup', state),
      };
    }
    this.recovery(state);
    return null;
  }

  private async ensurePage(
    state: OperationState,
  ): Promise<{ readonly success: true; readonly page: Page } | PreparationFailure> {
    if (this.context && this.page && !this.page.isClosed() && this.isOperationActive(state)) {
      return { success: true, page: this.page };
    }

    if (!this.isOperationActive(state)) {
      return {
        success: false,
        outcome: this.createStaleFailure('context', state),
      };
    }

    if (this.context || this.page) {
      const closed = await this.closeOwnedResources();
      if (!closed) {
        return {
          success: false,
          outcome: this.createFailure('cleanupFailure', 'cleanup', state),
        };
      }
    }

    try {
      const options = this.dependencies.createContextOptions(this.dependencies.cloakBrowserSettings.getWithSecret());
      // eslint-disable-next-line @eslint-react/naming-convention-context-name -- this is a Playwright browser context.
      const ownedBrowser = await this.dependencies.createContext(options);
      if (!this.isOperationActive(state)) {
        try {
          await ownedBrowser.close();
        } catch {
          // Ownership is not published, and stale outcomes remain non-applicable.
        }
        return {
          success: false,
          outcome: this.createStaleFailure('context', state),
        };
      }
      this.context = ownedBrowser;
      const page = await ownedBrowser.newPage();
      if (!this.isOperationActive(state) || this.context !== ownedBrowser) {
        this.releaseDetachedResources(page, ownedBrowser);
        return {
          success: false,
          outcome: this.createStaleFailure('context', state),
        };
      }
      this.page = page;
      return { success: true, page };
    } catch (error: unknown) {
      return {
        success: false,
        outcome: await this.createTerminalFailure(
          'navigationFailure',
          'context',
          state,
          normalizeProviderAuditExceptionType(error),
        ),
      };
    }
  }

  private async awaitStableResult(
    page: Page,
    previousResult: string,
    state: ValidatedOperationState,
  ): Promise<{ readonly success: true; readonly text: string } | TranslationProviderFailure> {
    const readAttempts = Math.max(
      1,
      Math.ceil(this.dependencies.resultTimeoutMs / this.dependencies.resultPollIntervalMs),
    );

    for (let attempt = 0; attempt < readAttempts; attempt += 1) {
      if (!this.isOperationActive(state)) {
        await this.closeOwnedResources();
        return this.createStaleFailure('result', state);
      }

      const firstRead = await this.invokeHook(() => this.readNormalizedResult(page), 'pageContractFailure');
      if (!firstRead.success) {
        return this.createTerminalFailure(firstRead.code, 'result', state, firstRead.exceptionType);
      }

      const candidate = firstRead.value;
      if (candidate.trim().length > 0 && candidate !== previousResult) {
        await this.dependencies.sleep(this.dependencies.resultStabilityDelayMs);
        if (!this.isOperationActive(state)) {
          await this.closeOwnedResources();
          return this.createStaleFailure('result', state);
        }

        const secondRead = await this.invokeHook(() => this.readNormalizedResult(page), 'pageContractFailure');
        if (!secondRead.success) {
          return this.createTerminalFailure(secondRead.code, 'result', state, secondRead.exceptionType);
        }
        if (candidate === secondRead.value) {
          const target = await this.invokeHook(
            () => this.verifySelectedTarget(page, state.targetLanguage),
            'pageContractFailure',
          );
          if (!target.success) {
            return this.createTerminalFailure(target.code, 'result', state, target.exceptionType);
          }
          return { success: true, text: candidate };
        }
      }

      if (attempt + 1 < readAttempts) {
        await this.dependencies.sleep(this.dependencies.resultPollIntervalMs);
      }
    }

    return this.createTerminalFailure('resultTimeoutOrEmpty', 'result', state);
  }

  private async createTerminalFailure(
    code: TranslationProviderFailureCode,
    phase: TranslationProviderPhase,
    state: OperationState,
    exceptionType?: ProviderAuditExceptionType,
    auditPhase?: 'consent-or-challenge',
  ): Promise<TranslationProviderFailure> {
    const closed = await this.closeOwnedResources();
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

  private createSuccess(text: string, state: ValidatedOperationState, pageClosed: boolean): TranslationProviderOutcome {
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
    state.auditContext.lifecycle.terminal(
      'cleanup',
      'success',
      state.audit.createMetadata(metadata, {
        durationMs: this.createAuditDuration(state),
        pageClosed,
        postSubmission: true,
      }),
    );
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
    state.audit.terminalFailure(state.auditContext.lifecycle, outcome, {
      durationMs: this.createAuditDuration(state),
      exceptionType: auditOptions.exceptionType,
      pageClosed: auditOptions.pageClosed,
      phase: auditOptions.auditPhase ?? state.audit.toPhase(phase),
      postSubmission: this.isPostSubmissionPhase(phase),
      signalAborted: state.signal?.aborted === true,
    });
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

  private async closeOwnedResources(): Promise<boolean> {
    if (this.closePromise) return this.closePromise;
    const closePromise = this.performCloseOwnedResources();
    this.closePromise = closePromise;
    try {
      return await closePromise;
    } finally {
      if (this.closePromise === closePromise) this.closePromise = null;
    }
  }

  private async performCloseOwnedResources(): Promise<boolean> {
    const page = this.page;
    const context = this.context;
    let pageClosed = page === null || page.isClosed();

    if (page && !pageClosed) {
      try {
        await page.close();
        pageClosed = true;
      } catch {
        pageClosed = false;
      }
    }
    if (pageClosed && this.page === page) this.page = null;

    if (context) {
      try {
        await context.close();
        if (this.context === context) this.context = null;
        if (this.page === page) this.page = null;
        return true;
      } catch {
        if (this.context === context && !pageClosed && this.page === null) this.page = page;
        return false;
      }
    }

    return pageClosed;
  }

  private async shutdownProvider(): Promise<void> {
    this.shutDown = true;
    this.generation += 1;
    this.initializationGeneration += 1;
    const closed = await this.closeOwnedResources();
    if (!closed) {
      throw new Error('Translation provider cleanup failed');
    }
  }

  private cancelInitializationNow(): void {
    this.initializationGeneration += 1;
    this.generation += 1;
    this.operationQueue = Promise.resolve();
    this.closePromise = null;
    const page = this.page;
    const context = this.context;
    if (this.page === page) this.page = null;
    if (this.context === context) this.context = null;
    this.releaseDetachedResources(page, context);
  }

  private releaseDetachedResources(page: Page | null, context: BrowserContext | null): void {
    const cleanup: Promise<unknown>[] = [];
    if (page) {
      try {
        if (!page.isClosed()) cleanup.push(page.close());
      } catch {
        // Detached provider resources remain unavailable to later generations.
      }
    }
    if (context) {
      try {
        cleanup.push(context.close());
      } catch {
        // Detached provider resources remain unavailable to later generations.
      }
    }
    if (cleanup.length > 0) void Promise.allSettled(cleanup);
  }
}
