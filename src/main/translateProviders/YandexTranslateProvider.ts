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
} from '@main/translateProviders/translationProviderContracts';
import { normalizeTranslationResultText } from '@main/translateProviders/translationResultText';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';

const YANDEX_TRANSLATE_URL = 'https://translate.yandex.com/en/translator';
const YANDEX_TRANSLATE_ORIGIN = 'https://translate.yandex.com';
const YANDEX_NAVIGATION_TIMEOUT_MS = 60_000;
const YANDEX_CONSENT_TIMEOUT_MS = 10_000;
const YANDEX_CHOOSER_TIMEOUT_MS = 5_000;
const YANDEX_CLEAR_TIMEOUT_MS = 1_500;
const YANDEX_CLEAR_POLL_INTERVAL_MS = 50;

const YANDEX_ESSENTIAL_CONSENT_NAME = 'Allow essential cookies';
const YANDEX_AUTO_DETECT_LABEL = 'Auto detect';
const YANDEX_AUTO_DETECT_SWITCH_SELECTOR = 'input[type="checkbox"][role="switch"]';
const YANDEX_SOURCE_OPENER_SELECTOR = 'button[aria-label^="Choose source language"]';
const YANDEX_SOURCE_PRIMARY_SELECTOR = '#fakeArea[role="textbox"][contenteditable="plaintext-only"]';
const YANDEX_SOURCE_FALLBACK_SELECTOR = '[role="textbox"][aria-labelledby="srcLabel"]';
const YANDEX_SOURCE_CANDIDATE_SELECTOR = `${YANDEX_SOURCE_PRIMARY_SELECTOR}, ${YANDEX_SOURCE_FALLBACK_SELECTOR}`;
const YANDEX_FORBIDDEN_TEXTAREA_SELECTOR = 'textarea#textarea';
const YANDEX_DESTINATION_PANEL_SELECTOR = '[data-tracking-data*="box-dst"]';
const YANDEX_DESTINATION_PRIMARY_SELECTOR = '[data-lexical-editor="true"][role="textbox"]';
const YANDEX_DESTINATION_FALLBACK_SELECTOR = '#translation';
const YANDEX_TARGET_OPENER_SELECTOR = 'button[aria-label^="Choose target language"]';
const YANDEX_TARGET_SEARCH_SELECTOR = 'input[placeholder="Search languages"]';
const YANDEX_TARGET_OPTION_SELECTOR = '[data-lang-element="true"][data-value][role="checkbox"][aria-label]:visible';
const YANDEX_CLEAR_SELECTOR = 'button[aria-label="Clear"]';
const YANDEX_BLOCKING_SURFACE_SELECTOR =
  'iframe[title*="challenge" i], iframe[title*="captcha" i], [aria-label*="captcha" i], [data-testid*="captcha" i]';

export type YandexRouteKind = 'loginOrChallenge' | 'translator' | 'unexpected';
export type YandexEditorResolution = 'fallback' | 'invalid' | 'primary';

export interface YandexRouteSnapshot {
  readonly hasTextParameter: boolean;
  readonly route: YandexRouteKind;
  readonly sourceLanguage: string | null;
  readonly targetLanguage: string | null;
}

export interface YandexConsentSnapshot {
  readonly visibleConsentSurfaces: number;
  readonly visibleEnabledEssentialControls: number;
  readonly visibleEssentialControls: number;
}

export interface YandexAutomaticSourceSnapshot {
  readonly checked: boolean | null;
  readonly chooserOpen: boolean;
  readonly enabledSwitches: number;
  readonly exactLabels: number;
  readonly switches: number;
}

export interface YandexTargetSnapshot {
  readonly selectedTargetCode: string | null;
  readonly visibleOpeners: number;
}

export interface YandexEditorSnapshot {
  readonly destinationEditors: number;
  readonly destinationResolution: YandexEditorResolution;
  readonly destinationText: string;
  readonly destinationVisible: boolean;
  readonly editableSourceEditors: number;
  readonly sourceEditors: number;
  readonly sourceResolution: YandexEditorResolution;
  readonly sourceTextLength: number | null;
  readonly visibleDestinationPanels: number;
  readonly visibleForbiddenTextareas: number;
}

export interface YandexReadinessSnapshot {
  readonly blockingSurfaces: number;
  readonly editors: YandexEditorSnapshot;
  readonly target: YandexTargetSnapshot;
}

export interface YandexClearSnapshot {
  readonly automaticSource: YandexAutomaticSourceSnapshot;
  readonly clearControlEnabled: boolean;
  readonly editors: YandexEditorSnapshot;
  readonly route: YandexRouteSnapshot;
  readonly target: YandexTargetSnapshot;
  readonly visibleClearControls: number;
}

export interface YandexTranslatePageAdapter {
  clickClear(): Promise<boolean>;
  clickEssentialConsent(): Promise<boolean>;
  closeAutomaticSourceChooser(): Promise<boolean>;
  enableAutomaticSourceDetection(): Promise<boolean>;
  insertSourceText(sourceText: string): Promise<boolean>;
  navigate(): Promise<void>;
  openAutomaticSourceChooser(): Promise<boolean>;
  openTargetChooser(): Promise<boolean>;
  readAutomaticSourceSnapshot(): Promise<YandexAutomaticSourceSnapshot>;
  readClearSnapshot(): Promise<YandexClearSnapshot>;
  readConsentSnapshot(): Promise<YandexConsentSnapshot>;
  readEditorSnapshot(): Promise<YandexEditorSnapshot>;
  readReadinessSnapshot(): Promise<YandexReadinessSnapshot>;
  readRouteSnapshot(): Promise<YandexRouteSnapshot>;
  readTargetSnapshot(): Promise<YandexTargetSnapshot>;
  selectTargetLanguage(targetLanguage: string): Promise<boolean>;
}

export type YandexTranslatePageAdapterFactory = (page: Page) => YandexTranslatePageAdapter;

export interface YandexTranslateProviderDependencies extends BaseTranslateProviderDependencies {
  readonly clearPollIntervalMs?: number;
  readonly clearTimeoutMs?: number;
  readonly createPageAdapter: YandexTranslatePageAdapterFactory;
  readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;
  readonly waitForClearPoll?: (delayMs: number) => Promise<void>;
}

interface VisibleLocatorSnapshot {
  readonly editable: boolean;
  readonly enabled: boolean;
  readonly locator: Locator;
}

interface DestinationLocatorSnapshot {
  readonly count: number;
  readonly locator?: Locator;
  readonly resolution: YandexEditorResolution;
  readonly visiblePanels: number;
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

function normalizeResultText(text: string): string {
  return normalizeTranslationResultText(text);
}

export function createYandexRouteSnapshot(rawUrl: string): YandexRouteSnapshot {
  try {
    const url = new URL(rawUrl);
    const normalizedPath = url.pathname.toLowerCase();
    if (
      normalizedPath.includes('challenge') ||
      normalizedPath.includes('captcha') ||
      normalizedPath.includes('login') ||
      normalizedPath.includes('signin') ||
      normalizedPath.includes('auth')
    ) {
      return {
        hasTextParameter: url.searchParams.has('text'),
        route: 'loginOrChallenge',
        sourceLanguage: url.searchParams.get('source_lang'),
        targetLanguage: url.searchParams.get('target_lang'),
      };
    }
    if (
      url.origin === YANDEX_TRANSLATE_ORIGIN &&
      ['/en', '/en/', '/en/translator', '/en/translator/'].includes(url.pathname) &&
      url.hash.length === 0
    ) {
      return {
        hasTextParameter: url.searchParams.has('text'),
        route: 'translator',
        sourceLanguage: url.searchParams.get('source_lang'),
        targetLanguage: url.searchParams.get('target_lang'),
      };
    }
  } catch {
    // Return only the closed sanitized route classification below.
  }
  return {
    hasTextParameter: false,
    route: 'unexpected',
    sourceLanguage: null,
    targetLanguage: null,
  };
}

export function classifyYandexAutomaticSource(snapshot: YandexAutomaticSourceSnapshot): TranslationProviderHookResult {
  if (
    snapshot.exactLabels !== 1 ||
    snapshot.switches !== 1 ||
    snapshot.enabledSwitches !== 1 ||
    snapshot.checked === null
  ) {
    return translationHookFailure('pageContractFailure');
  }
  return translationHookSuccess();
}

export function classifyYandexEditors(snapshot: YandexEditorSnapshot): TranslationProviderHookResult {
  if (
    snapshot.visibleDestinationPanels > 1 ||
    (snapshot.destinationVisible && snapshot.visibleDestinationPanels !== 1) ||
    snapshot.destinationEditors !== 1 ||
    snapshot.destinationResolution === 'invalid' ||
    snapshot.sourceEditors !== 1 ||
    snapshot.editableSourceEditors !== 1 ||
    snapshot.sourceResolution === 'invalid' ||
    snapshot.sourceTextLength === null ||
    snapshot.visibleForbiddenTextareas > 0 ||
    (!snapshot.destinationVisible && normalizeResultText(snapshot.destinationText).trim().length > 0)
  ) {
    return translationHookFailure('pageContractFailure');
  }
  return translationHookSuccess();
}

export function classifyYandexResult(snapshot: YandexEditorSnapshot): TranslationProviderHookResult<string> {
  const editors = classifyYandexEditors(snapshot);
  if (!editors.success) return editors;
  if (!snapshot.destinationVisible) return translationHookSuccess('');
  return translationHookSuccess(normalizeResultText(snapshot.destinationText));
}

/** Restricts Playwright access to the researched public Yandex controls. */
class PlaywrightYandexTranslatePageAdapter implements YandexTranslatePageAdapter {
  constructor(private readonly page: Page) {}

  async navigate(): Promise<void> {
    await this.page.goto(YANDEX_TRANSLATE_URL, {
      timeout: YANDEX_NAVIGATION_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
  }

  readRouteSnapshot(): Promise<YandexRouteSnapshot> {
    return Promise.resolve(createYandexRouteSnapshot(this.page.url()));
  }

  async readConsentSnapshot(): Promise<YandexConsentSnapshot> {
    const [essentialControls, dialogs] = await Promise.all([
      getVisibleLocators(this.page.getByRole('button', { exact: true, name: YANDEX_ESSENTIAL_CONSENT_NAME })),
      getVisibleLocators(this.page.locator('[role="dialog"]')),
    ]);
    return {
      visibleConsentSurfaces: dialogs.length > 0 ? dialogs.length : essentialControls.length > 0 ? 1 : 0,
      visibleEnabledEssentialControls: essentialControls.filter((control) => control.enabled).length,
      visibleEssentialControls: essentialControls.length,
    };
  }

  async clickEssentialConsent(): Promise<boolean> {
    const controls = await getVisibleLocators(
      this.page.getByRole('button', { exact: true, name: YANDEX_ESSENTIAL_CONSENT_NAME }),
    );
    if (controls.length !== 1 || !controls[0]?.enabled) return false;
    await controls[0].locator.click();
    await controls[0].locator.waitFor({ state: 'hidden', timeout: YANDEX_CONSENT_TIMEOUT_MS }).catch(() => {});
    return true;
  }

  async readAutomaticSourceSnapshot(): Promise<YandexAutomaticSourceSnapshot> {
    const labels = await this.getExactAutomaticSourceLabels();
    if (labels.length !== 1 || !labels[0]) {
      return {
        checked: null,
        chooserOpen: false,
        enabledSwitches: 0,
        exactLabels: labels.length,
        switches: 0,
      };
    }
    const switches = labels[0].locator(YANDEX_AUTO_DETECT_SWITCH_SELECTOR);
    const switchCount = await switches.count();
    return {
      checked: switchCount === 1 ? await switches.isChecked().catch(() => null) : null,
      chooserOpen: await labels[0].isVisible().catch(() => false),
      enabledSwitches: switchCount === 1 && (await switches.isEnabled().catch(() => false)) ? 1 : 0,
      exactLabels: 1,
      switches: switchCount,
    };
  }

  async openAutomaticSourceChooser(): Promise<boolean> {
    const initial = await this.readAutomaticSourceSnapshot();
    if (initial.chooserOpen) return classifyYandexAutomaticSource(initial).success;

    const openers = await getVisibleLocators(this.page.locator(YANDEX_SOURCE_OPENER_SELECTOR));
    if (openers.length !== 1 || !openers[0]?.enabled) return false;
    await openers[0].locator.click();

    const labels = await this.getExactAutomaticSourceLabels();
    if (labels.length !== 1 || !labels[0]) return false;
    await labels[0].waitFor({ state: 'visible', timeout: YANDEX_CHOOSER_TIMEOUT_MS }).catch(() => {});
    const opened = await this.readAutomaticSourceSnapshot();
    return opened.chooserOpen && classifyYandexAutomaticSource(opened).success;
  }

  async closeAutomaticSourceChooser(): Promise<boolean> {
    const initial = await this.readAutomaticSourceSnapshot();
    if (!initial.chooserOpen) return classifyYandexAutomaticSource(initial).success;

    const openers = await getVisibleLocators(this.page.locator(YANDEX_SOURCE_OPENER_SELECTOR));
    if (openers.length !== 1 || !openers[0]?.enabled) return false;
    await openers[0].locator.click();
    const labels = await this.getExactAutomaticSourceLabels();
    if (labels.length === 1 && labels[0]) {
      await labels[0].waitFor({ state: 'hidden', timeout: YANDEX_CHOOSER_TIMEOUT_MS }).catch(() => {});
    }
    const closed = await this.readAutomaticSourceSnapshot();
    return !closed.chooserOpen && classifyYandexAutomaticSource(closed).success;
  }

  async enableAutomaticSourceDetection(): Promise<boolean> {
    const labels = await this.getExactAutomaticSourceLabels();
    if (labels.length !== 1 || !labels[0] || !(await labels[0].isVisible())) return false;
    const switches = labels[0].locator(YANDEX_AUTO_DETECT_SWITCH_SELECTOR);
    if ((await switches.count()) !== 1 || !(await switches.isEnabled().catch(() => false))) return false;
    if (await switches.isChecked()) return true;
    await labels[0].click();
    return switches.isChecked().catch(() => false);
  }

  async readTargetSnapshot(): Promise<YandexTargetSnapshot> {
    const openers = await getVisibleLocators(this.page.locator(YANDEX_TARGET_OPENER_SELECTOR));
    const route = await this.readRouteSnapshot();
    return {
      selectedTargetCode: route.targetLanguage,
      visibleOpeners: openers.length,
    };
  }

  async openTargetChooser(): Promise<boolean> {
    const openers = await getVisibleLocators(this.page.locator(YANDEX_TARGET_OPENER_SELECTOR));
    if (openers.length !== 1 || !openers[0]?.enabled) return false;
    await openers[0].locator.click();

    await this.page
      .locator(`${YANDEX_TARGET_SEARCH_SELECTOR}:visible`)
      .waitFor({ state: 'visible', timeout: YANDEX_CHOOSER_TIMEOUT_MS })
      .catch(() => {});
    const searchInputs = await getVisibleLocators(this.page.locator(YANDEX_TARGET_SEARCH_SELECTOR));
    return searchInputs.length === 1 && searchInputs[0]?.enabled === true;
  }

  async selectTargetLanguage(targetLanguage: string): Promise<boolean> {
    const visibleOptions = this.page.locator(YANDEX_TARGET_OPTION_SELECTOR);
    const matchingIndexes = await visibleOptions.evaluateAll(
      (elements, expectedValue) =>
        elements.flatMap((element, index) => (element.getAttribute('data-value') === expectedValue ? [index] : [])),
      targetLanguage,
    );
    if (matchingIndexes.length !== 1 || matchingIndexes[0] === undefined) return false;
    const matchingOption = visibleOptions.nth(matchingIndexes[0]);
    if (!(await matchingOption.isEnabled().catch(() => false))) return false;
    await matchingOption.click();
    return true;
  }

  async readEditorSnapshot(): Promise<YandexEditorSnapshot> {
    const [sourceEditors, primarySourceEditors, forbiddenTextareas, destination] = await Promise.all([
      getVisibleLocators(this.page.locator(YANDEX_SOURCE_CANDIDATE_SELECTOR)),
      getVisibleLocators(this.page.locator(YANDEX_SOURCE_PRIMARY_SELECTOR)),
      getVisibleLocators(this.page.locator(YANDEX_FORBIDDEN_TEXTAREA_SELECTOR)),
      this.getDestinationLocator(),
    ]);
    const [destinationVisible, destinationText, sourceText] = await Promise.all([
      destination.locator ? destination.locator.isVisible().catch(() => false) : Promise.resolve(false),
      destination.locator ? destination.locator.innerText().catch(() => null) : Promise.resolve<string | null>(null),
      sourceEditors.length === 1
        ? (sourceEditors[0]?.locator.innerText().catch(() => null) ?? Promise.resolve(null))
        : Promise.resolve(null),
    ]);
    const sourceResolution: YandexEditorResolution =
      sourceEditors.length !== 1
        ? 'invalid'
        : primarySourceEditors.length === 1
          ? 'primary'
          : primarySourceEditors.length === 0
            ? 'fallback'
            : 'invalid';

    return {
      destinationEditors: destination.count,
      destinationResolution: destination.resolution,
      destinationText: destinationText ?? '',
      destinationVisible,
      editableSourceEditors: sourceEditors.filter((control) => control.enabled && control.editable).length,
      sourceEditors: sourceEditors.length,
      sourceResolution,
      sourceTextLength: sourceText?.length ?? null,
      visibleDestinationPanels: destination.visiblePanels,
      visibleForbiddenTextareas: forbiddenTextareas.length,
    };
  }

  async readReadinessSnapshot(): Promise<YandexReadinessSnapshot> {
    const [blockingSurfaces, editors, target] = await Promise.all([
      getVisibleLocators(this.page.locator(YANDEX_BLOCKING_SURFACE_SELECTOR)),
      this.readEditorSnapshot(),
      this.readTargetSnapshot(),
    ]);
    return {
      blockingSurfaces: blockingSurfaces.length,
      editors,
      target,
    };
  }

  async insertSourceText(sourceText: string): Promise<boolean> {
    const sourceEditors = await getVisibleLocators(this.page.locator(YANDEX_SOURCE_CANDIDATE_SELECTOR));
    if (sourceEditors.length !== 1 || !sourceEditors[0]?.enabled || !sourceEditors[0].editable) return false;
    await sourceEditors[0].locator.evaluate((element, value) => {
      element.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          data: value,
          inputType: 'insertText',
        }),
      );
      element.textContent = value;
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: value,
          inputType: 'insertText',
        }),
      );
    }, sourceText);
    return true;
  }

  async readClearSnapshot(): Promise<YandexClearSnapshot> {
    const [clearControls, automaticSource, editors, route, target] = await Promise.all([
      getVisibleLocators(this.page.locator(YANDEX_CLEAR_SELECTOR)),
      this.readAutomaticSourceSnapshot(),
      this.readEditorSnapshot(),
      this.readRouteSnapshot(),
      this.readTargetSnapshot(),
    ]);
    return {
      automaticSource,
      clearControlEnabled: clearControls.length === 1 && clearControls[0]?.enabled === true,
      editors,
      route,
      target,
      visibleClearControls: clearControls.length,
    };
  }

  async clickClear(): Promise<boolean> {
    const controls = await getVisibleLocators(this.page.locator(YANDEX_CLEAR_SELECTOR));
    if (controls.length !== 1 || !controls[0]?.enabled) return false;
    await controls[0].locator.click();
    return true;
  }

  private async getExactAutomaticSourceLabels(): Promise<Locator[]> {
    const labels = this.page.locator(`label:has(${YANDEX_AUTO_DETECT_SWITCH_SELECTOR})`);
    const exactLabels: Locator[] = [];
    const labelCount = await labels.count();
    for (let index = 0; index < labelCount; index += 1) {
      const label = labels.nth(index);
      if (((await label.textContent()) ?? '').trim() === YANDEX_AUTO_DETECT_LABEL) {
        exactLabels.push(label);
      }
    }
    return exactLabels;
  }

  private async getDestinationLocator(): Promise<DestinationLocatorSnapshot> {
    const panels = this.page.locator(YANDEX_DESTINATION_PANEL_SELECTOR);
    const panelCount = await panels.count();
    const visiblePanels = await getVisibleLocators(panels);
    const primary: Locator[] = [];
    const fallback: Locator[] = [];

    for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
      const panel = panels.nth(panelIndex);
      const primaryMatches = panel.locator(YANDEX_DESTINATION_PRIMARY_SELECTOR);
      for (let index = 0; index < (await primaryMatches.count()); index += 1) {
        primary.push(primaryMatches.nth(index));
      }
      const fallbackMatches = panel.locator(YANDEX_DESTINATION_FALLBACK_SELECTOR);
      for (let index = 0; index < (await fallbackMatches.count()); index += 1) {
        fallback.push(fallbackMatches.nth(index));
      }
    }

    if (primary.length === 1 && primary[0]) {
      return {
        count: 1,
        locator: primary[0],
        resolution: 'primary',
        visiblePanels: visiblePanels.length,
      };
    }
    if (primary.length > 1) {
      return { count: primary.length, resolution: 'invalid', visiblePanels: visiblePanels.length };
    }

    return {
      count: fallback.length,
      ...(fallback.length === 1 && fallback[0] ? { locator: fallback[0] } : {}),
      resolution: fallback.length === 1 ? 'fallback' : 'invalid',
      visiblePanels: visiblePanels.length,
    };
  }
}

export function createPlaywrightYandexTranslatePageAdapter(page: Page): YandexTranslatePageAdapter {
  return new PlaywrightYandexTranslatePageAdapter(page);
}

/** Unregistered Yandex public-page implementation of the shared translation lifecycle. */
export class YandexTranslateProvider extends BaseTranslateProvider {
  private readonly adapters = new WeakMap<Page, YandexTranslatePageAdapter>();
  private readonly automaticSourceDetectionPages = new WeakSet<Page>();
  private readonly clearPollIntervalMs: number;
  private readonly clearTimeoutMs: number;
  private readonly createPageAdapter: YandexTranslatePageAdapterFactory;
  private readonly expectedTargets = new WeakMap<Page, string>();
  private readonly preparedPages = new WeakSet<Page>();
  private readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;
  private readonly waitForClearPoll: (delayMs: number) => Promise<void>;

  constructor(dependencies: YandexTranslateProviderDependencies) {
    super(TRANSLATION_PROVIDER_INFO.yandex, dependencies);
    this.clearPollIntervalMs = dependencies.clearPollIntervalMs ?? YANDEX_CLEAR_POLL_INTERVAL_MS;
    this.clearTimeoutMs = dependencies.clearTimeoutMs ?? YANDEX_CLEAR_TIMEOUT_MS;
    this.createPageAdapter = dependencies.createPageAdapter;
    this.onNavigationRetry = dependencies.onNavigationRetry;
    this.waitForClearPoll = dependencies.waitForClearPoll ?? dependencies.sleep;
  }

  protected async navigateAndHandleConsent(
    page: Page,
    _targetLanguage: string,
  ): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    if (!this.preparedPages.has(page)) {
      this.automaticSourceDetectionPages.delete(page);
      await retryBrowserNavigation(
        {
          navigate: () => adapter.navigate(),
          service: BrowserNavigationService.YandexTranslate,
        },
        { onRetry: this.onNavigationRetry },
      );
    }

    const route = await adapter.readRouteSnapshot();
    if (route.route !== 'translator' || route.hasTextParameter) {
      return translationHookFailure('consentOrChallenge');
    }

    const consent = await adapter.readConsentSnapshot();
    if (consent.visibleConsentSurfaces === 0 && consent.visibleEssentialControls === 0) {
      this.preparedPages.add(page);
      return translationHookSuccess();
    }
    if (
      consent.visibleConsentSurfaces !== 1 ||
      consent.visibleEssentialControls !== 1 ||
      consent.visibleEnabledEssentialControls !== 1
    ) {
      return translationHookFailure('consentOrChallenge');
    }
    if (!(await adapter.clickEssentialConsent())) {
      return translationHookFailure('consentOrChallenge');
    }

    const returnRoute = await adapter.readRouteSnapshot();
    const remainingConsent = await adapter.readConsentSnapshot();
    if (
      returnRoute.route === 'translator' &&
      !returnRoute.hasTextParameter &&
      remainingConsent.visibleConsentSurfaces === 0 &&
      remainingConsent.visibleEssentialControls === 0
    ) {
      this.preparedPages.add(page);
      return translationHookSuccess();
    }
    return translationHookFailure('consentOrChallenge');
  }

  protected async inspectReadiness(page: Page): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    const route = await adapter.readRouteSnapshot();
    if (route.route !== 'translator' || route.hasTextParameter) {
      return translationHookFailure('consentOrChallenge');
    }
    const snapshot = await adapter.readReadinessSnapshot();
    if (snapshot.blockingSurfaces > 0) {
      return translationHookFailure('consentOrChallenge');
    }
    const editors = classifyYandexEditors(snapshot.editors);
    if (!editors.success || snapshot.target.visibleOpeners !== 1) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    return translationHookSuccess();
  }

  protected async enableAutomaticSourceDetection(page: Page): Promise<TranslationProviderHookResult> {
    if (this.automaticSourceDetectionPages.has(page)) {
      return translationHookSuccess();
    }
    const adapter = this.getAdapter(page);
    if (!(await adapter.openAutomaticSourceChooser())) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    let automaticSource = await adapter.readAutomaticSourceSnapshot();
    const classified = classifyYandexAutomaticSource(automaticSource);
    if (!classified.success || !automaticSource.chooserOpen) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    if (automaticSource.checked !== true && !(await adapter.enableAutomaticSourceDetection())) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    automaticSource = await adapter.readAutomaticSourceSnapshot();
    if (
      !classifyYandexAutomaticSource(automaticSource).success ||
      !automaticSource.chooserOpen ||
      automaticSource.checked !== true ||
      !(await adapter.closeAutomaticSourceChooser())
    ) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    this.automaticSourceDetectionPages.add(page);
    return translationHookSuccess();
  }

  protected async selectAndVerifyTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    const initial = await adapter.readTargetSnapshot();
    const initialRoute = await adapter.readRouteSnapshot();
    if (
      initial.visibleOpeners === 1 &&
      initial.selectedTargetCode === targetLanguage &&
      initialRoute.route === 'translator' &&
      !initialRoute.hasTextParameter &&
      initialRoute.targetLanguage === targetLanguage
    ) {
      this.expectedTargets.set(page, targetLanguage);
      return translationHookSuccess();
    }
    if (
      initial.visibleOpeners !== 1 ||
      !(await adapter.openTargetChooser()) ||
      !(await adapter.selectTargetLanguage(targetLanguage))
    ) {
      return translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
    }
    const route = await adapter.readRouteSnapshot();
    const selected = await adapter.readTargetSnapshot();
    if (
      route.route !== 'translator' ||
      route.hasTextParameter ||
      route.targetLanguage !== targetLanguage ||
      selected.visibleOpeners !== 1 ||
      selected.selectedTargetCode !== targetLanguage
    ) {
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
    return (await this.getAdapter(page).insertSourceText(sourceText))
      ? translationHookSuccess()
      : translationHookFailure('pageContractFailure');
  }

  protected async readNormalizedResult(page: Page): Promise<TranslationProviderHookResult<string>> {
    const route = await this.getAdapter(page).readRouteSnapshot();
    if (route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    return classifyYandexResult(await this.getAdapter(page).readEditorSnapshot());
  }

  protected async verifySelectedTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    const route = await adapter.readRouteSnapshot();
    const selected = await adapter.readTargetSnapshot();
    return route.route === 'translator' &&
      route.targetLanguage === targetLanguage &&
      selected.visibleOpeners === 1 &&
      selected.selectedTargetCode === targetLanguage
      ? translationHookSuccess()
      : translationHookFailure('pageContractFailure');
  }

  protected async clearVisibleState(page: Page): Promise<TranslationProviderHookResult> {
    const clear = await this.clearAndConfirm(page);
    return clear.success ? clear : translationHookFailure('cleanupFailure');
  }

  private getAdapter(page: Page): YandexTranslatePageAdapter {
    const current = this.adapters.get(page);
    if (current) return current;
    const adapter = this.createPageAdapter(page);
    this.adapters.set(page, adapter);
    return adapter;
  }

  private isCleared(snapshot: YandexClearSnapshot, targetLanguage: string): boolean {
    const automaticSource = classifyYandexAutomaticSource(snapshot.automaticSource);
    const editors = classifyYandexEditors(snapshot.editors);
    return (
      automaticSource.success &&
      snapshot.automaticSource.checked === true &&
      editors.success &&
      snapshot.editors.sourceTextLength === 0 &&
      !snapshot.editors.destinationVisible &&
      normalizeResultText(snapshot.editors.destinationText).trim().length === 0 &&
      snapshot.route.route === 'translator' &&
      !snapshot.route.hasTextParameter &&
      snapshot.route.targetLanguage === targetLanguage &&
      snapshot.target.visibleOpeners === 1 &&
      snapshot.target.selectedTargetCode === targetLanguage
    );
  }

  private async clearAndConfirm(page: Page): Promise<TranslationProviderHookResult> {
    const targetLanguage = this.expectedTargets.get(page);
    if (!targetLanguage) return translationHookFailure('pageContractFailure');

    const initial = await this.getAdapter(page).readClearSnapshot();
    if (this.isCleared(initial, targetLanguage)) return translationHookSuccess();
    const automaticSource = classifyYandexAutomaticSource(initial.automaticSource);
    const editors = classifyYandexEditors(initial.editors);
    if (
      !automaticSource.success ||
      initial.automaticSource.checked !== true ||
      !editors.success ||
      initial.route.route !== 'translator' ||
      initial.route.targetLanguage !== targetLanguage ||
      initial.target.visibleOpeners !== 1 ||
      initial.target.selectedTargetCode !== targetLanguage ||
      initial.visibleClearControls !== 1 ||
      !initial.clearControlEnabled
    ) {
      return translationHookFailure('pageContractFailure');
    }
    if (!(await this.getAdapter(page).clickClear())) {
      return translationHookFailure('pageContractFailure');
    }

    const clearPollIntervalMs = Math.max(1, this.clearPollIntervalMs);
    const readAttempts = Math.max(1, Math.ceil(this.clearTimeoutMs / clearPollIntervalMs));
    for (let attempt = 0; attempt < readAttempts; attempt += 1) {
      if (this.isCleared(await this.getAdapter(page).readClearSnapshot(), targetLanguage)) {
        return translationHookSuccess();
      }
      if (attempt + 1 < readAttempts) {
        await this.waitForClearPoll(this.clearPollIntervalMs);
      }
    }
    return translationHookFailure('pageContractFailure');
  }
}
