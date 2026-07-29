/* eslint-disable max-classes-per-file -- The service and its deferred readiness terminal share one lifecycle. */
import type { BrowserContext } from 'playwright-core';
import type { CloakBrowserSettingsRepository, CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';
import type { BaseVoiceProvider } from '@main/providers/BaseVoiceProvider';
import type {
  VoiceAuditLifecycle,
  VoiceAuditMetadata,
  VoiceAuditOperationContext,
  VoiceProviderAudit,
} from '@main/providers/voiceProviderAudit';
import type { VoiceProviderRegistry } from '@main/providers/voiceProviderRegistry';
import type { ProviderAuditPhase, ProviderAuditTerminalOutcome } from '@main/providerAudit';
import { BackgroundBrowserOperationQueue } from '@main/backgroundBrowserOperationQueue';
import type { AppConfigStore } from '@main/config';
import type { I18nService } from '@main/i18n';
import {
  InitialProviderReadinessDeadline,
  type InitialProviderReadinessDeadlineDependencies,
  type InitialProviderReadinessStopCause,
} from '@main/services/initialProviderReadinessDeadline';
import { presentNotificationError } from '@shared/notifications';

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
  readonly cloakBrowserSettings: Pick<CloakBrowserSettingsRepository, 'getWithSecret'>;
  readonly config: Pick<AppConfigStore, 'getSnapshot' | 'setProvider'>;
  readonly createBackgroundContext: (settings: CloakBrowserSettingsWithSecret) => Promise<BrowserContext>;
  readonly createLoginContext: (settings: CloakBrowserSettingsWithSecret) => Promise<BrowserContext>;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly logger: BackgroundBrowserLogger;
  readonly providerRegistry: Pick<VoiceProviderRegistry, 'createProvider' | 'isKnownProviderId'>;
  readonly readinessDeadline: InitialProviderReadinessDeadlineDependencies;
}

export interface BackgroundBrowserLaunchOptions {
  readonly cloakBrowserSettings?: CloakBrowserSettingsWithSecret;
}

interface BackgroundBrowserInitializationState {
  contextCleanupStarted: boolean;
  context: BrowserContext | null;
  readonly deadline: InitialProviderReadinessDeadline;
  readonly generation: number;
  pendingAudit: VoiceAuditOperationContext | null;
  providerCleanupStarted: boolean;
  provider: BaseVoiceProvider | null;
  readinessAudit: VoiceAuditOperationContext | null;
  readinessAuditRoot: VoiceAuditOperationContext | null;
  readinessTerminal: DeferredVoiceAuditLifecycle | null;
  stopped: boolean;
}

interface DeferredVoiceAuditTerminal {
  readonly metadata?: VoiceAuditMetadata;
  readonly outcome: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

/** Defers readiness terminal publication until the owning deadline settles. */
class DeferredVoiceAuditLifecycle implements VoiceAuditLifecycle {
  private deferredTerminal: DeferredVoiceAuditTerminal | null = null;

  public constructor(private readonly lifecycle: VoiceAuditLifecycle) {}

  public started(metadata?: VoiceAuditMetadata): void {
    this.lifecycle.started(metadata);
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: VoiceAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.phaseEntered(phase, metadata);
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: VoiceAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.phaseCompleted(phase, metadata);
  }

  public retry(phase: ProviderAuditPhase, metadata?: VoiceAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.retry(phase, metadata);
  }

  public recovery(phase: ProviderAuditPhase, metadata?: VoiceAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.recovery(phase, metadata);
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: VoiceAuditMetadata,
  ): void {
    if (this.deferredTerminal !== null) return;
    this.deferredTerminal = { phase, outcome, ...(metadata === undefined ? {} : { metadata }) };
  }

  public flushTerminal(): boolean {
    if (this.deferredTerminal === null) return false;
    const { metadata, outcome, phase } = this.deferredTerminal;
    this.deferredTerminal = null;
    this.lifecycle.terminal(phase, outcome, metadata);
    return true;
  }
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
  private activeInitialization: BackgroundBrowserInitializationState | null = null;
  private initializationGeneration = 0;
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
      providerId: this.dependencies.config.getSnapshot().provider,
      ready: this.ready,
      error: this.error || undefined,
      authExpired: this.authExpired || undefined,
    };
  }

  public launchLoginContext(): Promise<BrowserContext> {
    return this.dependencies.createLoginContext(this.dependencies.cloakBrowserSettings.getWithSecret());
  }

  public registerBeforeShutdownHook(hook: BeforeBackgroundBrowserShutdownHook): () => void {
    this.beforeShutdownHooks.add(hook);
    return () => {
      this.beforeShutdownHooks.delete(hook);
    };
  }

  public initialize(options: BackgroundBrowserLaunchOptions = {}): Promise<BackgroundBrowserStatus> {
    this.activeInitialization?.deadline.cancel();
    return this.operationQueue.run(() => this.initializeNow(options));
  }

  public ensure(options: BackgroundBrowserLaunchOptions = {}): Promise<void> {
    return this.operationQueue.run(async () => {
      if (this.ready && this.activeProvider?.isReady()) return;
      await this.initializeNow(options);
    });
  }

  public restart(options: BackgroundBrowserLaunchOptions = {}): Promise<BackgroundBrowserStatus> {
    this.activeInitialization?.deadline.cancel();
    return this.operationQueue.run(async () => {
      await this.shutdownNow();
      return this.initializeNow(options);
    });
  }

  public switchProvider(providerId: string): Promise<BackgroundBrowserStatus> {
    this.activeInitialization?.deadline.cancel();
    return this.operationQueue.run(async () => {
      if (!this.dependencies.providerRegistry.isKnownProviderId(providerId)) {
        this.dependencies.providerRegistry.createProvider(providerId);
      }
      await this.shutdownNow();
      this.dependencies.config.setProvider(providerId);
      return this.initializeNow();
    });
  }

  public shutdown(preserveError = false): Promise<void> {
    this.activeInitialization?.deadline.cancel();
    return this.operationQueue.run(async () => {
      await this.shutdownNow(preserveError);
    });
  }

  /**
   * Releases the current browser owner before a settings transaction.
   * A false result means cleanup ownership is uncertain and no replacement
   * context may be started.
   */
  public releaseForSettingsReset(): Promise<boolean> {
    this.activeInitialization?.deadline.cancel();
    return this.operationQueue.run(async () => {
      try {
        return await this.shutdownNow();
      } catch {
        return false;
      }
    });
  }

  private async initializeNow(options: BackgroundBrowserLaunchOptions = {}): Promise<BackgroundBrowserStatus> {
    if (this.activeProvider) {
      await this.shutdownNow();
    }
    this.ready = false;
    this.error = '';
    this.authExpired = false;

    let provider: BaseVoiceProvider;
    try {
      provider = this.dependencies.providerRegistry.createProvider(this.dependencies.config.getSnapshot().provider);
    } catch (error: unknown) {
      this.error = this.presentError(error);
      return this.getStatus();
    }

    const deadline = new InitialProviderReadinessDeadline(this.dependencies.readinessDeadline);
    const state: BackgroundBrowserInitializationState = {
      contextCleanupStarted: false,
      context: null,
      deadline,
      generation: ++this.initializationGeneration,
      pendingAudit: null,
      providerCleanupStarted: false,
      provider,
      readinessAudit: null,
      readinessAuditRoot: null,
      readinessTerminal: null,
      stopped: false,
    };
    this.activeInitialization = state;
    this.activeProvider = provider;

    try {
      let result;
      try {
        result = await deadline.run(() => this.runInitialization(state, options));
      } catch (error: unknown) {
        state.readinessTerminal?.flushTerminal();
        throw error;
      }
      if (result.status === 'completed') {
        state.readinessTerminal?.flushTerminal();
        return result.value;
      }
      this.settleStoppedInitialization(state, result.cause);
      return this.getStatus();
    } finally {
      if (this.activeInitialization === state) this.activeInitialization = null;
    }
  }

  private async runInitialization(
    state: BackgroundBrowserInitializationState,
    options: BackgroundBrowserLaunchOptions,
  ): Promise<BackgroundBrowserStatus> {
    const provider = state.provider;
    if (!provider) return this.getStatus();
    const audit = this.dependencies.audit;
    const settingsAudit = audit.startOperation(provider.info.id, 'settings-readiness', 'configuration');
    let hasSession: boolean;
    try {
      hasSession = provider.hasSession();
    } catch (error: unknown) {
      audit.terminalException(settingsAudit, 'configuration', error);
      return this.failInitialization(state, error);
    }
    if (!hasSession) {
      const causeCode = provider.requiresBrowserSession() ? 'not-authenticated' : 'not-configured';
      settingsAudit.lifecycle.terminal('configuration', 'failure', audit.createMetadata({ causeCode }));
      state.readinessAudit?.lifecycle.terminal('readiness', 'failure', audit.createMetadata({ causeCode }));
      return this.getStatus();
    }
    settingsAudit.lifecycle.phaseCompleted('configuration');
    settingsAudit.lifecycle.terminal('configuration', 'success');
    const readinessAudit = audit.startOperation(
      provider.info.id,
      'readiness',
      provider.requiresBrowserSession() ? 'context' : 'readiness',
    );
    const readinessTerminal = new DeferredVoiceAuditLifecycle(readinessAudit.lifecycle);
    state.readinessAuditRoot = readinessAudit;
    state.readinessTerminal = readinessTerminal;
    state.readinessAudit = Object.freeze({
      ...readinessAudit,
      lifecycle: readinessTerminal,
    });

    try {
      if (provider.requiresBrowserSession()) {
        const initialized = await this.initializeBrowserSessionProvider(state, options);
        if (!initialized) return this.getStatus();
      } else {
        this.initializeApiProvider(state);
      }
      if (this.isInitializationActive(state)) this.ready = true;
      return this.getStatus();
    } catch (error: unknown) {
      return this.failInitialization(state, error);
    }
  }

  /** Restores one browser-session provider and reports whether it reached readiness. */
  private async initializeBrowserSessionProvider(
    state: BackgroundBrowserInitializationState,
    options: BackgroundBrowserLaunchOptions,
  ): Promise<boolean> {
    const provider = state.provider;
    if (!provider) return false;
    const audit = this.dependencies.audit;
    const readinessAudit = state.readinessAudit;
    if (!readinessAudit) return false;
    try {
      this.dependencies.logger.info('Launching persistent background browser...');
      const context = await this.dependencies.createBackgroundContext(
        options.cloakBrowserSettings ?? this.dependencies.cloakBrowserSettings.getWithSecret(),
      );
      if (!this.isInitializationActive(state)) {
        this.releaseContext(context);
        return false;
      }
      state.context = context;
      this.backgroundContext = context;
      readinessAudit.lifecycle.phaseCompleted('context');
    } catch (error: unknown) {
      audit.terminalException(readinessAudit, 'context', error, { causeCode: 'connection-failed' });
      throw error;
    }

    const sessionAudit = audit.startOperation(provider.info.id, 'session-load', 'session');
    state.pendingAudit = sessionAudit;
    let sessionLoaded: boolean;
    try {
      const context = state.context;
      if (!context || !this.isInitializationActive(state)) return false;
      sessionLoaded = await provider.loadSession(context);
      if (!this.isInitializationActive(state)) return false;
    } catch (error: unknown) {
      audit.terminalException(sessionAudit, 'session', error, { causeCode: 'not-authenticated' });
      if (state.pendingAudit === sessionAudit) state.pendingAudit = null;
      audit.terminalException(readinessAudit, 'session', error, { causeCode: 'not-authenticated' });
      throw error;
    }
    sessionAudit.lifecycle.phaseCompleted('session');
    sessionAudit.lifecycle.terminal(
      'session',
      sessionLoaded ? 'success' : 'failure',
      sessionLoaded ? undefined : audit.createMetadata({ causeCode: 'not-authenticated' }),
    );
    if (state.pendingAudit === sessionAudit) state.pendingAudit = null;
    if (sessionLoaded) {
      readinessAudit.lifecycle.phaseEntered('navigation');
      try {
        const context = state.context;
        if (!context || !this.isInitializationActive(state)) return false;
        await provider.initPage(context);
        if (!this.isInitializationActive(state)) return false;
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
      this.error = this.getNotAuthenticatedError();
      const clearAudit = audit.startOperation(provider.info.id, 'session-clear', 'session');
      try {
        provider.clearSession();
        clearAudit.lifecycle.phaseCompleted('session');
        clearAudit.lifecycle.terminal('session', 'success');
      } catch (error: unknown) {
        audit.terminalException(clearAudit, 'session', error, { causeCode: 'cleanup-failed' });
        throw error;
      }
      await this.cleanupInitialization(state, true);
      return false;
    }

    if (startupState === BrowserSessionStartupState.TemporaryFailure) {
      readinessAudit.lifecycle.terminal(
        'readiness',
        'failure',
        audit.createMetadata({ causeCode: 'not-authenticated' }),
      );
      throw new Error(getBrowserSessionStartupError(provider.getReadinessError(), this.getNotAuthenticatedError()));
    }
    readinessAudit.lifecycle.phaseCompleted('readiness');
    readinessAudit.lifecycle.terminal('readiness', 'success');
    return true;
  }

  private initializeApiProvider(state: BackgroundBrowserInitializationState): void {
    const provider = state.provider;
    if (!provider) return;
    const audit = this.dependencies.audit;
    const readinessAudit = state.readinessAudit;
    if (!readinessAudit) return;
    if (!provider.isReady()) {
      readinessAudit.lifecycle.terminal('readiness', 'failure', audit.createMetadata({ causeCode: 'not-configured' }));
      throw new Error(this.getNotAuthenticatedError());
    }
    readinessAudit.lifecycle.phaseCompleted('readiness');
    readinessAudit.lifecycle.terminal('readiness', 'success');
  }

  private async failInitialization(
    state: BackgroundBrowserInitializationState,
    error: unknown,
  ): Promise<BackgroundBrowserStatus> {
    if (!this.isInitializationActive(state)) return this.getStatus();
    this.error = this.presentError(error);
    await this.cleanupInitialization(state, true);
    return this.getStatus();
  }

  private isInitializationActive(state: BackgroundBrowserInitializationState): boolean {
    return (
      !state.stopped &&
      !state.deadline.signal.aborted &&
      this.activeInitialization === state &&
      state.generation === this.initializationGeneration
    );
  }

  private settleStoppedInitialization(
    state: BackgroundBrowserInitializationState,
    cause: InitialProviderReadinessStopCause,
  ): void {
    if (state.stopped) return;
    state.stopped = true;
    const readinessAudit = state.readinessAuditRoot;
    if (readinessAudit) {
      try {
        if (cause === 'timed-out') {
          this.dependencies.audit.terminalReadinessTimedOut(readinessAudit);
        } else {
          this.dependencies.audit.terminalCancelled(readinessAudit);
        }
      } catch {
        // Audit settlement is fail-open and cannot retain browser ownership.
      }
    }
    if (state.pendingAudit) {
      try {
        this.dependencies.audit.terminalCancelled(state.pendingAudit);
      } catch {
        // Secondary audit settlement cannot retain browser ownership.
      }
      state.pendingAudit = null;
    }

    this.ready = false;
    if (this.activeProvider === state.provider) this.activeProvider = null;
    if (this.backgroundContext === state.context) this.backgroundContext = null;
    const provider = state.provider;
    const context = state.context;
    state.provider = null;
    state.context = null;
    if (!state.providerCleanupStarted) this.releaseProvider(provider);
    if (!state.contextCleanupStarted) this.releaseContext(context);
  }

  private async cleanupInitialization(
    state: BackgroundBrowserInitializationState,
    preserveError: boolean,
  ): Promise<void> {
    const provider = state.provider;
    const context = state.context;
    const audit = this.dependencies.audit;
    const shutdownAudit = provider ? audit.startOperation(provider.info.id, 'shutdown', 'shutdown') : null;
    state.pendingAudit = shutdownAudit;
    let cleanupFailed = false;

    await this.runBeforeShutdownHooks();
    if (this.activeProvider === provider) this.ready = false;
    if (!preserveError) {
      this.error = '';
      this.authExpired = false;
    }
    if (provider) {
      try {
        state.providerCleanupStarted = true;
        await provider.shutdown();
        if (state.provider === provider) state.provider = null;
        if (this.activeProvider === provider) this.activeProvider = null;
      } catch (error: unknown) {
        if (shutdownAudit) {
          audit.terminalException(shutdownAudit, 'shutdown', error, { causeCode: 'cleanup-failed' });
          if (state.pendingAudit === shutdownAudit) state.pendingAudit = null;
        }
        throw error;
      }
    }
    if (context) {
      try {
        state.contextCleanupStarted = true;
        this.dependencies.logger.info('Shutting down background browser...');
        await context.close();
        this.dependencies.logger.info('Background browser closed');
      } catch {
        cleanupFailed = true;
      }
      if (state.context === context) state.context = null;
      if (this.backgroundContext === context) this.backgroundContext = null;
    }
    if (shutdownAudit) {
      shutdownAudit.lifecycle.phaseCompleted('shutdown');
      shutdownAudit.lifecycle.terminal(
        'shutdown',
        cleanupFailed ? 'failure' : 'success',
        cleanupFailed ? audit.createMetadata({ causeCode: 'cleanup-failed' }) : undefined,
      );
      if (state.pendingAudit === shutdownAudit) state.pendingAudit = null;
    }
  }

  private releaseProvider(provider: BaseVoiceProvider | null): void {
    if (!provider) return;
    try {
      void provider.shutdown().catch(() => undefined);
    } catch {
      // Detached provider cleanup cannot delay readiness settlement.
    }
  }

  private releaseContext(context: BrowserContext | null): void {
    if (!context) return;
    try {
      void context.close().catch(() => undefined);
    } catch {
      // Detached context cleanup cannot delay readiness settlement.
    }
  }

  private async shutdownNow(preserveError = false): Promise<boolean> {
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
    return !cleanupFailed;
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

  private getNotAuthenticatedError(): string {
    return this.dependencies.localization.translate('error.noAccessToken');
  }

  private presentError(error: unknown): string {
    return presentNotificationError(error, {
      context: 'generic',
      t: this.dependencies.localization.translate,
    }).userMessage;
  }
}
