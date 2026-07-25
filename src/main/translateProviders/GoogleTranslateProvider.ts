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
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';

const GOOGLE_TRANSLATE_ORIGIN = 'https://translate.google.ru';
const GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS = 60_000;
const GOOGLE_CONSENT_TIMEOUT_MS = 10_000;
const GOOGLE_CLEAR_TIMEOUT_MS = 1_500;
const GOOGLE_CLEAR_POLL_INTERVAL_MS = 50;

const GOOGLE_SOURCE_SELECTOR = 'textarea[role="combobox"][aria-label="Source text"]';
const GOOGLE_RESULT_FRAGMENT_SELECTOR = '.ryNqvb';
const GOOGLE_CLEAR_SELECTOR = 'button[aria-label="Clear source text"]';
const GOOGLE_REJECT_CONSENT_SELECTOR = 'button[jsname="tWT92d"][aria-label="Reject all"]';

export type GoogleOriginFamily = 'com' | 'ru';
export type GoogleTopLevelOrigin = 'consent' | 'translator' | 'unexpected';
export type GoogleRouteKind = 'consent' | 'loginOrChallenge' | 'translator' | 'unexpected';

export interface GoogleRouteSnapshot {
  readonly family?: GoogleOriginFamily;
  readonly hasTextParameter: boolean;
  readonly operation: string | null;
  readonly origin: GoogleTopLevelOrigin;
  readonly route: GoogleRouteKind;
  readonly sourceLanguage: string | null;
  readonly targetLanguage: string | null;
}

export interface GoogleConsentSnapshot {
  readonly visibleRejectAllControls: number;
}

export interface GoogleReadinessSnapshot {
  readonly visibleEditableSourceControls: number;
  readonly visibleResultRegions: number;
  readonly visibleSourceControls: number;
}

export interface GoogleResultFragmentSnapshot {
  readonly branchIndex: number;
  readonly insideListItem: boolean;
  readonly text: string;
  readonly visible: boolean;
}

export interface GoogleResultSnapshot {
  readonly fragments: readonly GoogleResultFragmentSnapshot[];
  readonly visibleResultRegions: number;
}

export interface GoogleClearSnapshot {
  readonly clearControlEnabled: boolean;
  readonly result: GoogleResultSnapshot;
  readonly route: GoogleRouteSnapshot;
  readonly sourceValueLength: number | null;
  readonly visibleClearControls: number;
  readonly readiness: GoogleReadinessSnapshot;
}

export interface GoogleTranslatePageAdapter {
  clickClearSource(): Promise<boolean>;
  clickRejectAll(): Promise<boolean>;
  insertSourceText(sourceText: string): Promise<boolean>;
  navigate(url: string): Promise<void>;
  readClearSnapshot(): Promise<GoogleClearSnapshot>;
  readConsentSnapshot(): Promise<GoogleConsentSnapshot>;
  readReadinessSnapshot(): Promise<GoogleReadinessSnapshot>;
  readResultSnapshot(): Promise<GoogleResultSnapshot>;
  readRouteSnapshot(): Promise<GoogleRouteSnapshot>;
}

export type GoogleTranslatePageAdapterFactory = (page: Page) => GoogleTranslatePageAdapter;

export interface GoogleTranslateProviderDependencies extends Partial<BaseTranslateProviderDependencies> {
  readonly clearPollIntervalMs?: number;
  readonly clearTimeoutMs?: number;
  readonly createPageAdapter?: GoogleTranslatePageAdapterFactory;
  readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;
  readonly waitForClearPoll?: (delayMs: number) => Promise<void>;
}

interface VisibleLocatorSnapshot {
  readonly editable: boolean;
  readonly enabled: boolean;
  readonly locator: Locator;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getOriginClassification(url: URL): {
  readonly family?: GoogleOriginFamily;
  readonly origin: GoogleTopLevelOrigin;
} {
  switch (url.origin) {
    case 'https://translate.google.com':
      return { family: 'com', origin: 'translator' };
    case 'https://translate.google.ru':
      return { family: 'ru', origin: 'translator' };
    case 'https://consent.google.com':
      return { family: 'com', origin: 'consent' };
    case 'https://consent.google.ru':
      return { family: 'ru', origin: 'consent' };
    default:
      return { origin: 'unexpected' };
  }
}

function getRouteKind(url: URL, origin: GoogleTopLevelOrigin): GoogleRouteKind {
  const normalizedPath = url.pathname.toLowerCase();
  if (
    normalizedPath.includes('challenge') ||
    normalizedPath.includes('login') ||
    normalizedPath.includes('signin') ||
    normalizedPath.includes('sorry')
  ) {
    return 'loginOrChallenge';
  }
  if (origin === 'consent') return 'consent';
  if (origin === 'translator' && (url.pathname === '' || url.pathname === '/')) return 'translator';
  return 'unexpected';
}

export function createGoogleRouteSnapshot(rawUrl: string): GoogleRouteSnapshot {
  try {
    const url = new URL(rawUrl);
    const origin = getOriginClassification(url);
    return {
      ...origin,
      hasTextParameter: url.searchParams.has('text'),
      operation: url.searchParams.get('op'),
      route: getRouteKind(url, origin.origin),
      sourceLanguage: url.searchParams.get('sl'),
      targetLanguage: url.searchParams.get('tl'),
    };
  } catch {
    return {
      hasTextParameter: false,
      operation: null,
      origin: 'unexpected',
      route: 'unexpected',
      sourceLanguage: null,
      targetLanguage: null,
    };
  }
}

export function buildGoogleTranslateProviderUrl(targetLanguage: string): string {
  const url = new URL(GOOGLE_TRANSLATE_ORIGIN);
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', targetLanguage);
  url.searchParams.set('op', 'translate');
  url.searchParams.set('hl', 'en');
  return url.toString();
}

function routeMatchesTranslationState(snapshot: GoogleRouteSnapshot, targetLanguage?: string): boolean {
  return (
    snapshot.origin === 'translator' &&
    snapshot.route === 'translator' &&
    snapshot.sourceLanguage === 'auto' &&
    snapshot.operation === 'translate' &&
    (targetLanguage === undefined || snapshot.targetLanguage === targetLanguage)
  );
}

export function classifyGoogleReadinessSnapshot(snapshot: GoogleReadinessSnapshot): TranslationProviderHookResult {
  if (
    snapshot.visibleSourceControls !== 1 ||
    snapshot.visibleEditableSourceControls !== 1 ||
    snapshot.visibleResultRegions !== 1
  ) {
    return translationHookFailure('pageContractFailure');
  }
  return translationHookSuccess();
}

export function classifyGoogleResultSnapshot(snapshot: GoogleResultSnapshot): TranslationProviderHookResult<string> {
  if (snapshot.visibleResultRegions !== 1) {
    return translationHookFailure('pageContractFailure');
  }

  const primaryFragments = snapshot.fragments
    .filter((fragment) => fragment.visible && !fragment.insideListItem)
    .map((fragment) => ({
      branchIndex: fragment.branchIndex,
      text: fragment.text.replace(/\s+/gu, ' ').trim(),
    }))
    .filter((fragment) => fragment.text.length > 0);
  if (primaryFragments.length === 0) {
    return translationHookSuccess('');
  }

  const primaryBranches = new Set(primaryFragments.map((fragment) => fragment.branchIndex));
  if (primaryBranches.size !== 1 || primaryBranches.has(-1)) {
    return translationHookFailure('pageContractFailure');
  }
  return translationHookSuccess(primaryFragments.map((fragment) => fragment.text).join(''));
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

/** Restricts Playwright access to the researched public Google controls. */
class PlaywrightGoogleTranslatePageAdapter implements GoogleTranslatePageAdapter {
  constructor(private readonly page: Page) {}

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, {
      timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
  }

  readRouteSnapshot(): Promise<GoogleRouteSnapshot> {
    return Promise.resolve(createGoogleRouteSnapshot(this.page.url()));
  }

  async readConsentSnapshot(): Promise<GoogleConsentSnapshot> {
    const rejectControls = await getVisibleLocators(this.page.locator(GOOGLE_REJECT_CONSENT_SELECTOR));
    return { visibleRejectAllControls: rejectControls.length };
  }

  async clickRejectAll(): Promise<boolean> {
    const rejectControls = await getVisibleLocators(this.page.locator(GOOGLE_REJECT_CONSENT_SELECTOR));
    if (rejectControls.length !== 1 || !rejectControls[0]?.enabled) return false;
    await Promise.all([
      this.page.waitForURL(
        (url) => {
          const snapshot = createGoogleRouteSnapshot(url.toString());
          return snapshot.origin === 'translator' && snapshot.route === 'translator';
        },
        { timeout: GOOGLE_CONSENT_TIMEOUT_MS },
      ),
      rejectControls[0].locator.click(),
    ]);
    return true;
  }

  async readReadinessSnapshot(): Promise<GoogleReadinessSnapshot> {
    const sourceControls = await getVisibleLocators(this.page.locator(GOOGLE_SOURCE_SELECTOR));
    const resultRegions = await getVisibleLocators(
      this.page.getByRole('region', { exact: true, name: 'Translation results' }),
    );
    return {
      visibleEditableSourceControls: sourceControls.filter((control) => control.editable).length,
      visibleResultRegions: resultRegions.length,
      visibleSourceControls: sourceControls.length,
    };
  }

  async insertSourceText(sourceText: string): Promise<boolean> {
    const sourceControls = await getVisibleLocators(this.page.locator(GOOGLE_SOURCE_SELECTOR));
    if (sourceControls.length !== 1 || !sourceControls[0]?.editable) return false;

    await sourceControls[0].locator.evaluate((element, value) => {
      const textarea = element as HTMLTextAreaElement;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.apply supplies the textarea receiver.
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!valueSetter) throw new Error('Native textarea value setter unavailable');
      Reflect.apply(valueSetter, textarea, [value]);
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    }, sourceText);
    return true;
  }

  async readResultSnapshot(): Promise<GoogleResultSnapshot> {
    const regions = await getVisibleLocators(
      this.page.getByRole('region', { exact: true, name: 'Translation results' }),
    );
    if (regions.length !== 1 || !regions[0]) {
      return { fragments: [], visibleResultRegions: regions.length };
    }

    const fragments = await regions[0].locator.evaluate((region, selector): GoogleResultFragmentSnapshot[] => {
      return Array.from(region.querySelectorAll(selector)).map((fragment) => {
        let primaryBranch: Element | null = fragment;
        while (primaryBranch?.parentElement && primaryBranch.parentElement !== region) {
          primaryBranch = primaryBranch.parentElement;
        }
        return {
          branchIndex:
            primaryBranch?.parentElement === region ? Array.from(region.children).indexOf(primaryBranch) : -1,
          insideListItem: fragment.closest('[role="listitem"]') !== null,
          text: fragment.textContent ?? '',
          visible: (() => {
            const style = window.getComputedStyle(fragment);
            return style.display !== 'none' && style.visibility !== 'hidden' && fragment.getClientRects().length > 0;
          })(),
        };
      });
    }, GOOGLE_RESULT_FRAGMENT_SELECTOR);
    return { fragments, visibleResultRegions: 1 };
  }

  async readClearSnapshot(): Promise<GoogleClearSnapshot> {
    const readiness = await this.readReadinessSnapshot();
    const sourceControls = await getVisibleLocators(this.page.locator(GOOGLE_SOURCE_SELECTOR));
    const clearControls = await getVisibleLocators(this.page.locator(GOOGLE_CLEAR_SELECTOR));
    const sourceValue =
      sourceControls.length === 1 ? await sourceControls[0]?.locator.inputValue().catch(() => null) : null;
    return {
      clearControlEnabled: clearControls.length === 1 && clearControls[0]?.enabled === true,
      readiness,
      result: await this.readResultSnapshot(),
      route: await this.readRouteSnapshot(),
      sourceValueLength: sourceValue?.length ?? null,
      visibleClearControls: clearControls.length,
    };
  }

  async clickClearSource(): Promise<boolean> {
    const clearControls = await getVisibleLocators(this.page.locator(GOOGLE_CLEAR_SELECTOR));
    if (clearControls.length !== 1 || !clearControls[0]?.enabled) return false;
    await clearControls[0].locator.click();
    return true;
  }
}

function createPlaywrightGoogleTranslatePageAdapter(page: Page): GoogleTranslatePageAdapter {
  return new PlaywrightGoogleTranslatePageAdapter(page);
}

/** Unregistered Google public-page implementation of the shared translation lifecycle. */
export class GoogleTranslateProvider extends BaseTranslateProvider {
  private readonly adapters = new WeakMap<Page, GoogleTranslatePageAdapter>();
  private readonly clearPollIntervalMs: number;
  private readonly clearTimeoutMs: number;
  private readonly createPageAdapter: GoogleTranslatePageAdapterFactory;
  private readonly expectedTargets = new WeakMap<Page, string>();
  private readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;
  private readonly waitForClearPoll: (delayMs: number) => Promise<void>;

  constructor(dependencies: GoogleTranslateProviderDependencies = {}) {
    super(TRANSLATION_PROVIDER_INFO.google, dependencies);
    this.clearPollIntervalMs = dependencies.clearPollIntervalMs ?? GOOGLE_CLEAR_POLL_INTERVAL_MS;
    this.clearTimeoutMs = dependencies.clearTimeoutMs ?? GOOGLE_CLEAR_TIMEOUT_MS;
    this.createPageAdapter = dependencies.createPageAdapter ?? createPlaywrightGoogleTranslatePageAdapter;
    this.onNavigationRetry = dependencies.onNavigationRetry;
    this.waitForClearPoll = dependencies.waitForClearPoll ?? wait;
  }

  protected async navigateAndHandleConsent(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    const navigationUrl = buildGoogleTranslateProviderUrl(targetLanguage);
    await retryBrowserNavigation(
      {
        navigate: () => adapter.navigate(navigationUrl),
        service: BrowserNavigationService.GoogleTranslate,
      },
      { onRetry: this.onNavigationRetry },
    );

    const initialRoute = await adapter.readRouteSnapshot();
    if (initialRoute.route === 'translator' && initialRoute.origin === 'translator') {
      this.expectedTargets.set(page, targetLanguage);
      return translationHookSuccess();
    }
    if (initialRoute.route !== 'consent' || initialRoute.origin !== 'consent' || !initialRoute.family) {
      return translationHookFailure('consentOrChallenge');
    }

    const consent = await adapter.readConsentSnapshot();
    if (consent.visibleRejectAllControls !== 1) {
      return translationHookFailure('consentOrChallenge');
    }
    try {
      if (!(await adapter.clickRejectAll())) {
        return translationHookFailure('consentOrChallenge');
      }
    } catch {
      return translationHookFailure('consentOrChallenge');
    }

    const returnRoute = await adapter.readRouteSnapshot();
    if (
      returnRoute.route !== 'translator' ||
      returnRoute.origin !== 'translator' ||
      returnRoute.family !== initialRoute.family
    ) {
      return translationHookFailure('consentOrChallenge');
    }
    this.expectedTargets.set(page, targetLanguage);
    return translationHookSuccess();
  }

  protected async inspectReadiness(page: Page): Promise<TranslationProviderHookResult> {
    const route = await this.getAdapter(page).readRouteSnapshot();
    if (route.origin !== 'translator' || route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    const readiness = classifyGoogleReadinessSnapshot(await this.getAdapter(page).readReadinessSnapshot());
    return readiness.success
      ? readiness
      : translationHookFailure(readiness.code, { recoverableBeforeSubmission: true });
  }

  protected async enableAutomaticSourceDetection(page: Page): Promise<TranslationProviderHookResult> {
    const route = await this.getAdapter(page).readRouteSnapshot();
    if (route.origin !== 'translator' || route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    return route.sourceLanguage === 'auto' && route.operation === 'translate'
      ? translationHookSuccess()
      : translationHookFailure('pageContractFailure', { recoverableBeforeSubmission: true });
  }

  protected async selectAndVerifyTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const route = await this.getAdapter(page).readRouteSnapshot();
    if (route.origin !== 'translator' || route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    if (!routeMatchesTranslationState(route, targetLanguage)) {
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
    return classifyGoogleResultSnapshot(await this.getAdapter(page).readResultSnapshot());
  }

  protected async verifySelectedTarget(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const route = await this.getAdapter(page).readRouteSnapshot();
    if (route.origin !== 'translator' || route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    return routeMatchesTranslationState(route, targetLanguage)
      ? translationHookSuccess()
      : translationHookFailure('pageContractFailure');
  }

  protected async clearVisibleState(page: Page): Promise<TranslationProviderHookResult> {
    const clear = await this.clearAndConfirm(page);
    return clear.success ? clear : translationHookFailure('cleanupFailure');
  }

  private getAdapter(page: Page): GoogleTranslatePageAdapter {
    const current = this.adapters.get(page);
    if (current) return current;
    const adapter = this.createPageAdapter(page);
    this.adapters.set(page, adapter);
    return adapter;
  }

  private isCleared(snapshot: GoogleClearSnapshot, targetLanguage: string): boolean {
    const readiness = classifyGoogleReadinessSnapshot(snapshot.readiness);
    const result = classifyGoogleResultSnapshot(snapshot.result);
    return (
      readiness.success &&
      result.success &&
      result.value.length === 0 &&
      routeMatchesTranslationState(snapshot.route, targetLanguage) &&
      !snapshot.route.hasTextParameter &&
      snapshot.sourceValueLength === 0 &&
      snapshot.visibleClearControls === 0
    );
  }

  private async clearAndConfirm(page: Page): Promise<TranslationProviderHookResult> {
    const targetLanguage = this.expectedTargets.get(page);
    if (!targetLanguage) return translationHookFailure('pageContractFailure');

    const initial = await this.getAdapter(page).readClearSnapshot();
    if (this.isCleared(initial, targetLanguage)) return translationHookSuccess();
    if (
      classifyGoogleReadinessSnapshot(initial.readiness).success === false ||
      classifyGoogleResultSnapshot(initial.result).success === false ||
      !routeMatchesTranslationState(initial.route, targetLanguage) ||
      initial.visibleClearControls !== 1 ||
      !initial.clearControlEnabled
    ) {
      return translationHookFailure('pageContractFailure');
    }
    if (!(await this.getAdapter(page).clickClearSource())) {
      return translationHookFailure('pageContractFailure');
    }

    const readAttempts = Math.max(1, Math.ceil(this.clearTimeoutMs / this.clearPollIntervalMs));
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
