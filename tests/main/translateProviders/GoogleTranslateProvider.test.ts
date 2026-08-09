/* eslint-disable max-classes-per-file -- deterministic browser and public-control fixtures share one harness. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';
import { TestCloakBrowserSettingsRepository } from '../appConfigTestUtils';

import {
  buildGoogleTranslateProviderUrl,
  classifyGoogleResultSnapshot,
  createPlaywrightGoogleTranslatePageAdapter,
  createGoogleRouteSnapshot,
  GoogleTranslateProvider,
  type GoogleConsentSnapshot,
  type GoogleOriginFamily,
  type GoogleReadinessSnapshot,
  type GoogleResultFragmentSnapshot,
  type GoogleResultSnapshot,
  type GoogleRouteSnapshot,
  type GoogleTranslatePageAdapter,
} from '@main/translateProviders/GoogleTranslateProvider';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';
import { RecordingTranslationProviderAudit, TranslationProviderRequestFixture } from './translationAuditTestUtils';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolveDeferred!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve;
  });
  return { promise, resolve: resolveDeferred };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Condition was not reached');
}

function createTranslatorRoute(
  targetLanguage = 'en',
  family: GoogleOriginFamily = 'ru',
  hasTextParameter = false,
): GoogleRouteSnapshot {
  return {
    family,
    hasTextParameter,
    operation: 'translate',
    origin: 'translator',
    route: 'translator',
    sourceLanguage: 'auto',
    targetLanguage,
  };
}

function createConsentRoute(family: GoogleOriginFamily): GoogleRouteSnapshot {
  return {
    family,
    hasTextParameter: false,
    operation: null,
    origin: 'consent',
    route: 'consent',
    sourceLanguage: null,
    targetLanguage: null,
  };
}

function createUnexpectedRoute(route: GoogleRouteSnapshot['route'] = 'unexpected'): GoogleRouteSnapshot {
  return {
    hasTextParameter: false,
    operation: null,
    origin: route === 'loginOrChallenge' ? 'translator' : 'unexpected',
    route,
    sourceLanguage: null,
    targetLanguage: null,
    ...(route === 'loginOrChallenge' ? { family: 'ru' as const } : {}),
  };
}

function createFragment(
  text: string,
  branchIndex = 0,
  overrides: Partial<GoogleResultFragmentSnapshot> = {},
): GoogleResultFragmentSnapshot {
  return {
    branchIndex,
    insideListItem: false,
    text,
    visible: true,
    ...overrides,
  };
}

function createResult(
  fragments: readonly GoogleResultFragmentSnapshot[] = [],
  visibleResultRegions = 1,
): GoogleResultSnapshot {
  return { fragments, visibleResultRegions };
}

class FakePage {
  closeCalls = 0;
  closed = false;

  async close(): Promise<void> {
    this.closeCalls += 1;
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

class FakeContext {
  closeCalls = 0;
  readonly page = new FakePage();

  async close(): Promise<void> {
    this.closeCalls += 1;
    this.page.closed = true;
  }

  async newPage(): Promise<Page> {
    return this.page as unknown as Page;
  }
}

class FixtureGooglePageAdapter implements GoogleTranslatePageAdapter {
  clearWithKeyboardResult = true;
  keyboardClearDeferred: Deferred<void> | null = null;
  readonly events: string[] = [];
  consent: GoogleConsentSnapshot = { visibleRejectAllControls: 0 };
  consentReturnRoute: GoogleRouteSnapshot | null = null;
  currentResult = createResult();
  insertedTexts: string[] = [];
  navigationRoute: GoogleRouteSnapshot | null = null;
  navigatedUrls: string[] = [];
  readonly rejectAllClicks: string[] = [];
  readiness: GoogleReadinessSnapshot = {
    visibleEditableSourceControls: 1,
    visibleResultRegions: 1,
    visibleSourceControls: 1,
  };
  resultReadsAfterInsertion: GoogleResultSnapshot[] = [
    createResult([createFragment('translated')]),
    createResult([createFragment('translated')]),
  ];
  route = createTranslatorRoute();
  sourceValue = '';
  submissionEpoch = 0;
  resultMutationCount = 0;
  recordsResultMutation = true;
  afterInsertionRoute: GoogleRouteSnapshot | null = null;
  private submitted = false;

  async navigate(url: string): Promise<void> {
    this.navigatedUrls.push(url);
    this.route = this.navigationRoute ?? createTranslatorRoute(new URL(url).searchParams.get('tl') ?? '');
  }

  async readRouteSnapshot(): Promise<GoogleRouteSnapshot> {
    this.events.push('query:route');
    return this.route;
  }

  async readConsentSnapshot(): Promise<GoogleConsentSnapshot> {
    return this.consent;
  }

  async clickRejectAll(): Promise<boolean> {
    if (this.consent.visibleRejectAllControls !== 1 || !this.consentReturnRoute) return false;
    this.rejectAllClicks.push('Reject all');
    this.route = this.consentReturnRoute;
    return true;
  }

  async readReadinessSnapshot(): Promise<GoogleReadinessSnapshot> {
    this.events.push('query:readiness');
    return this.readiness;
  }

  async insertSourceText(sourceText: string): Promise<boolean> {
    if (this.readiness.visibleSourceControls !== 1 || this.readiness.visibleEditableSourceControls !== 1) {
      return false;
    }
    this.insertedTexts.push(sourceText);
    this.events.push('insert');
    this.submitted = true;
    this.submissionEpoch += 1;
    if (this.recordsResultMutation) this.resultMutationCount += 1;
    this.sourceValue = sourceText;
    this.route = this.afterInsertionRoute ?? this.route;
    return true;
  }

  async readResultSnapshot(): Promise<GoogleResultSnapshot> {
    this.events.push('query:result');
    if (this.submitted) {
      this.currentResult = this.resultReadsAfterInsertion.shift() ?? this.currentResult;
    }
    return this.currentResult;
  }

  async readResultObservationSnapshot(): Promise<
    import('@main/translateProviders/GoogleTranslateProvider').GoogleResultObservationSnapshot
  > {
    return {
      completionControl: { visible: 0, visibleEnabled: 0 },
      resultMutationCount: this.resultMutationCount,
      result: await this.readResultSnapshot(),
      route: await this.readRouteSnapshot(),
      sourceValue: this.sourceValue,
      submissionEpoch: this.submissionEpoch,
    };
  }

  async clearSourceWithKeyboard(): Promise<boolean> {
    this.events.push('query:source');
    if (!this.clearWithKeyboardResult) return false;
    this.events.push('focus', 'Control+A', 'Backspace');
    await this.keyboardClearDeferred?.promise;
    this.submitted = false;
    this.sourceValue = '';
    this.currentResult = createResult();
    this.route = { ...this.route, hasTextParameter: false };
    return true;
  }
}

class ResultCandidateFixtureGooglePageAdapter extends FixtureGooglePageAdapter {
  readonly candidateWaits: number[] = [];
  completionControls = [{ visible: 1, visibleEnabled: 1 }];

  public async readResultObservationSnapshot(): Promise<
    import('@main/translateProviders/GoogleTranslateProvider').GoogleResultObservationSnapshot
  > {
    return {
      completionControl: this.completionControls.shift() ?? { visible: 1, visibleEnabled: 1 },
      resultMutationCount: this.resultMutationCount,
      result: await this.readResultSnapshot(),
      route: await this.readRouteSnapshot(),
      sourceValue: this.sourceValue,
      submissionEpoch: this.submissionEpoch,
    };
  }

  public async waitForResultCandidate(timeoutMs: number): Promise<boolean> {
    this.candidateWaits.push(timeoutMs);
    return true;
  }
}

interface Harness {
  readonly adapter: FixtureGooglePageAdapter;
  readonly contexts: FakeContext[];
  readonly provider: GoogleTranslateProvider;
  readonly sleeps: number[];
}

function createHarness(
  adapter = new FixtureGooglePageAdapter(),
  resultTimeoutMs = 4,
  resultPollIntervalMs = 1,
): Harness {
  const contexts: FakeContext[] = [];
  const sleeps: number[] = [];
  const provider = new GoogleTranslateProvider({
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    createContext: async (_options: LaunchContextOptions) => {
      const context = new FakeContext();
      contexts.push(context);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({ headless: true }),
    createPageAdapter: () => adapter,
    now: () => 1_000,
    resultPollIntervalMs,
    resultStabilityDelayMs: 0,
    resultTimeoutMs,
    sleep: async (delayMs) => {
      sleeps.push(delayMs);
    },
  });
  return { adapter, contexts, provider, sleeps };
}

const requestFixture = new TranslationProviderRequestFixture({
  providerId: 'google',
  sourceText: 'synthetic source',
  targetLanguage: 'en',
});

describe('GoogleTranslateProvider', () => {
  it('uses a public result candidate before reading the final validated snapshot', async () => {
    const adapter = new ResultCandidateFixtureGooglePageAdapter();
    const harness = createHarness(adapter);

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.deepEqual(adapter.candidateWaits, [4]);
  });

  it('accepts the first coherent changed Google result without Copy-control readiness', async () => {
    const adapter = new ResultCandidateFixtureGooglePageAdapter();
    adapter.completionControls = [
      { visible: 1, visibleEnabled: 0 },
      { visible: 1, visibleEnabled: 1 },
    ];
    adapter.resultReadsAfterInsertion = [
      createResult([createFragment('partial translation')]),
      createResult([createFragment('complete translation')]),
    ];
    const harness = createHarness(adapter);

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'partial translation');
    assert.deepEqual(adapter.candidateWaits, [4]);
  });

  it('does not use the Google 500 ms stability fallback after a coherent changed result', async () => {
    const adapter = new ResultCandidateFixtureGooglePageAdapter();
    adapter.completionControls = [
      { visible: 1, visibleEnabled: 0 },
      { visible: 1, visibleEnabled: 1 },
    ];
    adapter.resultReadsAfterInsertion = [
      createResult([createFragment('partial translation')]),
      createResult([createFragment('complete translation')]),
    ];
    const harness = createHarness(adapter, 100, 100);

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'partial translation');
    assert.deepEqual(harness.sleeps, []);
  });

  it('accepts an identical result only after current-submission mutation evidence', async () => {
    const identical = createResult([createFragment('same translation')]);
    const accepted = createHarness();
    accepted.adapter.currentResult = identical;
    accepted.adapter.resultReadsAfterInsertion = [identical];

    const acceptedOutcome = await accepted.provider.translate(requestFixture.create());

    assert.equal(acceptedOutcome.success ? acceptedOutcome.text : null, 'same translation');
    assert.deepEqual(accepted.adapter.events.slice(-4), ['query:source', 'focus', 'Control+A', 'Backspace']);

    const rejected = createHarness(new FixtureGooglePageAdapter(), 2);
    rejected.adapter.currentResult = identical;
    rejected.adapter.recordsResultMutation = false;
    rejected.adapter.resultReadsAfterInsertion = [identical, identical];

    const rejectedOutcome = await rejected.provider.translate(requestFixture.create());

    assert.equal(rejectedOutcome.success, false);
    assert.equal(rejectedOutcome.success ? null : rejectedOutcome.code, 'resultTimeoutOrEmpty');
  });

  it('opens the selected Google target page during initialization without submitting text', async () => {
    const harness = createHarness();
    harness.adapter.navigationRoute = createTranslatorRoute('uk', 'ru');

    const outcome = await harness.provider.initialize(requestFixture.createInitialization({ targetLanguage: 'uk' }));

    assert.equal(outcome.success, true);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.adapter.navigatedUrls.length, 1);
    const navigationUrl = new URL(harness.adapter.navigatedUrls[0] ?? '');
    assert.equal(navigationUrl.origin, 'https://translate.google.ru');
    assert.equal(navigationUrl.searchParams.get('tl'), 'uk');
    assert.equal(navigationUrl.searchParams.has('text'), false);
    assert.deepEqual(harness.adapter.insertedTexts, []);
  });

  it('binds only the shared Google metadata and rejects source-only auto before browser creation', async () => {
    const harness = createHarness();

    assert.equal(harness.provider.info, TRANSLATION_PROVIDER_INFO.google);
    assert.equal(harness.provider.info.maxInputCharacters, 5_000);
    assert.equal(harness.provider.info.targetLanguages.length, 249);
    assert.equal(
      harness.provider.info.targetLanguages.some((language) => String(language.code) === 'auto'),
      false,
    );

    const automaticTarget = await harness.provider.translate(requestFixture.create({ targetLanguage: 'auto' }));
    const overLimit = await harness.provider.translate(requestFixture.create({ sourceText: 'x'.repeat(5_001) }));

    assert.equal(automaticTarget.success ? null : automaticTarget.code, 'unsupportedTargetLanguage');
    assert.equal(overLimit.success ? null : overLimit.code, 'inputTooLong');
    assert.equal(harness.contexts.length, 0);

    const atLimitHarness = createHarness();
    const atLimit = await atLimitHarness.provider.translate(requestFixture.create({ sourceText: 'x'.repeat(5_000) }));
    assert.equal(atLimit.success, true);
    assert.equal(atLimitHarness.adapter.insertedTexts[0]?.length, 5_000);
  });

  it('builds an exact source-free navigation URL and accepts ru or com translator routes without consent', async () => {
    for (const family of ['ru', 'com'] as const) {
      const harness = createHarness();
      harness.adapter.navigationRoute = createTranslatorRoute('uk', family);

      const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'uk' }));

      assert.equal(outcome.success, true);
      assert.equal(harness.adapter.navigatedUrls.length, 1);
      const navigationUrl = new URL(harness.adapter.navigatedUrls[0] ?? '');
      assert.equal(navigationUrl.origin, 'https://translate.google.ru');
      assert.deepEqual(Array.from(navigationUrl.searchParams), [
        ['sl', 'auto'],
        ['tl', 'uk'],
        ['op', 'translate'],
        ['hl', 'en'],
      ]);
      assert.equal(navigationUrl.searchParams.has('text'), false);
      assert.equal(navigationUrl.toString().includes('synthetic source'), false);
      assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source']);
    }
  });

  it('uses exactly Reject all for matching ru and com consent returns', async () => {
    for (const family of ['ru', 'com'] as const) {
      const harness = createHarness();
      harness.adapter.navigationRoute = createConsentRoute(family);
      harness.adapter.consent = { visibleRejectAllControls: 1 };
      harness.adapter.consentReturnRoute = createTranslatorRoute('en', family);

      const outcome = await harness.provider.translate(requestFixture.create());

      assert.equal(outcome.success, true);
      assert.deepEqual(harness.adapter.rejectAllClicks, ['Reject all']);
      assert.equal(JSON.stringify(harness.adapter).includes('Accept all'), false);
    }
  });

  it('fails closed for missing, ambiguous, or cross-family consent controls', async () => {
    for (const fixture of [
      { count: 0, returnFamily: 'ru' as const },
      { count: 2, returnFamily: 'ru' as const },
      { count: 1, returnFamily: 'com' as const },
    ]) {
      const harness = createHarness();
      harness.adapter.navigationRoute = createConsentRoute('ru');
      harness.adapter.consent = { visibleRejectAllControls: fixture.count };
      harness.adapter.consentReturnRoute = createTranslatorRoute('en', fixture.returnFamily);

      const outcome = await harness.provider.translate(requestFixture.create());

      assert.equal(outcome.success, false);
      assert.equal(outcome.success ? null : outcome.code, 'consentOrChallenge');
      assert.equal(harness.adapter.insertedTexts.length, 0);
    }
  });

  it('classifies unexpected origins and login or challenge routes as consent failures', async () => {
    for (const route of [createUnexpectedRoute(), createUnexpectedRoute('loginOrChallenge')]) {
      const harness = createHarness();
      harness.adapter.navigationRoute = route;

      const outcome = await harness.provider.translate(requestFixture.create());

      assert.equal(outcome.success, false);
      assert.equal(outcome.success ? null : outcome.code, 'consentOrChallenge');
      assert.equal(harness.adapter.insertedTexts.length, 0);
    }
  });

  it('sanitizes route state for allowed origins and rejects login or challenge URL paths', () => {
    assert.deepEqual(
      createGoogleRouteSnapshot('https://translate.google.com/?sl=auto&tl=be&op=translate&hl=en'),
      createTranslatorRoute('be', 'com'),
    );
    assert.equal(
      createGoogleRouteSnapshot('https://translate.google.ru/sorry/?text=synthetic').route,
      'loginOrChallenge',
    );
    assert.equal(createGoogleRouteSnapshot('https://accounts.google.com/signin').origin, 'unexpected');
    assert.equal(createGoogleRouteSnapshot('not a url').route, 'unexpected');
  });

  it('rejects ambiguous source controls and exact named result regions before insertion', async () => {
    for (const readiness of [
      {
        visibleEditableSourceControls: 2,
        visibleResultRegions: 1,
        visibleSourceControls: 2,
      },
      {
        visibleEditableSourceControls: 1,
        visibleResultRegions: 2,
        visibleSourceControls: 1,
      },
    ]) {
      const harness = createHarness();
      harness.adapter.readiness = readiness;

      const outcome = await harness.provider.translate(requestFixture.create());

      assert.equal(outcome.success, false);
      assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
      assert.equal(harness.adapter.insertedTexts.length, 0);
      assert.equal(harness.contexts.length, 2);
    }
  });

  it('excludes listitem alternatives and preserves Markdown line breaks in one primary branch', async () => {
    const audit = new RecordingTranslationProviderAudit();
    const classified = classifyGoogleResultSnapshot(
      createResult([
        createFragment('First '),
        createFragment('alternative', 1, { insideListItem: true }),
        createFragment(' second'),
        createFragment('hidden', 2, { visible: false }),
      ]),
    );

    assert.equal(classified.success, true);
    assert.equal(classified.success ? classified.value : null, 'First second');
    const markdownResult = createResult([
      createFragment('  # Heading\r\n\r\n'),
      createFragment('- First item\r\n- Second item\n  continuation  '),
    ]);
    const markdown = classifyGoogleResultSnapshot(markdownResult);
    assert.equal(
      markdown.success ? markdown.value : null,
      '  # Heading\n\n- First item\n- Second item\n  continuation  ',
    );

    const harness = createHarness();
    harness.adapter.resultReadsAfterInsertion = [markdownResult, markdownResult];
    const sourceText = '# Заголовок\r\n\r\n- Первый пункт\r\n- Второй пункт';
    const outcome = await harness.provider.translate(
      new TranslationProviderRequestFixture(requestFixture.defaults, audit).create({ sourceText }),
    );
    assert.equal(
      outcome.success ? outcome.text : null,
      '  # Heading\r\n\r\n- First item\r\n- Second item\r\n  continuation  ',
    );
    assert.deepEqual(harness.adapter.insertedTexts, [sourceText]);
    assert.equal(audit.events.filter((event) => event.event === 'terminal').length, 1);
    assert.equal(audit.events[audit.events.length - 1]?.outcome, 'success');
  });

  it('rejects multiple primary branches and named-region ambiguity after submission without reinsertion', async () => {
    for (const result of [
      createResult([createFragment('first', 0), createFragment('second', 1)]),
      createResult([], 2),
    ]) {
      const harness = createHarness();
      harness.adapter.resultReadsAfterInsertion = [result];

      const outcome = await harness.provider.translate(requestFixture.create());

      assert.equal(outcome.success, false);
      assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
      assert.equal(harness.adapter.insertedTexts.length, 1);
      assert.equal(harness.contexts.length, 1);
      assert.equal(harness.contexts[0]?.closeCalls, 1);
    }
  });

  it('rejects a changed target after a stable result and never resubmits the source', async () => {
    const harness = createHarness();
    harness.adapter.afterInsertionRoute = createTranslatorRoute('ru', 'ru', true);

    const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'en' }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source']);
  });

  it('rejects wrong route state before submission', async () => {
    const harness = createHarness();
    harness.adapter.navigationRoute = createTranslatorRoute('ru');

    const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'en' }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    assert.equal(harness.adapter.insertedTexts.length, 0);
  });

  it('leaves empty results to the base timeout policy after one insertion', async () => {
    const harness = createHarness(new FixtureGooglePageAdapter(), 2);
    harness.adapter.resultReadsAfterInsertion = [createResult(), createResult()];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'resultTimeoutOrEmpty');
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source']);
  });

  it('replaces stale source, copies the result, then clears with keyboard without a later query', async () => {
    const harness = createHarness();
    harness.adapter.currentResult = createResult([createFragment('stale')]);
    harness.adapter.sourceValue = 'stale';
    harness.adapter.route = createTranslatorRoute('en', 'ru');
    harness.adapter.resultReadsAfterInsertion = [createResult([createFragment('fresh')])];

    const outcome = await harness.provider.translate(
      requestFixture.create({
        onResultReady: () => {
          harness.adapter.events.push('clipboard');
          return true;
        },
      }),
    );

    assert.equal(outcome.success ? outcome.text : null, 'fresh');
    assert.deepEqual(harness.adapter.events.slice(-5), [
      'clipboard',
      'query:source',
      'focus',
      'Control+A',
      'Backspace',
    ]);
    assert.equal(harness.adapter.sourceValue, '');
    assert.equal(harness.adapter.readiness.visibleResultRegions, 1);
    assert.deepEqual(harness.adapter.currentResult, createResult());
    assert.equal(harness.contexts[0]?.closeCalls, 0);
  });

  it('preserves the delivered result after keyboard failure closes the Google context', async () => {
    const harness = createHarness();
    harness.adapter.clearWithKeyboardResult = false;

    const outcome = await harness.provider.translate(requestFixture.create({ onResultReady: () => true }));

    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.deepEqual(harness.adapter.events.slice(-1), ['query:source']);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });

  it('starts generation evidence at the new page epoch after a keyboard-failure close', async () => {
    const harness = createHarness();
    harness.adapter.clearWithKeyboardResult = false;

    const first = await harness.provider.translate(requestFixture.create({ onResultReady: () => true }));
    assert.equal(first.success, true);
    assert.equal(harness.contexts[0]?.closeCalls, 1);

    harness.adapter.clearWithKeyboardResult = true;
    harness.adapter.submissionEpoch = 0;
    harness.adapter.resultMutationCount = 0;
    harness.adapter.resultReadsAfterInsertion = [createResult([createFragment('retry translated')])];
    const retry = await harness.provider.translate(requestFixture.create({ sourceText: 'retry synthetic source' }));

    assert.equal(retry.success ? retry.text : null, 'retry translated');
    assert.equal(harness.contexts.length, 2);
  });

  it('reuses one keyboard-cleared Google page without repeating provider navigation', async () => {
    const harness = createHarness();

    const first = await harness.provider.translate(requestFixture.create());
    const secondResult = createResult([createFragment('second translated')]);
    harness.adapter.resultReadsAfterInsertion = [secondResult, secondResult];
    const second = await harness.provider.translate(requestFixture.create({ sourceText: 'second synthetic source' }));

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.adapter.navigatedUrls.length, 1);
    assert.equal(harness.adapter.events.filter((event) => event === 'Control+A').length, 2);
    assert.equal(harness.adapter.events.filter((event) => event === 'Backspace').length, 2);
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source', 'second synthetic source']);
  });

  it('does not start Google keyboard clearing when result delivery is rejected', async () => {
    const harness = createHarness();

    const outcome = await harness.provider.translate(requestFixture.create({ onResultReady: () => false }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'resultDeliveryFailure');
    assert.equal(harness.adapter.events.includes('query:source'), false);
    assert.equal(harness.adapter.events.includes('Control+A'), false);
    assert.equal(harness.adapter.events.includes('Backspace'), false);
  });

  it('blocks a later Google submission until deferred Backspace completes', async () => {
    const harness = createHarness();
    const backspace = createDeferred<void>();
    harness.adapter.keyboardClearDeferred = backspace;

    const first = harness.provider.translate(requestFixture.create({ onResultReady: () => true }));
    await waitUntil(() => harness.adapter.events.includes('Backspace'));
    const secondResult = createResult([createFragment('second translated')]);
    harness.adapter.resultReadsAfterInsertion = [secondResult];
    const second = harness.provider.translate(requestFixture.create({ sourceText: 'second synthetic source' }));
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source']);

    backspace.resolve();
    const firstOutcome = await first;
    const secondOutcome = await second;

    assert.equal(firstOutcome.success, true);
    assert.equal(secondOutcome.success, true);
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source', 'second synthetic source']);
  });

  it('focuses the production source adapter and sends Control+A then Backspace without a later query', async () => {
    const events: string[] = [];
    const source = {
      focus: async () => {
        events.push('focus');
      },
      isEditable: async () => true,
      isEnabled: async () => true,
      isVisible: async () => true,
    };
    const sourceCollection = {
      count: async () => 1,
      nth: () => source,
    };
    const page = {
      keyboard: {
        press: async (key: string) => {
          events.push(key);
        },
      },
      locator: (selector: string) => {
        events.push(`query:${selector}`);
        return sourceCollection;
      },
    } as unknown as Page;
    const adapter = createPlaywrightGoogleTranslatePageAdapter(page);

    const cleared = await adapter.clearSourceWithKeyboard();

    assert.equal(cleared, true);
    assert.deepEqual(events, [
      'query:textarea[role="combobox"][aria-label="Source text"]',
      'focus',
      'Control+A',
      'Backspace',
    ]);
  });

  it('keeps the standalone URL builder free of source state', () => {
    const url = new URL(buildGoogleTranslateProviderUrl('be'));
    assert.equal(url.origin, 'https://translate.google.ru');
    assert.equal(url.searchParams.get('tl'), 'be');
    assert.equal(url.searchParams.has('text'), false);
  });
});
