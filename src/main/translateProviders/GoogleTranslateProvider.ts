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
  type TranslationProviderCompletionControlSnapshot,
  type TranslationProviderHookResult,
  type TranslationProviderResultObservation,
} from '@main/translateProviders/translationProviderContracts';
import { normalizeTranslationResultText } from '@main/translateProviders/translationResultText';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';

const GOOGLE_TRANSLATE_ORIGIN = 'https://translate.google.ru';
const GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS = 60_000;
const GOOGLE_CONSENT_TIMEOUT_MS = 10_000;
const GOOGLE_RESULT_FALLBACK_POLL_INTERVAL_MS = 25;

const GOOGLE_SOURCE_SELECTOR = 'textarea[role="combobox"][aria-label="Source text"]';
// Google removed the accessible name from its public result container in August 2026.
// Keep the prior semantic contract as a fallback and fail closed unless exactly one
// visible result container matches either documented public-page shape.
const GOOGLE_RESULT_REGION_SELECTOR = '[role="region"][aria-label="Translation results"], [class~="sciAJc"]';
const GOOGLE_RESULT_FRAGMENT_SELECTOR = '.ryNqvb';
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

export interface GoogleResultObservationSnapshot {
  readonly completionControl?: TranslationProviderCompletionControlSnapshot;
  readonly resultMutationCount?: number;
  readonly result: GoogleResultSnapshot;
  readonly route: GoogleRouteSnapshot;
  readonly sourceValue?: string | null;
  readonly submissionEpoch?: number;
}

export interface GoogleTranslatePageAdapter {
  clearSourceWithKeyboard(): Promise<boolean>;
  clickRejectAll(): Promise<boolean>;
  insertSourceText(sourceText: string): Promise<boolean>;
  navigate(url: string): Promise<void>;
  readConsentSnapshot(): Promise<GoogleConsentSnapshot>;
  readReadinessSnapshot(): Promise<GoogleReadinessSnapshot>;
  readResultObservationSnapshot?(): Promise<GoogleResultObservationSnapshot>;
  readResultSnapshot(): Promise<GoogleResultSnapshot>;
  readRouteSnapshot(): Promise<GoogleRouteSnapshot>;
  waitForResultCandidate?(timeoutMs: number): Promise<boolean>;
}

export type GoogleTranslatePageAdapterFactory = (page: Page) => GoogleTranslatePageAdapter;

export interface GoogleTranslateProviderDependencies extends BaseTranslateProviderDependencies {
  readonly createPageAdapter: GoogleTranslatePageAdapterFactory;
  readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;
}

interface VisibleLocatorSnapshot {
  readonly editable: boolean;
  readonly enabled: boolean;
  readonly locator: Locator;
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

  const visibleFragments = snapshot.fragments.filter((fragment) => fragment.visible && !fragment.insideListItem);
  const contentFragments = visibleFragments.filter((fragment) => fragment.text.trim().length > 0);
  if (contentFragments.length === 0) {
    return translationHookSuccess('');
  }

  const primaryBranches = new Set(contentFragments.map((fragment) => fragment.branchIndex));
  if (primaryBranches.size !== 1 || primaryBranches.has(-1)) {
    return translationHookFailure('pageContractFailure');
  }
  const [primaryBranch] = primaryBranches;
  const primaryText = visibleFragments
    .filter((fragment) => fragment.branchIndex === primaryBranch)
    .reduce((combined, fragment) => {
      const text =
        /[^\S\r\n]$/u.test(combined) && /^[^\S\r\n]/u.test(fragment.text)
          ? fragment.text.replace(/^[^\S\r\n]+/u, '')
          : fragment.text;
      return combined + text;
    }, '');
  return translationHookSuccess(normalizeTranslationResultText(primaryText));
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
    const resultRegions = await getVisibleLocators(this.page.locator(GOOGLE_RESULT_REGION_SELECTOR));
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
      const stateKey = '__gptVoiceGoogleTranslationEpochState__';
      type PageEpochState = { epoch: number; mutations: number; observer: MutationObserver | null };
      const pageState = globalThis as typeof globalThis & { [stateKey]?: PageEpochState };
      pageState[stateKey]?.observer?.disconnect();
      const state: PageEpochState = {
        epoch: (pageState[stateKey]?.epoch ?? 0) + 1,
        mutations: 0,
        observer: null,
      };
      state.observer = new MutationObserver((records) => {
        const regions = Array.from(
          document.querySelectorAll('[role="region"][aria-label="Translation results"], [class~="sciAJc"]'),
        );
        if (records.some((record) => regions.some((region) => region.contains(record.target)))) state.mutations += 1;
      });
      state.observer.observe(document.body, { characterData: true, childList: true, subtree: true });
      pageState[stateKey] = state;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.apply supplies the textarea receiver.
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!valueSetter) throw new Error('Native textarea value setter unavailable');
      Reflect.apply(valueSetter, textarea, [value]);
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    }, sourceText);
    return true;
  }

  async readResultSnapshot(): Promise<GoogleResultSnapshot> {
    const regions = await getVisibleLocators(this.page.locator(GOOGLE_RESULT_REGION_SELECTOR));
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
          text: fragment instanceof HTMLElement ? fragment.innerText : (fragment.textContent ?? ''),
          visible: (() => {
            const style = window.getComputedStyle(fragment);
            return style.display !== 'none' && style.visibility !== 'hidden' && fragment.getClientRects().length > 0;
          })(),
        };
      });
    }, GOOGLE_RESULT_FRAGMENT_SELECTOR);
    return { fragments, visibleResultRegions: 1 };
  }

  async readResultObservationSnapshot(): Promise<GoogleResultObservationSnapshot> {
    const snapshot = await this.page.evaluate(
      ({ fragmentSelector, regionSelector, sourceSelector }) => {
        const isVisible = (element: Element): boolean => {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        };
        const regions = Array.from(document.querySelectorAll(regionSelector)).filter(isVisible);
        const region = regions.length === 1 ? regions[0] : null;
        return {
          rawUrl: window.location.href,
          resultMutationCount:
            (
              globalThis as typeof globalThis & {
                __gptVoiceGoogleTranslationEpochState__?: { mutations: number };
              }
            ).__gptVoiceGoogleTranslationEpochState__?.mutations ?? null,
          result: {
            fragments: region
              ? Array.from(region.querySelectorAll(fragmentSelector)).map((fragment) => {
                  let primaryBranch: Element | null = fragment;
                  while (primaryBranch?.parentElement && primaryBranch.parentElement !== region) {
                    primaryBranch = primaryBranch.parentElement;
                  }
                  return {
                    branchIndex:
                      primaryBranch?.parentElement === region ? Array.from(region.children).indexOf(primaryBranch) : -1,
                    insideListItem: fragment.closest('[role="listitem"]') !== null,
                    text: fragment instanceof HTMLElement ? fragment.innerText : (fragment.textContent ?? ''),
                    visible: isVisible(fragment),
                  };
                })
              : [],
            visibleResultRegions: regions.length,
          },
          sourceValue: document.querySelector<HTMLTextAreaElement>(sourceSelector)?.value ?? null,
          submissionEpoch:
            (
              globalThis as typeof globalThis & {
                __gptVoiceGoogleTranslationEpochState__?: { epoch: number };
              }
            ).__gptVoiceGoogleTranslationEpochState__?.epoch ?? null,
        };
      },
      {
        fragmentSelector: GOOGLE_RESULT_FRAGMENT_SELECTOR,
        regionSelector: GOOGLE_RESULT_REGION_SELECTOR,
        sourceSelector: GOOGLE_SOURCE_SELECTOR,
      },
    );
    return {
      ...(snapshot.resultMutationCount === null ? {} : { resultMutationCount: snapshot.resultMutationCount }),
      result: snapshot.result,
      route: createGoogleRouteSnapshot(snapshot.rawUrl),
      sourceValue: snapshot.sourceValue,
      ...(snapshot.submissionEpoch === null ? {} : { submissionEpoch: snapshot.submissionEpoch }),
    };
  }

  /** Waits on browser frames for a public result candidate; it never returns translated text. */
  async waitForResultCandidate(timeoutMs: number): Promise<boolean> {
    if (timeoutMs <= 0) return false;
    try {
      await this.page.waitForFunction(
        ({ fragmentSelector, regionSelector }) => {
          const isVisible = (element: Element): boolean => {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
          };
          const regions = Array.from(document.querySelectorAll(regionSelector)).filter(isVisible);
          const region = regions.length === 1 ? regions[0] : null;
          if (!region) return false;
          const hasVisibleText = Array.from(region.querySelectorAll(fragmentSelector)).some(
            (fragment) => isVisible(fragment) && (fragment.textContent ?? '').trim().length > 0,
          );
          return hasVisibleText;
        },
        {
          fragmentSelector: GOOGLE_RESULT_FRAGMENT_SELECTOR,
          regionSelector: GOOGLE_RESULT_REGION_SELECTOR,
        },
        { polling: 'raf', timeout: timeoutMs },
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TimeoutError') return false;
      throw error;
    }
  }

  async clearSourceWithKeyboard(): Promise<boolean> {
    const sourceControls = await getVisibleLocators(this.page.locator(GOOGLE_SOURCE_SELECTOR));
    const source = sourceControls[0];
    if (sourceControls.length !== 1 || !source?.enabled || !source.editable) return false;
    await source.locator.focus();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    return true;
  }
}

export function createPlaywrightGoogleTranslatePageAdapter(page: Page): GoogleTranslatePageAdapter {
  return new PlaywrightGoogleTranslatePageAdapter(page);
}

/** Unregistered Google public-page implementation of the shared translation lifecycle. */
export class GoogleTranslateProvider extends BaseTranslateProvider {
  private readonly adapters = new WeakMap<Page, GoogleTranslatePageAdapter>();
  private readonly createPageAdapter: GoogleTranslatePageAdapterFactory;
  private readonly expectedTargets = new WeakMap<Page, string>();
  private readonly previousResults = new WeakMap<Page, string>();
  private readonly preparedPages = new WeakSet<Page>();
  private readonly submissions = new WeakMap<
    Page,
    { readonly epoch: number; readonly previousResult: string; readonly sourceText: string }
  >();
  private readonly submissionEpochs = new WeakMap<Page, number>();
  private readonly onNavigationRetry?: (event: BrowserNavigationRetryEvent) => void;

  constructor(dependencies: GoogleTranslateProviderDependencies) {
    super(TRANSLATION_PROVIDER_INFO.google, {
      ...dependencies,
      resultPollIntervalMs: Math.min(dependencies.resultPollIntervalMs, GOOGLE_RESULT_FALLBACK_POLL_INTERVAL_MS),
    });
    this.createPageAdapter = dependencies.createPageAdapter;
    this.onNavigationRetry = dependencies.onNavigationRetry;
  }

  protected async navigateAndHandleConsent(page: Page, targetLanguage: string): Promise<TranslationProviderHookResult> {
    const adapter = this.getAdapter(page);
    if (this.preparedPages.has(page)) {
      const route = await adapter.readRouteSnapshot();
      if (routeMatchesTranslationState(route, targetLanguage)) {
        this.expectedTargets.set(page, targetLanguage);
        return translationHookSuccess();
      }
      if (route.origin !== 'translator' || route.route !== 'translator') {
        return translationHookFailure('consentOrChallenge');
      }
    }

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
      this.preparedPages.add(page);
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
    this.preparedPages.add(page);
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
    this.previousResults.set(page, previousResult.value);
    return translationHookSuccess(previousResult.value);
  }

  protected async insertSourceText(page: Page, sourceText: string): Promise<TranslationProviderHookResult> {
    const epoch = (this.submissionEpochs.get(page) ?? 0) + 1;
    this.submissionEpochs.set(page, epoch);
    const submission = {
      epoch,
      previousResult: this.previousResults.get(page) ?? '',
      sourceText,
    };
    this.submissions.set(page, submission);
    if (await this.getAdapter(page).insertSourceText(sourceText)) return translationHookSuccess();
    this.submissions.delete(page);
    return translationHookFailure('pageContractFailure');
  }

  protected async readNormalizedResult(page: Page): Promise<TranslationProviderHookResult<string>> {
    return classifyGoogleResultSnapshot(await this.getAdapter(page).readResultSnapshot());
  }

  protected override async observeResult(
    page: Page,
    targetLanguage: string,
  ): Promise<TranslationProviderHookResult<TranslationProviderResultObservation>> {
    const adapter = this.getAdapter(page);
    if (!adapter.readResultObservationSnapshot) return super.observeResult(page, targetLanguage);
    const snapshot = await adapter.readResultObservationSnapshot();
    const result = classifyGoogleResultSnapshot(snapshot.result);
    if (!result.success) return result;
    if (snapshot.route.origin !== 'translator' || snapshot.route.route !== 'translator') {
      return translationHookFailure('consentOrChallenge');
    }
    if (!routeMatchesTranslationState(snapshot.route, targetLanguage)) {
      return translationHookFailure('pageContractFailure');
    }
    const submission = this.submissions.get(page);
    const sourceMatches = snapshot.sourceValue === undefined || snapshot.sourceValue === submission?.sourceText;
    const epochMatches = snapshot.submissionEpoch === undefined || snapshot.submissionEpoch === submission?.epoch;
    const generation =
      !submission || !sourceMatches || !epochMatches
        ? 'unavailable'
        : result.value !== submission.previousResult
          ? 'changed-after-submission'
          : (snapshot.resultMutationCount ?? 0) > 0
            ? 'renewed-identical'
            : 'unavailable';
    return translationHookSuccess({
      completion: 'unavailable',
      generation,
      targetVerified: true,
      text: result.value,
    });
  }

  protected override readonly waitForResultCandidate = async (
    page: Page,
    _targetLanguage: string,
    timeoutMs: number,
  ): Promise<TranslationProviderHookResult<boolean>> => {
    const adapter = this.getAdapter(page);
    if (!adapter.waitForResultCandidate) return translationHookSuccess(false);
    return translationHookSuccess(await adapter.waitForResultCandidate(timeoutMs));
  };

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
    return (await this.getAdapter(page).clearSourceWithKeyboard())
      ? translationHookSuccess()
      : translationHookFailure('cleanupFailure');
  }

  protected override retainResourceOnTerminalFailure(): boolean {
    return true;
  }

  protected override deliverResultBeforeVisibleCleanup(): boolean {
    return true;
  }

  protected override async isActiveResourceHealthy(page: Page): Promise<boolean> {
    const targetLanguage = this.expectedTargets.get(page);
    if (!targetLanguage) return false;
    const route = await this.getAdapter(page).readRouteSnapshot();
    return (
      route.origin === 'translator' &&
      route.route === 'translator' &&
      routeMatchesTranslationState(route, targetLanguage)
    );
  }

  private getAdapter(page: Page): GoogleTranslatePageAdapter {
    const current = this.adapters.get(page);
    if (current) return current;
    const adapter = this.createPageAdapter(page);
    this.adapters.set(page, adapter);
    return adapter;
  }
}
