/* eslint-disable max-classes-per-file -- Provider and service fixtures own separate lifecycle state. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserContext } from 'playwright-core';
import {
  BackgroundBrowserService,
  BrowserSessionStartupState,
  getBrowserSessionStartupError,
  getBrowserSessionStartupState,
} from '@main/browser';
import { I18nService } from '@main/i18n';
import { BatchVoiceProvider } from '@main/providers/BatchVoiceProvider';
import type { TranscriptionResult, VoiceProviderInfo } from '@main/providers/BaseVoiceProvider';
import { RecordingVoiceProviderAudit, getTerminalEvents } from './providers/voiceAuditTestUtils';
import { TestAppConfigStore, TestCloakBrowserSettingsRepository } from './appConfigTestUtils';

const localization = new I18nService();

class TestBrowserAuditProvider extends BatchVoiceProvider {
  readonly info: VoiceProviderInfo & { readonly transcriptionMode: 'batch' };

  clearSessionCalls = 0;
  loadSessionCalls = 0;
  shutdownCalls = 0;
  shutdownFailures = 0;
  private ready: boolean;

  constructor(
    browserSession = false,
    private readonly sessionLoaded = true,
  ) {
    super();
    this.ready = !browserSession;
    this.info = {
      id: browserSession ? 'chatgpt' : 'openai-api',
      name: browserSession ? 'Synthetic ChatGPT' : 'Synthetic OpenAI',
      authType: browserSession ? 'browserSession' : 'apiKey',
      category: browserSession ? 'web' : 'api',
      hasSettings: true,
      transcriptionMode: 'batch',
    };
  }

  clearSession(): void {
    this.clearSessionCalls += 1;
  }

  hasSession(): boolean {
    return true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async initPage(): Promise<void> {
    this.ready = true;
  }

  async loadSession(): Promise<boolean> {
    this.loadSessionCalls += 1;
    return this.sessionLoaded;
  }

  async shutdown(): Promise<void> {
    this.shutdownCalls += 1;
    if (this.shutdownCalls <= this.shutdownFailures) {
      throw new Error('private shutdown failure /home/private');
    }
    await super.shutdown();
  }

  transcribe(): Promise<TranscriptionResult> {
    return Promise.resolve({ success: true, text: 'synthetic' });
  }
}

class BackgroundBrowserServiceFixture {
  readonly audit = new RecordingVoiceProviderAudit();
  readonly service: BackgroundBrowserService;
  readonly config: TestAppConfigStore;

  constructor(
    readonly provider: TestBrowserAuditProvider,
    context: BrowserContext = {
      close: async () => undefined,
    } as unknown as BrowserContext,
  ) {
    this.config = new TestAppConfigStore(provider.info.id);
    this.service = new BackgroundBrowserService({
      audit: this.audit,
      cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
      config: this.config,
      createBackgroundContext: async () => context,
      createLoginContext: async () => context,
      localization,
      logger: { info: () => {} },
      providerRegistry: {
        createProvider: () => provider,
        isKnownProviderId: (providerId): providerId is 'chatgpt' | 'openai-api' | 'claude-web' =>
          providerId === 'chatgpt' || providerId === 'openai-api' || providerId === 'claude-web',
      },
    });
  }
}

describe('browser session startup state', () => {
  it('classifies saved-session startup states', () => {
    assert.equal(
      getBrowserSessionStartupState({ providerReady: false, sessionLoaded: true }),
      BrowserSessionStartupState.TemporaryFailure,
    );
    assert.equal(
      getBrowserSessionStartupState({ providerReady: false, sessionLoaded: false }),
      BrowserSessionStartupState.Expired,
    );
    assert.equal(
      getBrowserSessionStartupState({ providerReady: true, sessionLoaded: true }),
      BrowserSessionStartupState.Ready,
    );
  });

  it('preserves a provider-specific readiness failure and accepts an injected fallback', () => {
    const providerError = 'Claude readiness failed safely';
    const fallback = localization.translate('error.noAccessToken');

    assert.equal(getBrowserSessionStartupError(providerError, fallback), providerError);
    assert.equal(getBrowserSessionStartupError(null, fallback), fallback);
  });

  it('audits settings readiness, provider readiness, and shutdown without a live browser', async () => {
    const fixture = new BackgroundBrowserServiceFixture(new TestBrowserAuditProvider());

    const status = await fixture.service.initialize();
    await fixture.service.shutdown();

    assert.equal(status.ready, true);
    assert.equal(fixture.provider.shutdownCalls, 1);
    assert.deepEqual(
      fixture.audit.operations.map((operation) => operation.input.operation),
      ['settings-readiness', 'readiness', 'shutdown'],
    );
    assert.deepEqual(
      fixture.audit.operations.map((operation) => getTerminalEvents(operation).map((event) => event.outcome)),
      [['success'], ['success'], ['success']],
    );
  });

  it('audits browser session loading with bounded semantic phases', async () => {
    let contextCloseCalls = 0;
    const context = {
      close: async () => {
        contextCloseCalls += 1;
      },
    } as unknown as BrowserContext;
    const fixture = new BackgroundBrowserServiceFixture(new TestBrowserAuditProvider(true), context);

    const status = await fixture.service.initialize();
    await fixture.service.shutdown();

    assert.equal(status.ready, true);
    assert.equal(fixture.provider.loadSessionCalls, 1);
    assert.equal(contextCloseCalls, 1);
    const sessionLoad = fixture.audit.operations.find((operation) => operation.input.operation === 'session-load');
    assert.ok(sessionLoad);
    assert.deepEqual(
      getTerminalEvents(sessionLoad).map((event) => event.outcome),
      ['success'],
    );
    assert.equal(
      sessionLoad.events.filter((event) => event.event === 'phase-entered' && event.phase === 'session').length,
      1,
    );
  });

  it('reports uncertain browser cleanup ownership without changing swallowed close behavior', async () => {
    const privacyCanary = 'private browser path /home/private https://private.invalid stack-private';
    const context = {
      close: async () => {
        throw new TypeError(privacyCanary);
      },
    } as unknown as BrowserContext;
    const fixture = new BackgroundBrowserServiceFixture(new TestBrowserAuditProvider(true), context);

    await fixture.service.initialize();
    await assert.doesNotReject(() => fixture.service.shutdown());

    const shutdown = fixture.audit.operations.find((operation) => operation.input.operation === 'shutdown');
    assert.ok(shutdown);
    const terminal = getTerminalEvents(shutdown)[0];
    assert.equal(terminal?.outcome, 'failure');
    assert.equal(terminal?.metadata?.causeCode, 'cleanup-failed');
    assert.doesNotMatch(JSON.stringify(shutdown), /private browser path|private\.invalid|\/home\/private/u);
  });

  it('audits expired-session clearing and preserves the auth-expired status', async () => {
    const fixture = new BackgroundBrowserServiceFixture(new TestBrowserAuditProvider(true, false));

    const status = await fixture.service.initialize();

    assert.equal(status.ready, false);
    assert.equal(status.authExpired, true);
    assert.equal(fixture.provider.clearSessionCalls, 1);
    const sessionClear = fixture.audit.operations.find((operation) => operation.input.operation === 'session-clear');
    assert.ok(sessionClear);
    assert.deepEqual(
      getTerminalEvents(sessionClear).map((event) => event.outcome),
      ['success'],
    );
  });

  it('retains a failed provider shutdown for the existing retry path', async () => {
    const provider = new TestBrowserAuditProvider();
    provider.shutdownFailures = 1;
    const fixture = new BackgroundBrowserServiceFixture(provider);
    await fixture.service.initialize();

    await assert.rejects(() => fixture.service.shutdown());
    await assert.doesNotReject(() => fixture.service.shutdown());

    assert.equal(provider.shutdownCalls, 2);
    const shutdowns = fixture.audit.operations.filter((operation) => operation.input.operation === 'shutdown');
    assert.deepEqual(
      shutdowns.map((operation) => getTerminalEvents(operation)[0]?.outcome),
      ['failure', 'success'],
    );
    assert.doesNotMatch(JSON.stringify(shutdowns), /private shutdown failure|\/home\/private/u);
  });
});
