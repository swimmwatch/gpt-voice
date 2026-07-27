import type { BrowserContext } from 'playwright-core';
import type { CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';
import type { BaseVoiceProvider } from '@main/providers/BaseVoiceProvider';
import type { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';
import type { VoiceProviderRegistry } from '@main/providers/voiceProviderRegistry';
import { BackgroundBrowserOperationQueue } from '@main/backgroundBrowserOperationQueue';

export interface BackgroundBrowserStatus {
  readonly providerId?: string;
  readonly ready: boolean;
  readonly error?: string;
  readonly authExpired?: boolean;
}

export enum BrowserSessionStartupState {
  Expired = 'expired',
  Ready = 'ready',
  TemporaryFailure = 'temporaryFailure',
}

export type BeforeBackgroundBrowserShutdownHook = () => void | Promise<void>;

export interface BackgroundBrowserLogger {
  info(message: string): void;
}

export interface BackgroundBrowserServiceDependencies {
  readonly audit: VoiceProviderAudit;
  readonly createBackgroundContext: (settings?: CloakBrowserSettingsWithSecret) => Promise<BrowserContext>;
  readonly createLoginContext: () => Promise<BrowserContext>;
  readonly getCurrentProviderId: () => string;
  readonly getNotAuthenticatedError: () => string;
  readonly logger: BackgroundBrowserLogger;
  readonly presentError: (error: unknown) => string;
  readonly providerRegistry: Pick<VoiceProviderRegistry, 'createProvider' | 'isKnownProviderId'>;
  readonly setCurrentProviderId: (providerId: string) => void;
}

export interface BackgroundBrowserLaunchOptions {
  readonly cloakBrowserSettings?: CloakBrowserSettingsWithSecret;
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

export function getBrowserSessionStartupError(providerReadinessError: string | null, fallbackError: string): string {
  return providerReadinessError || fallbackError;
}

/** Owns one serialized background-browser context and its active Voice provider. */
export class BackgroundBrowserService {
  private activeProvider: BaseVoiceProvider | null = null;
  private authExpired = false;
  private backgroundContext: BrowserContext | null = null;
  private error = '';
  private readonly operationQueue = new BackgroundBrowserOperationQueue();
  private readonly beforeShutdownHooks = new Set<BeforeBackgroundBrowserShutdownHook>();
  private ready = false;

  public constructor(private readonly dependencies: BackgroundBrowserServiceDependencies) {}

  public isReady(): boolean {
    return this.ready;
  }

  public getActiveProvider(): BaseVoiceProvider | null {
    return this.activeProvider;
  }

  public getStatus(): BackgroundBrowserStatus {
    return {
      providerId: this.dependencies.getCurrentProviderId(),
      ready: this.ready,
      error: this.error || undefined,
      authExpired: this.authExpired || undefined,
    };
  }

  public launchLoginContext(): Promise<BrowserContext> {
    return this.dependencies.createLoginContext();
  }

  public registerBeforeShutdownHook(hook: BeforeBackgroundBrowserShutdownHook): () => void {
    this.beforeShutdownHooks.add(hook);
    return () => {
      this.beforeShutdownHooks.delete(hook);
    };
  }

  public initialize(options: BackgroundBrowserLaunchOptions = {}): Promise<BackgroundBrowserStatus> {
    return this.operationQueue.run(() => this.initializeNow(options));
  }

  public ensure(options: BackgroundBrowserLaunchOptions = {}): Promise<void> {
    return this.operationQueue.run(async () => {
      if (this.ready && this.activeProvider?.isReady()) return;
      await this.initializeNow(options);
    });
  }

  public restart(options: BackgroundBrowserLaunchOptions = {}): Promise<BackgroundBrowserStatus> {
    return this.operationQueue.run(async () => {
      await this.shutdownNow();
      return this.initializeNow(options);
    });
  }

  public switchProvider(providerId: string): Promise<BackgroundBrowserStatus> {
    return this.operationQueue.run(async () => {
      if (!this.dependencies.providerRegistry.isKnownProviderId(providerId)) {
        this.dependencies.providerRegistry.createProvider(providerId);
      }
      await this.shutdownNow();
      this.dependencies.setCurrentProviderId(providerId);
      return this.initializeNow();
    });
  }

  public shutdown(preserveError = false): Promise<void> {
    return this.operationQueue.run(() => this.shutdownNow(preserveError));
  }

  private async ensureBackgroundContext(settings?: CloakBrowserSettingsWithSecret): Promise<BrowserContext> {
    if (this.backgroundContext) return this.backgroundContext;
    this.dependencies.logger.info('Launching persistent background browser...');
    this.backgroundContext = await this.dependencies.createBackgroundContext(settings);
    return this.backgroundContext;
  }

  private async initializeNow(options: BackgroundBrowserLaunchOptions = {}): Promise<BackgroundBrowserStatus> {
    if (this.activeProvider) {
      await this.shutdownNow();
    }
    this.ready = false;
    this.error = '';
    this.authExpired = false;

    try {
      this.activeProvider = this.dependencies.providerRegistry.createProvider(this.dependencies.getCurrentProviderId());
    } catch (error: unknown) {
      this.error = this.dependencies.presentError(error);
      return this.getStatus();
    }

    const provider = this.activeProvider;
    const audit = this.dependencies.audit;
    const settingsAudit = audit.startOperation(provider.info.id, 'settings-readiness', 'configuration');
    let hasSession: boolean;
    try {
      hasSession = provider.hasSession();
    } catch (error: unknown) {
      audit.terminalException(settingsAudit, 'configuration', error);
      throw error;
    }
    if (!hasSession) {
      settingsAudit.lifecycle.terminal(
        'configuration',
        'failure',
        audit.createMetadata({
          causeCode: provider.requiresBrowserSession() ? 'not-authenticated' : 'not-configured',
        }),
      );
      return this.getStatus();
    }
    settingsAudit.lifecycle.phaseCompleted('configuration');
    settingsAudit.lifecycle.terminal('configuration', 'success');

    try {
      if (provider.requiresBrowserSession()) {
        const initialized = await this.initializeBrowserSessionProvider(provider, options);
        if (!initialized) return this.getStatus();
      } else {
        this.initializeApiProvider(provider);
      }
      this.ready = true;
      return this.getStatus();
    } catch (error: unknown) {
      this.error = this.dependencies.presentError(error);
      await this.shutdownNow(true);
      return this.getStatus();
    }
  }

  /** Restores one browser-session provider and reports whether it reached readiness. */
  private async initializeBrowserSessionProvider(
    provider: BaseVoiceProvider,
    options: BackgroundBrowserLaunchOptions,
  ): Promise<boolean> {
    const audit = this.dependencies.audit;
    const readinessAudit = audit.startOperation(provider.info.id, 'readiness', 'context');
    try {
      this.backgroundContext = await this.ensureBackgroundContext(options.cloakBrowserSettings);
      readinessAudit.lifecycle.phaseCompleted('context');
    } catch (error: unknown) {
      audit.terminalException(readinessAudit, 'context', error, { causeCode: 'connection-failed' });
      throw error;
    }

    const sessionAudit = audit.startOperation(provider.info.id, 'session-load', 'session');
    let sessionLoaded: boolean;
    try {
      sessionLoaded = await provider.loadSession(this.backgroundContext);
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
        await provider.initPage(this.backgroundContext);
        readinessAudit.lifecycle.phaseCompleted('navigation');
      } catch (error: unknown) {
        audit.terminalException(readinessAudit, 'navigation', error, { causeCode: 'connection-failed' });
        throw error;
      }
    }

    readinessAudit.lifecycle.phaseEntered('readiness');
    const startupState = getBrowserSessionStartupState({
      providerReady: provider.isReady(),
      sessionLoaded,
    });
    if (startupState === BrowserSessionStartupState.Expired) {
      readinessAudit.lifecycle.terminal(
        'readiness',
        'failure',
        audit.createMetadata({ causeCode: 'not-authenticated' }),
      );
      this.authExpired = true;
      this.error = this.dependencies.getNotAuthenticatedError();
      const clearAudit = audit.startOperation(provider.info.id, 'session-clear', 'session');
      try {
        provider.clearSession();
        clearAudit.lifecycle.phaseCompleted('session');
        clearAudit.lifecycle.terminal('session', 'success');
      } catch (error: unknown) {
        audit.terminalException(clearAudit, 'session', error, { causeCode: 'cleanup-failed' });
        throw error;
      }
      await this.shutdownNow(true);
      return false;
    }

    if (startupState === BrowserSessionStartupState.TemporaryFailure) {
      readinessAudit.lifecycle.terminal(
        'readiness',
        'failure',
        audit.createMetadata({ causeCode: 'not-authenticated' }),
      );
      throw new Error(
        getBrowserSessionStartupError(provider.getReadinessError(), this.dependencies.getNotAuthenticatedError()),
      );
    }
    readinessAudit.lifecycle.phaseCompleted('readiness');
    readinessAudit.lifecycle.terminal('readiness', 'success');
    return true;
  }

  private initializeApiProvider(provider: BaseVoiceProvider): void {
    const audit = this.dependencies.audit;
    const readinessAudit = audit.startOperation(provider.info.id, 'readiness', 'readiness');
    if (!provider.isReady()) {
      readinessAudit.lifecycle.terminal('readiness', 'failure', audit.createMetadata({ causeCode: 'not-configured' }));
      throw new Error(this.dependencies.getNotAuthenticatedError());
    }
    readinessAudit.lifecycle.phaseCompleted('readiness');
    readinessAudit.lifecycle.terminal('readiness', 'success');
  }

  private async shutdownNow(preserveError = false): Promise<void> {
    const provider = this.activeProvider;
    const audit = this.dependencies.audit;
    const shutdownAudit = provider ? audit.startOperation(provider.info.id, 'shutdown', 'shutdown') : null;
    let cleanupFailed = false;

    await this.runBeforeShutdownHooks();
    this.ready = false;
    if (!preserveError) {
      this.error = '';
      this.authExpired = false;
    }
    if (provider) {
      try {
        await provider.shutdown();
        if (this.activeProvider === provider) {
          this.activeProvider = null;
        }
      } catch (error: unknown) {
        if (shutdownAudit) {
          audit.terminalException(shutdownAudit, 'shutdown', error, { causeCode: 'cleanup-failed' });
        }
        throw error;
      }
    }
    if (this.backgroundContext) {
      try {
        this.dependencies.logger.info('Shutting down background browser...');
        await this.backgroundContext.close();
        this.dependencies.logger.info('Background browser closed');
      } catch {
        cleanupFailed = true;
      }
      this.backgroundContext = null;
    }
    if (shutdownAudit) {
      shutdownAudit.lifecycle.phaseCompleted('shutdown');
      shutdownAudit.lifecycle.terminal(
        'shutdown',
        cleanupFailed ? 'failure' : 'success',
        cleanupFailed ? audit.createMetadata({ causeCode: 'cleanup-failed' }) : undefined,
      );
    }
  }

  private async runBeforeShutdownHooks(): Promise<void> {
    for (const hook of [...this.beforeShutdownHooks]) {
      try {
        await hook();
      } catch {
        // Browser teardown must continue when an optional lifecycle hook fails.
      }
    }
  }
}
