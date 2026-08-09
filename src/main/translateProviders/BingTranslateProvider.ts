/* eslint-disable max-classes-per-file -- the private Playwright adapter is colocated with its provider contract. */
import type { Locator, Page } from 'playwright-core';

import {
  BrowserNavigationService,
  retryBrowserNavigation,
  type BrowserNavigationRetryEvent,
} from '@main/browserNavigationRetry';
import {
  BaseTranslateProvider,
  type BaseTranslateProviderDependencies,
} from '@main/translateProviders/BaseTranslateProvider';
import {
  translationHookFailure,
  translationHookSuccess,
  type TranslationProviderHookResult,
  type TranslationProviderResultObservation,
} from '@main/translateProviders/translationProviderContracts';
import { normalizeTranslationResultText } from '@main/translateProviders/translationResultText';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';

const BING_TRANSLATE_URL = 'https://www.bing.com/translator';
const BING_NAVIGATION_TIMEOUT_MS = 60_000;
export const BING_READINESS_TIMEOUT_MS = 5_000;
export const BING_CATALOG_STABILITY_DELAY_MS = 250;
const BING_CLEAR_TIMEOUT_MS = 1_500;
const BING_CLEAR_POLL_INTERVAL_MS = 50;

const BING_SOURCE_SELECT_SELECTOR = 'select#tta_srcsl[aria-label="Input Language Selection Dropdown"]';
const BING_TARGET_SELECT_SELECTOR = 'select#tta_tgtsl[aria-label="Output Language Selection Dropdown"]';
const BING_SOURCE_SELECTOR = 'div#tta_input_ta[role="textbox"][aria-label="Input text area"][contenteditable="true"]';
const BING_RESULT_SELECTOR = 'div#tta_output_ta[data-placeholder="Translation"]';
const BING_CANONICAL_GROUP_SELECTOR = ':scope > optgroup#t_tgtAllLang';
const BING_CANONICAL_OPTION_SELECTOR = ':scope > option';
const BING_CLEAR_SELECTOR = '#tta_clear[role="button"][aria-label="Click to Clear"]';
const BING_CLEAR_WRAPPER_SELECTOR = '#tta_clear_cnt';
export const BING_BLOCKING_SURFACE_SELECTOR =
  '[role="dialog"]:not(.infobubble), iframe[title*="challenge" i], iframe[title*="captcha" i]';
const BING_AUTOMATIC_SOURCE_VALUE = 'auto-detect';

export type BingRouteKind = 'loginOrChallenge' | 'translator' | 'unexpected';

export interface BingRouteSnapshot {
  readonly route: BingRouteKind;
}

export interface BingControlCountSnapshot {
  readonly visible: number;
  readonly visibleEnabled: number;
}

export interface BingPublicControlsSnapshot {
  readonly blockingSurfaces: number;
  readonly output: BingControlCountSnapshot;
  readonly sourceEditor: BingControlCountSnapshot;
  readonly sourceSelect: BingControlCountSnapshot;
  readonly sourceTextLength: number | null;
  readonly targetSelect: BingControlCountSnapshot;
}

export interface BingCanonicalOptionSnapshot {
  readonly enabled: boolean;
  readonly label: string;
  readonly value: string;
}

export interface BingCanonicalCatalogSnapshot {
  readonly canonicalGroups: number;
  readonly options: readonly BingCanonicalOptionSnapshot[];
}

export interface BingSelectionSnapshot {
  readonly outputLanguage: string | null;
  readonly sourceLanguage: string | null;
  readonly targetLanguage: string | null;
}

export interface BingResultSnapshot {
  readonly outputLanguage: string | null;
  readonly text: string;
  readonly visibleEnabledOutputControls: number;
  readonly visibleOutputControls: number;
}

export interface BingClearSnapshot {
  readonly clearControlEnabled: boolean;
  readonly clearWrapperVisible: boolean;
  readonly controls: BingPublicControlsSnapshot;
  readonly result: BingResultSnapshot;
  readonly selection: BingSelectionSnapshot;
  readonly sourceFocused: boolean;
  readonly visibleClearControls: number;
  readonly visibleClearWrappers: number;
}

export interface BingResultObservationSnapshot {
  readonly controls: BingPublicControlsSnapshot;
  readonly result: BingResultSnapshot;
  readonly route: BingRouteSnapshot;
  readonly selection: BingSelectionSnapshot;
}

export interface BingTranslatePageAdapter {
  clickClear(): Promise<boolean>;
  fillSourceText(sourceText: string): Promise<boolean>;
  navigate(): Promise<void>;
  readCanonicalCatalogSnapshot(): Promise<BingCanonicalCatalogSnapshot>;
  readClearSnapshot(): Promise<BingClearSnapshot>;
  readPublicControlsSnapshot(): Promise<BingPublicControlsSnapshot>;
  readResultObservationSnapshot?(): Promise<BingResultObservationSnapshot>;
  readResultSnapshot(): Promise<BingResultSnapshot>;
  readRouteSnapshot(): Promise<BingRouteSnapshot>;
  readSelectionSnapshot(): Promise<BingSelectionSnapshot>;
  selectSourceLanguage(value: string): Promise<boolean>;
  selectTargetLanguage(value: string): Promise<boolean>;
}

export type BingTranslatePageAdapterFactory = (page: Page) => BingTranslatePageAdapter;

export interface BingTranslateProviderDependencies extends BaseTranslateProviderDependencies {
  readonly catalogStabilityDelayMs?: number;
  readonly clearPollIntervalMs?: number;
  readonly clearTimeoutMs?: number;
  readonly createPageAdapter: BingTranslatePageAdapterFactory;
  readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;
  readonly readinessTimeoutMs?: number;
  readonly waitForCatalogStability?: (delayMs: number) => Promise<void>;
  readonly waitForClearPoll?: (delayMs: number) => Promise<void>;
}

interface VisibleLocatorSnapshot {
  readonly editable: boolean;
  readonly enabled: boolean;
  readonly locator: Locator;
}

function createControlCountSnapshot(controls: readonly VisibleLocatorSnapshot[]): BingControlCountSnapshot {
  return {
    visible: controls.length,
    visibleEnabled: controls.filter((control) => control.enabled).length,
  };
}

async function getVisibleLocators(locator: Locator): Promise<VisibleLocatorSnapshot[]> {
  const visible: VisibleLocatorSnapshot[] = [];
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible())) continue;
    visible.push({
      editable: await candidate.isEditable().catch(() => false),
      enabled: await candidate.isEnabled().catch(() => false),
      locator: candidate,
    });
  }
  return visible;
}

function isSingleEnabledControl(snapshot: BingControlCountSnapshot): boolean {
  return snapshot.visible === 1 && snapshot.visibleEnabled === 1;
}

export function createBingRouteSnapshot(rawUrl: string): BingRouteSnapshot {
  try {
    const url = new URL(rawUrl);
    const normalizedPath = url.pathname.toLowerCase();
    if (
      normalizedPath.includes('challenge') ||
      normalizedPath.includes('login') ||
      normalizedPath.includes('signin') ||
      normalizedPath.includes('sorry')
    ) {
      return { route: 'loginOrChallenge' };
    }
    if (
      url.origin === 'https://www.bing.com' &&
      (url.pathname === '/translator' || url.pathname === '/translator/') &&
      url.search.length === 0 &&
      url.hash.length === 0
    ) {
      return { route: 'translator' };
    }
  } catch {
    return { route: 'unexpected' };
  }
  return { route: 'unexpected' };
}

export function classifyBingPublicControls(snapshot: BingPublicControlsSnapshot): TranslationProviderHookResult {
  if (snapshot.blockingSurfaces > 0) {
    return translationHookFailure('consentOrChallenge');
  }
  if (
    !isSingleEnabledControl(snapshot.sourceSelect) ||
    !isSingleEnabledControl(snapshot.targetSelect) ||
    !isSingleEnabledControl(snapshot.sourceEditor) ||
    !isSingleEnabledControl(snapshot.output)
  ) {
    return translationHookFailure('pageContractFailure');
  }
  return translationHookSuccess();
}

function compareCatalogOptions(
  left: Pick<BingCanonicalOptionSnapshot, 'label' | 'value'>,
  right: Pick<BingCanonicalOptionSnapshot, 'label' | 'value'>,
): number {
  if (left.value < right.value) return -1;
  if (left.value > right.value) return 1;
  if (left.label < right.label) return -1;
  if (left.label > right.label) return 1;
  return 0;
}

export function classifyBingCanonicalCatalog(
  snapshot: BingCanonicalCatalogSnapshot,
): TranslationProviderHookResult<string> {
  if (snapshot.canonicalGroups !== 1 || snapshot.options.length === 0) {
    return translationHookFailure('pageContractFailure');
  }

  const normalized = snapshot.options.map((option) => ({
    enabled: option.enabled,
    label: option.label.trim(),
    value: option.value,
  }));
  const seenValues = new Set<string>();
  for (const option of normalized) {
    if (
      !option.enabled ||
      option.value.trim().length === 0 ||
      option.label.length === 0 ||
      seenValues.has(option.value)
    ) {
      return translationHookFailure('pageContractFailure');
    }
    seenValues.add(option.value);
  }

  return translationHookSuccess(
    JSON.stringify(normalized.map(({ label, value }) => ({ label, value })).sort(compareCatalogOptions)),
  );
}

export function classifyBingResultSnapshot(snapshot: BingResultSnapshot): TranslationProviderHookResult<string> {
  if (snapshot.visibleOutputControls !== 1 || snapshot.visibleEnabledOutputControls !== 1) {
    return translationHookFailure('pageContractFailure');
  }
  const normalizedText = normalizeTranslationResultText(snapshot.text);
  const statusText = normalizedText.trim();
  return translationHookSuccess(statusText === '...' || statusText === '…' ? '' : normalizedText);
}

/** Restricts Playwright access to the researched public Bing controls. */
class PlaywrightBingTranslatePageAdapter implements BingTranslatePageAdapter {
  constructor(private readonly page: Page) {}

  async navigate(): Promise<void> {
    await this.page.goto(BING_TRANSLATE_URL, {
      timeout: BING_NAVIGATION_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
  }

  readRouteSnapshot(): Promise<BingRouteSnapshot> {
    return Promise.resolve(createBingRouteSnapshot(this.page.url()));
  }

  async readPublicControlsSnapshot(): Promise<BingPublicControlsSnapshot> {
    const [sourceSelect, targetSelect, sourceEditors, outputs, blockingSurfaces] = await Promise.all([
      getVisibleLocators(this.page.locator(BING_SOURCE_SELECT_SELECTOR)),
      getVisibleLocators(this.page.locator(BING_TARGET_SELECT_SELECTOR)),
      getVisibleLocators(this.page.locator(BING_SOURCE_SELECTOR)),
      getVisibleLocators(this.page.locator(BING_RESULT_SELECTOR)),
      getVisibleLocators(this.page.locator(BING_BLOCKING_SURFACE_SELECTOR)),
    ]);
    const sourceText =
      sourceEditors.length === 1 ? await sourceEditors[0]?.locator.textContent().catch(() => null) : null;
    return {
      blockingSurfaces: blockingSurfaces.length,
      output: createControlCountSnapshot(outputs),
      sourceEditor: {
        visible: sourceEditors.length,
        visibleEnabled: sourceEditors.filter((control) => control.enabled && control.editable).length,
      },
      sourceSelect: createControlCountSnapshot(sourceSelect),
      sourceTextLength: sourceText?.length ?? null,
      targetSelect: createControlCountSnapshot(targetSelect),
    };
  }

  async readCanonicalCatalogSnapshot(): Promise<BingCanonicalCatalogSnapshot> {
    const targetSelects = await getVisibleLocators(this.page.locator(BING_TARGET_SELECT_SELECTOR));
    if (targetSelects.length !== 1 || !targetSelects[0]) {
      return { canonicalGroups: 0, options: [] };
    }
    const groups = targetSelects[0].locator.locator(BING_CANONICAL_GROUP_SELECTOR);
    const options = groups.locator(BING_CANONICAL_OPTION_SELECTOR);
    const [canonicalGroups, optionSnapshots] = await Promise.all([
      groups.count(),
      options.evaluateAll((elements) =>
        elements.map((element) => {
          const option = element as HTMLOptionElement;
          const parentGroup = option.parentElement as HTMLOptGroupElement | null;
          return {
            enabled: !option.disabled && parentGroup?.disabled !== true,
            label: option.textContent ?? '',
            value: option.value,
          };
        }),
      ),
    ]);
    return {
      canonicalGroups,
      options: optionSnapshots,
    };
  }

  async readSelectionSnapshot(): Promise<BingSelectionSnapshot> {
    const [sourceSelect, targetSelect, outputs] = await Promise.all([
      getVisibleLocators(this.page.locator(BING_SOURCE_SELECT_SELECTOR)),
      getVisibleLocators(this.page.locator(BING_TARGET_SELECT_SELECTOR)),
      getVisibleLocators(this.page.locator(BING_RESULT_SELECTOR)),
    ]);
    return {
      outputLanguage: outputs.length === 1 ? await outputs[0]?.locator.getAttribute('lang').catch(() => null) : null,
      sourceLanguage: sourceSelect.length === 1 ? await sourceSelect[0]?.locator.inputValue().catch(() => null) : null,
      targetLanguage: targetSelect.length === 1 ? await targetSelect[0]?.locator.inputValue().catch(() => null) : null,
    };
  }

  async selectSourceLanguage(value: string): Promise<boolean> {
    return this.selectExactValue(BING_SOURCE_SELECT_SELECTOR, value);
  }

  async selectTargetLanguage(value: string): Promise<boolean> {
    return this.selectExactValue(BING_TARGET_SELECT_SELECTOR, value);
  }

  async fillSourceText(sourceText: string): Promise<boolean> {
    const sourceEditors = await getVisibleLocators(this.page.locator(BING_SOURCE_SELECTOR));
    if (sourceEditors.length !== 1 || !sourceEditors[0]?.enabled || !sourceEditors[0].editable) return false;
    return sourceEditors[0].locator.evaluate((element, value) => {
      const editor = element as HTMLElement;
      const beforeInputAccepted = editor.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          data: value,
          inputType: 'insertText',
        }),
      );
      if (!beforeInputAccepted) return false;
      editor.textContent = value;
      editor.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: value,
          inputType: 'insertText',
        }),
      );
      return editor.textContent === value;
    }, sourceText);
  }

  async readResultSnapshot(): Promise<BingResultSnapshot> {
    const outputs = await getVisibleLocators(this.page.locator(BING_RESULT_SELECTOR));
    if (outputs.length !== 1 || !outputs[0]) {
      return {
        outputLanguage: null,
        text: '',
        visibleEnabledOutputControls: outputs.filter((control) => control.enabled).length,
        visibleOutputControls: outputs.length,
      };
    }
    return {
      outputLanguage: await outputs[0].locator.getAttribute('lang'),
      text: await outputs[0].locator.innerText(),
      visibleEnabledOutputControls: outputs[0].enabled ? 1 : 0,
      visibleOutputControls: 1,
    };
  }

  async readResultObservationSnapshot(): Promise<BingResultObservationSnapshot> {
    const snapshot = await this.page.evaluate(
      ({ blockingSelector, outputSelector, sourceSelector, sourceSelectSelector, targetSelectSelector }) => {
        const isVisible = (element: Element): boolean => {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        };
        const visible = (selector: string): HTMLElement[] =>
          Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
        const count = (elements: readonly HTMLElement[], requireEditable = false) => ({
          visible: elements.length,
          visibleEnabled: elements.filter(
            (element) => !element.matches(':disabled') && (!requireEditable || element.isContentEditable),
          ).length,
        });
        const sourceSelects = visible(sourceSelectSelector) as HTMLSelectElement[];
        const targetSelects = visible(targetSelectSelector) as HTMLSelectElement[];
        const sourceEditors = visible(sourceSelector);
        const outputs = visible(outputSelector);
        const output = outputs.length === 1 ? outputs[0] : null;
        return {
          controls: {
            blockingSurfaces: visible(blockingSelector).length,
            output: count(outputs),
            sourceEditor: count(sourceEditors, true),
            sourceSelect: count(sourceSelects),
            sourceTextLength: sourceEditors.length === 1 ? (sourceEditors[0]?.innerText.length ?? null) : null,
            targetSelect: count(targetSelects),
          },
          rawUrl: window.location.href,
          result: {
            outputLanguage: output?.getAttribute('lang') ?? null,
            text: output?.innerText ?? '',
            visibleEnabledOutputControls: count(outputs).visibleEnabled,
            visibleOutputControls: outputs.length,
          },
          selection: {
            outputLanguage: output?.getAttribute('lang') ?? null,
            sourceLanguage: sourceSelects.length === 1 ? (sourceSelects[0]?.value ?? null) : null,
            targetLanguage: targetSelects.length === 1 ? (targetSelects[0]?.value ?? null) : null,
          },
        };
      },
      {
        blockingSelector: BING_BLOCKING_SURFACE_SELECTOR,
        outputSelector: BING_RESULT_SELECTOR,
        sourceSelector: BING_SOURCE_SELECTOR,
        sourceSelectSelector: BING_SOURCE_SELECT_SELECTOR,
        targetSelectSelector: BING_TARGET_SELECT_SELECTOR,
      },
    );
    return {
      controls: snapshot.controls,
      result: snapshot.result,
      route: createBingRouteSnapshot(snapshot.rawUrl),
      selection: snapshot.selection,
    };
  }

  async readClearSnapshot(): Promise<BingClearSnapshot> {
    const clearControls = await getVisibleLocators(this.page.locator(BING_CLEAR_SELECTOR));
    const clearWrappers = this.page.locator(BING_CLEAR_WRAPPER_SELECTOR);
    const visibleClearWrappers = await getVisibleLocators(clearWrappers);
    const sourceEditors = await getVisibleLocators(this.page.locator(BING_SOURCE_SELECTOR));
    const sourceFocused =
      sourceEditors.length === 1
        ? await sourceEditors[0]?.locator.evaluate((element) => document.activeElement === element)
        : false;
    return {
      clearControlEnabled: clearControls.length === 1 && clearControls[0]?.enabled === true,
      clearWrapperVisible: visibleClearWrappers.length === 1,
      controls: await this.readPublicControlsSnapshot(),
      result: await this.readResultSnapshot(),
      selection: await this.readSelectionSnapshot(),
      sourceFocused: sourceFocused === true,
      visibleClearControls: clearControls.length,
      visibleClearWrappers: await clearWrappers.count(),
    };
  }

  async clickClear(): Promise<boolean> {
    const clearControls = await getVisibleLocators(this.page.locator(BING_CLEAR_SELECTOR));
    if (clearControls.length !== 1 || !clearControls[0]?.enabled) return false;
    return clearControls[0].locator.evaluate((element) => {
      (element as HTMLElement).click();
      return true;
    });
  }

  private async selectExactValue(selector: string, value: string): Promise<boolean> {
    const controls = await getVisibleLocators(this.page.locator(selector));
    if (controls.length !== 1 || !controls[0]?.enabled) return false;
    return controls[0].locator.evaluate((element, exactValue) => {
      const select = element as HTMLSelectElement;
      const option = Array.from(select.options).find(
        (candidate) =>
          candidate.value === exactValue &&
          !candidate.disabled &&
          !(candidate.parentElement instanceof HTMLOptGroupElement && candidate.parentElement.disabled),
      );
      if (!option) return false;
      select.value = exactValue;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value === exactValue;
    }, value);
  }
}

export function createPlaywrightBingTranslatePageAdapter(page: Page): BingTranslatePageAdapter {
  return new PlaywrightBingTranslatePageAdapter(page);
}

/** Unregistered Bing public-page implementation of the shared translation lifecycle. */
export class BingTranslateProvider extends BaseTranslateProvider {
  private readonly adapters = new WeakMap<Page, BingTranslatePageAdapter>();
  private readonly catalogStabilityDelayMs: number;
  private readonly clearPollIntervalMs: number;
  private readonly clearTimeoutMs: number;
  private readonly createPageAdapter: BingTranslatePageAdapterFactory;
  private readonly expectedTargets = new WeakMap<Page, string>();
  private readonly preparedPages = new WeakSet<Page>();
  private readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;
  private readonly readinessTimeoutMs: number;
  private readonly validatedCatalogTargets = new WeakMap<Page, ReadonlySet<string>>();
  private readonly waitForCatalogStability: (delayMs: number) => Promise<void>;
  private readonly waitForClearPoll: (delayMs: number) => Promise<void>;

  constructor(dependencies: BingTranslateProviderDependencies) {
    super(TRANSLATION_PROVIDER_INFO.bing, dependencies);
    this.catalogStabilityDelayMs = dependencies.catalogStabilityDelayMs ?? BING_CATALOG_STABILITY_DELAY_MS;
    this.clearPollIntervalMs = dependencies.clearPollIntervalMs ?? BING_CLEAR_POLL_INTERVAL_MS;
    this.clearTimeoutMs = dependencies.clearTimeoutMs ?? BING_CLEAR_TIMEOUT_MS;
    this.createPageAdapter = dependencies.createPageAdapter;
    this.onNavigationRetry = dependencies.onNavigationRetry;
    this.readinessTimeoutMs = dependencies.readinessTimeoutMs ?? BING_READINESS_TIMEOUT_MS;
    this.waitForCatalogStability = dependencies.waitForCatalogStability ?? dependencies.sleep;
    this.waitForClearPoll = dependencies.waitForClearPoll ?? dependencies.sleep;
  }

  protected async navigateAndHandleConsent(
    page: Page,
    _targetLanguage: string,
  ): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    if (this.preparedPages.has(page)) {
      const route = await adapter.readRouteSnapshot();
      if (route.route !== 'translator') {
        return translationHookFailure('consentOrChallenge');
      }
      const controls = await adapter.readPublicControlsSnapshot();
      return controls.blockingSurfaces === 0 ? translationHookSuccess() : translationHookFailure('consentOrChallenge');
    }

    this.validatedCatalogTargets.delete(page);
    await retryBrowserNavigation(
      {
        navigate: () => adapter.navigate(),
        service: BrowserNavigationService.BingTranslate,
      },
      { onRetry: this.onNavigationRetry },
    );

    const route = await adapter.readRouteSnapshot();
    if (route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    const controls = await adapter.readPublicControlsSnapshot();
    if (controls.blockingSurfaces > 0) {
      return translationHookFailure('consentOrChallenge');
    }
    this.preparedPages.add(page);
    return translationHookSuccess();
  }

  protected async inspectReadiness(page: Page): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    if (this.validatedCatalogTargets.has(page)) {
      const controlsSnapshot = await adapter.readPublicControlsSnapshot();
      const controls = classifyBingPublicControls(controlsSnapshot);
      if (!controls.success && controls.code === 'consentOrChallenge') return controls;
      return controls.success && controlsSnapshot.sourceTextLength === 0
        ? translationHookSuccess()
        : translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }

    const stabilityDelayMs = Math.max(1, this.catalogStabilityDelayMs);
    const maximumReads = Math.max(2, Math.floor(this.readinessTimeoutMs / stabilityDelayMs) + 1);
    let previousSignature: string | null = null;

    for (let read = 0; read < maximumReads; read += 1) {
      const route = await adapter.readRouteSnapshot();
      if (route.route !== 'translator') {
        return translationHookFailure('consentOrChallenge');
      }

      const controlsSnapshot = await adapter.readPublicControlsSnapshot();
      const controls = classifyBingPublicControls(controlsSnapshot);
      if (!controls.success && controls.code === 'consentOrChallenge') return controls;
      const catalogSnapshot = await adapter.readCanonicalCatalogSnapshot();
      const catalog = classifyBingCanonicalCatalog(catalogSnapshot);
      if (controls.success && controlsSnapshot.sourceTextLength === 0 && catalog.success) {
        if (previousSignature === catalog.value) {
          this.validatedCatalogTargets.set(
            page,
            new Set(catalogSnapshot.options.filter((option) => option.enabled).map((option) => option.value)),
          );
          return translationHookSuccess();
        }
        previousSignature = catalog.value;
      } else {
        previousSignature = null;
      }

      if (read + 1 < maximumReads) {
        await this.waitForCatalogStability(this.catalogStabilityDelayMs);
      }
    }

    return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
  }

  protected async enableAutomaticSourceDetection(page: Page): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    const currentSelection = await adapter.readSelectionSnapshot();
    if (currentSelection.sourceLanguage === BING_AUTOMATIC_SOURCE_VALUE) {
      return translationHookSuccess();
    }
    if (!(await adapter.selectSourceLanguage(BING_AUTOMATIC_SOURCE_VALUE))) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    const selection = await adapter.readSelectionSnapshot();
    return selection.sourceLanguage === BING_AUTOMATIC_SOURCE_VALUE
      ? translationHookSuccess()
      : translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
  }

  protected async selectAndVerifyTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    const validatedTargets = this.validatedCatalogTargets.get(page);
    if (!validatedTargets?.has(targetLanguage)) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    const currentSelection = await adapter.readSelectionSnapshot();
    if (this.selectionMatches(currentSelection, targetLanguage)) {
      this.expectedTargets.set(page, targetLanguage);
      return translationHookSuccess();
    }
    if (!(await adapter.selectTargetLanguage(targetLanguage))) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    const selection = await adapter.readSelectionSnapshot();
    if (!this.selectionMatches(selection, targetLanguage)) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    this.expectedTargets.set(page, targetLanguage);
    return translationHookSuccess();
  }

  protected async clearStaleState(page: Page): Promise<TranslationProviderHookResult<string>> {
    const previousResult = await this.readNormalizedResult(page);
    if (!previousResult.success) {
      return translationHookFailure(previousResult.code, { recoverableBeforeSubmission: true });
    }
    const clear = await this.clearAndConfirm(page);
    if (!clear.success) {
      return translationHookFailure(clear.code, { recoverableBeforeSubmission: true });
    }
    return translationHookSuccess(previousResult.value);
  }

  protected async insertSourceText(page: Page, sourceText: string): Promise<TranslationProviderHookResult> {
    return (await this.getAdapter(page).fillSourceText(sourceText))
      ? translationHookSuccess()
      : translationHookFailure('pageContractFailure');
  }

  protected async readNormalizedResult(page: Page): Promise<TranslationProviderHookResult<string>> {
    const adapter = this.getAdapter(page);
    const route = await adapter.readRouteSnapshot();
    if (route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    const controlsSnapshot = await adapter.readPublicControlsSnapshot();
    const controls = classifyBingPublicControls(controlsSnapshot);
    if (!controls.success) return controls;
    return classifyBingResultSnapshot(await adapter.readResultSnapshot());
  }

  protected override async observeResult(
    page: Page,
    targetLanguage: string,
  ): Promise<TranslationProviderHookResult<TranslationProviderResultObservation>> {
    const adapter = this.getAdapter(page);
    if (!adapter.readResultObservationSnapshot) return super.observeResult(page, targetLanguage);
    const snapshot = await adapter.readResultObservationSnapshot();
    if (snapshot.route.route !== 'translator') return translationHookFailure('consentOrChallenge');
    const controls = classifyBingPublicControls(snapshot.controls);
    if (!controls.success) return controls;
    const result = classifyBingResultSnapshot(snapshot.result);
    if (!result.success) return result;
    if (!this.selectionMatches(snapshot.selection, targetLanguage)) {
      return translationHookFailure('pageContractFailure');
    }
    return translationHookSuccess({
      completion: 'unavailable',
      targetVerified: true,
      text: result.value,
    });
  }

  protected async verifySelectedTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const route = await this.getAdapter(page).readRouteSnapshot();
    if (route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    return this.selectionMatches(await this.getAdapter(page).readSelectionSnapshot(), targetLanguage)
      ? translationHookSuccess()
      : translationHookFailure('pageContractFailure');
  }

  protected async clearVisibleState(page: Page): Promise<TranslationProviderHookResult> {
    const clear = await this.clearAndConfirm(page);
    return clear.success ? clear : translationHookFailure('cleanupFailure');
  }

  private getAdapter(page: Page): BingTranslatePageAdapter {
    const current = this.adapters.get(page);
    if (current) return current;
    const adapter = this.createPageAdapter(page);
    this.adapters.set(page, adapter);
    return adapter;
  }

  private selectionMatches(selection: BingSelectionSnapshot, targetLanguage: string): boolean {
    return (
      selection.sourceLanguage === BING_AUTOMATIC_SOURCE_VALUE &&
      selection.targetLanguage === targetLanguage &&
      selection.outputLanguage === targetLanguage
    );
  }

  private isCleared(snapshot: BingClearSnapshot, targetLanguage: string, requireFocus: boolean): boolean {
    const controls = classifyBingPublicControls(snapshot.controls);
    const result = classifyBingResultSnapshot(snapshot.result);
    return (
      controls.success &&
      result.success &&
      snapshot.controls.sourceTextLength === 0 &&
      result.value.trim().length === 0 &&
      this.selectionMatches(snapshot.selection, targetLanguage) &&
      snapshot.visibleClearControls === 0 &&
      snapshot.visibleClearWrappers === 1 &&
      !snapshot.clearWrapperVisible &&
      (!requireFocus || snapshot.sourceFocused)
    );
  }

  private async clearAndConfirm(page: Page): Promise<TranslationProviderHookResult> {
    const targetLanguage = this.expectedTargets.get(page);
    if (!targetLanguage) return translationHookFailure('pageContractFailure');

    const initial = await this.getAdapter(page).readClearSnapshot();
    if (this.isCleared(initial, targetLanguage, false)) return translationHookSuccess();
    const controls = classifyBingPublicControls(initial.controls);
    const result = classifyBingResultSnapshot(initial.result);
    if (
      !controls.success ||
      !result.success ||
      !this.selectionMatches(initial.selection, targetLanguage) ||
      initial.visibleClearControls !== 1 ||
      !initial.clearControlEnabled ||
      initial.visibleClearWrappers !== 1 ||
      !initial.clearWrapperVisible
    ) {
      return translationHookFailure('pageContractFailure');
    }
    if (!(await this.getAdapter(page).clickClear())) {
      return translationHookFailure('pageContractFailure');
    }

    const clearPollIntervalMs = Math.max(1, this.clearPollIntervalMs);
    const readAttempts = Math.max(1, Math.ceil(this.clearTimeoutMs / clearPollIntervalMs));
    for (let attempt = 0; attempt < readAttempts; attempt += 1) {
      if (this.isCleared(await this.getAdapter(page).readClearSnapshot(), targetLanguage, true)) {
        return translationHookSuccess();
      }
      if (attempt + 1 < readAttempts) {
        await this.waitForClearPoll(this.clearPollIntervalMs);
      }
    }
    return translationHookFailure('pageContractFailure');
  }
}
