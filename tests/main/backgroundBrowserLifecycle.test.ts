/* eslint-disable max-classes-per-file -- Test fixture classes keep independent lifecycle state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserContext } from 'playwright-core';
import { BackgroundBrowserService } from '@main/browser';
import { BatchVoiceProvider } from '@main/providers/BatchVoiceProvider';
import type { TranscriptionResult, VoiceProviderInfo } from '@main/providers/BaseVoiceProvider';
import { RecordingVoiceProviderAudit } from './providers/voiceAuditTestUtils';
import type { VoiceProviderAuditId } from '@main/providerAudit/mappings';
import { I18nService } from '@main/i18n';
import { TestAppConfigStore, TestCloakBrowserSettingsRepository } from './appConfigTestUtils';

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
  });
}

describe('background browser lifecycle hooks', () => {
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
});
