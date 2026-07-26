/* eslint-disable max-classes-per-file -- deterministic browser and public-control fixtures share one harness. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';

import {
  buildGoogleTranslateProviderUrl,
  classifyGoogleResultSnapshot,
  createGoogleRouteSnapshot,
  GoogleTranslateProvider,
  type GoogleClearSnapshot,
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
  clearClicks = 0;
  clearDoesNotComplete = false;
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
  sourceValueLength = 0;
  visibleClearControls = 0;
  clearControlEnabled = false;
  afterInsertionRoute: GoogleRouteSnapshot | null = null;
  private submitted = false;

  async navigate(url: string): Promise<void> {
    this.navigatedUrls.push(url);
    this.route = this.navigationRoute ?? createTranslatorRoute(new URL(url).searchParams.get('tl') ?? '');
  }

  async readRouteSnapshot(): Promise<GoogleRouteSnapshot> {
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
    return this.readiness;
  }

  async insertSourceText(sourceText: string): Promise<boolean> {
    if (this.readiness.visibleSourceControls !== 1 || this.readiness.visibleEditableSourceControls !== 1) {
      return false;
    }
    this.insertedTexts.push(sourceText);
    this.submitted = true;
    this.sourceValueLength = sourceText.length;
    this.visibleClearControls = 1;
    this.clearControlEnabled = true;
    this.route = this.afterInsertionRoute ?? { ...this.route, hasTextParameter: true };
    return true;
  }

  async readResultSnapshot(): Promise<GoogleResultSnapshot> {
    if (this.submitted) {
      this.currentResult = this.resultReadsAfterInsertion.shift() ?? this.currentResult;
    }
    return this.currentResult;
  }

  async readClearSnapshot(): Promise<GoogleClearSnapshot> {
    return {
      clearControlEnabled: this.clearControlEnabled,
      readiness: this.readiness,
      result: await this.readResultSnapshot(),
      route: this.route,
      sourceValueLength: this.sourceValueLength,
      visibleClearControls: this.visibleClearControls,
    };
  }

  async clickClearSource(): Promise<boolean> {
    if (this.visibleClearControls !== 1 || !this.clearControlEnabled) return false;
    this.clearClicks += 1;
    if (this.clearDoesNotComplete) return true;
    this.submitted = false;
    this.sourceValueLength = 0;
    this.visibleClearControls = 0;
    this.clearControlEnabled = false;
    this.currentResult = createResult();
    this.route = { ...this.route, hasTextParameter: false };
    return true;
  }
}

interface Harness {
  readonly adapter: FixtureGooglePageAdapter;
  readonly contexts: FakeContext[];
  readonly provider: GoogleTranslateProvider;
}

function createHarness(adapter = new FixtureGooglePageAdapter(), resultTimeoutMs = 4): Harness {
  const contexts: FakeContext[] = [];
  const provider = new GoogleTranslateProvider({
    clearPollIntervalMs: 1,
    clearTimeoutMs: 2,
    createContext: async (_options: LaunchContextOptions) => {
      const context = new FakeContext();
      contexts.push(context);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({ headless: true }),
    createPageAdapter: () => adapter,
    now: () => 1_000,
    resultPollIntervalMs: 1,
    resultStabilityDelayMs: 0,
    resultTimeoutMs,
    sleep: async () => {},
    waitForClearPoll: async () => {},
  });
  return { adapter, contexts, provider };
}

const requestFixture = new TranslationProviderRequestFixture({
  providerId: 'google',
  sourceText: 'synthetic source',
  targetLanguage: 'en',
});

describe('GoogleTranslateProvider', () => {
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

  it('excludes listitem alternatives and concatenates one primary branch in DOM order', async () => {
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
    assert.equal(classified.success ? classified.value : null, 'Firstsecond');

    const harness = createHarness();
    harness.adapter.resultReadsAfterInsertion = [
      createResult([createFragment('First '), createFragment(' second')]),
      createResult([createFragment('First '), createFragment(' second')]),
    ];
    const outcome = await harness.provider.translate(
      new TranslationProviderRequestFixture(requestFixture.defaults, audit).create(),
    );
    assert.equal(outcome.success ? outcome.text : null, 'Firstsecond');
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

  it('clears stale state, rejects its previous marker, and confirms the retained empty region after success', async () => {
    const harness = createHarness();
    harness.adapter.currentResult = createResult([createFragment('stale')]);
    harness.adapter.sourceValueLength = 5;
    harness.adapter.visibleClearControls = 1;
    harness.adapter.clearControlEnabled = true;
    harness.adapter.route = createTranslatorRoute('en', 'ru', true);
    harness.adapter.resultReadsAfterInsertion = [
      createResult([createFragment('stale')]),
      createResult([createFragment('fresh')]),
      createResult([createFragment('fresh')]),
    ];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success ? outcome.text : null, 'fresh');
    assert.equal(harness.adapter.clearClicks, 2);
    assert.equal(harness.adapter.sourceValueLength, 0);
    assert.equal(harness.adapter.visibleClearControls, 0);
    assert.equal(harness.adapter.readiness.visibleResultRegions, 1);
    assert.deepEqual(harness.adapter.currentResult, createResult());
    assert.equal(harness.contexts[0]?.closeCalls, 0);
  });

  it('returns the result only after closing the context when visible clearing cannot be confirmed', async () => {
    const harness = createHarness();
    harness.adapter.clearDoesNotComplete = true;

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.equal(harness.adapter.clearClicks, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });

  it('reuses a confirmed cleared page without repeating provider navigation', async () => {
    const harness = createHarness();

    const first = await harness.provider.translate(requestFixture.create());
    const secondResult = createResult([createFragment('second translated')]);
    harness.adapter.resultReadsAfterInsertion = [secondResult, secondResult];
    const second = await harness.provider.translate(requestFixture.create({ sourceText: 'second synthetic source' }));

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.adapter.navigatedUrls.length, 1);
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source', 'second synthetic source']);
  });

  it('keeps the standalone URL builder free of source state', () => {
    const url = new URL(buildGoogleTranslateProviderUrl('be'));
    assert.equal(url.origin, 'https://translate.google.ru');
    assert.equal(url.searchParams.get('tl'), 'be');
    assert.equal(url.searchParams.has('text'), false);
  });
});
