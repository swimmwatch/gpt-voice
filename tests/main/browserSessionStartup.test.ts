import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserContext } from 'playwright-core';
import {
  BrowserSessionStartupState,
  getBrowserSessionStartupError,
  getBrowserSessionStartupState,
  initBackgroundBrowser,
  shutdownBackgroundBrowser,
} from '@main/browser';
import { t } from '@main/i18n';
import { BatchVoiceProvider } from '@main/providers/BatchVoiceProvider';
import type { TranscriptionResult, VoiceProviderInfo } from '@main/providers/BaseVoiceProvider';
import { RecordingVoiceProviderAudit, getTerminalEvents } from './providers/voiceAuditTestUtils';

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

describe('browser session startup state', () => {
  it('treats a missing access token after loading a saved session as temporary', () => {
    assert.equal(
      getBrowserSessionStartupState({ providerReady: false, sessionLoaded: true }),
      BrowserSessionStartupState.TemporaryFailure,
    );
  });

  it('treats an unloadable saved session as expired', () => {
    assert.equal(
      getBrowserSessionStartupState({ providerReady: false, sessionLoaded: false }),
      BrowserSessionStartupState.Expired,
    );
  });

  it('treats a loaded and ready provider as ready', () => {
    assert.equal(
      getBrowserSessionStartupState({ providerReady: true, sessionLoaded: true }),
      BrowserSessionStartupState.Ready,
    );
  });

  it('classifies a switched provider from its own restored-session state', () => {
    const previousProviderState = getBrowserSessionStartupState({ providerReady: true, sessionLoaded: true });
    const switchedProviderState = getBrowserSessionStartupState({ providerReady: false, sessionLoaded: false });

    assert.equal(previousProviderState, BrowserSessionStartupState.Ready);
    assert.equal(switchedProviderState, BrowserSessionStartupState.Expired);
  });

  it('preserves a provider-specific readiness failure and falls back for legacy providers', () => {
    const providerError = 'Claude readiness failed safely';

    assert.equal(getBrowserSessionStartupError(providerError), providerError);
    assert.equal(getBrowserSessionStartupError(null), t('error.noAccessToken'));
  });

  it('audits settings readiness, provider readiness, and shutdown without a live browser', async () => {
    const provider = new TestBrowserAuditProvider();
    const audit = new RecordingVoiceProviderAudit();

    try {
      const status = await initBackgroundBrowser({
        audit: audit,
        providerFactory: () => provider,
      });

      assert.equal(status.ready, true);
    } finally {
      await shutdownBackgroundBrowser();
    }

    assert.equal(provider.shutdownCalls, 1);
    assert.deepEqual(
      audit.operations.map((operation) => operation.input.operation),
      ['settings-readiness', 'readiness', 'shutdown'],
    );
    assert.deepEqual(
      audit.operations.map((operation) => getTerminalEvents(operation).map((event) => event.outcome)),
      [['success'], ['success'], ['success']],
    );
  });

  it('audits browser session loading with bounded semantic phases', async () => {
    const provider = new TestBrowserAuditProvider(true);
    const audit = new RecordingVoiceProviderAudit();
    let contextCloseCalls = 0;
    const context = {
      close: async () => {
        contextCloseCalls += 1;
      },
    } as unknown as BrowserContext;

    try {
      const status = await initBackgroundBrowser({
        audit: audit,
        backgroundContextFactory: async () => context,
        providerFactory: () => provider,
      });

      assert.equal(status.ready, true);
    } finally {
      await shutdownBackgroundBrowser();
    }

    assert.equal(provider.loadSessionCalls, 1);
    assert.equal(contextCloseCalls, 1);
    const sessionLoad = audit.operations.find((operation) => operation.input.operation === 'session-load');
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
    const provider = new TestBrowserAuditProvider(true);
    const audit = new RecordingVoiceProviderAudit();
    const context = {
      close: async () => {
        throw new TypeError(privacyCanary);
      },
    } as unknown as BrowserContext;

    await initBackgroundBrowser({
      audit: audit,
      backgroundContextFactory: async () => context,
      providerFactory: () => provider,
    });
    await assert.doesNotReject(() => shutdownBackgroundBrowser());

    const shutdown = audit.operations.find((operation) => operation.input.operation === 'shutdown');
    assert.ok(shutdown);
    const terminal = getTerminalEvents(shutdown)[0];
    assert.equal(terminal?.outcome, 'failure');
    assert.equal(terminal?.metadata?.causeCode, 'cleanup-failed');
    assert.doesNotMatch(JSON.stringify(shutdown), /private browser path|private\.invalid|\/home\/private/u);
  });

  it('audits expired-session clearing and preserves the auth-expired status', async () => {
    const provider = new TestBrowserAuditProvider(true, false);
    const audit = new RecordingVoiceProviderAudit();
    const context = {
      close: async () => undefined,
    } as unknown as BrowserContext;

    const status = await initBackgroundBrowser({
      audit: audit,
      backgroundContextFactory: async () => context,
      providerFactory: () => provider,
    });

    assert.equal(status.ready, false);
    assert.equal(status.authExpired, true);
    assert.equal(provider.clearSessionCalls, 1);
    const sessionClear = audit.operations.find((operation) => operation.input.operation === 'session-clear');
    assert.ok(sessionClear);
    assert.deepEqual(
      getTerminalEvents(sessionClear).map((event) => event.outcome),
      ['success'],
    );
  });

  it('retains a failed provider shutdown for the existing retry path', async () => {
    const provider = new TestBrowserAuditProvider();
    provider.shutdownFailures = 1;
    const audit = new RecordingVoiceProviderAudit();
    await initBackgroundBrowser({
      audit: audit,
      providerFactory: () => provider,
    });

    await assert.rejects(() => shutdownBackgroundBrowser());
    await assert.doesNotReject(() => shutdownBackgroundBrowser());

    assert.equal(provider.shutdownCalls, 2);
    const shutdowns = audit.operations.filter((operation) => operation.input.operation === 'shutdown');
    assert.deepEqual(
      shutdowns.map((operation) => getTerminalEvents(operation)[0]?.outcome),
      ['failure', 'success'],
    );
    assert.doesNotMatch(JSON.stringify(shutdowns), /private shutdown failure|\/home\/private/u);
  });
});
