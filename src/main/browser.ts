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
import { createProvider, voiceProviderAudit, type BaseVoiceProvider, type VoiceProviderAudit } from '@main/providers';
import { presentNotificationError } from '@shared/notifications';
import { runBeforeBackgroundBrowserShutdownHooks } from '@main/backgroundBrowserLifecycle';
import { BackgroundBrowserOperationQueue } from '@main/backgroundBrowserOperationQueue';

const log = createLogger('browser');

let bgContext: BrowserContext | null = null;
let activeProvider: BaseVoiceProvider | null = null;
let bgReady = false;
let bgError = '';
let bgAuthExpired = false;
let activeProviderAudit: VoiceProviderAudit = voiceProviderAudit;
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

/** Testable main-only dependencies for serialized background-provider startup. */
export interface EnsureBackgroundBrowserOptions {
  audit?: VoiceProviderAudit;
  backgroundContextFactory?: (settings?: CloakBrowserSettingsWithSecret) => Promise<BrowserContext>;
  cloakBrowserSettings?: CloakBrowserSettingsWithSecret;
  providerFactory?: (providerId: string, audit: VoiceProviderAudit) => BaseVoiceProvider;
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

/** Initializes the configured provider and its owned readiness/session state. */
async function initBackgroundBrowserNow(
  options: EnsureBackgroundBrowserOptions = {},
): Promise<BackgroundBrowserStatus> {
  const {
    audit = voiceProviderAudit,
    backgroundContextFactory = ensureBackgroundContext,
    cloakBrowserSettings,
    providerFactory = createProvider,
  } = options;

  if (activeProvider) {
    await shutdownBackgroundBrowserNow();
  }
  bgReady = false;
  bgError = '';
  bgAuthExpired = false;

  try {
    activeProvider = providerFactory(currentProvider, audit);
    activeProviderAudit = audit;
  } catch (error: unknown) {
    const presented = presentNotificationError(error, { context: 'generic', t });
    bgError = presented.userMessage;
    return getBackgroundBrowserStatus();
  }

  const settingsAudit = audit.startOperation(activeProvider.info.id, 'settings-readiness', 'configuration');
  let hasSession: boolean;
  try {
    hasSession = activeProvider.hasSession();
  } catch (error: unknown) {
    audit.terminalException(settingsAudit, 'configuration', error);
    throw error;
  }
  if (!hasSession) {
    settingsAudit.lifecycle.terminal(
      'configuration',
      'failure',
      audit.createMetadata({
        causeCode: activeProvider.requiresBrowserSession() ? 'not-authenticated' : 'not-configured',
      }),
    );
    return getBackgroundBrowserStatus();
  }
  settingsAudit.lifecycle.phaseCompleted('configuration');
  settingsAudit.lifecycle.terminal('configuration', 'success');

  try {
    if (activeProvider.requiresBrowserSession()) {
      const readinessAudit = audit.startOperation(activeProvider.info.id, 'readiness', 'context');
      try {
        bgContext = await backgroundContextFactory(cloakBrowserSettings);
        readinessAudit.lifecycle.phaseCompleted('context');
      } catch (error: unknown) {
        audit.terminalException(readinessAudit, 'context', error, { causeCode: 'connection-failed' });
        throw error;
      }

      // Load session cookies and initialize the provider page.
      const sessionAudit = audit.startOperation(activeProvider.info.id, 'session-load', 'session');
      let sessionLoaded: boolean;
      try {
        sessionLoaded = await activeProvider.loadSession(bgContext);
      } catch (error: unknown) {
        audit.terminalException(sessionAudit, 'session', error, { causeCode: 'not-authenticated' });
        audit.terminalException(readinessAudit, 'session', error, { causeCode: 'not-authenticated' });
        throw error;
      }
      sessionAudit.lifecycle.phaseCompleted('session');
      sessionAudit.lifecycle.terminal(
        'session',
        sessionLoaded ? 'success' : 'failure',
        sessionLoaded ? undefined : audit.createMetadata({ causeCode: 'not-authenticated' }),
      );
      if (sessionLoaded) {
        readinessAudit.lifecycle.phaseEntered('navigation');
        try {
          await activeProvider.initPage(bgContext);
          readinessAudit.lifecycle.phaseCompleted('navigation');
        } catch (error: unknown) {
          audit.terminalException(readinessAudit, 'navigation', error, { causeCode: 'connection-failed' });
          throw error;
        }
      }

      readinessAudit.lifecycle.phaseEntered('readiness');
      const startupState = getBrowserSessionStartupState({
        providerReady: activeProvider.isReady(),
        sessionLoaded,
      });
      if (startupState === BrowserSessionStartupState.Expired) {
        readinessAudit.lifecycle.terminal(
          'readiness',
          'failure',
          audit.createMetadata({ causeCode: 'not-authenticated' }),
        );
        bgAuthExpired = true;
        bgError = t('error.noAccessToken');
        const clearAudit = audit.startOperation(activeProvider.info.id, 'session-clear', 'session');
        try {
          activeProvider.clearSession();
          clearAudit.lifecycle.phaseCompleted('session');
          clearAudit.lifecycle.terminal('session', 'success');
        } catch (error: unknown) {
          audit.terminalException(clearAudit, 'session', error, { causeCode: 'cleanup-failed' });
          throw error;
        }
        await shutdownBackgroundBrowserNow(true);
        return getBackgroundBrowserStatus();
      }

      if (startupState === BrowserSessionStartupState.TemporaryFailure) {
        readinessAudit.lifecycle.terminal(
          'readiness',
          'failure',
          audit.createMetadata({ causeCode: 'not-authenticated' }),
        );
        throw new Error(getBrowserSessionStartupError(activeProvider.getReadinessError()));
      }
      readinessAudit.lifecycle.phaseCompleted('readiness');
      readinessAudit.lifecycle.terminal('readiness', 'success');
    } else {
      const readinessAudit = audit.startOperation(activeProvider.info.id, 'readiness', 'readiness');
      if (!activeProvider.isReady()) {
        readinessAudit.lifecycle.terminal(
          'readiness',
          'failure',
          audit.createMetadata({ causeCode: 'not-configured' }),
        );
        throw new Error(t('error.noAccessToken'));
      }
      readinessAudit.lifecycle.phaseCompleted('readiness');
      readinessAudit.lifecycle.terminal('readiness', 'success');
    }

    bgReady = true;
    return getBackgroundBrowserStatus();
  } catch (error: unknown) {
    const presented = presentNotificationError(error, { context: 'generic', t });
    bgError = presented.userMessage;
    await shutdownBackgroundBrowserNow(true);
    return getBackgroundBrowserStatus();
  }
}

export function initBackgroundBrowser(options: EnsureBackgroundBrowserOptions = {}): Promise<BackgroundBrowserStatus> {
  return backgroundBrowserOperationQueue.run(() => initBackgroundBrowserNow(options));
}

async function shutdownBackgroundBrowserNow(preserveError = false): Promise<void> {
  const provider = activeProvider;
  const shutdownAudit = provider ? activeProviderAudit.startOperation(provider.info.id, 'shutdown', 'shutdown') : null;
  let cleanupFailed = false;
  try {
    await runBeforeBackgroundBrowserShutdownHooks();
  } catch (error: unknown) {
    if (shutdownAudit) {
      activeProviderAudit.terminalException(shutdownAudit, 'shutdown', error, { causeCode: 'cleanup-failed' });
    }
    throw error;
  }
  bgReady = false;
  if (!preserveError) {
    bgError = '';
    bgAuthExpired = false;
  }
  if (provider) {
    try {
      await provider.shutdown();
      if (activeProvider === provider) {
        activeProvider = null;
      }
    } catch (error: unknown) {
      activeProviderAudit.terminalException(shutdownAudit!, 'shutdown', error, { causeCode: 'cleanup-failed' });
      throw error;
    }
  }
  if (bgContext) {
    try {
      log.info('Shutting down background browser...');
      await bgContext.close();
      log.info('Background browser closed');
    } catch {
      cleanupFailed = true;
    }
    bgContext = null;
  }
  if (shutdownAudit) {
    shutdownAudit.lifecycle.phaseCompleted('shutdown');
    shutdownAudit.lifecycle.terminal(
      'shutdown',
      cleanupFailed ? 'failure' : 'success',
      cleanupFailed ? activeProviderAudit.createMetadata({ causeCode: 'cleanup-failed' }) : undefined,
    );
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
  if (!voiceProviderAudit.isKnownProviderId(providerId)) {
    createProvider(providerId);
  }
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
