import type { BrowserContext } from 'playwright-core';
import {
  createCloakBrowserLoginContextOptions,
  createCloakBrowserPersistentContextOptions,
} from '@main/cloakBrowserLaunchOptions';
import type { CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';
import { launchCloakContext, launchCloakPersistentContext } from '@main/cloakbrowser';
import { currentProvider, setProvider } from '@main/config';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { createProvider, type BaseVoiceProvider } from '@main/providers';
import { presentNotificationError } from '@shared/notifications';
import { runBeforeBackgroundBrowserShutdownHooks } from '@main/backgroundBrowserLifecycle';
import { BackgroundBrowserOperationQueue } from '@main/backgroundBrowserOperationQueue';

const log = createLogger('browser');

let bgContext: BrowserContext | null = null;
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

export function getActiveProvider(): BaseVoiceProvider | null {
  return activeProvider;
}

export function launchLoginContext(): Promise<BrowserContext> {
  return launchCloakContext(createCloakBrowserLoginContextOptions());
}

async function ensureBackgroundContext(settings?: CloakBrowserSettingsWithSecret): Promise<BrowserContext> {
  if (bgContext) return bgContext;

  log.info('Launching persistent background browser...');
  bgContext = await launchCloakPersistentContext(createCloakBrowserPersistentContextOptions(settings));
  return bgContext;
}

async function initBackgroundBrowserNow(
  options: EnsureBackgroundBrowserOptions = {},
): Promise<BackgroundBrowserStatus> {
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
      bgContext = await ensureBackgroundContext(cloakBrowserSettings);

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
  if (bgReady && activeProvider?.isReady()) {
    return;
  }
  await initBackgroundBrowserNow(options);
}

export function ensureBackgroundBrowser(options: EnsureBackgroundBrowserOptions = {}): Promise<void> {
  return backgroundBrowserOperationQueue.run(() => ensureBackgroundBrowserNow(options));
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
