import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';

import { createCloakBrowserTranslationContextOptions } from '@main/cloakBrowserLaunchOptions';
import { launchCloakContext } from '@main/cloakbrowser';
import { createLogger } from '@main/logger';
import {
  getTranslationLanguage,
  getTranslationProviderInfo,
  type TranslationProviderInfo,
} from '@shared/translationProvider';
import {
  translationHookFailure,
  type TranslationProviderDiagnostic,
  type TranslationProviderFailure,
  type TranslationProviderFailureCode,
  type TranslationProviderHookResult,
  type TranslationProviderOperationMetadata,
  type TranslationProviderOutcome,
  type TranslationProviderPhase,
  type TranslationProviderRequest,
} from './translationProviderContracts';

const DEFAULT_RESULT_TIMEOUT_MS = 15_000;
const DEFAULT_RESULT_POLL_INTERVAL_MS = 100;
export const TRANSLATION_RESULT_STABILITY_DELAY_MS = 500;

const log = createLogger('translation-provider');

export interface BaseTranslateProviderDependencies {
  readonly createContext: (options: LaunchContextOptions) => Promise<BrowserContext>;
  readonly createContextOptions: () => LaunchContextOptions;
  readonly emitDiagnostic: (diagnostic: TranslationProviderDiagnostic) => void;
  readonly now: () => number;
  readonly resultPollIntervalMs: number;
  readonly resultStabilityDelayMs: number;
  readonly resultTimeoutMs: number;
  readonly sleep: (delayMs: number) => Promise<void>;
}

interface OperationState {
  readonly attemptCount: number;
  readonly generation: number;
  readonly signal?: AbortSignal;
  readonly sourceLength: number;
  readonly startedAt: number;
  readonly targetLanguage?: string;
}

interface ValidatedOperationState extends OperationState {
  readonly targetLanguage: string;
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

const DEFAULT_DEPENDENCIES: BaseTranslateProviderDependencies = {
  createContext: launchCloakContext,
  createContextOptions: createCloakBrowserTranslationContextOptions,
  emitDiagnostic: (diagnostic) => {
    if (diagnostic.outcome === 'success') {
      log.info('Translation provider operation completed', diagnostic);
      return;
    }
    log.warn('Translation provider operation failed', diagnostic);
  },
  now: () => Date.now(),
  resultPollIntervalMs: DEFAULT_RESULT_POLL_INTERVAL_MS,
  resultStabilityDelayMs: TRANSLATION_RESULT_STABILITY_DELAY_MS,
  resultTimeoutMs: DEFAULT_RESULT_TIMEOUT_MS,
  sleep: (delayMs) =>
    new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    }),
};

/** Shared main-process lifecycle; subclasses implement only public-page behavior. */
export abstract class BaseTranslateProvider {
  public readonly info: TranslationProviderInfo;
  public readonly translate: (request: TranslationProviderRequest) => Promise<TranslationProviderOutcome>;
  public readonly shutdown: () => Promise<void>;

  private readonly dependencies: BaseTranslateProviderDependencies;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private generation = 0;
  private operationQueue: Promise<void> = Promise.resolve();
  private closePromise: Promise<boolean> | null = null;
  private shutDown = false;

  protected constructor(info: TranslationProviderInfo, dependencies: Partial<BaseTranslateProviderDependencies> = {}) {
    this.info = info;
    this.dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
    this.translate = (request) => this.enqueueTranslation(request);
    this.shutdown = () => this.shutdownProvider();
    Object.defineProperties(this, {
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

  private enqueueTranslation(request: TranslationProviderRequest): Promise<TranslationProviderOutcome> {
    const generation = ++this.generation;
    const operation = this.operationQueue.then(() => this.runTranslation(request, generation));
    this.operationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
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
      attemptCount: 1,
      generation,
      signal: request.signal,
      sourceLength,
      startedAt,
    };
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

    const preparation = await this.preparePage(state);
    if (!preparation.success) return preparation.outcome;

    const activeState: ValidatedOperationState = {
      ...state,
      attemptCount: preparation.attemptCount,
    };
    if (!this.isOperationActive(activeState)) {
      return this.createStaleFailure('submission', activeState);
    }

    const insertion = await this.invokeHook(
      () => this.insertSourceText(preparation.page, rawSourceText),
      'pageContractFailure',
    );
    if (!insertion.success) {
      return this.createTerminalFailure(insertion.code, 'submission', activeState);
    }
    if (!this.isOperationActive(activeState)) {
      await this.closeOwnedResources();
      return this.createStaleFailure('submission', activeState);
    }

    const result = await this.awaitStableResult(preparation.page, preparation.previousResult, activeState);
    if (!result.success) return result;

    const clear = await this.invokeHook(() => this.clearVisibleState(preparation.page), 'cleanupFailure');
    if (!this.isOperationActive(activeState)) {
      await this.closeOwnedResources();
      return this.createStaleFailure('cleanup', activeState);
    }
    if (!clear.success) {
      const closed = await this.closeOwnedResources();
      if (!closed) {
        return this.createFailure('cleanupFailure', 'cleanup', activeState, result.text.length);
      }
    }

    return this.createSuccess(result.text, activeState);
  }

  /** Runs the bounded pre-submission page preparation and recovery sequence. */
  private async preparePage(state: ValidatedOperationState): Promise<PreparationResult> {
    for (let attemptCount = 1; attemptCount <= 2; attemptCount += 1) {
      const activeState: ValidatedOperationState = {
        ...state,
        attemptCount,
      };
      const pageResult = await this.ensurePage(activeState);
      if (!pageResult.success) return pageResult;
      const page = pageResult.page;

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

      let recover = false;
      for (const step of steps) {
        const hookResult = await this.invokeHook(step.run, step.fallbackCode);
        if (!this.isOperationActive(activeState)) {
          return {
            success: false,
            outcome: this.createStaleFailure(step.phase, activeState),
          };
        }
        if (!hookResult.success) {
          if (attemptCount === 1 && hookResult.recoverableBeforeSubmission === true) {
            recover = true;
            break;
          }
          return {
            success: false,
            outcome: await this.createTerminalFailure(hookResult.code, step.phase, activeState),
          };
        }
      }

      if (recover) {
        const closed = await this.closeOwnedResources();
        if (!closed) {
          return {
            success: false,
            outcome: this.createFailure('cleanupFailure', 'cleanup', activeState),
          };
        }
        continue;
      }

      const staleState = await this.invokeHook(() => this.clearStaleState(page), 'pageContractFailure');
      if (!this.isOperationActive(activeState)) {
        return {
          success: false,
          outcome: this.createStaleFailure('staleState', activeState),
        };
      }
      if (!staleState.success) {
        if (attemptCount === 1 && staleState.recoverableBeforeSubmission === true) {
          const closed = await this.closeOwnedResources();
          if (!closed) {
            return {
              success: false,
              outcome: this.createFailure('cleanupFailure', 'cleanup', activeState),
            };
          }
          continue;
        }
        return {
          success: false,
          outcome: await this.createTerminalFailure(staleState.code, 'staleState', activeState),
        };
      }

      return {
        success: true,
        page,
        previousResult: staleState.value,
        attemptCount,
      };
    }

    return {
      success: false,
      outcome: await this.createTerminalFailure('pageContractFailure', 'readiness', { ...state, attemptCount: 2 }),
    };
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
      const options = this.dependencies.createContextOptions();
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
      this.page = page;
      return { success: true, page };
    } catch {
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
        return this.createTerminalFailure(firstRead.code, 'result', state);
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
          return this.createTerminalFailure(secondRead.code, 'result', state);
        }
        if (candidate === secondRead.value) {
          const target = await this.invokeHook(
            () => this.verifySelectedTarget(page, state.targetLanguage),
            'pageContractFailure',
          );
          if (!target.success) {
            return this.createTerminalFailure(target.code, 'result', state);
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
  ): Promise<TranslationProviderFailure> {
    const closed = await this.closeOwnedResources();
    return this.createFailure(closed ? code : 'cleanupFailure', closed ? phase : 'cleanup', state);
  }

  private async invokeHook<T>(
    hook: () => Promise<TranslationProviderHookResult<T>>,
    fallbackCode: TranslationProviderFailureCode,
  ): Promise<TranslationProviderHookResult<T>> {
    try {
      return await hook();
    } catch {
      return translationHookFailure(fallbackCode);
    }
  }

  private isOperationActive(state: OperationState): boolean {
    return !this.shutDown && state.generation === this.generation && state.signal?.aborted !== true;
  }

  private createSuccess(text: string, state: ValidatedOperationState): TranslationProviderOutcome {
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
    this.emitDiagnostic(outcome);
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
  ): TranslationProviderFailure {
    const outcome: TranslationProviderFailure = {
      success: false,
      code,
      discard: code === 'cancelledOrStaleOperation',
      metadata: this.createMetadata(phase, state, resultLength),
    };
    this.emitDiagnostic(outcome);
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
      sourceLength: state.sourceLength,
      ...(resultLength === undefined ? {} : { resultLength }),
      durationMs: Math.max(0, this.dependencies.now() - state.startedAt),
      attemptCount: state.attemptCount,
      phase,
    };
  }

  private emitDiagnostic(outcome: TranslationProviderOutcome): void {
    const diagnostic: TranslationProviderDiagnostic = {
      ...outcome.metadata,
      outcome: outcome.success ? 'success' : 'failure',
      ...(outcome.success ? {} : { failureCode: outcome.code }),
    };
    try {
      this.dependencies.emitDiagnostic(diagnostic);
    } catch {
      // Diagnostics must never change the operation outcome.
    }
  }

  private async closeOwnedResources(): Promise<boolean> {
    if (this.closePromise) return this.closePromise;
    this.closePromise = this.performCloseOwnedResources();
    try {
      return await this.closePromise;
    } finally {
      this.closePromise = null;
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
    if (pageClosed) this.page = null;

    if (context) {
      try {
        await context.close();
        this.context = null;
        this.page = null;
        return true;
      } catch {
        this.context = context;
        if (!pageClosed) this.page = page;
        return false;
      }
    }

    return pageClosed;
  }

  private async shutdownProvider(): Promise<void> {
    this.shutDown = true;
    this.generation += 1;
    const closed = await this.closeOwnedResources();
    if (!closed) {
      throw new Error('Translation provider cleanup failed');
    }
  }
}
