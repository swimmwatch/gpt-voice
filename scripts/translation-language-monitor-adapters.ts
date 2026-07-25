import type { Locator, Page } from 'playwright-core';
import {
  ProbeFailure,
  type BingProbeSnapshot,
  type GoogleProbeSnapshot,
  type ProbeProviderId,
  type ProbeSession,
  type PublicLanguageCandidate,
  type ProviderProbeSnapshot,
  type YandexProbeSnapshot,
} from './translation-language-monitor-core';

export const TRANSLATION_PROBE_SELECTORS = Object.freeze({
  google: Object.freeze({
    group: '[role="group"]',
    listbox: '[role="listbox"]',
    opener: 'button[aria-label="More target languages"]',
    option: '[role="option"][data-language-code]',
    search: 'input[aria-label="Search languages"]',
  }),
  bing: Object.freeze({
    canonicalGroup: '#tta_tgtsl > optgroup#t_tgtAllLang',
    canonicalOption: '#tta_tgtsl optgroup#t_tgtAllLang > option',
    targetSelect: '#tta_tgtsl',
  }),
  yandex: Object.freeze({
    opener: 'button[aria-label^="Choose target language"]',
    option: '[data-lang-element="true"][data-value][role="checkbox"][aria-label]',
    search: 'input[placeholder="Search languages"]',
  }),
});

const TRANSLATION_PROBE_URLS: Readonly<Record<ProbeProviderId, string>> = {
  google: 'https://translate.google.com/?sl=auto&tl=en&op=translate&hl=en',
  bing: 'https://www.bing.com/translator',
  yandex: 'https://translate.yandex.com/en/translator',
};

const CHALLENGE_SELECTOR =
  'iframe[src*="captcha" i], [aria-label*="captcha" i], [data-testid*="captcha" i], [role="dialog"][aria-label*="challenge" i]';
const BUSY_SELECTOR = '[aria-busy="true"], [role="progressbar"]';

async function visibleLocators(locator: Locator): Promise<Locator[]> {
  const visible: Locator[] = [];
  for (let index = 0; index < (await locator.count()); index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible()) visible.push(candidate);
  }
  return visible;
}

async function visibleCount(locator: Locator): Promise<number> {
  return (await visibleLocators(locator)).length;
}

async function hasVisible(page: Page, selector: string): Promise<boolean> {
  return (await visibleCount(page.locator(selector))) > 0;
}

function parseUrl(rawUrl: string): URL {
  try {
    return new URL(rawUrl);
  } catch {
    throw new ProbeFailure('unexpected-origin');
  }
}

function hasBlockedRoute(url: URL): boolean {
  return /(?:^|\/)(?:login|signin|challenge|captcha)(?:\/|$)/iu.test(url.pathname);
}

async function isChallengeVisible(page: Page): Promise<boolean> {
  const url = parseUrl(page.url());
  return hasBlockedRoute(url) || hasVisible(page, CHALLENGE_SELECTOR);
}

async function isBusy(page: Page): Promise<boolean> {
  return hasVisible(page, BUSY_SELECTOR);
}

/** Checks one top-level location against the fixed researched translator routes. */
export function isAllowedTranslationProbeLocation(providerId: ProbeProviderId, rawUrl: string): boolean {
  let url: URL;
  try {
    url = parseUrl(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || hasBlockedRoute(url)) return false;
  switch (providerId) {
    case 'google':
      return (
        (url.hostname === 'translate.google.com' || url.hostname === 'translate.google.ru') && url.pathname === '/'
      );
    case 'bing':
      return url.hostname === 'www.bing.com' && (url.pathname === '/translator' || url.pathname === '/translator/');
    case 'yandex':
      return (
        url.hostname === 'translate.yandex.com' &&
        (url.pathname === '/en/translator' ||
          url.pathname === '/en/translator/' ||
          url.pathname === '/en' ||
          url.pathname === '/en/')
      );
  }
}

function assertTranslatorOrigin(providerId: ProbeProviderId, rawUrl: string): void {
  if (!isAllowedTranslationProbeLocation(providerId, rawUrl)) throw new ProbeFailure('unexpected-origin');
}

async function navigate(page: Page, providerId: ProbeProviderId): Promise<void> {
  try {
    await page.goto(TRANSLATION_PROBE_URLS[providerId], {
      timeout: 30_000,
      waitUntil: 'domcontentloaded',
    });
  } catch {
    throw new ProbeFailure('navigation-failure');
  }
}

async function handleGoogleConsent(page: Page): Promise<void> {
  const url = parseUrl(page.url());
  const consentOrigin =
    url.protocol === 'https:' && (url.hostname === 'consent.google.com' || url.hostname === 'consent.google.ru');
  if (!consentOrigin) return;
  const rejectButtons = await visibleLocators(page.locator('button[jsname="tWT92d"][aria-label="Reject all"]'));
  if (rejectButtons.length !== 1) throw new ProbeFailure('consent-or-challenge');
  try {
    await rejectButtons[0].click();
    await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
  } catch {
    throw new ProbeFailure('consent-or-challenge');
  }
}

async function handleYandexConsent(page: Page): Promise<void> {
  const essentialButtons = await visibleLocators(page.getByRole('button', { name: 'Allow essential cookies' }));
  const allowAllVisible = await hasVisible(page, 'button:has-text("Allow all")');
  if (essentialButtons.length === 0) {
    if (allowAllVisible) throw new ProbeFailure('consent-or-challenge');
    return;
  }
  if (essentialButtons.length !== 1) throw new ProbeFailure('consent-or-challenge');
  try {
    await essentialButtons[0].click();
  } catch {
    throw new ProbeFailure('consent-or-challenge');
  }
}

async function rejectUnexpectedBingOverlay(page: Page): Promise<void> {
  if (await hasVisible(page, '#bnp_container, [role="dialog"][aria-label*="cookie" i]')) {
    throw new ProbeFailure('consent-or-challenge');
  }
}

async function openUnique(page: Page, selector: string): Promise<Locator> {
  const openers = await visibleLocators(page.locator(selector));
  if (openers.length !== 1) throw new ProbeFailure('page-contract-failure');
  try {
    await openers[0].click();
  } catch {
    throw new ProbeFailure('page-contract-failure');
  }
  return openers[0];
}

async function installGoogleMutationCounter(page: Page): Promise<void> {
  await page.evaluate((groupSelector) => {
    const state = globalThis as typeof globalThis & {
      __gptVoiceTranslationProbeMutation?: { count: number; observer: MutationObserver };
    };
    state.__gptVoiceTranslationProbeMutation?.observer.disconnect();
    const groups = [...document.querySelectorAll(groupSelector)].filter((element) => {
      const htmlElement = element as HTMLElement;
      const style = getComputedStyle(htmlElement);
      return htmlElement.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (groups.length !== 1) {
      delete state.__gptVoiceTranslationProbeMutation;
      return;
    }
    const probeState = {
      count: 0,
      observer: new MutationObserver(() => {
        probeState.count += 1;
      }),
    };
    probeState.observer.observe(groups[0], { attributes: true, childList: true, subtree: true });
    state.__gptVoiceTranslationProbeMutation = probeState;
  }, TRANSLATION_PROBE_SELECTORS.google.group);
}

async function prepareGoogle(page: Page): Promise<void> {
  await navigate(page, 'google');
  await handleGoogleConsent(page);
  assertTranslatorOrigin('google', page.url());
  if (await isChallengeVisible(page)) throw new ProbeFailure('consent-or-challenge');
  await openUnique(page, TRANSLATION_PROBE_SELECTORS.google.opener);
  if (!(await verifyGoogleTerminalTraversal(page))) throw new ProbeFailure('page-contract-failure');
  await installGoogleMutationCounter(page);
}

async function prepareBing(page: Page): Promise<void> {
  await navigate(page, 'bing');
  assertTranslatorOrigin('bing', page.url());
  await rejectUnexpectedBingOverlay(page);
  if (await isChallengeVisible(page)) throw new ProbeFailure('consent-or-challenge');
}

async function prepareYandex(page: Page): Promise<void> {
  await navigate(page, 'yandex');
  assertTranslatorOrigin('yandex', page.url());
  if (await isChallengeVisible(page)) throw new ProbeFailure('consent-or-challenge');
  await handleYandexConsent(page);
  assertTranslatorOrigin('yandex', page.url());
  if (await isChallengeVisible(page)) throw new ProbeFailure('consent-or-challenge');
  await openUnique(page, TRANSLATION_PROBE_SELECTORS.yandex.opener);
}

async function readGoogleOptions(page: Page): Promise<PublicLanguageCandidate[]> {
  const groups = await visibleLocators(page.locator(TRANSLATION_PROBE_SELECTORS.google.group));
  if (groups.length !== 1) return [];
  const options = groups[0].locator(TRANSLATION_PROBE_SELECTORS.google.option);
  const candidates: PublicLanguageCandidate[] = [];
  for (let index = 0; index < (await options.count()); index += 1) {
    const option = options.nth(index);
    candidates.push({
      code: (await option.getAttribute('data-language-code')) ?? '',
      label: (await option.getAttribute('aria-label')) ?? '',
      visible: await option.isVisible(),
    });
  }
  return candidates;
}

async function verifyGoogleTerminalTraversal(page: Page): Promise<boolean> {
  const groups = await visibleLocators(page.locator(TRANSLATION_PROBE_SELECTORS.google.group));
  if (groups.length !== 1) return false;
  const options = groups[0].locator(TRANSLATION_PROBE_SELECTORS.google.option);
  const count = await options.count();
  if (count === 0) return false;
  try {
    await options.first().focus();
    await page.keyboard.press('End');
    const terminalVisible = await options.nth(count - 1).isVisible();
    await page.keyboard.press('Home');
    return terminalVisible;
  } catch {
    return false;
  }
}

async function readGoogleSnapshot(page: Page): Promise<GoogleProbeSnapshot> {
  return {
    busy: await isBusy(page),
    challenge: await isChallengeVisible(page),
    documentReadyState: await page.evaluate(() => document.readyState),
    groupCount: await visibleCount(page.locator(TRANSLATION_PROBE_SELECTORS.google.group)),
    listboxCount: await visibleCount(page.locator(TRANSLATION_PROBE_SELECTORS.google.listbox)),
    mutationVersion: await page.evaluate(() => {
      const state = globalThis as typeof globalThis & {
        __gptVoiceTranslationProbeMutation?: { count: number };
      };
      return state.__gptVoiceTranslationProbeMutation?.count ?? 0;
    }),
    openerCount: await visibleCount(page.locator(TRANSLATION_PROBE_SELECTORS.google.opener)),
    options: await readGoogleOptions(page),
    originAllowed: (() => {
      try {
        assertTranslatorOrigin('google', page.url());
        return true;
      } catch {
        return false;
      }
    })(),
    providerId: 'google',
    searchInputCount: await visibleCount(page.locator(TRANSLATION_PROBE_SELECTORS.google.search)),
    terminalTraversalComplete: true,
  };
}

async function readBingSnapshot(page: Page): Promise<BingProbeSnapshot> {
  const targetSelects = await visibleLocators(page.locator(TRANSLATION_PROBE_SELECTORS.bing.targetSelect));
  const canonicalGroups =
    targetSelects.length === 1 ? targetSelects[0].locator(':scope > optgroup#t_tgtAllLang') : page.locator(':not(*)');
  const canonicalOptions = canonicalGroups.locator(':scope > option');
  const candidates: PublicLanguageCandidate[] = [];
  for (let index = 0; index < (await canonicalOptions.count()); index += 1) {
    const option = canonicalOptions.nth(index);
    candidates.push({
      code: (await option.getAttribute('value')) ?? '',
      enabled: (await option.getAttribute('disabled')) === null,
      label: ((await option.textContent()) ?? '').trim(),
    });
  }
  return {
    busy: await isBusy(page),
    canonicalGroupCount: await canonicalGroups.count(),
    canonicalOptions: candidates,
    challenge: await isChallengeVisible(page),
    originAllowed: (() => {
      try {
        assertTranslatorOrigin('bing', page.url());
        return true;
      } catch {
        return false;
      }
    })(),
    providerId: 'bing',
    targetSelectCount: targetSelects.length,
    targetSelectEnabled: targetSelects.length === 1 ? await targetSelects[0].isEnabled() : false,
    targetSelectVisible: targetSelects.length === 1,
  };
}

async function readYandexSnapshot(page: Page): Promise<YandexProbeSnapshot> {
  const options = page.locator(TRANSLATION_PROBE_SELECTORS.yandex.option);
  const candidates: PublicLanguageCandidate[] = [];
  for (let index = 0; index < (await options.count()); index += 1) {
    const option = options.nth(index);
    candidates.push({
      code: (await option.getAttribute('data-value')) ?? '',
      label: (await option.getAttribute('aria-label')) ?? '',
      visible: await option.isVisible(),
    });
  }
  return {
    busy: await isBusy(page),
    challenge: await isChallengeVisible(page),
    openerCount: await visibleCount(page.locator(TRANSLATION_PROBE_SELECTORS.yandex.opener)),
    options: candidates,
    originAllowed: (() => {
      try {
        assertTranslatorOrigin('yandex', page.url());
        return true;
      } catch {
        return false;
      }
    })(),
    providerId: 'yandex',
    searchInputCount: await visibleCount(page.locator(TRANSLATION_PROBE_SELECTORS.yandex.search)),
  };
}

async function prepare(page: Page, providerId: ProbeProviderId): Promise<void> {
  switch (providerId) {
    case 'google':
      await prepareGoogle(page);
      return;
    case 'bing':
      await prepareBing(page);
      return;
    case 'yandex':
      await prepareYandex(page);
  }
}

async function readSnapshot(page: Page, providerId: ProbeProviderId): Promise<ProviderProbeSnapshot> {
  try {
    switch (providerId) {
      case 'google':
        return await readGoogleSnapshot(page);
      case 'bing':
        return await readBingSnapshot(page);
      case 'yandex':
        return await readYandexSnapshot(page);
    }
  } catch (error: unknown) {
    if (error instanceof ProbeFailure) throw error;
    throw new ProbeFailure('page-contract-failure');
  }
}

export function createPlaywrightProbeSession(options: {
  readonly closeContext: () => Promise<void>;
  readonly closePage: () => Promise<void>;
  readonly page: Page;
  readonly providerId: ProbeProviderId;
}): ProbeSession {
  return {
    closeContext: options.closeContext,
    closePage: options.closePage,
    prepare: () => prepare(options.page, options.providerId),
    readSnapshot: () => readSnapshot(options.page, options.providerId),
  };
}
