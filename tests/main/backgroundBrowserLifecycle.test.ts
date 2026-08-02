/* eslint-disable max-classes-per-file -- Test fixture classes keep independent lifecycle state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserContext } from 'playwright-core';
import { BackgroundBrowserService } from '@main/browser';
import { BatchVoiceProvider } from '@main/providers/BatchVoiceProvider';
import type { TranscriptionResult, VoiceProviderInfo } from '@main/providers/BaseVoiceProvider';
import { LocalWhisperVoiceProvider } from '@main/providers/LocalWhisperVoiceProvider';
import { RecordingVoiceProviderAudit } from './providers/voiceAuditTestUtils';
import { READY_LOCAL_WHISPER_SNAPSHOT, RecordingLocalWhisperCoordinator } from './providers/localWhisperTestUtils';
import type { VoiceProviderAuditId } from '@main/providerAudit/mappings';
import { I18nService } from '@main/i18n';
import { TestAppConfigStore, TestCloakBrowserSettingsRepository } from './appConfigTestUtils';
import { InitialProviderReadinessTestDependencies } from './initialProviderReadinessTestUtils';
import { createLocalWhisperActionFailure } from '@shared/localWhisper';

class Deferred {
  public readonly promise: Promise<void>;
  private resolvePromise: (() => void) | null = null;

  public constructor() {
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  public resolve(): void {
    this.resolvePromise?.();
  }
}

class ReadyLifecycleProvider extends BatchVoiceProvider {
  public readonly info = {
    id: 'openai-api',
    name: 'OpenAI API',
    authType: 'apiKey',
    category: 'api',
    hasSettings: true,
    transcriptionMode: 'batch',
  } satisfies VoiceProviderInfo;
  public readonly shutdownStarted = new Deferred();

  public constructor(private readonly shutdownGate?: Deferred) {
    super();
  }

  public clearSession(): void {}

  public hasSession(): boolean {
    return true;
  }

  public isReady(): boolean {
    return true;
  }

  public override async shutdown(): Promise<void> {
    this.shutdownStarted.resolve();
    await this.shutdownGate?.promise;
    await super.shutdown();
  }

  public transcribe(): Promise<TranscriptionResult> {
    return Promise.resolve({ success: true, text: 'unused' });
  }
}

class FailingShutdownLifecycleProvider extends ReadyLifecycleProvider {
  public override async shutdown(): Promise<void> {
    throw new Error('synthetic provider cleanup failure');
  }
}

class SessionTrapLocalWhisperProvider extends LocalWhisperVoiceProvider {
  public override clearSession(): never {
    throw new Error('Local Whisper clearSession must not be called');
  }

  public override fetchAccessToken(): never {
    throw new Error('Local Whisper fetchAccessToken must not be called');
  }

  public override getLoginUrl(): never {
    throw new Error('Local Whisper getLoginUrl must not be called');
  }

  public override hasSession(): never {
    throw new Error('Local Whisper hasSession must not be called');
  }

  public override initPage(): never {
    throw new Error('Local Whisper initPage must not be called');
  }

  public override isReady(): never {
    throw new Error('Local Whisper isReady must not be called as an authentication gate');
  }

  public override loadSession(): never {
    throw new Error('Local Whisper loadSession must not be called');
  }

  public override refreshAccessToken(): never {
    throw new Error('Local Whisper refreshAccessToken must not be called');
  }

  public override saveSession(): never {
    throw new Error('Local Whisper saveSession must not be called');
  }
}

interface LocalLifecycleHarness {
  readonly config: TestAppConfigStore;
  readonly coordinator: RecordingLocalWhisperCoordinator;
  readonly localProvider: SessionTrapLocalWhisperProvider;
  readonly service: BackgroundBrowserService;
  readonly state: { backgroundContexts: number; loginContexts: number };
}

function createLocalLifecycleHarness(): LocalLifecycleHarness {
  const config = new TestAppConfigStore('local-whisper');
  const coordinator = new RecordingLocalWhisperCoordinator();
  const localProvider = new SessionTrapLocalWhisperProvider(coordinator);
  const remoteProvider = new ReadyLifecycleProvider();
  const state = { backgroundContexts: 0, loginContexts: 0 };
  const context = { close: async () => undefined } as unknown as BrowserContext;
  const service = new BackgroundBrowserService({
    audit: new RecordingVoiceProviderAudit(),
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    config,
    createBackgroundContext: async () => {
      state.backgroundContexts += 1;
      return context;
    },
    createLoginContext: async () => {
      state.loginContexts += 1;
      return context;
    },
    localization: new I18nService(),
    logger: { info: () => {} },
    providerRegistry: {
      createProvider: (providerId) => (providerId === 'local-whisper' ? localProvider : remoteProvider),
      isKnownProviderId: (providerId): providerId is VoiceProviderAuditId =>
        providerId === 'local-whisper' || providerId === 'openai-api',
    },
    readinessDeadline: new InitialProviderReadinessTestDependencies(),
  });
  return { config, coordinator, localProvider, service, state };
}

function createService(provider?: ReadyLifecycleProvider): BackgroundBrowserService {
  const context = { close: async () => undefined } as unknown as BrowserContext;
  return new BackgroundBrowserService({
    audit: new RecordingVoiceProviderAudit(),
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    config: new TestAppConfigStore('openai-api'),
    createBackgroundContext: async () => context,
    createLoginContext: async () => context,
    localization: new I18nService(),
    logger: { info: () => {} },
    providerRegistry: {
      createProvider: () => {
        if (provider) return provider;
        throw new Error('provider construction not expected');
      },
      isKnownProviderId: (providerId): providerId is VoiceProviderAuditId => providerId === 'openai-api',
    },
    readinessDeadline: new InitialProviderReadinessTestDependencies(),
  });
}

describe('background browser lifecycle hooks', () => {
  it('initializes Local Whisper without browser, login, session, or authentication readiness work', async () => {
    const harness = createLocalLifecycleHarness();

    const status = await harness.service.initialize();
    await harness.service.ensure();

    assert.deepEqual(status, { providerId: 'local-whisper', ready: true, error: undefined, authExpired: undefined });
    assert.equal(harness.service.getActiveProvider(), harness.localProvider);
    assert.deepEqual(harness.coordinator.calls, ['readiness']);
    assert.deepEqual(harness.state, { backgroundContexts: 0, loginContexts: 0 });
  });

  it('switches an idle Local Whisper provider only after its coordinator accepts the transition', async () => {
    const harness = createLocalLifecycleHarness();
    await harness.service.initialize();

    const status = await harness.service.switchProvider('openai-api');

    assert.deepEqual(status, { providerId: 'openai-api', ready: true, error: undefined, authExpired: undefined });
    assert.equal(harness.config.getSnapshot().provider, 'openai-api');
    assert.deepEqual(harness.coordinator.calls, ['readiness', 'switch']);
    assert.deepEqual(harness.state, { backgroundContexts: 0, loginContexts: 0 });
  });

  it('keeps the active Local Whisper provider and configuration when switching conflicts', async () => {
    const harness = createLocalLifecycleHarness();
    harness.coordinator.switchResult = createLocalWhisperActionFailure(
      'shutdown',
      'OPERATION_CONFLICT',
      Object.freeze({
        ...READY_LOCAL_WHISPER_SNAPSHOT,
        activity: 'Transcribing',
        operationalStatus: 'Busy',
        canAttempt: false,
        blockingCode: 'OPERATION_CONFLICT',
      }),
    );
    await harness.service.initialize();

    const status = await harness.service.switchProvider('openai-api');

    assert.deepEqual(status, {
      providerId: 'local-whisper',
      ready: true,
      error: 'OPERATION_CONFLICT',
      authExpired: undefined,
    });
    assert.equal(harness.config.getSnapshot().provider, 'local-whisper');
    assert.equal(harness.service.getActiveProvider(), harness.localProvider);
    assert.deepEqual(harness.coordinator.calls, ['readiness', 'switch']);
    assert.deepEqual(harness.state, { backgroundContexts: 0, loginContexts: 0 });
  });

  it('runs registered hooks before teardown and removes them idempotently', async () => {
    const service = createService();
    const calls: string[] = [];
    const removeFirst = service.registerBeforeShutdownHook(() => {
      calls.push('first');
    });
    const removeSecond = service.registerBeforeShutdownHook(async () => {
      calls.push('second');
    });

    await service.shutdown();
    removeFirst();
    removeFirst();
    await service.shutdown();
    removeSecond();

    assert.deepEqual(calls, ['first', 'second', 'second']);
  });

  it('continues through hook failures so browser teardown cannot be blocked', async () => {
    const service = createService();
    const calls: string[] = [];
    service.registerBeforeShutdownHook(() => {
      calls.push('failure');
      throw new Error('expected');
    });
    service.registerBeforeShutdownHook(() => {
      calls.push('success');
    });

    await assert.doesNotReject(() => service.shutdown());

    assert.deepEqual(calls, ['failure', 'success']);
  });

  it('keeps hook ownership isolated between service instances', async () => {
    const first = createService();
    const second = createService();
    const calls: string[] = [];
    first.registerBeforeShutdownHook(() => {
      calls.push('first');
    });
    second.registerBeforeShutdownHook(() => {
      calls.push('second');
    });

    await first.shutdown();

    assert.deepEqual(calls, ['first']);
  });

  it('keeps operation queues isolated between service instances', async () => {
    const firstShutdownGate = new Deferred();
    const firstProvider = new ReadyLifecycleProvider(firstShutdownGate);
    const secondProvider = new ReadyLifecycleProvider();
    const first = createService(firstProvider);
    const second = createService(secondProvider);
    await first.initialize();
    await second.initialize();

    let firstShutdownComplete = false;
    const firstShutdown = first.shutdown().then(() => {
      firstShutdownComplete = true;
    });
    await firstProvider.shutdownStarted.promise;

    await second.shutdown();

    assert.equal(firstShutdownComplete, false);
    firstShutdownGate.resolve();
    await firstShutdown;
    assert.equal(firstShutdownComplete, true);
  });

  it('reports exclusive settings-reset ownership only after provider cleanup succeeds', async () => {
    const successfulProvider = new ReadyLifecycleProvider();
    const successfulService = createService(successfulProvider);
    await successfulService.initialize();

    const successfulRelease = await successfulService.releaseForSettingsReset();

    assert.equal(successfulRelease, true);
    assert.equal(successfulService.isReady(), false);

    const failingService = createService(new FailingShutdownLifecycleProvider());
    await failingService.initialize();

    const failedRelease = await failingService.releaseForSettingsReset();

    assert.equal(failedRelease, false);
    assert.equal(failingService.isReady(), false);
  });
});
