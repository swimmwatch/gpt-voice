/* eslint-disable max-classes-per-file -- deterministic browser and public-control fixtures share one harness. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';
import { TestCloakBrowserSettingsRepository } from '../appConfigTestUtils';

import {
  classifyYandexResult,
  createYandexRouteSnapshot,
  YandexTranslateProvider,
  type YandexAutomaticSourceSnapshot,
  type YandexClearSnapshot,
  type YandexConsentSnapshot,
  type YandexEditorSnapshot,
  type YandexReadinessSnapshot,
  type YandexRouteSnapshot,
  type YandexTargetSnapshot,
  type YandexTranslatePageAdapter,
} from '@main/translateProviders/YandexTranslateProvider';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';
import { YANDEX_TRANSLATION_LANGUAGES } from '@shared/translationLanguages/yandex';
import { RecordingTranslationProviderAudit, TranslationProviderRequestFixture } from './translationAuditTestUtils';
import { withTestTranslationBrowserResources } from './translationBrowserResourceTestUtils';

function createRoute(
  targetLanguage: string | null = null,
  overrides: Partial<YandexRouteSnapshot> = {},
): YandexRouteSnapshot {
  return {
    hasTextParameter: false,
    route: 'translator',
    sourceLanguage: 'auto',
    targetLanguage,
    ...overrides,
  };
}

function createEditors(overrides: Partial<YandexEditorSnapshot> = {}): YandexEditorSnapshot {
  const destinationVisible = overrides.destinationVisible ?? false;
  return {
    destinationEditors: 1,
    destinationResolution: 'primary',
    destinationText: '',
    destinationVisible,
    editableSourceEditors: 1,
    sourceEditors: 1,
    sourceResolution: 'primary',
    sourceTextLength: 0,
    visibleDestinationPanels: destinationVisible ? 1 : 0,
    visibleForbiddenTextareas: 0,
    ...overrides,
  };
}

function createAutomaticSource(overrides: Partial<YandexAutomaticSourceSnapshot> = {}): YandexAutomaticSourceSnapshot {
  return {
    checked: true,
    chooserOpen: false,
    enabledSwitches: 1,
    exactLabels: 1,
    switches: 1,
    ...overrides,
  };
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

class FixtureYandexPageAdapter implements YandexTranslatePageAdapter {
  automaticSource = createAutomaticSource();
  automaticSourceClicks = 0;
  automaticSourceChooserCloses = 0;
  automaticSourceChooserOpens = 0;
  blockingSurfaces = 0;
  clearClicks = 0;
  clearControlEnabled = false;
  clearDoesNotComplete = false;
  consent: YandexConsentSnapshot = {
    visibleConsentSurfaces: 0,
    visibleEnabledEssentialControls: 0,
    visibleEssentialControls: 0,
  };
  consentReturnRoute: YandexRouteSnapshot | null = null;
  currentEditors = createEditors();
  readonly essentialConsentClicks: string[] = [];
  forbiddenTextareaUpdates = 0;
  hiddenTargetOptionMatches = 0;
  insertionEventSequences: string[][] = [];
  insertedTexts: string[] = [];
  navigationRoute: YandexRouteSnapshot | null = null;
  navigatedUrls: string[] = [];
  resultReadsAfterInsertion: YandexEditorSnapshot[] = [
    createEditors({
      destinationText: 'translated',
      destinationVisible: true,
      sourceTextLength: 'synthetic source'.length,
    }),
    createEditors({
      destinationText: 'translated',
      destinationVisible: true,
      sourceTextLength: 'synthetic source'.length,
    }),
  ];
  route = createRoute();
  selectedTargetCodes: string[] = [];
  sourceUpdates = 0;
  targetAfterInsertion: string | null = null;
  targetChooserHydrates = true;
  targetChooserOpen = false;
  targetChooserOpens = 0;
  targetSnapshot: YandexTargetSnapshot = {
    selectedTargetCode: null,
    visibleOpeners: 1,
  };
  visibleClearControls = 0;
  visibleTargetOptionMatches = 1;
  private submitted = false;

  async navigate(): Promise<void> {
    this.navigatedUrls.push('https://translate.yandex.com/en/translator');
    this.targetChooserOpen = false;
    this.route = this.navigationRoute ?? createRoute();
    this.targetSnapshot = {
      ...this.targetSnapshot,
      selectedTargetCode: this.route.targetLanguage,
    };
  }

  async readRouteSnapshot(): Promise<YandexRouteSnapshot> {
    if (this.submitted && this.targetAfterInsertion) {
      return {
        ...this.route,
        targetLanguage: this.targetAfterInsertion,
      };
    }
    return this.route;
  }

  async readConsentSnapshot(): Promise<YandexConsentSnapshot> {
    return this.consent;
  }

  async clickEssentialConsent(): Promise<boolean> {
    if (
      this.consent.visibleConsentSurfaces !== 1 ||
      this.consent.visibleEssentialControls !== 1 ||
      this.consent.visibleEnabledEssentialControls !== 1 ||
      !this.consentReturnRoute
    ) {
      return false;
    }
    this.essentialConsentClicks.push('Allow essential cookies');
    this.consent = {
      visibleConsentSurfaces: 0,
      visibleEnabledEssentialControls: 0,
      visibleEssentialControls: 0,
    };
    this.route = this.consentReturnRoute;
    return true;
  }

  async readAutomaticSourceSnapshot(): Promise<YandexAutomaticSourceSnapshot> {
    return this.automaticSource;
  }

  async openAutomaticSourceChooser(): Promise<boolean> {
    if (
      this.automaticSource.exactLabels !== 1 ||
      this.automaticSource.switches !== 1 ||
      this.automaticSource.enabledSwitches !== 1
    ) {
      return false;
    }
    this.automaticSourceChooserOpens += 1;
    this.automaticSource = { ...this.automaticSource, chooserOpen: true };
    return true;
  }

  async closeAutomaticSourceChooser(): Promise<boolean> {
    if (!this.automaticSource.chooserOpen) return false;
    this.automaticSourceChooserCloses += 1;
    this.automaticSource = { ...this.automaticSource, chooserOpen: false };
    return true;
  }

  async enableAutomaticSourceDetection(): Promise<boolean> {
    if (
      !this.automaticSource.chooserOpen ||
      this.automaticSource.exactLabels !== 1 ||
      this.automaticSource.switches !== 1 ||
      this.automaticSource.enabledSwitches !== 1
    ) {
      return false;
    }
    this.automaticSourceClicks += 1;
    this.automaticSource = { ...this.automaticSource, checked: true };
    return true;
  }

  async readTargetSnapshot(): Promise<YandexTargetSnapshot> {
    if (this.submitted && this.targetAfterInsertion) {
      return {
        ...this.targetSnapshot,
        selectedTargetCode: this.targetAfterInsertion,
      };
    }
    return this.targetSnapshot;
  }

  async openTargetChooser(): Promise<boolean> {
    if (this.targetSnapshot.visibleOpeners !== 1 || !this.targetChooserHydrates) return false;
    this.targetChooserOpens += 1;
    this.targetChooserOpen = true;
    return true;
  }

  async selectTargetLanguage(targetLanguage: string): Promise<boolean> {
    if (
      !this.targetChooserOpen ||
      this.targetSnapshot.visibleOpeners !== 1 ||
      this.visibleTargetOptionMatches !== 1 ||
      !YANDEX_TRANSLATION_LANGUAGES.some((language) => language.code === targetLanguage)
    ) {
      return false;
    }
    this.selectedTargetCodes.push(targetLanguage);
    this.targetChooserOpen = false;
    this.targetSnapshot = { ...this.targetSnapshot, selectedTargetCode: targetLanguage };
    this.route = {
      ...this.route,
      hasTextParameter: false,
      targetLanguage,
    };
    return true;
  }

  async readEditorSnapshot(): Promise<YandexEditorSnapshot> {
    if (this.submitted) {
      this.currentEditors = this.resultReadsAfterInsertion.shift() ?? this.currentEditors;
    }
    return this.currentEditors;
  }

  async readReadinessSnapshot(): Promise<YandexReadinessSnapshot> {
    return {
      blockingSurfaces: this.blockingSurfaces,
      editors: await this.readEditorSnapshot(),
      target: await this.readTargetSnapshot(),
    };
  }

  async insertSourceText(sourceText: string): Promise<boolean> {
    if (
      this.currentEditors.sourceEditors !== 1 ||
      this.currentEditors.editableSourceEditors !== 1 ||
      this.currentEditors.visibleForbiddenTextareas > 0
    ) {
      return false;
    }
    this.insertedTexts.push(sourceText);
    this.insertionEventSequences.push(['beforeinput:insertText', 'textContent', 'input:insertText']);
    this.sourceUpdates += 1;
    this.submitted = true;
    this.currentEditors = {
      ...this.currentEditors,
      sourceTextLength: sourceText.length,
    };
    this.route = {
      ...this.route,
      hasTextParameter: true,
      sourceLanguage: 'en',
    };
    this.visibleClearControls = 1;
    this.clearControlEnabled = true;
    return true;
  }

  async readClearSnapshot(): Promise<YandexClearSnapshot> {
    return {
      automaticSource: this.automaticSource,
      clearControlEnabled: this.clearControlEnabled,
      editors: await this.readEditorSnapshot(),
      route: await this.readRouteSnapshot(),
      target: await this.readTargetSnapshot(),
      visibleClearControls: this.visibleClearControls,
    };
  }

  async clickClear(): Promise<boolean> {
    if (this.visibleClearControls !== 1 || !this.clearControlEnabled) return false;
    this.clearClicks += 1;
    if (this.clearDoesNotComplete) return true;
    this.submitted = false;
    this.currentEditors = {
      ...this.currentEditors,
      destinationText: '',
      destinationVisible: false,
      sourceTextLength: 0,
      visibleDestinationPanels: 0,
    };
    this.route = {
      ...this.route,
      hasTextParameter: false,
    };
    this.visibleClearControls = 0;
    this.clearControlEnabled = false;
    return true;
  }
}

interface Harness {
  readonly adapter: FixtureYandexPageAdapter;
  readonly contexts: FakeContext[];
  readonly provider: YandexTranslateProvider;
}

function createHarness(adapter = new FixtureYandexPageAdapter(), resultTimeoutMs = 4): Harness {
  const contexts: FakeContext[] = [];
  const provider = new YandexTranslateProvider(
    withTestTranslationBrowserResources({
      cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
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
    }),
  );
  return { adapter, contexts, provider };
}

const requestFixture = new TranslationProviderRequestFixture({
  providerId: 'yandex',
  sourceText: 'synthetic source',
  targetLanguage: 'en',
});

describe('YandexTranslateProvider', () => {
  it('opens the selected Yandex target page during initialization without submitting text', async () => {
    const harness = createHarness();
    harness.adapter.navigationRoute = createRoute(null, { targetLanguage: 'be' });

    const outcome = await harness.provider.initialize(requestFixture.createInitialization({ targetLanguage: 'be' }));

    assert.equal(outcome.success, true);
    assert.equal(harness.contexts.length, 1);
    assert.deepEqual(harness.adapter.navigatedUrls, ['https://translate.yandex.com/en/translator']);
    assert.equal(new URL(harness.adapter.navigatedUrls[0] ?? '').searchParams.has('text'), false);
    assert.deepEqual(harness.adapter.insertedTexts, []);
  });

  it('binds only shared Yandex metadata and enforces the 10,000-character limit before browser creation', async () => {
    const harness = createHarness();

    assert.equal(harness.provider.info, TRANSLATION_PROVIDER_INFO.yandex);
    assert.equal(harness.provider.info.maxInputCharacters, 10_000);
    assert.equal(harness.provider.info.targetLanguages.length, 118);
    assert.equal(
      harness.provider.info.targetLanguages.some((language) => String(language.code) === 'auto'),
      false,
    );

    const automaticTarget = await harness.provider.translate(requestFixture.create({ targetLanguage: 'auto' }));
    const overLimit = await harness.provider.translate(requestFixture.create({ sourceText: 'x'.repeat(10_001) }));
    assert.equal(automaticTarget.success ? null : automaticTarget.code, 'unsupportedTargetLanguage');
    assert.equal(overLimit.success ? null : overLimit.code, 'inputTooLong');
    assert.equal(harness.contexts.length, 0);

    const atLimitHarness = createHarness();
    const atLimit = await atLimitHarness.provider.translate(requestFixture.create({ sourceText: 'x'.repeat(10_000) }));
    assert.equal(atLimit.success, true);
    assert.equal(atLimitHarness.adapter.insertedTexts[0]?.length, 10_000);
  });

  it('navigates source-free and accepts only the researched English translator routes', async () => {
    for (const navigationRoute of [createRoute(), createRoute(null, { sourceLanguage: null })]) {
      const harness = createHarness();
      harness.adapter.navigationRoute = navigationRoute;

      const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'be' }));

      assert.equal(outcome.success, true);
      assert.deepEqual(harness.adapter.navigatedUrls, ['https://translate.yandex.com/en/translator']);
      assert.equal(harness.adapter.navigatedUrls[0]?.includes('synthetic source'), false);
      assert.equal(new URL(harness.adapter.navigatedUrls[0] ?? '').searchParams.has('text'), false);
    }

    assert.equal(createYandexRouteSnapshot('https://translate.yandex.com/en/translator').route, 'translator');
    assert.equal(createYandexRouteSnapshot('https://translate.yandex.com/en/').route, 'translator');
    assert.equal(createYandexRouteSnapshot('https://translate.yandex.com/en/login').route, 'loginOrChallenge');
    assert.equal(createYandexRouteSnapshot('https://accounts.yandex.com/en/').route, 'unexpected');
    assert.equal(createYandexRouteSnapshot('not a url').route, 'unexpected');
  });

  it('uses exactly Allow essential cookies and accepts the no-consent state', async () => {
    const noConsent = createHarness();
    assert.equal((await noConsent.provider.translate(requestFixture.create())).success, true);
    assert.deepEqual(noConsent.adapter.essentialConsentClicks, []);

    const consent = createHarness();
    consent.adapter.consent = {
      visibleConsentSurfaces: 1,
      visibleEnabledEssentialControls: 1,
      visibleEssentialControls: 1,
    };
    consent.adapter.consentReturnRoute = createRoute();

    const outcome = await consent.provider.translate(requestFixture.create());

    assert.equal(outcome.success, true);
    assert.deepEqual(consent.adapter.essentialConsentClicks, ['Allow essential cookies']);
    assert.equal(JSON.stringify(consent.adapter).includes('Allow all'), false);
  });

  it('fails closed for missing, ambiguous, challenged, or unexpected consent states', async () => {
    const fixtures: Array<{
      blockingSurfaces?: number;
      consent?: YandexConsentSnapshot;
      route?: YandexRouteSnapshot;
    }> = [
      {
        consent: {
          visibleConsentSurfaces: 1,
          visibleEnabledEssentialControls: 0,
          visibleEssentialControls: 0,
        },
      },
      {
        consent: {
          visibleConsentSurfaces: 1,
          visibleEnabledEssentialControls: 2,
          visibleEssentialControls: 2,
        },
      },
      { blockingSurfaces: 1 },
      { route: createRoute(null, { route: 'loginOrChallenge' }) },
      { route: createRoute(null, { route: 'unexpected' }) },
    ];

    for (const fixture of fixtures) {
      const harness = createHarness();
      if (fixture.consent) harness.adapter.consent = fixture.consent;
      if (fixture.blockingSurfaces) harness.adapter.blockingSurfaces = fixture.blockingSurfaces;
      if (fixture.route) harness.adapter.navigationRoute = fixture.route;

      const outcome = await harness.provider.translate(requestFixture.create());

      assert.equal(outcome.success, false);
      assert.equal(outcome.success ? null : outcome.code, 'consentOrChallenge');
      assert.equal(harness.adapter.insertedTexts.length, 0);
    }
  });

  it('opens the source chooser, enables automatic detection through its exact label, and closes it', async () => {
    const unchecked = createHarness();
    unchecked.adapter.automaticSource = createAutomaticSource({ checked: false });

    const enabled = await unchecked.provider.translate(requestFixture.create());

    assert.equal(enabled.success, true);
    assert.equal(unchecked.adapter.automaticSourceClicks, 1);
    assert.equal(unchecked.adapter.automaticSourceChooserOpens, 1);
    assert.equal(unchecked.adapter.automaticSourceChooserCloses, 1);
    assert.equal(unchecked.adapter.automaticSource.chooserOpen, false);

    const ambiguous = createHarness();
    ambiguous.adapter.automaticSource = createAutomaticSource({
      checked: null,
      enabledSwitches: 2,
      exactLabels: 2,
      switches: 2,
    });
    const rejected = await ambiguous.provider.translate(requestFixture.create());
    assert.equal(rejected.success, false);
    assert.equal(rejected.success ? null : rejected.code, 'pageContractFailure');
    assert.equal(ambiguous.adapter.insertedTexts.length, 0);
    assert.equal(ambiguous.contexts.length, 2);
  });

  it('accepts one attached hidden destination editor before submission and after clearing', async () => {
    const harness = createHarness();

    const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'be' }));

    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.equal(harness.adapter.currentEditors.destinationEditors, 1);
    assert.equal(harness.adapter.currentEditors.destinationVisible, false);
    assert.equal(harness.adapter.currentEditors.visibleDestinationPanels, 0);
    assert.equal(harness.adapter.clearClicks, 1);
  });

  it('selects every shared target by its exact opaque code and ignores hidden duplicate options', async () => {
    assert.equal(YANDEX_TRANSLATION_LANGUAGES.length, 118);
    for (const language of YANDEX_TRANSLATION_LANGUAGES) {
      const harness = createHarness();
      harness.adapter.hiddenTargetOptionMatches = 2;

      const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: language.code }));

      assert.equal(outcome.success, true, language.code);
      assert.deepEqual(harness.adapter.selectedTargetCodes, [language.code]);
      assert.equal(harness.adapter.targetChooserOpens, 1);
    }

    for (const code of ['pt-BR', 'sr-Latn', 'kazlat', 'uzbcyr']) {
      assert.equal(
        YANDEX_TRANSLATION_LANGUAGES.some((language) => language.code === code),
        true,
      );
    }
  });

  it('recovers once for a missing target and stops after the second exact-value failure', async () => {
    const harness = createHarness();
    harness.adapter.visibleTargetOptionMatches = 0;

    const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'be' }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    assert.equal(harness.contexts.length, 2);
    assert.equal(harness.adapter.insertedTexts.length, 0);
  });

  it('waits for target-chooser hydration and recovers only before submission', async () => {
    const harness = createHarness();
    harness.adapter.targetChooserHydrates = false;

    const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'be' }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    assert.equal(harness.contexts.length, 2);
    assert.equal(harness.adapter.targetChooserOpens, 0);
    assert.equal(harness.adapter.insertedTexts.length, 0);
  });

  it('supports only the approved primary or single semantic editor fallbacks', async () => {
    const fallback = createHarness();
    fallback.adapter.currentEditors = createEditors({
      destinationResolution: 'fallback',
      sourceResolution: 'fallback',
    });
    fallback.adapter.resultReadsAfterInsertion = [
      createEditors({
        destinationResolution: 'fallback',
        destinationText: 'translated',
        destinationVisible: true,
        sourceResolution: 'fallback',
      }),
      createEditors({
        destinationResolution: 'fallback',
        destinationText: 'translated',
        destinationVisible: true,
        sourceResolution: 'fallback',
      }),
    ];

    assert.equal((await fallback.provider.translate(requestFixture.create())).success, true);

    for (const editors of [
      createEditors({ editableSourceEditors: 2, sourceEditors: 2, sourceResolution: 'invalid' }),
      createEditors({ destinationEditors: 2, destinationResolution: 'invalid' }),
      createEditors({ visibleDestinationPanels: 2 }),
      createEditors({ destinationVisible: true, visibleDestinationPanels: 0 }),
      createEditors({ visibleForbiddenTextareas: 1 }),
    ]) {
      const ambiguous = createHarness();
      ambiguous.adapter.currentEditors = editors;
      const outcome = await ambiguous.provider.translate(requestFixture.create());
      assert.equal(outcome.success, false);
      assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
      assert.equal(ambiguous.adapter.insertedTexts.length, 0);
    }
  });

  it('performs one full-string source update with the exact three-step event sequence', async () => {
    const audit = new RecordingTranslationProviderAudit();
    const harness = createHarness();

    const outcome = await harness.provider.translate(
      new TranslationProviderRequestFixture(requestFixture.defaults, audit).create(),
    );

    assert.equal(outcome.success, true);
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source']);
    assert.equal(harness.adapter.sourceUpdates, 1);
    assert.deepEqual(harness.adapter.insertionEventSequences, [
      ['beforeinput:insertText', 'textContent', 'input:insertText'],
    ]);
    assert.equal(harness.adapter.forbiddenTextareaUpdates, 0);
    assert.equal(audit.events.filter((event) => event.event === 'terminal').length, 1);
    assert.equal(audit.events[audit.events.length - 1]?.outcome, 'success');
  });

  it('reuses one prepared page without reopening either language chooser', async () => {
    const harness = createHarness();

    const first = await harness.provider.translate(requestFixture.create({ sourceText: 'first source' }));
    harness.adapter.resultReadsAfterInsertion = [
      createEditors({ destinationText: 'second', destinationVisible: true }),
      createEditors({ destinationText: 'second', destinationVisible: true }),
    ];
    const second = await harness.provider.translate(requestFixture.create({ sourceText: 'second source' }));

    assert.equal(first.success, true);
    assert.equal(second.success ? second.text : null, 'second');
    assert.equal(harness.adapter.navigatedUrls.length, 1);
    assert.equal(harness.adapter.automaticSourceChooserOpens, 1);
    assert.equal(harness.adapter.targetChooserOpens, 1);
    assert.deepEqual(harness.adapter.selectedTargetCodes, ['en']);
    assert.deepEqual(harness.adapter.insertedTexts, ['first source', 'second source']);
    assert.equal(harness.contexts.length, 1);
  });

  it('accepts only a visible normalized result and rejects hidden nonempty or ambiguous destinations', async () => {
    const normalized = classifyYandexResult(
      createEditors({
        destinationText: '  translated \n result  ',
        destinationVisible: true,
      }),
    );
    assert.equal(normalized.success ? normalized.value : null, '  translated \n result  ');
    const markdown = classifyYandexResult(
      createEditors({
        destinationText: '# Heading\r\n\r\n- First\r\n- Second\n  continuation',
        destinationVisible: true,
      }),
    );
    assert.equal(markdown.success ? markdown.value : null, '# Heading\n\n- First\n- Second\n  continuation');
    assert.equal(classifyYandexResult(createEditors()).success, true);

    for (const result of [
      createEditors({ destinationText: 'hidden', destinationVisible: false }),
      createEditors({ destinationEditors: 2, destinationResolution: 'invalid' }),
    ]) {
      const harness = createHarness();
      harness.adapter.resultReadsAfterInsertion = [result];

      const outcome = await harness.provider.translate(requestFixture.create());

      assert.equal(outcome.success, false);
      assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
      assert.equal(harness.adapter.insertedTexts.length, 1);
      assert.equal(harness.contexts.length, 1);
    }
  });

  it('rejects a changed target after stable output without changing the target or reinserting', async () => {
    const harness = createHarness();
    harness.adapter.targetAfterInsertion = 'ru';

    const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'be' }));

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    assert.deepEqual(harness.adapter.selectedTargetCodes, ['be']);
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source']);
  });

  it('leaves empty output to the base timeout policy after one insertion', async () => {
    const harness = createHarness(new FixtureYandexPageAdapter(), 2);
    harness.adapter.resultReadsAfterInsertion = [createEditors(), createEditors()];

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'resultTimeoutOrEmpty');
    assert.deepEqual(harness.adapter.insertedTexts, ['synthetic source']);
  });

  it('clears stale state, rejects the previous result, and confirms exact local clearing', async () => {
    const harness = createHarness();
    harness.adapter.currentEditors = createEditors({
      destinationText: 'stale',
      destinationVisible: true,
      sourceTextLength: 5,
    });
    harness.adapter.visibleClearControls = 1;
    harness.adapter.clearControlEnabled = true;
    harness.adapter.resultReadsAfterInsertion = [
      createEditors({
        destinationText: 'stale',
        destinationVisible: true,
        sourceTextLength: 'synthetic source'.length,
      }),
      createEditors({
        destinationText: 'fresh',
        destinationVisible: true,
        sourceTextLength: 'synthetic source'.length,
      }),
      createEditors({
        destinationText: 'fresh',
        destinationVisible: true,
        sourceTextLength: 'synthetic source'.length,
      }),
    ];

    const outcome = await harness.provider.translate(requestFixture.create({ targetLanguage: 'be' }));

    assert.equal(outcome.success ? outcome.text : null, 'fresh');
    assert.equal(harness.adapter.clearClicks, 2);
    assert.equal(harness.adapter.currentEditors.sourceTextLength, 0);
    assert.equal(harness.adapter.currentEditors.destinationText, '');
    assert.equal(harness.adapter.currentEditors.destinationVisible, false);
    assert.equal(harness.adapter.route.hasTextParameter, false);
    assert.equal(harness.adapter.route.targetLanguage, 'be');
    assert.equal(harness.contexts[0]?.closeCalls, 0);
  });

  it('returns the result only after context closure when visible clearing cannot be confirmed', async () => {
    const harness = createHarness();
    harness.adapter.clearDoesNotComplete = true;

    const outcome = await harness.provider.translate(requestFixture.create());

    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.equal(harness.adapter.clearClicks, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });
});
