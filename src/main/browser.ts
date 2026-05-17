import type { BrowserContext, Page } from 'playwright-core';
import { BROWSER_CACHE_DIR, currentProvider, currentTranslate, getFingerprintSeed, setProvider } from './config';
import { createProvider, type BaseVoiceProvider } from './providers';
import { launchCloakContext, launchCloakPersistentContext } from './cloakbrowser';
import { createLogger } from './logger';
import { t } from './i18n';

const log = createLogger('browser');

let bgContext: BrowserContext | null = null;
let translatePage: Page | null = null;
let activeProvider: BaseVoiceProvider | null = null;
let bgReady = false;
let bgError = '';
let bgAuthExpired = false;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const VIEWPORT = { width: 1366, height: 768 };
const GOOGLE_TRANSLATE_URL = 'https://translate.google.ru/?sl=auto&tl=en&op=translate';

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
}

export function getBackgroundBrowserStatus(): BackgroundBrowserStatus {
  return { ready: bgReady, error: bgError || undefined, authExpired: bgAuthExpired || undefined };
}

export function getTranslatePage(): Page | null {
  return translatePage;
}

export function getActiveProvider(): BaseVoiceProvider | null {
  return activeProvider;
}

function getCloakContextOptions(headless: boolean) {
  return {
    headless,
    userAgent: USER_AGENT,
    viewport: VIEWPORT,
    locale: 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    args: [`--fingerprint=${getFingerprintSeed()}`],
  };
}

export function launchLoginContext(): Promise<BrowserContext> {
  return launchCloakContext(getCloakContextOptions(false));
}

async function ensureTranslateContext(): Promise<BrowserContext> {
  if (bgContext) return bgContext;

  log.info('Launching persistent browser for translation...');
  bgContext = await launchCloakPersistentContext({
    userDataDir: BROWSER_CACHE_DIR,
    ...getCloakContextOptions(true),
  });
  return bgContext;
}

async function initTranslatePage(context: BrowserContext): Promise<void> {
  translatePage = await context.newPage();
  log.info('Navigating to Google Translate...');
  await translatePage.goto(GOOGLE_TRANSLATE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
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
      await translatePage.goto(GOOGLE_TRANSLATE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
    }
  }
  log.info('Google Translate page loaded');
}

export async function initBackgroundBrowser(
  options: EnsureBackgroundBrowserOptions = {},
): Promise<BackgroundBrowserStatus> {
  const includeTranslate = options.includeTranslate ?? currentTranslate;

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
      log.info('Launching persistent background browser...');
      bgContext = await launchCloakPersistentContext({
        userDataDir: BROWSER_CACHE_DIR,
        ...getCloakContextOptions(true),
      });

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

    if (includeTranslate && currentTranslate) {
      await initTranslatePage(await ensureTranslateContext());
    }

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
  const includeTranslate = options.includeTranslate ?? currentTranslate;

  if (bgReady && activeProvider?.isReady()) {
    if (!includeTranslate || !currentTranslate || translatePage) return;
    await initTranslatePage(await ensureTranslateContext());
    return;
  }
  await initBackgroundBrowser({ includeTranslate });
}

export async function switchProvider(providerId: string): Promise<BackgroundBrowserStatus> {
  createProvider(providerId);
  setProvider(providerId);
  await shutdownBackgroundBrowser();
  return initBackgroundBrowser();
}
