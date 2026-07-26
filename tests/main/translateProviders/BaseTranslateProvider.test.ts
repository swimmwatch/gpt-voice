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
  translationHookFailure,
  translationHookSuccess,
  type TranslationProviderHookResult,
  type TranslationProviderRequest,
} from '@main/translateProviders/translationProviderContracts';
import { TRANSLATION_PROVIDER_INFO, type TranslationProviderId } from '@shared/translationProvider';
import { createNoopTranslationAuditLifecycle, createTranslationAuditRecorder } from './translationAuditTestUtils';

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
  closeFails = false;
  newPageCalls = 0;
  readonly page = new FakePage();

  async close(): Promise<void> {
    this.closeCalls += 1;
    if (this.closeFails) throw new Error('private context close error');
    this.page.closed = true;
  }

  async newPage(): Promise<Page> {
    this.newPageCalls += 1;
    return this.page as unknown as Page;
  }
}

class FakeTranslateProvider extends BaseTranslateProvider {
  readonly calls = {
    clear: 0,
    insert: 0,
    navigate: 0,
    readiness: 0,
    read: 0,
    sourceDetection: 0,
    staleState: 0,
    targetSelection: 0,
    targetVerification: 0,
  };

  clearResult: TranslationProviderHookResult = translationHookSuccess();
  insertResult: TranslationProviderHookResult = translationHookSuccess();
  navigationError: Error | null = null;
  navigationResult: TranslationProviderHookResult = translationHookSuccess();
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

  constructor(dependencies: Partial<BaseTranslateProviderDependencies>) {
    super(TRANSLATION_PROVIDER_INFO.google, dependencies);
  }

  protected async navigateAndHandleConsent(
    _page: Page,
    targetLanguage: string,
  ): Promise<TranslationProviderHookResult> {
    this.calls.navigate += 1;
    this.selectedTargets.push(`navigate:${targetLanguage}`);
    if (this.navigationError) throw this.navigationError;
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

  protected async clearVisibleState(): Promise<TranslationProviderHookResult> {
    this.calls.clear += 1;
    return this.clearResult;
  }
}

interface Harness {
  readonly contexts: FakeContext[];
  readonly options: LaunchContextOptions[];
  readonly provider: FakeTranslateProvider;
  readonly sleeps: number[];
}

function createHarness(): Harness {
  const contexts: FakeContext[] = [];
  const options: LaunchContextOptions[] = [];
  const sleeps: number[] = [];
  let now = 1_000;
  const provider = new FakeTranslateProvider({
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
    resultTimeoutMs: 30,
    sleep: async (delayMs) => {
      sleeps.push(delayMs);
      now += delayMs;
    },
  });
  return { contexts, options, provider, sleeps };
}

function createRequest(overrides: Partial<TranslationProviderRequest> = {}): TranslationProviderRequest {
  return {
    auditLifecycle: createNoopTranslationAuditLifecycle(),
    auditStartedAt: 1_000,
    providerId: 'google',
    sourceText: 'source text',
    targetLanguage: 'en',
    ...overrides,
  };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail('Expected condition did not become true');
}

describe('BaseTranslateProvider', () => {
  it('uses the required production stability window', () => {
    assert.equal(TRANSLATION_RESULT_STABILITY_DELAY_MS, 500);
  });

  it('lazily creates and reuses one nonpersistent context per provider instance', async () => {
    const first = createHarness();
    const second = createHarness();

    assert.equal(first.contexts.length, 0);
    assert.equal((await first.provider.translate(createRequest())).success, true);
    assert.equal((await first.provider.translate(createRequest())).success, true);
    assert.equal((await second.provider.translate(createRequest())).success, true);

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
    assert.equal((await harness.provider.translate(createRequest())).success, true);
    const firstContext = harness.contexts[0];
    assert.ok(firstContext);
    firstContext.page.closed = true;

    assert.equal((await harness.provider.translate(createRequest())).success, true);

    assert.equal(firstContext.closeCalls, 1);
    assert.equal(harness.contexts.length, 2);
  });

  it('rejects unsupported, empty, and over-limit requests before context creation', async () => {
    const harness = createHarness();
    const unsupportedProvider = await harness.provider.translate(
      createRequest({
        providerId: 'private-provider' as TranslationProviderId,
        targetLanguage: 'private-target',
      }),
    );
    const unsupportedTarget = await harness.provider.translate(createRequest({ targetLanguage: 'private-target' }));
    const empty = await harness.provider.translate(createRequest({ sourceText: ' \n ' }));
    const overLimit = await harness.provider.translate(createRequest({ sourceText: 'x'.repeat(5_001) }));

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
    const audit = createTranslationAuditRecorder();
    harness.provider.readinessResults = [
      translationHookFailure('pageContractFailure', {
        recoverableBeforeSubmission: true,
      }),
      translationHookSuccess(),
    ];

    const outcome = await harness.provider.translate(createRequest({ auditLifecycle: audit.lifecycle }));

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

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.provider.calls.insert, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });

  it('rejects stale and changing results until two normalized reads agree', async () => {
    const harness = createHarness();
    const audit = createTranslationAuditRecorder();
    harness.provider.previousResult = 'stale';
    harness.provider.readResults = [
      translationHookSuccess('stale'),
      translationHookSuccess('changing-1'),
      translationHookSuccess('changing-2'),
      translationHookSuccess('stable'),
      translationHookSuccess('stable'),
    ];

    const outcome = await harness.provider.translate(createRequest({ auditLifecycle: audit.lifecycle }));

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'stable');
    assert.deepEqual(harness.sleeps, [10, 5, 10, 5]);
    assert.equal(harness.provider.calls.targetVerification, 1);
    assert.equal(audit.events.filter((event) => event.phase === 'result').length, 2);
  });

  it('returns a terminal timeout for an empty result without replaying insertion', async () => {
    const harness = createHarness();
    harness.provider.readResults = [translationHookSuccess(''), translationHookSuccess(''), translationHookSuccess('')];

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'resultTimeoutOrEmpty');
    assert.equal(harness.provider.calls.insert, 1);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });

  it('suppresses a late result after shutdown invalidates its generation', async () => {
    const harness = createHarness();
    const deferred = createDeferred<TranslationProviderHookResult<string>>();
    harness.provider.readDeferred = deferred;
    const operation = harness.provider.translate(createRequest());
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

  it('discards an already-cancelled request before browser creation', async () => {
    const harness = createHarness();
    const abortController = new AbortController();
    abortController.abort();

    const outcome = await harness.provider.translate(createRequest({ signal: abortController.signal }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'cancelledOrStaleOperation');
    assert.equal(outcome.success ? null : outcome.discard, true);
    assert.equal(harness.contexts.length, 0);
  });

  it('returns success after clear or confirmed close, but never after cleanup failure', async () => {
    const clearHarness = createHarness();
    const clearOutcome = await clearHarness.provider.translate(createRequest());
    assert.equal(clearOutcome.success, true);
    assert.equal(clearHarness.contexts[0]?.closeCalls, 0);

    const closeHarness = createHarness();
    closeHarness.provider.clearResult = translationHookFailure('cleanupFailure');
    const closeOutcome = await closeHarness.provider.translate(createRequest());
    assert.equal(closeOutcome.success, true);
    assert.equal(closeHarness.contexts[0]?.closeCalls, 1);

    const failureHarness = createHarness();
    const failureAudit = createTranslationAuditRecorder();
    failureHarness.provider.clearResult = translationHookFailure('cleanupFailure');
    const failedContextPromise = waitUntil(() => failureHarness.contexts.length === 1);
    const operation = failureHarness.provider.translate(createRequest({ auditLifecycle: failureAudit.lifecycle }));
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

  it('maps raw hook errors to sanitized audit metadata and keeps final entrypoints fixed', async () => {
    const harness = createHarness();
    const audit = createTranslationAuditRecorder();
    harness.provider.navigationError = new Error('https://private.invalid/?text=private-source raw response');

    const outcome = await harness.provider.translate(createRequest({ auditLifecycle: audit.lifecycle }));
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
