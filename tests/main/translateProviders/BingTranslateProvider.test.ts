/* eslint-disable max-classes-per-file -- deterministic browser and public-control fixtures share one harness. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';

import {
  BING_BLOCKING_SURFACE_SELECTOR,
  BING_CATALOG_STABILITY_DELAY_MS,
  BING_READINESS_TIMEOUT_MS,
  BingTranslateProvider,
  classifyBingCanonicalCatalog,
  classifyBingResultSnapshot,
  createBingRouteSnapshot,
  type BingCanonicalCatalogSnapshot,
  type BingCanonicalOptionSnapshot,
  type BingClearSnapshot,
  type BingControlCountSnapshot,
  type BingPublicControlsSnapshot,
  type BingResultSnapshot,
  type BingRouteSnapshot,
  type BingSelectionSnapshot,
  type BingTranslatePageAdapter,
} from '@main/translateProviders/BingTranslateProvider';
import type { TranslationProviderRequest } from '@main/translateProviders/translationProviderContracts';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';
import {
  createTranslationAuditRecorder,
  createTranslationAuditRequestFields,
  noopTranslationProviderAudit,
} from './translationAuditTestUtils';

function createControl(visible = 1, visibleEnabled = visible): BingControlCountSnapshot {
  return { visible, visibleEnabled };
}

function createControls(overrides: Partial<BingPublicControlsSnapshot> = {}): BingPublicControlsSnapshot {
  return {
    blockingSurfaces: 0,
    output: createControl(),
    sourceEditor: createControl(),
    sourceSelect: createControl(),
    sourceTextLength: 0,
    targetSelect: createControl(),
    ...overrides,
  };
}

function createCatalog(
  options: readonly BingCanonicalOptionSnapshot[] = [
    { enabled: true, label: 'Belarusian', value: 'be' },
    { enabled: true, label: 'English', value: 'en' },
    { enabled: true, label: 'Russian', value: 'ru' },
    { enabled: true, label: 'Ukrainian', value: 'uk' },
  ],
): BingCanonicalCatalogSnapshot {
  return { canonicalGroups: 1, options };
}

function createResult(
  text = '',
  outputLanguage = 'en',
  visibleOutputControls = 1,
  visibleEnabledOutputControls = visibleOutputControls,
): BingResultSnapshot {
  return { outputLanguage, text, visibleEnabledOutputControls, visibleOutputControls };
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

class FixtureBingPageAdapter implements BingTranslatePageAdapter {
  afterInsertionSelection: BingSelectionSnapshot | null = null;
  canonicalReadCalls = 0;
  canonicalReads: BingCanonicalCatalogSnapshot[] = [createCatalog(), createCatalog()];
  clearClicks = 0;
  clearControlEnabled = false;
  clearDoesNotComplete = false;
  clearWrapperVisible = false;
  controls = createControls();
  currentResult = createResult();
  fillCalls: string[] = [];
  navigationCalls = 0;
  outputLanguageFollowsTarget = true;
  readonly recentlyUsedOptions: BingCanonicalOptionSnapshot[] = [];
  resultReadsAfterInsertion: BingResultSnapshot[] = [createResult('translated'), createResult('translated')];
  route: BingRouteSnapshot = { route: 'translator' };
  scriptConsoleFailures = 0;
  selection: BingSelectionSnapshot = {
    outputLanguage: 'en',
    sourceLanguage: 'auto-detect',
    targetLanguage: 'en',
  };
  sourceFocused = false;
  sourceSelectionSticks = true;
  targetSelectionSticks = true;
  visibleClearControls = 0;
  visibleClearWrappers = 1;
  private lastCatalog = createCatalog();
  private submitted = false;

  async navigate(): Promise<void> {
    this.navigationCalls += 1;
  }

  async readRouteSnapshot(): Promise<BingRouteSnapshot> {
    return this.route;
  }

  async readPublicControlsSnapshot(): Promise<BingPublicControlsSnapshot> {
    return this.controls;
  }

  async readCanonicalCatalogSnapshot(): Promise<BingCanonicalCatalogSnapshot> {
    this.canonicalReadCalls += 1;
    this.lastCatalog = this.canonicalReads.shift() ?? this.lastCatalog;
    return this.lastCatalog;
  }

  async readSelectionSnapshot(): Promise<BingSelectionSnapshot> {
    return this.submitted && this.afterInsertionSelection ? this.afterInsertionSelection : this.selection;
  }

  async selectSourceLanguage(value: string): Promise<boolean> {
    if (this.sourceSelectionSticks) {
      this.selection = { ...this.selection, sourceLanguage: value };
    }
    return true;
  }

  async selectTargetLanguage(value: string): Promise<boolean> {
    if (this.targetSelectionSticks) {
      this.selection = {
        ...this.selection,
        outputLanguage: this.outputLanguageFollowsTarget ? value : this.selection.outputLanguage,
        targetLanguage: value,
      };
    }
    return true;
  }

  async fillSourceText(sourceText: string): Promise<boolean> {
    this.fillCalls.push(sourceText);
    this.submitted = true;
    this.controls = { ...this.controls, sourceTextLength: sourceText.length };
    this.visibleClearControls = 1;
    this.clearControlEnabled = true;
    this.clearWrapperVisible = true;
    this.sourceFocused = true;
    return true;
  }

  async readResultSnapshot(): Promise<BingResultSnapshot> {
    if (this.submitted) {
      this.currentResult = this.resultReadsAfterInsertion.shift() ?? this.currentResult;
    }
    return {
      ...this.currentResult,
      outputLanguage: this.selection.outputLanguage,
      visibleEnabledOutputControls: this.controls.output.visibleEnabled,
      visibleOutputControls: this.controls.output.visible,
    };
  }

  async readClearSnapshot(): Promise<BingClearSnapshot> {
    return {
      clearControlEnabled: this.clearControlEnabled,
      clearWrapperVisible: this.clearWrapperVisible,
      controls: this.controls,
      result: await this.readResultSnapshot(),
      selection: this.selection,
      sourceFocused: this.sourceFocused,
      visibleClearControls: this.visibleClearControls,
      visibleClearWrappers: this.visibleClearWrappers,
    };
  }

  async clickClear(): Promise<boolean> {
    if (this.visibleClearControls !== 1 || !this.clearControlEnabled) return false;
    this.clearClicks += 1;
    if (this.clearDoesNotComplete) return true;
    this.submitted = false;
    this.controls = { ...this.controls, sourceTextLength: 0 };
    this.currentResult = createResult('', this.selection.outputLanguage ?? '');
    this.selection = { ...this.selection, sourceLanguage: 'auto-detect' };
    this.visibleClearControls = 0;
    this.clearControlEnabled = false;
    this.clearWrapperVisible = false;
    this.sourceFocused = true;
    return true;
  }
}

interface Harness {
  readonly adapters: readonly FixtureBingPageAdapter[];
  readonly contexts: FakeContext[];
  readonly provider: BingTranslateProvider;
}

function createHarness(
  adapters: readonly FixtureBingPageAdapter[] = [new FixtureBingPageAdapter()],
  resultTimeoutMs: number | null = 4,
): Harness {
  const contexts: FakeContext[] = [];
  let adapterIndex = 0;
  const fallbackAdapter = adapters[0] ?? new FixtureBingPageAdapter();
  const provider = new BingTranslateProvider({
    catalogStabilityDelayMs: 1,
    clearPollIntervalMs: 1,
    clearTimeoutMs: 2,
    createContext: async (_options: LaunchContextOptions) => {
      const context = new FakeContext();
      contexts.push(context);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({ headless: true }),
    createPageAdapter: () => adapters[Math.min(adapterIndex++, adapters.length - 1)] ?? fallbackAdapter,
    now: () => 1_000,
    readinessTimeoutMs: 2,
    resultPollIntervalMs: 1,
    resultStabilityDelayMs: 0,
    ...(resultTimeoutMs === null ? {} : { resultTimeoutMs }),
    sleep: async () => {},
    waitForCatalogStability: async () => {},
    waitForClearPoll: async () => {},
  });
  return { adapters, contexts, provider };
}

function createRequest(
  overrides: Partial<TranslationProviderRequest> = {},
  audit = noopTranslationProviderAudit,
): TranslationProviderRequest {
  return {
    ...createTranslationAuditRequestFields('bing', audit),
    providerId: 'bing',
    sourceText: 'synthetic source',
    targetLanguage: 'en',
    ...overrides,
  };
}

function failureCode(outcome: Awaited<ReturnType<BingTranslateProvider['translate']>>): string | null {
  return outcome.success ? null : outcome.code;
}

describe('BingTranslateProvider', () => {
  it('uses the approved bounded production readiness window', () => {
    assert.equal(BING_CATALOG_STABILITY_DELAY_MS, 250);
    assert.equal(BING_READINESS_TIMEOUT_MS, 5_000);
    assert.match(BING_BLOCKING_SURFACE_SELECTOR, /\[role="dialog"\]:not\(\.infobubble\)/u);
    assert.match(BING_BLOCKING_SURFACE_SELECTOR, /iframe\[title\*="challenge" i\]/u);
    assert.match(BING_BLOCKING_SURFACE_SELECTOR, /iframe\[title\*="captcha" i\]/u);
  });

  it('keeps loading sentinels inside one insertion result window', async () => {
    const audit = createTranslationAuditRecorder();
    const adapter = new FixtureBingPageAdapter();
    adapter.resultReadsAfterInsertion = [
      ...Array.from({ length: 80 }, () => createResult('...')),
      ...Array.from({ length: 80 }, () => createResult('…')),
      createResult('translated'),
      createResult('translated'),
    ];
    const harness = createHarness([adapter], null);

    const outcome = await harness.provider.translate(createRequest({}, audit.audit));

    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.deepEqual(adapter.fillCalls, ['synthetic source']);
    assert.equal(audit.events.filter((event) => event.event === 'terminal').length, 1);
    assert.equal(audit.events[audit.events.length - 1]?.outcome, 'success');
  });

  it('keeps Bing loading sentinels inside the base timeout loop', () => {
    assert.deepEqual(classifyBingResultSnapshot(createResult('...')), { success: true, value: '' });
    assert.deepEqual(classifyBingResultSnapshot(createResult(' … ')), { success: true, value: '' });
    assert.deepEqual(classifyBingResultSnapshot(createResult('translated')), {
      success: true,
      value: 'translated',
    });
  });

  it('binds shared Bing metadata and validates target and length before browser creation', async () => {
    const harness = createHarness();

    assert.equal(harness.provider.info, TRANSLATION_PROVIDER_INFO.bing);
    assert.equal(harness.provider.info.targetLanguages.length, 179);
    assert.equal(harness.provider.info.maxInputCharacters, 1_000);
    assert.equal(
      harness.provider.info.targetLanguages.some((language) => String(language.code) === 'auto-detect'),
      false,
    );

    const automaticTarget = await harness.provider.translate(createRequest({ targetLanguage: 'auto-detect' }));
    const overLimit = await harness.provider.translate(createRequest({ sourceText: 'x'.repeat(1_001) }));
    assert.equal(failureCode(automaticTarget), 'unsupportedTargetLanguage');
    assert.equal(failureCode(overLimit), 'inputTooLong');
    assert.equal(harness.contexts.length, 0);

    const atLimit = createHarness();
    const outcome = await atLimit.provider.translate(createRequest({ sourceText: 'x'.repeat(1_000) }));
    assert.equal(outcome.success, true);
    assert.equal(atLimit.adapters[0]?.fillCalls[0]?.length, 1_000);
  });

  it('navigates once and selects exact current target values with automatic source detection', async () => {
    for (const targetLanguage of ['en', 'ru', 'uk', 'be'] as const) {
      const harness = createHarness();
      const outcome = await harness.provider.translate(createRequest({ targetLanguage }));

      assert.equal(outcome.success, true);
      assert.equal(harness.adapters[0]?.navigationCalls, 1);
      assert.deepEqual(harness.adapters[0]?.selection, {
        outputLanguage: targetLanguage,
        sourceLanguage: 'auto-detect',
        targetLanguage,
      });
      assert.deepEqual(harness.adapters[0]?.fillCalls, ['synthetic source']);
    }
  });

  it('accepts only the exact public translator route', () => {
    assert.deepEqual(createBingRouteSnapshot('https://www.bing.com/translator'), { route: 'translator' });
    assert.deepEqual(createBingRouteSnapshot('https://www.bing.com/translator/'), { route: 'translator' });
    assert.deepEqual(createBingRouteSnapshot('https://www.bing.com/translator?text=synthetic'), {
      route: 'unexpected',
    });
    assert.deepEqual(createBingRouteSnapshot('https://www.bing.com/signin'), { route: 'loginOrChallenge' });
    assert.deepEqual(createBingRouteSnapshot('https://login.live.com/'), { route: 'unexpected' });
  });

  it('fails closed for unexpected routes and blocking public surfaces', async () => {
    const unexpected = new FixtureBingPageAdapter();
    unexpected.route = { route: 'unexpected' };
    const blocked = new FixtureBingPageAdapter();
    blocked.controls = createControls({ blockingSurfaces: 1 });

    for (const adapter of [unexpected, blocked]) {
      const harness = createHarness([adapter]);
      const outcome = await harness.provider.translate(createRequest());
      assert.equal(failureCode(outcome), 'consentOrChallenge');
      assert.equal(adapter.fillCalls.length, 0);
    }
  });

  it('rejects missing, duplicate, or disabled public controls after one clean recovery', async () => {
    for (const controls of [
      createControls({ sourceSelect: createControl(0, 0) }),
      createControls({ targetSelect: createControl(2, 2) }),
      createControls({ sourceEditor: createControl(1, 0) }),
      createControls({ output: createControl(1, 0) }),
    ]) {
      const adapter = new FixtureBingPageAdapter();
      adapter.controls = controls;
      const harness = createHarness([adapter, adapter]);

      const outcome = await harness.provider.translate(createRequest());

      assert.equal(failureCode(outcome), 'pageContractFailure');
      assert.equal(adapter.fillCalls.length, 0);
      assert.equal(harness.contexts.length, 2);
    }
  });

  it('normalizes an order-independent canonical catalog and rejects invalid options', () => {
    const first = classifyBingCanonicalCatalog(
      createCatalog([
        { enabled: true, label: ' English ', value: 'en' },
        { enabled: true, label: 'Russian', value: 'ru' },
      ]),
    );
    const second = classifyBingCanonicalCatalog(
      createCatalog([
        { enabled: true, label: 'Russian', value: 'ru' },
        { enabled: true, label: 'English', value: 'en' },
      ]),
    );
    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(first.success && second.success ? first.value : null, second.success ? second.value : null);

    for (const invalid of [
      createCatalog([]),
      { canonicalGroups: 2, options: createCatalog().options },
      createCatalog([{ enabled: false, label: 'English', value: 'en' }]),
      createCatalog([{ enabled: true, label: ' ', value: 'en' }]),
      createCatalog([
        { enabled: true, label: 'English', value: 'en' },
        { enabled: true, label: 'Recent English', value: 'en' },
      ]),
    ]) {
      assert.equal(classifyBingCanonicalCatalog(invalid).success, false);
    }
  });

  it('ignores Recently used duplicates and browser script-console failures', async () => {
    const adapter = new FixtureBingPageAdapter();
    adapter.recentlyUsedOptions.push({ enabled: true, label: 'English', value: 'en' });
    adapter.scriptConsoleFailures = 3;

    const outcome = await createHarness([adapter]).provider.translate(createRequest());

    assert.equal(outcome.success, true);
    assert.equal(adapter.recentlyUsedOptions.length, 1);
    assert.equal(adapter.scriptConsoleFailures, 3);

    const recentOnly = new FixtureBingPageAdapter();
    recentOnly.canonicalReads = [
      createCatalog([{ enabled: true, label: 'English', value: 'en' }]),
      createCatalog([{ enabled: true, label: 'English', value: 'en' }]),
    ];
    recentOnly.recentlyUsedOptions.push({ enabled: true, label: 'Russian', value: 'ru' });
    const recentOnlyOutcome = await createHarness([recentOnly, recentOnly]).provider.translate(
      createRequest({ targetLanguage: 'ru' }),
    );
    assert.equal(failureCode(recentOnlyOutcome), 'pageContractFailure');
    assert.equal(recentOnly.fillCalls.length, 0);
  });

  it('recovers once when the canonical catalog is unstable, then reruns the full gate', async () => {
    const first = new FixtureBingPageAdapter();
    first.canonicalReads = [
      createCatalog([{ enabled: true, label: 'English', value: 'en' }]),
      createCatalog([{ enabled: true, label: 'Russian', value: 'ru' }]),
      createCatalog([{ enabled: true, label: 'English', value: 'en' }]),
    ];
    const second = new FixtureBingPageAdapter();
    const harness = createHarness([first, second]);

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(outcome.success, true);
    assert.equal(harness.contexts.length, 2);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
    assert.equal(first.fillCalls.length, 0);
    assert.deepEqual(second.fillCalls, ['synthetic source']);
    assert.equal(outcome.metadata.attemptCount, 2);
  });

  it('fails after the second unstable readiness attempt', async () => {
    const createUnstable = (): FixtureBingPageAdapter => {
      const adapter = new FixtureBingPageAdapter();
      adapter.canonicalReads = [
        createCatalog([{ enabled: true, label: 'English', value: 'en' }]),
        createCatalog([{ enabled: true, label: 'Russian', value: 'ru' }]),
        createCatalog([{ enabled: true, label: 'English', value: 'en' }]),
      ];
      return adapter;
    };
    const first = createUnstable();
    const second = createUnstable();
    const harness = createHarness([first, second]);

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(failureCode(outcome), 'pageContractFailure');
    assert.equal(harness.contexts.length, 2);
    assert.equal(first.fillCalls.length + second.fillCalls.length, 0);
  });

  it('rejects source or target values that do not stick before submission', async () => {
    const source = new FixtureBingPageAdapter();
    source.sourceSelectionSticks = false;
    source.selection = { ...source.selection, sourceLanguage: 'en' };
    const target = new FixtureBingPageAdapter();
    target.targetSelectionSticks = false;

    for (const adapter of [source, target]) {
      const harness = createHarness([adapter, adapter]);
      const outcome = await harness.provider.translate(createRequest({ targetLanguage: 'ru' }));
      assert.equal(failureCode(outcome), 'pageContractFailure');
      assert.equal(adapter.fillCalls.length, 0);
    }
  });

  it('returns one stable changed output after exactly one fill', async () => {
    const adapter = new FixtureBingPageAdapter();
    adapter.resultReadsAfterInsertion = [createResult('fresh'), createResult('fresh')];
    const harness = createHarness([adapter]);

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(outcome.success ? outcome.text : null, 'fresh');
    assert.deepEqual(adapter.fillCalls, ['synthetic source']);
  });

  it('reuses one prepared page and its validated canonical catalog', async () => {
    const adapter = new FixtureBingPageAdapter();
    const harness = createHarness([adapter]);

    const first = await harness.provider.translate(createRequest({ sourceText: 'first source' }));
    adapter.resultReadsAfterInsertion = [createResult('second'), createResult('second')];
    const second = await harness.provider.translate(createRequest({ sourceText: 'second source' }));

    assert.equal(first.success, true);
    assert.equal(second.success ? second.text : null, 'second');
    assert.equal(adapter.navigationCalls, 1);
    assert.equal(adapter.canonicalReadCalls, 2);
    assert.deepEqual(adapter.fillCalls, ['first source', 'second source']);
    assert.equal(harness.contexts.length, 1);
  });

  it('requires target-select and output-language agreement when accepting a result', async () => {
    const adapter = new FixtureBingPageAdapter();
    adapter.outputLanguageFollowsTarget = false;
    const harness = createHarness([adapter, adapter]);

    const outcome = await harness.provider.translate(createRequest({ targetLanguage: 'ru' }));

    assert.equal(failureCode(outcome), 'pageContractFailure');
    assert.equal(adapter.fillCalls.length, 0);
  });

  it('rejects target drift after submission without replaying fill', async () => {
    const adapter = new FixtureBingPageAdapter();
    adapter.afterInsertionSelection = {
      outputLanguage: 'ru',
      sourceLanguage: 'auto-detect',
      targetLanguage: 'en',
    };
    const harness = createHarness([adapter]);

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(failureCode(outcome), 'pageContractFailure');
    assert.deepEqual(adapter.fillCalls, ['synthetic source']);
  });

  it('leaves empty output to the base timeout policy without replay', async () => {
    const adapter = new FixtureBingPageAdapter();
    adapter.resultReadsAfterInsertion = [createResult(), createResult()];
    const harness = createHarness([adapter], 2);

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(failureCode(outcome), 'resultTimeoutOrEmpty');
    assert.deepEqual(adapter.fillCalls, ['synthetic source']);
  });

  it('clears stale output and confirms exact post-success clear state', async () => {
    const adapter = new FixtureBingPageAdapter();
    adapter.currentResult = createResult('stale');
    adapter.visibleClearControls = 1;
    adapter.clearControlEnabled = true;
    adapter.clearWrapperVisible = true;
    adapter.resultReadsAfterInsertion = [createResult('stale'), createResult('fresh'), createResult('fresh')];
    const harness = createHarness([adapter]);

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(outcome.success ? outcome.text : null, 'fresh');
    assert.equal(adapter.clearClicks, 2);
    assert.equal(adapter.controls.sourceTextLength, 0);
    assert.equal(adapter.currentResult.text, '');
    assert.equal(adapter.selection.sourceLanguage, 'auto-detect');
    assert.equal(adapter.selection.targetLanguage, 'en');
    assert.equal(adapter.clearWrapperVisible, false);
    assert.equal(adapter.visibleClearControls, 0);
    assert.equal(adapter.sourceFocused, true);
    assert.equal(harness.contexts[0]?.closeCalls, 0);
  });

  it('closes the context before returning success when clear confirmation fails', async () => {
    const adapter = new FixtureBingPageAdapter();
    adapter.clearDoesNotComplete = true;
    const harness = createHarness([adapter]);

    const outcome = await harness.provider.translate(createRequest());

    assert.equal(outcome.success ? outcome.text : null, 'translated');
    assert.equal(adapter.clearClicks, 1);
    assert.equal(harness.contexts[0]?.closeCalls, 1);
  });
});
