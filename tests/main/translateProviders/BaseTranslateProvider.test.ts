/* eslint-disable max-classes-per-file -- focused lifecycle fakes share one deterministic harness. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';

import {
  BaseTranslateProvider,
  TRANSLATION_RESULT_STABILITY_DELAY_MS,
  type BaseTranslateProviderDependencies,
} from '@main/translateProviders/BaseTranslateProvider';
import {
  TRANSLATION_RESULT_TIMEOUT_MS,
  TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS,
  TranslationOperationLifecycle,
  type TranslationOperationLifecycleDependencies,
} from '@main/translateProviders/translationOperationLifecycle';
import {
  classifyTranslationProviderCompletionControl,
  translationHookFailure,
  translationHookSuccess,
  type TranslationProviderHookResult,
  type TranslationProviderResultObservation,
} from '@main/translateProviders/translationProviderContracts';
import { TRANSLATION_PROVIDER_INFO, type TranslationProviderId } from '@shared/translationProvider';
import { RecordingTranslationProviderAudit, TranslationProviderRequestFixture } from './translationAuditTestUtils';
import { TestCloakBrowserSettingsRepository } from '../appConfigTestUtils';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => {
      assert.ok(resolvePromise);
      resolvePromise(value);
    },
  };
}

class FakePage {
  closeCalls = 0;
  closeFails = false;
  closed = false;

  async close(): Promise<void> {
    this.closeCalls += 1;
    if (this.closeFails) throw new Error('private page close error');
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

class FakeContext {
  closeCalls = 0;
  closeDeferred: Deferred<void> | null = null;
  closeFails = false;
  newPageCalls = 0;
  readonly page = new FakePage();

  async close(): Promise<void> {
    this.closeCalls += 1;
    if (this.closeFails) throw new Error('private context close error');
    if (this.closeDeferred) await this.closeDeferred.promise;
    this.page.closed = true;
  }

  async newPage(): Promise<Page> {
    this.newPageCalls += 1;
    return this.page as unknown as Page;
  }
}

class ControlledLifecycleDependencies implements TranslationOperationLifecycleDependencies {
  private currentMs = 0;

  public activeNow = (): number => this.currentMs;
  public clearTimeout = (): void => undefined;
  public createAbortController = (): AbortController => new AbortController();
  public setTimeout = (): number => 0;
  public subscribeResume = (): (() => void) => () => undefined;
  public wallNow = (): number => this.currentMs;

  public advance(milliseconds: number): void {
    this.currentMs += milliseconds;
  }
}

function createLifecycle(dependencies = new ControlledLifecycleDependencies()): {
  readonly dependencies: ControlledLifecycleDependencies;
  readonly lifecycle: TranslationOperationLifecycle;
} {
  return {
    dependencies,
    lifecycle: new TranslationOperationLifecycle(dependencies, {
      attemptCount: 1,
      contractVersion: '2026-08-09',
      generation: 0,
      providerId: 'google',
      sourceLength: 'source text'.length,
      targetLanguage: 'en',
    }),
  };
}

class FakeTranslateProvider extends BaseTranslateProvider {
  readonly calls = {
    clear: 0,
    insert: 0,
    navigate: 0,
    observe: 0,
    readiness: 0,
    read: 0,
    sourceDetection: 0,
    staleState: 0,
    targetSelection: 0,
    targetVerification: 0,
  };

  clearResult: TranslationProviderHookResult = translationHookSuccess();
  clearDeferred: Deferred<TranslationProviderHookResult> | null = null;
  deliverBeforeCleanup = false;
  insertResult: TranslationProviderHookResult = translationHookSuccess();
  navigationError: Error | null = null;
  navigationDeferred: Deferred<TranslationProviderHookResult> | null = null;
  navigationResult: TranslationProviderHookResult = translationHookSuccess();
  observationResults: TranslationProviderHookResult<TranslationProviderResultObservation>[] | null = null;
  previousResult = '';
  readinessResults: TranslationProviderHookResult[] = [translationHookSuccess()];
  readDeferred: Deferred<TranslationProviderHookResult<string>> | null = null;
  readResults: TranslationProviderHookResult<string>[] = [translationHookSuccess('translated')];
  sourceDetectionResult: TranslationProviderHookResult = translationHookSuccess();
  staleStateResult: TranslationProviderHookResult<string> | null = null;
  targetResult: TranslationProviderHookResult = translationHookSuccess();
  targetVerificationResult: TranslationProviderHookResult = translationHookSuccess();
  insertedTexts: string[] = [];
  selectedTargets: string[] = [];

  constructor(dependencies: BaseTranslateProviderDependencies) {
    super(TRANSLATION_PROVIDER_INFO.google, dependencies);
  }

  protected async navigateAndHandleConsent(
    _page: Page,
    targetLanguage: string,
  ): Promise<TranslationProviderHookResult> {
    this.calls.navigate += 1;
    this.selectedTargets.push(`navigate:${targetLanguage}`);
    if (this.navigationError) throw this.navigationError;
    if (this.navigationDeferred) {
      const deferred = this.navigationDeferred;
      this.navigationDeferred = null;
      return deferred.promise;
    }
    return this.navigationResult;
  }

  protected async inspectReadiness(): Promise<TranslationProviderHookResult> {
    this.calls.readiness += 1;
    return this.readinessResults.shift() ?? translationHookSuccess();
  }

  protected async enableAutomaticSourceDetection(): Promise<TranslationProviderHookResult> {
    this.calls.sourceDetection += 1;
    return this.sourceDetectionResult;
  }

  protected async selectAndVerifyTarget(_page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    this.calls.targetSelection += 1;
    this.selectedTargets.push(targetLanguage);
    return this.targetResult;
  }

  protected async clearStaleState(): Promise<TranslationProviderHookResult<string>> {
    this.calls.staleState += 1;
    return this.staleStateResult ?? translationHookSuccess(this.previousResult);
  }

  protected async insertSourceText(_page: Page, sourceText: string): Promise<TranslationProviderHookResult> {
    this.calls.insert += 1;
    this.insertedTexts.push(sourceText);
    return this.insertResult;
  }

  protected async readNormalizedResult(): Promise<TranslationProviderHookResult<string>> {
    this.calls.read += 1;
    if (this.readDeferred) {
      const deferred = this.readDeferred;
      this.readDeferred = null;
      return deferred.promise;
    }
    return this.readResults.shift() ?? translationHookSuccess('translated');
  }

  protected async verifySelectedTarget(): Promise<TranslationProviderHookResult> {
    this.calls.targetVerification += 1;
    return this.targetVerificationResult;
  }

  protected override async observeResult(
    page: Page,
    targetLanguage: string,
  ): Promise<TranslationProviderHookResult<TranslationProviderResultObservation>> {
    this.calls.observe += 1;
    return this.observationResults?.shift() ?? super.observeResult(page, targetLanguage);
  }

  protected async clearVisibleState(): Promise<TranslationProviderHookResult> {
    this.calls.clear += 1;
    if (this.clearDeferred) {
      const deferred = this.clearDeferred;
      this.clearDeferred = null;
      return deferred.promise;
    }
    return this.clearResult;
  }

  protected override deliverResultBeforeVisibleCleanup(): boolean {
    return this.deliverBeforeCleanup;
  }
}

interface Harness {
  readonly contexts: FakeContext[];
  readonly options: LaunchContextOptions[];
  readonly provider: FakeTranslateProvider;
  readonly sleeps: number[];
}

function createHarness(resultTimeoutMs = 31): Harness {
  const contexts: FakeContext[] = [];
  const options: LaunchContextOptions[] = [];
  const sleeps: number[] = [];
  let now = 1_000;
  const provider = new FakeTranslateProvider({
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    createContext: async (contextOptions) => {
      options.push(contextOptions);
      const context = new FakeContext();
      contexts.push(context);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({
      headless: true,
      humanize: true,
      locale: 'en-US',
      timezone: 'Europe/Moscow',
    }),
    now: () => now,
    resultPollIntervalMs: 10,
    resultStabilityDelayMs: 5,
    resultTimeoutMs,
    sleep: async (delayMs) => {
      sleeps.push(delayMs);
      now += delayMs;
    },
  });
  return { contexts, options, provider, sleeps };
}

const requestFixture = new TranslationProviderRequestFixture({
  providerId: 'google',
  sourceText: 'source text',
  targetLanguage: 'en',
});

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail('Expected condition did not become true');
}

describe('BaseTranslateProvider', () => {
  it('classifies provider-owned copy readiness without guessing from result text', () => {
    assert.equal(classifyTranslationProviderCompletionControl({ visible: 0, visibleEnabled: 0 }), 'unavailable');
    assert.equal(classifyTranslationProviderCompletionControl({ visible: 1, visibleEnabled: 0 }), 'incomplete');
    assert.equal(classifyTranslationProviderCompletionControl({ visible: 1, visibleEnabled: 1 }), 'verified-complete');
    assert.equal(classifyTranslationProviderCompletionControl({ visible: 2, visibleEnabled: 2 }), 'ambiguous');
  });

  it('uses the required production stability window', () => {
    assert.equal(TRANSLATION_RESULT_STABILITY_DELAY_MS, 500);
  });

  it('prepares and reuses the selected provider page without submitting source text', async () => {
    const harness = createHarness();
    const audit = new RecordingTranslationProviderAudit();
    const fixture = new TranslationProviderRequestFixture(requestFixture.defaults, audit);

    const initialization = await harness.provider.initialize(fixture.createInitialization());

    assert.equal(initialization.success, true);
    assert.equal(harness.contexts.length, 1);
    assert.deepEqual(harness.provider.selectedTargets, ['navigate:en', 'en']);
    assert.equal(harness.provider.calls.insert, 0);
    assert.equal(harness.provider.calls.read, 0);
    assert.equal(harness.provider.calls.staleState, 0);
    assert.equal(audit.events.filter((event) => event.event === 'terminal').length, 1);
    assert.equal(audit.events[audit.events.length - 1]?.outcome, 'success');

    assert.equal((await harness.provider.translate(fixture.create())).success, true);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.newPageCalls, 1);
    assert.equal(harness.provider.calls.insert, 1);
  });

  it('closes a failed warm-up and lets the first translation recover with a new page', async () => {
    const harness = createHarness();
    harness.provider.navigationResult = translationHookFailure('navigationFailure');

    const initialization = await harness.provider.initialize(requestFixture.createInitialization());

    assert.equal(initialization.success, false);
    assert.equal(initialization.success ? null : initialization.code, 'navigationFailure');
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);

    harness.provider.navigationResult = translationHookSuccess();
    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, true);
    assert.equal(harness.contexts.length, 2);
    assert.equal(harness.contexts[1]?.newPageCalls, 1);
  });

  it('queues the first translation behind in-flight initialization without invalidating preparation', async () => {
    const harness = createHarness();

    const initialization = harness.provider.initialize(requestFixture.createInitialization());
    const translation = harness.provider.translate(requestFixture.create());
    const [initializationOutcome, translationOutcome] = await Promise.all([initialization, translation]);

    assert.equal(initializationOutcome.success, true);
    assert.equal(translationOutcome.success, true);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.newPageCalls, 1);
    assert.equal(harness.provider.calls.insert, 1);
  });

  it('retains a verified clean page after selected-text lifecycle completion', async () => {
    const harness = createHarness();
    const { lifecycle } = createLifecycle();
    const outcome = await harness.provider.translate(requestFixture.create({ lifecycle, signal: lifecycle.signal }));

    assert.equal(outcome.success, true);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 0);
    assert.deepEqual(lifecycle.check(), { kind: 'completed' });

    assert.equal((await harness.provider.translate(requestFixture.create())).success, true);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.newPageCalls, 1);
  });

  it('detaches a cancelled initialization queue and preserves retry-owned resources', async () => {
    const harness = createHarness();
    const firstNavigation = createDeferred<TranslationProviderHookResult>();
    harness.provider.navigationDeferred = firstNavigation;

    const first = harness.provider.initialize(requestFixture.createInitialization());
    await waitUntil(() => harness.provider.calls.navigate === 1);

    harness.provider.cancelInitialization();
    const retry = await harness.provider.initialize(requestFixture.createInitialization());

    assert.equal(retry.success, true);
    assert.equal(harness.contexts.length, 2);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
    assert.equal(harness.contexts[1]?.closeCalls, 0);

    firstNavigation.resolve(translationHookSuccess());
    const stale = await first;
    assert.equal(stale.success, false);
    assert.equal(stale.success ? null : stale.code, 'cancelledOrStaleOperation');
    assert.equal(harness.contexts[1]?.closeCalls, 0);
    assert.equal((await harness.provider.translate(requestFixture.create())).success, true);
    assert.equal(harness.contexts.length, 2);
  });

  it('lazily creates and reuses one nonpersistent context per provider instance', async () => {
    const first = createHarness();
    const second = createHarness();

    assert.equal(first.contexts.length, 0);
    assert.equal((await first.provider.translate(requestFixture.create())).success, true);
    assert.equal((await first.provider.translate(requestFixture.create())).success, true);
    assert.equal((await second.provider.translate(requestFixture.create())).success, true);

    assert.equal(first.contexts.length, 1);
    assert.equal(first.contexts[0]?.newPageCalls, 1);
    assert.equal(second.contexts.length, 1);
    assert.notEqual(first.contexts[0], second.contexts[0]);
    assert.equal(first.options.length, 1);
    assert.equal(first.options[0]?.headless, true);
    assert.equal('userDataDir' in (first.options[0] ?? {}), false);
    assert.equal(first.provider.selectedTargets[0], 'navigate:en');
  });

  it('invalidates an unexpectedly closed page before creating a replacement context', async () => {
    const harness = createHarness();
    assert.equal((await harness.provider.translate(requestFixture.create())).success, true);
    const firstContext = harness.contexts[0];
    assert.ok(firstContext);
    firstContext.page.closed = true;

    assert.equal((await harness.provider.translate(requestFixture.create())).success, true);

    assert.equal(firstContext.closeCalls, 1);
    assert.equal(harness.contexts.length, 2);
  });

  it('rejects unsupported, empty, and over-limit requests before context creation', async () => {
    const harness = createHarness();
    const unsupportedProvider = await harness.provider.translate(
      requestFixture.create({
        providerId: 'private-provider' as TranslationProviderId,
        targetLanguage: 'private-target',
      }),
    );
    const unsupportedTarget = await harness.provider.translate(
      requestFixture.create({ targetLanguage: 'private-target' }),
    );
    const empty = await harness.provider.translate(requestFixture.create({ sourceText: ' \n ' }));
    const overLimit = await harness.provider.translate(requestFixture.create({ sourceText: 'x'.repeat(5_001) }));

    assert.equal(unsupportedProvider.success, false);
    assert.equal(unsupportedProvider.success ? null : unsupportedProvider.code, 'unsupportedProvider');
    assert.equal(unsupportedTarget.success, false);
    assert.equal(unsupportedTarget.success ? null : unsupportedTarget.code, 'unsupportedTargetLanguage');
    assert.equal(empty.success ? null : empty.code, 'emptyInput');
    assert.equal(overLimit.success ? null : overLimit.code, 'inputTooLong');
    assert.equal(harness.contexts.length, 0);

    const serialized = JSON.stringify({
      outcomes: [unsupportedProvider, unsupportedTarget],
    });
    assert.equal(serialized.includes('private-provider'), false);
    assert.equal(serialized.includes('private-target'), false);
  });

  it('performs one clean pre-submission recovery without replaying source text', async () => {
    const harness = createHarness();
    const audit = new RecordingTranslationProviderAudit();
    harness.provider.readinessResults = [
      translationHookFailure('pageContractFailure', {
        recoverableBeforeSubmission: true,
      }),
      translationHookSuccess(),
    ];

    const outcome = await harness.provider.translate(
      new TranslationProviderRequestFixture(requestFixture.defaults, audit).create(),
    );

    assert.equal(outcome.success, true);
    assert.equal(outcome.metadata.attemptCount, 2);
    assert.equal(harness.contexts.length, 2);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
    assert.equal(harness.provider.calls.insert, 1);
    assert.deepEqual(harness.provider.insertedTexts, ['source text']);
    assert.equal(audit.events.filter((event) => event.event === 'retry').length, 1);
    assert.equal(audit.events.filter((event) => event.event === 'recovery').length, 1);
    assert.equal(audit.events.filter((event) => event.event === 'terminal').length, 1);
    assert.equal(audit.events[audit.events.length - 1]?.event, 'terminal');
  });

  it('never recreates or reinserts after the submission boundary', async () => {
    const harness = createHarness();
    harness.provider.readResults = [
      translationHookFailure('pageContractFailure', {
        recoverableBeforeSubmission: true,
      }),
    ];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.provider.calls.insert, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });

  it('rejects stale and changing results until two normalized reads agree', async () => {
    const harness = createHarness();
    const audit = new RecordingTranslationProviderAudit();
    harness.provider.previousResult = 'stale';
    harness.provider.readResults = [
      translationHookSuccess('stale'),
      translationHookSuccess('changing-1'),
      translationHookSuccess('changing-2'),
      translationHookSuccess('stable'),
      translationHookSuccess('stable'),
    ];

    const outcome = await harness.provider.translate(
      new TranslationProviderRequestFixture(requestFixture.defaults, audit).create(),
    );

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'stable');
    assert.deepEqual(harness.sleeps, [10, 5, 10, 5]);
    assert.equal(harness.provider.calls.targetVerification, 1);
    assert.equal(audit.events.filter((event) => event.phase === 'result').length, 2);
  });

  it('returns a terminal timeout for an empty result without replaying insertion', async () => {
    const harness = createHarness();
    harness.provider.readResults = [translationHookSuccess(''), translationHookSuccess(''), translationHookSuccess('')];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'resultTimeoutOrEmpty');
    assert.equal(harness.provider.calls.insert, 1);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });

  it('accepts a target-verified complete observation without the fallback delay', async () => {
    const harness = createHarness();
    harness.provider.observationResults = [
      translationHookSuccess({
        completion: 'verified-complete',
        targetVerified: true,
        text: 'translated',
      }),
    ];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.equal(harness.provider.calls.observe, 1);
    assert.equal(harness.provider.calls.targetVerification, 0);
    assert.deepEqual(harness.sleeps, []);
  });

  it('does not accept a partial observation before the provider marks the final result copy-ready', async () => {
    const harness = createHarness();
    harness.provider.observationResults = [
      translationHookSuccess({
        completion: 'incomplete',
        targetVerified: true,
        text: 'partial',
      }),
      translationHookSuccess({
        completion: 'verified-complete',
        targetVerified: true,
        text: 'complete',
      }),
    ];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'complete');
    assert.equal(harness.provider.calls.observe, 2);
    assert.equal(harness.provider.calls.targetVerification, 0);
    assert.deepEqual(harness.sleeps, [10]);
  });

  it('treats the exact result deadline as expired before a delayed fallback confirmation', async () => {
    const harness = createHarness(15);
    harness.provider.previousResult = 'stale';
    harness.provider.readResults = [
      translationHookSuccess('stale'),
      translationHookSuccess('candidate'),
      translationHookSuccess('candidate'),
    ];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'resultTimeoutOrEmpty');
    assert.deepEqual(harness.sleeps, [10, 5]);
    assert.equal(harness.provider.calls.targetVerification, 0);
  });

  it('suppresses a late result after shutdown invalidates its generation', async () => {
    const harness = createHarness();
    const deferred = createDeferred<TranslationProviderHookResult<string>>();
    harness.provider.readDeferred = deferred;
    const operation = harness.provider.translate(requestFixture.create());
    await waitUntil(() => harness.provider.calls.read === 1);

    await harness.provider.shutdown();
    deferred.resolve(translationHookSuccess('late private result'));
    const outcome = await operation;

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'cancelledOrStaleOperation');
    assert.equal(outcome.success ? null : outcome.discard, true);
    assert.equal('text' in outcome, false);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });

  it('returns the shared result-budget timeout while a Playwright read ignores abort', async () => {
    const harness = createHarness();
    const deferred = createDeferred<TranslationProviderHookResult<string>>();
    const { dependencies, lifecycle } = createLifecycle();
    harness.provider.readDeferred = deferred;

    const operation = harness.provider.translate(requestFixture.create({ lifecycle, signal: lifecycle.signal }));
    await waitUntil(() => harness.provider.calls.read === 1);

    dependencies.advance(TRANSLATION_RESULT_TIMEOUT_MS);
    assert.deepEqual(lifecycle.check(), { deadline: 'result', kind: 'timed-out' });
    const outcome = await operation;

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'timed-out');
    assert.equal(harness.contexts[0]?.closeCalls, 1);
    assert.equal(harness.provider.calls.insert, 1);

    deferred.resolve(translationHookSuccess('late private result'));
    await Promise.resolve();
    assert.equal(harness.provider.calls.insert, 1);
  });

  it('quarantines a hanging cleanup and releases only after its late close confirms', async () => {
    const harness = createHarness();
    const read = createDeferred<TranslationProviderHookResult<string>>();
    const close = createDeferred<void>();
    const { dependencies, lifecycle } = createLifecycle();
    harness.provider.readDeferred = read;

    const operation = harness.provider.translate(requestFixture.create({ lifecycle, signal: lifecycle.signal }));
    await waitUntil(() => harness.provider.calls.read === 1);
    const context = harness.contexts[0];
    assert.ok(context);
    context.closeDeferred = close;

    lifecycle.cancel('caller');
    dependencies.advance(TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS);
    assert.deepEqual(lifecycle.check(), { kind: 'cleanup-failure' });
    const outcome = await operation;

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'cleanupFailure');
    assert.equal(harness.contexts.length, 1);

    close.resolve();
    read.resolve(translationHookSuccess('late private result'));
    await Promise.resolve();
    await Promise.resolve();

    const retry = await harness.provider.translate(requestFixture.create());
    assert.equal(retry.success, true);
    assert.equal(harness.contexts.length, 2);
  });

  it('discards an already-cancelled request before browser creation', async () => {
    const harness = createHarness();
    const abortController = new AbortController();
    abortController.abort();

    const outcome = await harness.provider.translate(requestFixture.create({ signal: abortController.signal }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'cancelledOrStaleOperation');
    assert.equal(outcome.success ? null : outcome.discard, true);
    assert.equal(harness.contexts.length, 0);
  });

  it('returns success after clear or confirmed close, but never after cleanup failure', async () => {
    const clearHarness = createHarness();
    const clearOutcome = await clearHarness.provider.translate(requestFixture.create());
    assert.equal(clearOutcome.success, true);
    assert.equal(clearHarness.contexts[0]?.closeCalls, 0);

    const closeHarness = createHarness();
    closeHarness.provider.clearResult = translationHookFailure('cleanupFailure');
    const closeOutcome = await closeHarness.provider.translate(requestFixture.create());
    assert.equal(closeOutcome.success, true);
    assert.equal(closeHarness.contexts[0]?.closeCalls, 1);

    const failureHarness = createHarness();
    const failureAudit = new RecordingTranslationProviderAudit();
    failureHarness.provider.clearResult = translationHookFailure('cleanupFailure');
    const failedContextPromise = waitUntil(() => failureHarness.contexts.length === 1);
    const operation = failureHarness.provider.translate(
      new TranslationProviderRequestFixture(requestFixture.defaults, failureAudit).create(),
    );
    await failedContextPromise;
    const failedContext = failureHarness.contexts[0];
    assert.ok(failedContext);
    failedContext.page.closeFails = true;
    failedContext.closeFails = true;
    const failureOutcome = await operation;

    assert.equal(failureOutcome.success, false);
    assert.equal(failureOutcome.success ? null : failureOutcome.code, 'cleanupFailure');
    assert.equal('text' in failureOutcome, false);
    assert.equal(failureOutcome.metadata.resultLength, 'translated'.length);
    assert.equal(failureAudit.events.filter((event) => event.event === 'terminal').length, 1);
    assert.equal(failureAudit.events[failureAudit.events.length - 1]?.metadata?.errorClass, 'cleanup');

    await assert.rejects(failureHarness.provider.shutdown(), /Translation provider cleanup failed/u);
    failedContext.page.closeFails = false;
    failedContext.closeFails = false;
    await failureHarness.provider.shutdown();
    assert.equal(failedContext.closeCalls, 3);
  });

  it('requires acknowledged result delivery before starting visible cleanup', async () => {
    const rejected = createHarness();
    rejected.provider.deliverBeforeCleanup = true;
    const rejectedOutcome = await rejected.provider.translate(requestFixture.create({ onResultReady: () => false }));

    assert.equal(rejectedOutcome.success, false);
    assert.equal(rejectedOutcome.success ? null : rejectedOutcome.code, 'resultDeliveryFailure');
    assert.equal(rejected.provider.calls.clear, 0);

    const throwing = createHarness();
    throwing.provider.deliverBeforeCleanup = true;
    const throwingOutcome = await throwing.provider.translate(
      requestFixture.create({
        onResultReady: () => {
          throw new Error('private clipboard failure');
        },
      }),
    );

    assert.equal(throwingOutcome.success, false);
    assert.equal(throwingOutcome.success ? null : throwingOutcome.code, 'resultDeliveryFailure');
    assert.equal(throwing.provider.calls.clear, 0);
  });

  it('keeps pre-cleanup result delivery disabled unless a provider explicitly opts in', async () => {
    const harness = createHarness();
    let delivered = false;

    const outcome = await harness.provider.translate(
      requestFixture.create({
        onResultReady: () => {
          delivered = true;
          return true;
        },
      }),
    );

    assert.equal(outcome.success, true);
    assert.equal(harness.provider.calls.clear, 1);
    assert.equal(delivered, false);
  });

  it('acknowledges delivery before cleanup and holds settlement while cleanup is pending', async () => {
    const harness = createHarness();
    harness.provider.deliverBeforeCleanup = true;
    const clear = createDeferred<TranslationProviderHookResult>();
    harness.provider.clearDeferred = clear;
    let delivered = false;

    const operation = harness.provider.translate(
      requestFixture.create({
        onResultReady: () => {
          assert.equal(harness.provider.calls.clear, 0);
          delivered = true;
          return true;
        },
      }),
    );
    await waitUntil(() => harness.provider.calls.clear === 1);

    assert.equal(delivered, true);
    let settled = false;
    void operation.then(() => {
      settled = true;
    });
    await Promise.resolve();
    assert.equal(settled, false);

    clear.resolve(translationHookSuccess());
    const outcome = await operation;
    assert.equal(outcome.success, true);
  });

  it('maps raw hook errors to sanitized audit metadata and keeps final entrypoints fixed', async () => {
    const harness = createHarness();
    const audit = new RecordingTranslationProviderAudit();
    harness.provider.navigationError = new Error('https://private.invalid/?text=private-source raw response');

    const outcome = await harness.provider.translate(
      new TranslationProviderRequestFixture(requestFixture.defaults, audit).create(),
    );
    const serialized = JSON.stringify({
      auditEvents: audit.events,
      outcome,
    });

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'navigationFailure');
    assert.equal(serialized.includes('private.invalid'), false);
    assert.equal(serialized.includes('private-source'), false);
    assert.equal(audit.events.filter((event) => event.event === 'terminal').length, 1);
    assert.equal(audit.events[audit.events.length - 1]?.metadata?.exceptionType, 'Error');
    assert.equal(audit.events[audit.events.length - 1]?.metadata?.errorClass, 'internal');
    assert.equal(Object.getOwnPropertyDescriptor(harness.provider, 'translate')?.writable, false);
    assert.equal(Object.getOwnPropertyDescriptor(harness.provider, 'shutdown')?.writable, false);
  });
});
