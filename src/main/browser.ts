import type { BrowserContext, Page } from 'playwright-core';
import {
  createCloakBrowserLoginContextOptions,
  createCloakBrowserPersistentContextOptions,
} from '@main/cloakBrowserLaunchOptions';
import type { CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';
import { launchCloakContext, launchCloakPersistentContext } from '@main/cloakbrowser';
import { currentProvider, currentTargetLang, setProvider } from '@main/config';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { createProvider, type BaseVoiceProvider } from '@main/providers';
import {
  buildGoogleTranslateUrl,
  GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
  normalizeGoogleTranslateTargetLang,
} from '@main/services/translationUtils';

const log = createLogger('browser');

let bgContext: BrowserContext | null = null;
let translatePage: Page | null = null;
let translatePageTargetLang = '';
let activeProvider: BaseVoiceProvider | null = null;
let bgReady = false;
let bgError = '';
let bgAuthExpired = false;

export function isBgReady(): boolean {
  return bgReady;
}

export interface BackgroundBrowserStatus {
  ready: boolean;
  error?: string;
  authExpired?: boolean;
}

interface EnsureBackgroundBrowserOptions {
  includeTranslate?: boolean;
  translateTargetLang?: string;
  cloakBrowserSettings?: CloakBrowserSettingsWithSecret;
}

export function getBackgroundBrowserStatus(): BackgroundBrowserStatus {
  return { ready: bgReady, error: bgError || undefined, authExpired: bgAuthExpired || undefined };
}

export function getTranslatePage(): Page | null {
  return translatePage;
}

export function getTranslatePageTargetLang(): string | null {
  if (!translatePage || translatePage.isClosed()) return null;
  return translatePageTargetLang || null;
}

export function setTranslatePageTargetLang(targetLang: string): void {
  translatePageTargetLang = normalizeGoogleTranslateTargetLang(targetLang);
}

export function getActiveProvider(): BaseVoiceProvider | null {
  return activeProvider;
}

export function launchLoginContext(): Promise<BrowserContext> {
  return launchCloakContext(createCloakBrowserLoginContextOptions());
}

async function ensureTranslateContext(settings?: CloakBrowserSettingsWithSecret): Promise<BrowserContext> {
  if (bgContext) return bgContext;

  log.info('Launching persistent browser for translation...');
  bgContext = await launchCloakPersistentContext(createCloakBrowserPersistentContextOptions(settings));
  return bgContext;
}

async function initTranslatePage(context: BrowserContext, targetLang = currentTargetLang): Promise<void> {
  const normalizedTargetLang = normalizeGoogleTranslateTargetLang(targetLang);
  const url = buildGoogleTranslateUrl(normalizedTargetLang);

  translatePage = await context.newPage();
  log.info('Navigating to Google Translate:', { targetLang: normalizedTargetLang });
  await translatePage.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
  });

  // Handle Google cookie consent if redirected
  if (translatePage.url().includes('consent.google')) {
    log.info('Cookie consent detected, accepting...');
    const acceptBtn = translatePage.locator(
      'button:has-text("Accept all"), button:has-text("Принять все"), button:has-text("Alle akzeptieren")',
    );
    try {
      await acceptBtn.first().click({ timeout: 5000 });
      await translatePage.waitForURL('**/translate.google.*', { timeout: 10000 });
      await translatePage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    } catch {
      log.warn('Could not auto-accept consent, retrying navigation...');
      await translatePage.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
      });
    }
  }
  translatePageTargetLang = normalizedTargetLang;
  log.info('Google Translate page loaded');
}

export async function initBackgroundBrowser(
  options: EnsureBackgroundBrowserOptions = {},
): Promise<BackgroundBrowserStatus> {
  const includeTranslate = options.includeTranslate ?? false;
  const translateTargetLang = options.translateTargetLang ?? currentTargetLang;
  const { cloakBrowserSettings } = options;

  bgReady = false;
  bgError = '';
  bgAuthExpired = false;

  try {
    activeProvider = createProvider(currentProvider);
  } catch (err: unknown) {
    bgError = err instanceof Error ? err.message : String(err);
    log.error('Provider init error:', bgError);
    return getBackgroundBrowserStatus();
  }

  if (!activeProvider.hasSession()) {
    log.info('No provider session/settings, skipping background browser init');
    return getBackgroundBrowserStatus();
  }

  try {
    if (activeProvider.requiresBrowserSession()) {
      log.info('Ensuring persistent background browser...');
      bgContext = await ensureTranslateContext(cloakBrowserSettings);

      // Load session cookies and initialize provider page
      const sessionLoaded = await activeProvider.loadSession(bgContext);
      if (!sessionLoaded) {
        bgAuthExpired = true;
        bgError = t('error.noAccessToken');
        activeProvider.clearSession();
        await shutdownBackgroundBrowser(true);
        return getBackgroundBrowserStatus();
      }

      await activeProvider.initPage(bgContext);
      if (!activeProvider.isReady()) {
        bgAuthExpired = true;
        activeProvider.clearSession();
        throw new Error(t('error.noAccessToken'));
      }
    } else if (!activeProvider.isReady()) {
      throw new Error(t('error.noAccessToken'));
    }

    if (includeTranslate) await ensureTranslateBrowser(translateTargetLang, cloakBrowserSettings);

    bgReady = true;
    log.info('Background browser ready');
    return getBackgroundBrowserStatus();
  } catch (err: unknown) {
    bgError = err instanceof Error ? err.message : String(err);
    log.error('Init error:', bgError);
    await shutdownBackgroundBrowser(true);
    return getBackgroundBrowserStatus();
  }
}

export async function shutdownBackgroundBrowser(preserveError = false): Promise<void> {
  bgReady = false;
  if (!preserveError) {
    bgError = '';
    bgAuthExpired = false;
  }
  if (activeProvider) {
    await activeProvider.shutdown();
  }
  translatePage = null;
  translatePageTargetLang = '';
  if (bgContext) {
    try {
      log.info('Shutting down background browser...');
      await bgContext.close();
      log.info('Background browser closed');
    } catch {
      /* ignore */
    }
    bgContext = null;
  }
}

export async function ensureBackgroundBrowser(options: EnsureBackgroundBrowserOptions = {}): Promise<void> {
  const includeTranslate = options.includeTranslate ?? false;
  const translateTargetLang = options.translateTargetLang ?? currentTargetLang;
  const { cloakBrowserSettings } = options;

  if (bgReady && activeProvider?.isReady()) {
    if (!includeTranslate) return;
    if (translatePage && !translatePage.isClosed()) return;
    translatePage = null;
    translatePageTargetLang = '';
    await ensureTranslateBrowser(translateTargetLang, cloakBrowserSettings);
    return;
  }
  await initBackgroundBrowser({ includeTranslate, translateTargetLang, cloakBrowserSettings });
}

export async function ensureTranslateBrowser(
  targetLang = currentTargetLang,
  settings?: CloakBrowserSettingsWithSecret,
): Promise<void> {
  const normalizedTargetLang = normalizeGoogleTranslateTargetLang(targetLang);
  const context = await ensureTranslateContext(settings);

  if (!translatePage || translatePage.isClosed()) {
    await initTranslatePage(context, normalizedTargetLang);
    return;
  }

  if (translatePageTargetLang !== normalizedTargetLang) return;
  await translatePage
    .waitForLoadState('domcontentloaded', { timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS })
    .catch(() => {});
}

export async function switchProvider(providerId: string): Promise<BackgroundBrowserStatus> {
  createProvider(providerId);
  setProvider(providerId);
  await shutdownBackgroundBrowser();
  return initBackgroundBrowser();
}
