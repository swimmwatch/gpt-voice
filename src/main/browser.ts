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
import { BrowserNavigationService, retryBrowserNavigation } from '@main/browserNavigationRetry';
import { createProvider, type BaseVoiceProvider } from '@main/providers';
import {
  buildGoogleTranslateUrl,
  GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
  normalizeGoogleTranslateTargetLang,
} from '@main/services/translationUtils';
import { presentNotificationError } from '@shared/notifications';
import { runBeforeBackgroundBrowserShutdownHooks } from '@main/backgroundBrowserLifecycle';
import { BackgroundBrowserOperationQueue } from '@main/backgroundBrowserOperationQueue';

const log = createLogger('browser');

let bgContext: BrowserContext | null = null;
let translatePage: Page | null = null;
let translatePageTargetLang = '';
let activeProvider: BaseVoiceProvider | null = null;
let bgReady = false;
let bgError = '';
let bgAuthExpired = false;
const backgroundBrowserOperationQueue = new BackgroundBrowserOperationQueue();

export function isBgReady(): boolean {
  return bgReady;
}

export interface BackgroundBrowserStatus {
  providerId?: string;
  ready: boolean;
  error?: string;
  authExpired?: boolean;
}

export enum BrowserSessionStartupState {
  Expired = 'expired',
  Ready = 'ready',
  TemporaryFailure = 'temporaryFailure',
}

interface EnsureBackgroundBrowserOptions {
  includeTranslate?: boolean;
  translateTargetLang?: string;
  cloakBrowserSettings?: CloakBrowserSettingsWithSecret;
}

export function getBrowserSessionStartupState({
  providerReady,
  sessionLoaded,
}: {
  providerReady: boolean;
  sessionLoaded: boolean;
}): BrowserSessionStartupState {
  if (!sessionLoaded) return BrowserSessionStartupState.Expired;
  return providerReady ? BrowserSessionStartupState.Ready : BrowserSessionStartupState.TemporaryFailure;
}

export function getBrowserSessionStartupError(providerReadinessError: string | null): string {
  return providerReadinessError || t('error.noAccessToken');
}

export function getBackgroundBrowserStatus(): BackgroundBrowserStatus {
  return {
    providerId: currentProvider,
    ready: bgReady,
    error: bgError || undefined,
    authExpired: bgAuthExpired || undefined,
  };
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

  log.info('Launching persistent background browser...');
  bgContext = await launchCloakPersistentContext(createCloakBrowserPersistentContextOptions(settings));
  return bgContext;
}

async function navigateTranslatePage(page: Page, targetLang: string): Promise<void> {
  const normalizedTargetLang = normalizeGoogleTranslateTargetLang(targetLang);
  const url = buildGoogleTranslateUrl(normalizedTargetLang);

  log.info('Navigating to Google Translate:', { targetLang: normalizedTargetLang });
  await retryBrowserNavigation(
    {
      navigate: () =>
        page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
        }),
      service: BrowserNavigationService.GoogleTranslate,
    },
    {
      onRetry: (event) => log.warn('Retrying Google Translate page navigation:', event),
    },
  );

  // Handle Google cookie consent if redirected
  if (page.url().includes('consent.google')) {
    log.info('Cookie consent detected, accepting...');
    const acceptBtn = page.locator(
      'button:has-text("Accept all"), button:has-text("Принять все"), button:has-text("Alle akzeptieren")',
    );
    try {
      await acceptBtn.first().click({ timeout: 5000 });
      await page.waitForURL('**/translate.google.*', { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    } catch {
      log.warn('Could not auto-accept consent, retrying navigation...');
      await retryBrowserNavigation(
        {
          navigate: () =>
            page.goto(url, {
              waitUntil: 'domcontentloaded',
              timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS,
            }),
          service: BrowserNavigationService.GoogleTranslate,
        },
        {
          onRetry: (event) => log.warn('Retrying Google Translate page navigation:', event),
        },
      );
    }
  }
  translatePageTargetLang = normalizedTargetLang;
  log.info('Google Translate page loaded');
}

async function initTranslatePage(context: BrowserContext, targetLang = currentTargetLang): Promise<void> {
  translatePage = await context.newPage();
  await navigateTranslatePage(translatePage, targetLang);
}

async function initBackgroundBrowserNow(
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
  } catch (error: unknown) {
    const presented = presentNotificationError(error, { context: 'generic', t });
    bgError = presented.userMessage;
    log.error('Provider init error:', presented.safeLogMetadata);
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

      // Load session cookies and initialize the provider page.
      const sessionLoaded = await activeProvider.loadSession(bgContext);
      if (sessionLoaded) {
        await activeProvider.initPage(bgContext);
      }

      const startupState = getBrowserSessionStartupState({
        providerReady: activeProvider.isReady(),
        sessionLoaded,
      });
      if (startupState === BrowserSessionStartupState.Expired) {
        bgAuthExpired = true;
        bgError = t('error.noAccessToken');
        activeProvider.clearSession();
        await shutdownBackgroundBrowserNow(true);
        return getBackgroundBrowserStatus();
      }

      if (startupState === BrowserSessionStartupState.TemporaryFailure) {
        throw new Error(getBrowserSessionStartupError(activeProvider.getReadinessError()));
      }
    } else if (!activeProvider.isReady()) {
      throw new Error(t('error.noAccessToken'));
    }

    if (includeTranslate) await ensureTranslateBrowserNow(translateTargetLang, cloakBrowserSettings);

    bgReady = true;
    log.info('Background browser ready');
    return getBackgroundBrowserStatus();
  } catch (error: unknown) {
    const presented = presentNotificationError(error, { context: 'generic', t });
    bgError = presented.userMessage;
    log.error('Init error:', presented.safeLogMetadata);
    await shutdownBackgroundBrowserNow(true);
    return getBackgroundBrowserStatus();
  }
}

export function initBackgroundBrowser(options: EnsureBackgroundBrowserOptions = {}): Promise<BackgroundBrowserStatus> {
  return backgroundBrowserOperationQueue.run(() => initBackgroundBrowserNow(options));
}

async function shutdownBackgroundBrowserNow(preserveError = false): Promise<void> {
  await runBeforeBackgroundBrowserShutdownHooks();
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

export function shutdownBackgroundBrowser(preserveError = false): Promise<void> {
  return backgroundBrowserOperationQueue.run(() => shutdownBackgroundBrowserNow(preserveError));
}

async function ensureBackgroundBrowserNow(options: EnsureBackgroundBrowserOptions = {}): Promise<void> {
  const includeTranslate = options.includeTranslate ?? false;
  const translateTargetLang = options.translateTargetLang ?? currentTargetLang;
  const { cloakBrowserSettings } = options;

  if (bgReady && activeProvider?.isReady()) {
    if (!includeTranslate) return;
    await ensureTranslateBrowserNow(translateTargetLang, cloakBrowserSettings);
    return;
  }
  await initBackgroundBrowserNow({ includeTranslate, translateTargetLang, cloakBrowserSettings });
}

export function ensureBackgroundBrowser(options: EnsureBackgroundBrowserOptions = {}): Promise<void> {
  return backgroundBrowserOperationQueue.run(() => ensureBackgroundBrowserNow(options));
}

async function ensureTranslateBrowserNow(
  targetLang = currentTargetLang,
  settings?: CloakBrowserSettingsWithSecret,
): Promise<void> {
  const normalizedTargetLang = normalizeGoogleTranslateTargetLang(targetLang);
  const context = await ensureTranslateContext(settings);

  if (!translatePage || translatePage.isClosed()) {
    await initTranslatePage(context, normalizedTargetLang);
    return;
  }

  if (translatePageTargetLang !== normalizedTargetLang) {
    await navigateTranslatePage(translatePage, normalizedTargetLang);
    return;
  }

  await translatePage
    .waitForLoadState('domcontentloaded', { timeout: GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS })
    .catch(() => {});
}

export function ensureTranslateBrowser(
  targetLang = currentTargetLang,
  settings?: CloakBrowserSettingsWithSecret,
): Promise<void> {
  return backgroundBrowserOperationQueue.run(() => ensureTranslateBrowserNow(targetLang, settings));
}

async function switchProviderNow(providerId: string): Promise<BackgroundBrowserStatus> {
  createProvider(providerId);
  await shutdownBackgroundBrowserNow();
  setProvider(providerId);
  return initBackgroundBrowserNow();
}

/** Atomically tears down and recreates the browser for the current provider. */
export function restartBackgroundBrowser(
  options: EnsureBackgroundBrowserOptions = {},
): Promise<BackgroundBrowserStatus> {
  return backgroundBrowserOperationQueue.run(async () => {
    await shutdownBackgroundBrowserNow();
    return initBackgroundBrowserNow(options);
  });
}

export function switchProvider(providerId: string): Promise<BackgroundBrowserStatus> {
  return backgroundBrowserOperationQueue.run(() => switchProviderNow(providerId));
}
