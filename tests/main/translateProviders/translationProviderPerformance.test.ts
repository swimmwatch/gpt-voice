/* eslint-disable max-classes-per-file -- deterministic provider adapters own isolated browser state. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';

import { TestCloakBrowserSettingsRepository } from '../appConfigTestUtils';

import {
  TRANSLATION_RESULT_POLL_INTERVAL_MS,
  TRANSLATION_RESULT_STABILITY_DELAY_MS,
  TRANSLATION_RESULT_TIMEOUT_MS,
} from '@main/translateProviders/BaseTranslateProvider';
import {
  GoogleTranslateProvider,
  type GoogleClearSnapshot,
  type GoogleReadinessSnapshot,
  type GoogleResultSnapshot,
  type GoogleRouteSnapshot,
  type GoogleTranslatePageAdapter,
} from '@main/translateProviders/GoogleTranslateProvider';
import {
  BingTranslateProvider,
  type BingCanonicalCatalogSnapshot,
  type BingClearSnapshot,
  type BingPublicControlsSnapshot,
  type BingResultSnapshot,
  type BingRouteSnapshot,
  type BingSelectionSnapshot,
  type BingTranslatePageAdapter,
} from '@main/translateProviders/BingTranslateProvider';
import {
  YandexTranslateProvider,
  type YandexAutomaticSourceSnapshot,
  type YandexClearSnapshot,
  type YandexEditorSnapshot,
  type YandexReadinessSnapshot,
  type YandexRouteSnapshot,
  type YandexTargetSnapshot,
  type YandexTranslatePageAdapter,
} from '@main/translateProviders/YandexTranslateProvider';
import type { TranslationProviderInstance } from '@main/translateProviders';
import type { TranslationProviderRequest } from '@main/translateProviders/translationProviderContracts';
import type { TranslationProviderId } from '@shared/translationProvider';
import {
  RecordingTranslationProviderAudit,
  TranslationProviderRequestFixture,
  type RecordedTranslationAuditEvent,
} from './translationAuditTestUtils';

const BROWSER_EVALUATION_COST_MS = 5;
const GENERIC_SOURCE_TEXT = 'x'.repeat(16);
const GENERIC_RESULT_TEXT = 'r'.repeat(12);
const TARGET_LANGUAGE = 'en';

type BenchmarkPath = 'cold' | 'warm';

interface BaselineCell {
  readonly browserEvaluationCount: number;
  readonly browserEvaluationSequence: readonly string[];
  readonly confirmationDurationMs: number;
  readonly contextCreationCount: number;
  readonly initializationNavigationDurationMs: number;
  readonly path: BenchmarkPath;
  readonly providerId: TranslationProviderId;
  readonly queueDurationMs: number;
  readonly readinessDurationMs: number;
  readonly sleepDurationsMs: readonly number[];
  readonly submissionToFirstCandidateDurationMs: number;
  readonly targetVerificationDurationMs: number;
  readonly totalApplicationControlledDurationMs: number;
  readonly visibleClearDurationMs: number;
}

interface ScenarioHarness {
  readonly contexts: FakeContext[];
  readonly provider: TranslationProviderInstance;
  readonly timeline: ControlledTimeline;
}

interface ProviderScenario {
  readonly createHarness: () => ScenarioHarness;
  readonly providerId: TranslationProviderId;
}

class ControlledTimeline {
  private confirmationAtMs: number | null = null;
  private contextCreationCount = 0;
  private firstCandidateAtMs: number | null = null;
  private insertionAtMs: number | null = null;
  private nowMs = 0;
  private targetVerificationAtMs: number | null = null;
  private visibleClearCompletedAtMs: number | null = null;
  private visibleClearStartedAtMs: number | null = null;

  public readonly browserEvaluationSequence: string[] = [];
  public readonly sleepDurationsMs: number[] = [];

  public beginMeasurement(): void {
    this.browserEvaluationSequence.length = 0;
    this.confirmationAtMs = null;
    this.contextCreationCount = 0;
    this.firstCandidateAtMs = null;
    this.insertionAtMs = null;
    this.nowMs = 0;
    this.sleepDurationsMs.length = 0;
    this.targetVerificationAtMs = null;
    this.visibleClearCompletedAtMs = null;
    this.visibleClearStartedAtMs = null;
  }

  public browserEvaluation(name: string): void {
    this.browserEvaluationSequence.push(name);
    this.nowMs += BROWSER_EVALUATION_COST_MS;
  }

  public contextCreated(): void {
    this.contextCreationCount += 1;
    this.nowMs += BROWSER_EVALUATION_COST_MS;
  }

  public pageCreated(): void {
    this.nowMs += BROWSER_EVALUATION_COST_MS;
  }

  public now(): number {
    return this.nowMs;
  }

  public sleep(delayMs: number): Promise<void> {
    this.sleepDurationsMs.push(delayMs);
    this.nowMs += delayMs;
    return Promise.resolve();
  }

  public recordInsertion(): void {
    this.insertionAtMs = this.nowMs;
  }

  public recordCandidate(): void {
    if (this.firstCandidateAtMs === null) {
      this.firstCandidateAtMs = this.nowMs;
      return;
    }
    if (this.confirmationAtMs === null) this.confirmationAtMs = this.nowMs;
  }

  public recordTargetVerification(): void {
    if (this.confirmationAtMs !== null && this.targetVerificationAtMs === null) {
      this.targetVerificationAtMs = this.nowMs;
    }
  }

  public recordVisibleClearStart(): void {
    if (this.confirmationAtMs !== null && this.visibleClearStartedAtMs === null) {
      this.visibleClearStartedAtMs = this.nowMs;
    }
  }

  public recordVisibleClearCompletion(): void {
    if (this.visibleClearStartedAtMs !== null && this.visibleClearCompletedAtMs === null) {
      this.visibleClearCompletedAtMs = this.nowMs;
    }
  }

  public createCell(
    providerId: TranslationProviderId,
    path: BenchmarkPath,
    events: readonly RecordedTranslationAuditEvent[],
  ): BaselineCell {
    const firstCandidateAtMs = this.requireMeasurement(this.firstCandidateAtMs, 'first result candidate');
    const insertionAtMs = this.requireMeasurement(this.insertionAtMs, 'source insertion');
    const confirmationAtMs = this.requireMeasurement(this.confirmationAtMs, 'result confirmation');
    const targetVerificationAtMs = this.requireMeasurement(this.targetVerificationAtMs, 'target verification');
    const visibleClearStartedAtMs = this.requireMeasurement(this.visibleClearStartedAtMs, 'visible clear start');
    const visibleClearCompletedAtMs = this.requireMeasurement(
      this.visibleClearCompletedAtMs,
      'visible clear completion',
    );

    return {
      browserEvaluationCount: this.browserEvaluationSequence.length,
      browserEvaluationSequence: [...this.browserEvaluationSequence],
      confirmationDurationMs: confirmationAtMs - firstCandidateAtMs,
      contextCreationCount: this.contextCreationCount,
      initializationNavigationDurationMs: phaseDuration(events, 'context') + phaseDuration(events, 'navigation'),
      path,
      providerId,
      queueDurationMs: 0,
      readinessDurationMs: phaseDuration(events, 'readiness'),
      sleepDurationsMs: [...this.sleepDurationsMs],
      submissionToFirstCandidateDurationMs: firstCandidateAtMs - insertionAtMs,
      targetVerificationDurationMs: targetVerificationAtMs - confirmationAtMs,
      totalApplicationControlledDurationMs: this.nowMs,
      visibleClearDurationMs: visibleClearCompletedAtMs - visibleClearStartedAtMs,
    };
  }

  private requireMeasurement(value: number | null, name: string): number {
    if (value === null) throw new Error(`Missing ${name} measurement`);
    return value;
  }
}

class FakePage {
  private closed = false;

  public constructor(private readonly timeline: ControlledTimeline) {}

  public async close(): Promise<void> {
    this.timeline.browserEvaluation('page.close');
    this.closed = true;
  }

  public isClosed(): boolean {
    return this.closed;
  }
}

class FakeContext {
  public readonly page: FakePage;

  public constructor(private readonly timeline: ControlledTimeline) {
    this.page = new FakePage(timeline);
  }

  public async close(): Promise<void> {
    await this.page.close();
  }

  public async newPage(): Promise<Page> {
    this.timeline.pageCreated();
    return this.page as unknown as Page;
  }
}

class GooglePerformanceAdapter implements GoogleTranslatePageAdapter {
  private clearControlEnabled = false;
  private route: GoogleRouteSnapshot = this.createRoute(TARGET_LANGUAGE, false);
  private sourceValueLength = 0;
  private submitted = false;
  private visibleClearControls = 0;

  public constructor(private readonly timeline: ControlledTimeline) {}

  public async clickClearSource(): Promise<boolean> {
    this.timeline.browserEvaluation('google.clear.click');
    this.submitted = false;
    this.sourceValueLength = 0;
    this.visibleClearControls = 0;
    this.clearControlEnabled = false;
    this.route = this.createRoute(this.route.targetLanguage ?? TARGET_LANGUAGE, false);
    return true;
  }

  public async clickRejectAll(): Promise<boolean> {
    this.timeline.browserEvaluation('google.consent.click');
    return false;
  }

  public async insertSourceText(sourceText: string): Promise<boolean> {
    this.timeline.browserEvaluation('google.source.insert');
    this.submitted = true;
    this.sourceValueLength = sourceText.length;
    this.visibleClearControls = 1;
    this.clearControlEnabled = true;
    this.route = this.createRoute(this.route.targetLanguage ?? TARGET_LANGUAGE, true);
    this.timeline.recordInsertion();
    return true;
  }

  public async navigate(url: string): Promise<void> {
    this.timeline.browserEvaluation('google.navigate');
    this.route = this.createRoute(new URL(url).searchParams.get('tl') ?? TARGET_LANGUAGE, false);
  }

  public async readClearSnapshot(): Promise<GoogleClearSnapshot> {
    this.timeline.browserEvaluation('google.clear.read');
    this.timeline.recordVisibleClearStart();
    if (this.sourceValueLength === 0) this.timeline.recordVisibleClearCompletion();
    return {
      clearControlEnabled: this.clearControlEnabled,
      readiness: this.readiness(),
      result: this.resultSnapshot(),
      route: this.route,
      sourceValueLength: this.sourceValueLength,
      visibleClearControls: this.visibleClearControls,
    };
  }

  public async readConsentSnapshot(): Promise<{ readonly visibleRejectAllControls: number }> {
    this.timeline.browserEvaluation('google.consent.read');
    return { visibleRejectAllControls: 0 };
  }

  public async readReadinessSnapshot(): Promise<GoogleReadinessSnapshot> {
    this.timeline.browserEvaluation('google.readiness.read');
    return this.readiness();
  }

  public async readResultSnapshot(): Promise<GoogleResultSnapshot> {
    this.timeline.browserEvaluation('google.result.read');
    if (this.submitted) this.timeline.recordCandidate();
    return this.resultSnapshot();
  }

  public async readRouteSnapshot(): Promise<GoogleRouteSnapshot> {
    this.timeline.browserEvaluation('google.route.read');
    this.timeline.recordTargetVerification();
    return this.route;
  }

  private createRoute(targetLanguage: string, hasTextParameter: boolean): GoogleRouteSnapshot {
    return {
      family: 'ru',
      hasTextParameter,
      operation: 'translate',
      origin: 'translator',
      route: 'translator',
      sourceLanguage: 'auto',
      targetLanguage,
    };
  }

  private readiness(): GoogleReadinessSnapshot {
    return {
      visibleEditableSourceControls: 1,
      visibleResultRegions: 1,
      visibleSourceControls: 1,
    };
  }

  private resultSnapshot(): GoogleResultSnapshot {
    return {
      fragments: this.submitted
        ? [{ branchIndex: 0, insideListItem: false, text: GENERIC_RESULT_TEXT, visible: true }]
        : [],
      visibleResultRegions: 1,
    };
  }
}

class BingPerformanceAdapter implements BingTranslatePageAdapter {
  private clearControlEnabled = false;
  private clearWrapperVisible = false;
  private readonly catalog: BingCanonicalCatalogSnapshot = {
    canonicalGroups: 1,
    options: [
      { enabled: true, label: 'English', value: 'en' },
      { enabled: true, label: 'Russian', value: 'ru' },
    ],
  };
  private controls: BingPublicControlsSnapshot = this.createControls(0);
  private selection: BingSelectionSnapshot = {
    outputLanguage: TARGET_LANGUAGE,
    sourceLanguage: 'auto-detect',
    targetLanguage: TARGET_LANGUAGE,
  };
  private submitted = false;
  private visibleClearControls = 0;

  public constructor(private readonly timeline: ControlledTimeline) {}

  public async clickClear(): Promise<boolean> {
    this.timeline.browserEvaluation('bing.clear.click');
    this.submitted = false;
    this.controls = this.createControls(0);
    this.clearControlEnabled = false;
    this.clearWrapperVisible = false;
    this.visibleClearControls = 0;
    this.selection = { ...this.selection, sourceLanguage: 'auto-detect' };
    return true;
  }

  public async fillSourceText(sourceText: string): Promise<boolean> {
    this.timeline.browserEvaluation('bing.source.fill');
    this.submitted = true;
    this.controls = this.createControls(sourceText.length);
    this.clearControlEnabled = true;
    this.clearWrapperVisible = true;
    this.visibleClearControls = 1;
    this.timeline.recordInsertion();
    return true;
  }

  public async navigate(): Promise<void> {
    this.timeline.browserEvaluation('bing.navigate');
  }

  public async readCanonicalCatalogSnapshot(): Promise<BingCanonicalCatalogSnapshot> {
    this.timeline.browserEvaluation('bing.catalog.read');
    return this.catalog;
  }

  public async readClearSnapshot(): Promise<BingClearSnapshot> {
    this.timeline.browserEvaluation('bing.clear.read');
    this.timeline.recordVisibleClearStart();
    if (this.controls.sourceTextLength === 0) this.timeline.recordVisibleClearCompletion();
    return {
      clearControlEnabled: this.clearControlEnabled,
      clearWrapperVisible: this.clearWrapperVisible,
      controls: this.controls,
      result: this.resultSnapshot(),
      selection: this.selection,
      sourceFocused: true,
      visibleClearControls: this.visibleClearControls,
      visibleClearWrappers: 1,
    };
  }

  public async readPublicControlsSnapshot(): Promise<BingPublicControlsSnapshot> {
    this.timeline.browserEvaluation('bing.controls.read');
    return this.controls;
  }

  public async readResultSnapshot(): Promise<BingResultSnapshot> {
    this.timeline.browserEvaluation('bing.result.read');
    if (this.submitted) this.timeline.recordCandidate();
    return this.resultSnapshot();
  }

  public async readRouteSnapshot(): Promise<BingRouteSnapshot> {
    this.timeline.browserEvaluation('bing.route.read');
    return { route: 'translator' };
  }

  public async readSelectionSnapshot(): Promise<BingSelectionSnapshot> {
    this.timeline.browserEvaluation('bing.selection.read');
    this.timeline.recordTargetVerification();
    return this.selection;
  }

  public async selectSourceLanguage(value: string): Promise<boolean> {
    this.timeline.browserEvaluation('bing.source.select');
    this.selection = { ...this.selection, sourceLanguage: value };
    return true;
  }

  public async selectTargetLanguage(value: string): Promise<boolean> {
    this.timeline.browserEvaluation('bing.target.select');
    this.selection = { outputLanguage: value, sourceLanguage: this.selection.sourceLanguage, targetLanguage: value };
    return true;
  }

  private createControls(sourceTextLength: number): BingPublicControlsSnapshot {
    const control = { visible: 1, visibleEnabled: 1 };
    return {
      blockingSurfaces: 0,
      output: control,
      sourceEditor: control,
      sourceSelect: control,
      sourceTextLength,
      targetSelect: control,
    };
  }

  private resultSnapshot(): BingResultSnapshot {
    return {
      outputLanguage: this.selection.outputLanguage,
      text: this.submitted ? GENERIC_RESULT_TEXT : '',
      visibleEnabledOutputControls: 1,
      visibleOutputControls: 1,
    };
  }
}

class YandexPerformanceAdapter implements YandexTranslatePageAdapter {
  private automaticSource: YandexAutomaticSourceSnapshot = {
    checked: true,
    chooserOpen: false,
    enabledSwitches: 1,
    exactLabels: 1,
    switches: 1,
  };
  private clearControlEnabled = false;
  private editors = this.createEditors(0, false);
  private route: YandexRouteSnapshot = {
    hasTextParameter: false,
    route: 'translator',
    sourceLanguage: 'auto',
    targetLanguage: null,
  };
  private submitted = false;
  private target: YandexTargetSnapshot = { selectedTargetCode: null, visibleOpeners: 1 };
  private targetChooserOpen = false;
  private visibleClearControls = 0;

  public constructor(private readonly timeline: ControlledTimeline) {}

  public async clickClear(): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.clear.click');
    this.submitted = false;
    this.editors = this.createEditors(0, false);
    this.route = { ...this.route, hasTextParameter: false };
    this.clearControlEnabled = false;
    this.visibleClearControls = 0;
    return true;
  }

  public async clickEssentialConsent(): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.consent.click');
    return false;
  }

  public async closeAutomaticSourceChooser(): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.source-chooser.close');
    this.automaticSource = { ...this.automaticSource, chooserOpen: false };
    return true;
  }

  public async enableAutomaticSourceDetection(): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.source-detection.enable');
    this.automaticSource = { ...this.automaticSource, checked: true };
    return true;
  }

  public async insertSourceText(sourceText: string): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.source.insert');
    this.submitted = true;
    this.editors = this.createEditors(sourceText.length, false);
    this.route = { ...this.route, hasTextParameter: true, sourceLanguage: 'en' };
    this.clearControlEnabled = true;
    this.visibleClearControls = 1;
    this.timeline.recordInsertion();
    return true;
  }

  public async navigate(): Promise<void> {
    this.timeline.browserEvaluation('yandex.navigate');
  }

  public async openAutomaticSourceChooser(): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.source-chooser.open');
    this.automaticSource = { ...this.automaticSource, chooserOpen: true };
    return true;
  }

  public async openTargetChooser(): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.target-chooser.open');
    this.targetChooserOpen = true;
    return true;
  }

  public async readAutomaticSourceSnapshot(): Promise<YandexAutomaticSourceSnapshot> {
    this.timeline.browserEvaluation('yandex.source-detection.read');
    return this.automaticSource;
  }

  public async readClearSnapshot(): Promise<YandexClearSnapshot> {
    this.timeline.browserEvaluation('yandex.clear.read');
    this.timeline.recordVisibleClearStart();
    if (this.editors.sourceTextLength === 0) this.timeline.recordVisibleClearCompletion();
    return {
      automaticSource: this.automaticSource,
      clearControlEnabled: this.clearControlEnabled,
      editors: this.editors,
      route: this.route,
      target: this.target,
      visibleClearControls: this.visibleClearControls,
    };
  }

  public async readConsentSnapshot(): Promise<{
    readonly visibleConsentSurfaces: number;
    readonly visibleEnabledEssentialControls: number;
    readonly visibleEssentialControls: number;
  }> {
    this.timeline.browserEvaluation('yandex.consent.read');
    return { visibleConsentSurfaces: 0, visibleEnabledEssentialControls: 0, visibleEssentialControls: 0 };
  }

  public async readEditorSnapshot(): Promise<YandexEditorSnapshot> {
    this.timeline.browserEvaluation('yandex.editor.read');
    if (this.submitted) this.timeline.recordCandidate();
    return this.submitted ? this.createEditors(this.editors.sourceTextLength ?? 0, true) : this.editors;
  }

  public async readReadinessSnapshot(): Promise<YandexReadinessSnapshot> {
    this.timeline.browserEvaluation('yandex.readiness.read');
    return { blockingSurfaces: 0, editors: this.editors, target: this.target };
  }

  public async readRouteSnapshot(): Promise<YandexRouteSnapshot> {
    this.timeline.browserEvaluation('yandex.route.read');
    return this.route;
  }

  public async readTargetSnapshot(): Promise<YandexTargetSnapshot> {
    this.timeline.browserEvaluation('yandex.target.read');
    this.timeline.recordTargetVerification();
    return this.target;
  }

  public async selectTargetLanguage(targetLanguage: string): Promise<boolean> {
    this.timeline.browserEvaluation('yandex.target.select');
    if (!this.targetChooserOpen) return false;
    this.targetChooserOpen = false;
    this.target = { selectedTargetCode: targetLanguage, visibleOpeners: 1 };
    this.route = { ...this.route, targetLanguage };
    return true;
  }

  private createEditors(sourceTextLength: number, destinationVisible: boolean): YandexEditorSnapshot {
    return {
      destinationEditors: 1,
      destinationResolution: 'primary',
      destinationText: destinationVisible ? GENERIC_RESULT_TEXT : '',
      destinationVisible,
      editableSourceEditors: 1,
      sourceEditors: 1,
      sourceResolution: 'primary',
      sourceTextLength,
      visibleDestinationPanels: destinationVisible ? 1 : 0,
      visibleForbiddenTextareas: 0,
    };
  }
}

function createGoogleHarness(): ScenarioHarness {
  const timeline = new ControlledTimeline();
  const adapter = new GooglePerformanceAdapter(timeline);
  const contexts: FakeContext[] = [];
  const provider = new GoogleTranslateProvider({
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    createContext: async (_options: LaunchContextOptions) => {
      timeline.contextCreated();
      const context = new FakeContext(timeline);
      contexts.push(context);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({ headless: true }),
    createPageAdapter: () => adapter,
    now: () => timeline.now(),
    resultPollIntervalMs: TRANSLATION_RESULT_POLL_INTERVAL_MS,
    resultStabilityDelayMs: TRANSLATION_RESULT_STABILITY_DELAY_MS,
    resultTimeoutMs: TRANSLATION_RESULT_TIMEOUT_MS,
    sleep: (delayMs) => timeline.sleep(delayMs),
    waitForClearPoll: (delayMs) => timeline.sleep(delayMs),
  });
  return { contexts, provider, timeline };
}

function createBingHarness(): ScenarioHarness {
  const timeline = new ControlledTimeline();
  const adapter = new BingPerformanceAdapter(timeline);
  const contexts: FakeContext[] = [];
  const provider = new BingTranslateProvider({
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    createContext: async (_options: LaunchContextOptions) => {
      timeline.contextCreated();
      const context = new FakeContext(timeline);
      contexts.push(context);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({ headless: true }),
    createPageAdapter: () => adapter,
    now: () => timeline.now(),
    resultPollIntervalMs: TRANSLATION_RESULT_POLL_INTERVAL_MS,
    resultStabilityDelayMs: TRANSLATION_RESULT_STABILITY_DELAY_MS,
    resultTimeoutMs: TRANSLATION_RESULT_TIMEOUT_MS,
    sleep: (delayMs) => timeline.sleep(delayMs),
    waitForCatalogStability: (delayMs) => timeline.sleep(delayMs),
    waitForClearPoll: (delayMs) => timeline.sleep(delayMs),
  });
  return { contexts, provider, timeline };
}

function createYandexHarness(): ScenarioHarness {
  const timeline = new ControlledTimeline();
  const adapter = new YandexPerformanceAdapter(timeline);
  const contexts: FakeContext[] = [];
  const provider = new YandexTranslateProvider({
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    createContext: async (_options: LaunchContextOptions) => {
      timeline.contextCreated();
      const context = new FakeContext(timeline);
      contexts.push(context);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({ headless: true }),
    createPageAdapter: () => adapter,
    now: () => timeline.now(),
    resultPollIntervalMs: TRANSLATION_RESULT_POLL_INTERVAL_MS,
    resultStabilityDelayMs: TRANSLATION_RESULT_STABILITY_DELAY_MS,
    resultTimeoutMs: TRANSLATION_RESULT_TIMEOUT_MS,
    sleep: (delayMs) => timeline.sleep(delayMs),
    waitForClearPoll: (delayMs) => timeline.sleep(delayMs),
  });
  return { contexts, provider, timeline };
}

function createRequest(
  providerId: TranslationProviderId,
  audit: RecordingTranslationProviderAudit,
): TranslationProviderRequest {
  return new TranslationProviderRequestFixture(
    {
      providerId,
      sourceText: GENERIC_SOURCE_TEXT,
      targetLanguage: TARGET_LANGUAGE,
    },
    audit,
  ).create();
}

async function measureTranslation(
  harness: ScenarioHarness,
  providerId: TranslationProviderId,
  path: BenchmarkPath,
): Promise<BaselineCell> {
  harness.timeline.beginMeasurement();
  const audit = new RecordingTranslationProviderAudit({ elapsedNow: () => harness.timeline.now() });
  const outcome = await harness.provider.translate(createRequest(providerId, audit));
  assert.equal(outcome.success, true, `${providerId} ${path} translation must succeed`);
  assert.equal(outcome.success ? outcome.text.length : 0, GENERIC_RESULT_TEXT.length);
  const operation = audit.operations[0];
  assert.ok(operation);
  return harness.timeline.createCell(providerId, path, operation.events);
}

async function captureProviderBaseline(scenario: ProviderScenario): Promise<readonly BaselineCell[]> {
  const coldHarness = scenario.createHarness();
  const cold = await measureTranslation(coldHarness, scenario.providerId, 'cold');
  assert.equal(cold.contextCreationCount, 1);
  assert.equal(coldHarness.contexts.length, 1);

  const warmHarness = scenario.createHarness();
  await measureTranslation(warmHarness, scenario.providerId, 'cold');
  assert.equal(warmHarness.contexts.length, 1);
  const warm = await measureTranslation(warmHarness, scenario.providerId, 'warm');
  assert.equal(warm.contextCreationCount, 0);
  assert.equal(warmHarness.contexts.length, 1);

  return [cold, warm];
}

async function captureBaseline(): Promise<readonly BaselineCell[]> {
  const scenarios: readonly ProviderScenario[] = [
    { createHarness: createGoogleHarness, providerId: 'google' },
    { createHarness: createBingHarness, providerId: 'bing' },
    { createHarness: createYandexHarness, providerId: 'yandex' },
  ];
  const cells: BaselineCell[] = [];
  for (const scenario of scenarios) cells.push(...(await captureProviderBaseline(scenario)));
  return cells;
}

function phaseDuration(
  events: readonly RecordedTranslationAuditEvent[],
  phase: RecordedTranslationAuditEvent['phase'],
): number {
  const entered = events.find((event) => event.event === 'phase-entered' && event.phase === phase);
  const completed = events.find((event) => event.event === 'phase-completed' && event.phase === phase);
  return Math.max(0, eventDuration(completed) - eventDuration(entered));
}

function eventDuration(event: RecordedTranslationAuditEvent | undefined): number {
  const metadata = event?.metadata;
  if (metadata === undefined || !('durationMs' in metadata) || typeof metadata.durationMs !== 'number') return 0;
  return metadata.durationMs;
}

const EXPECTED_BASELINES: readonly BaselineCell[] = [
  {
    browserEvaluationCount: 15,
    browserEvaluationSequence: [
      'google.navigate',
      'google.route.read',
      'google.route.read',
      'google.readiness.read',
      'google.route.read',
      'google.route.read',
      'google.result.read',
      'google.clear.read',
      'google.source.insert',
      'google.result.read',
      'google.result.read',
      'google.route.read',
      'google.clear.read',
      'google.clear.click',
      'google.clear.read',
    ],
    confirmationDurationMs: 505,
    contextCreationCount: 1,
    initializationNavigationDurationMs: 20,
    path: 'cold',
    providerId: 'google',
    queueDurationMs: 0,
    readinessDurationMs: 10,
    sleepDurationsMs: [500],
    submissionToFirstCandidateDurationMs: 5,
    targetVerificationDurationMs: 5,
    totalApplicationControlledDurationMs: 585,
    visibleClearDurationMs: 10,
  },
  {
    browserEvaluationCount: 14,
    browserEvaluationSequence: [
      'google.route.read',
      'google.route.read',
      'google.readiness.read',
      'google.route.read',
      'google.route.read',
      'google.result.read',
      'google.clear.read',
      'google.source.insert',
      'google.result.read',
      'google.result.read',
      'google.route.read',
      'google.clear.read',
      'google.clear.click',
      'google.clear.read',
    ],
    confirmationDurationMs: 505,
    contextCreationCount: 0,
    initializationNavigationDurationMs: 5,
    path: 'warm',
    providerId: 'google',
    queueDurationMs: 0,
    readinessDurationMs: 10,
    sleepDurationsMs: [500],
    submissionToFirstCandidateDurationMs: 5,
    targetVerificationDurationMs: 5,
    totalApplicationControlledDurationMs: 570,
    visibleClearDurationMs: 10,
  },
  {
    browserEvaluationCount: 27,
    browserEvaluationSequence: [
      'bing.navigate',
      'bing.route.read',
      'bing.controls.read',
      'bing.route.read',
      'bing.controls.read',
      'bing.catalog.read',
      'bing.route.read',
      'bing.controls.read',
      'bing.catalog.read',
      'bing.selection.read',
      'bing.selection.read',
      'bing.route.read',
      'bing.controls.read',
      'bing.result.read',
      'bing.clear.read',
      'bing.source.fill',
      'bing.route.read',
      'bing.controls.read',
      'bing.result.read',
      'bing.route.read',
      'bing.controls.read',
      'bing.result.read',
      'bing.route.read',
      'bing.selection.read',
      'bing.clear.read',
      'bing.clear.click',
      'bing.clear.read',
    ],
    confirmationDurationMs: 515,
    contextCreationCount: 1,
    initializationNavigationDurationMs: 25,
    path: 'cold',
    providerId: 'bing',
    queueDurationMs: 0,
    readinessDurationMs: 280,
    sleepDurationsMs: [250, 500],
    submissionToFirstCandidateDurationMs: 15,
    targetVerificationDurationMs: 10,
    totalApplicationControlledDurationMs: 895,
    visibleClearDurationMs: 10,
  },
  {
    browserEvaluationCount: 21,
    browserEvaluationSequence: [
      'bing.route.read',
      'bing.controls.read',
      'bing.controls.read',
      'bing.selection.read',
      'bing.selection.read',
      'bing.route.read',
      'bing.controls.read',
      'bing.result.read',
      'bing.clear.read',
      'bing.source.fill',
      'bing.route.read',
      'bing.controls.read',
      'bing.result.read',
      'bing.route.read',
      'bing.controls.read',
      'bing.result.read',
      'bing.route.read',
      'bing.selection.read',
      'bing.clear.read',
      'bing.clear.click',
      'bing.clear.read',
    ],
    confirmationDurationMs: 515,
    contextCreationCount: 0,
    initializationNavigationDurationMs: 10,
    path: 'warm',
    providerId: 'bing',
    queueDurationMs: 0,
    readinessDurationMs: 5,
    sleepDurationsMs: [500],
    submissionToFirstCandidateDurationMs: 15,
    targetVerificationDurationMs: 10,
    totalApplicationControlledDurationMs: 605,
    visibleClearDurationMs: 10,
  },
  {
    browserEvaluationCount: 28,
    browserEvaluationSequence: [
      'yandex.navigate',
      'yandex.route.read',
      'yandex.consent.read',
      'yandex.route.read',
      'yandex.readiness.read',
      'yandex.source-chooser.open',
      'yandex.source-detection.read',
      'yandex.source-detection.read',
      'yandex.source-chooser.close',
      'yandex.target.read',
      'yandex.route.read',
      'yandex.target-chooser.open',
      'yandex.target.select',
      'yandex.route.read',
      'yandex.target.read',
      'yandex.route.read',
      'yandex.editor.read',
      'yandex.clear.read',
      'yandex.source.insert',
      'yandex.route.read',
      'yandex.editor.read',
      'yandex.route.read',
      'yandex.editor.read',
      'yandex.route.read',
      'yandex.target.read',
      'yandex.clear.read',
      'yandex.clear.click',
      'yandex.clear.read',
    ],
    confirmationDurationMs: 510,
    contextCreationCount: 1,
    initializationNavigationDurationMs: 25,
    path: 'cold',
    providerId: 'yandex',
    queueDurationMs: 0,
    readinessDurationMs: 10,
    sleepDurationsMs: [500],
    submissionToFirstCandidateDurationMs: 10,
    targetVerificationDurationMs: 10,
    totalApplicationControlledDurationMs: 650,
    visibleClearDurationMs: 10,
  },
  {
    browserEvaluationCount: 19,
    browserEvaluationSequence: [
      'yandex.route.read',
      'yandex.consent.read',
      'yandex.route.read',
      'yandex.readiness.read',
      'yandex.target.read',
      'yandex.route.read',
      'yandex.route.read',
      'yandex.editor.read',
      'yandex.clear.read',
      'yandex.source.insert',
      'yandex.route.read',
      'yandex.editor.read',
      'yandex.route.read',
      'yandex.editor.read',
      'yandex.route.read',
      'yandex.target.read',
      'yandex.clear.read',
      'yandex.clear.click',
      'yandex.clear.read',
    ],
    confirmationDurationMs: 510,
    contextCreationCount: 0,
    initializationNavigationDurationMs: 10,
    path: 'warm',
    providerId: 'yandex',
    queueDurationMs: 0,
    readinessDurationMs: 10,
    sleepDurationsMs: [500],
    submissionToFirstCandidateDurationMs: 10,
    targetVerificationDurationMs: 10,
    totalApplicationControlledDurationMs: 595,
    visibleClearDurationMs: 10,
  },
];

function assertBaseline(cells: readonly BaselineCell[]): void {
  assert.deepEqual(cells, EXPECTED_BASELINES);
}

describe('translation provider controlled performance baseline', () => {
  it('records the current six controlled cold and warm provider cells', async () => {
    const cells = await captureBaseline();
    assert.equal(cells.length, 6);
    assertBaseline(cells);
  });

  it('fails when a recorded browser evaluation is added, omitted, or reordered', async () => {
    const cells = await captureBaseline();
    const first = cells[0];
    assert.ok(first);
    const added = { ...first, browserEvaluationCount: first.browserEvaluationCount + 1 };
    const omitted = { ...first, browserEvaluationSequence: first.browserEvaluationSequence.slice(1) };
    const reordered = {
      ...first,
      browserEvaluationSequence: [...first.browserEvaluationSequence].reverse(),
    };
    assert.throws(() => assertBaseline([added, ...cells.slice(1)]));
    assert.throws(() => assertBaseline([omitted, ...cells.slice(1)]));
    assert.throws(() => assertBaseline([reordered, ...cells.slice(1)]));
  });

  it('keeps published baseline evidence limited to generic safe metadata', async () => {
    const evidence = await readFile(
      resolve(
        process.cwd(),
        'docs/specs/translation-provider-reliability-remediation/tasks/evidence/performance-baseline.md',
      ),
      'utf8',
    );

    assert.match(evidence, /Fixture version: `v1`/u);
    assert.match(evidence, /\|\s+Google\s+\|\s+Cold\s+\|/u);
    assert.match(evidence, /\|\s+Yandex\s+\|\s+Warm\s+\|/u);
    assert.equal(evidence.includes(GENERIC_SOURCE_TEXT), false);
    assert.equal(evidence.includes(GENERIC_RESULT_TEXT), false);
    assert.doesNotMatch(evidence, /https?:\/\//u);
  });
});
