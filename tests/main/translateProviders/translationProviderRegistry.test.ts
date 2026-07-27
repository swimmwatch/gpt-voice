/* eslint-disable max-classes-per-file -- provider and factory fakes own isolated registry state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserContext } from 'playwright-core';

import {
  TranslationProviderFactory,
  TranslationProviderRegistry,
  type TranslationProviderFactoryContract,
  type TranslationProviderInstance,
} from '@main/translateProviders';
import {
  BingTranslateProvider,
  createPlaywrightBingTranslatePageAdapter,
} from '@main/translateProviders/BingTranslateProvider';
import {
  GoogleTranslateProvider,
  createPlaywrightGoogleTranslatePageAdapter,
} from '@main/translateProviders/GoogleTranslateProvider';
import {
  YandexTranslateProvider,
  createPlaywrightYandexTranslatePageAdapter,
} from '@main/translateProviders/YandexTranslateProvider';
import type {
  TranslationProviderOutcome,
  TranslationProviderRequest,
} from '@main/translateProviders/translationProviderContracts';
import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  type TranslationProviderId,
  type TranslationProviderInfo,
} from '@shared/translationProvider';
import { noopTranslationProviderAudit, RecordingTranslationProviderAudit } from './translationAuditTestUtils';

class TestTranslationProvider implements TranslationProviderInstance {
  public readonly translate = (_request: TranslationProviderRequest): Promise<TranslationProviderOutcome> => {
    return Promise.reject(new Error('Unexpected test translation'));
  };
  public shutdownCalls = 0;
  public shutdownFails = false;

  public constructor(public readonly info: TranslationProviderInfo) {}

  public readonly shutdown = async (): Promise<void> => {
    this.shutdownCalls += 1;
    if (this.shutdownFails) throw new Error('synthetic close failure');
  };
}

class TestTranslationProviderFactory implements TranslationProviderFactoryContract {
  public readonly createCalls: TranslationProviderId[] = [];
  public readonly providers: Readonly<Record<TranslationProviderId, TestTranslationProvider>>;

  public constructor() {
    this.providers = {
      google: new TestTranslationProvider(TRANSLATION_PROVIDER_INFO.google),
      bing: new TestTranslationProvider(TRANSLATION_PROVIDER_INFO.bing),
      yandex: new TestTranslationProvider(TRANSLATION_PROVIDER_INFO.yandex),
    };
  }

  public create(providerId: TranslationProviderId): TranslationProviderInstance {
    this.createCalls.push(providerId);
    return this.providers[providerId];
  }

  public getProviderInfo(providerId: TranslationProviderId): TranslationProviderInfo {
    return TRANSLATION_PROVIDER_INFO[providerId];
  }
}

function createProductionFactory(): TranslationProviderFactory {
  return new TranslationProviderFactory({
    createBingPageAdapter: createPlaywrightBingTranslatePageAdapter,
    createContext: async () => ({ close: async () => undefined }) as BrowserContext,
    createContextOptions: () => ({ headless: true }),
    createGooglePageAdapter: createPlaywrightGoogleTranslatePageAdapter,
    createYandexPageAdapter: createPlaywrightYandexTranslatePageAdapter,
    now: () => 1_000,
    sleep: async () => undefined,
  });
}

describe('translation provider registry', () => {
  it('is exhaustive and exposes shared metadata without constructing providers', () => {
    const factory = new TestTranslationProviderFactory();
    const registry = new TranslationProviderRegistry(factory, noopTranslationProviderAudit, () => 1_000);

    assert.deepEqual(registry.getAvailableProviderInfo(), [
      TRANSLATION_PROVIDER_INFO.google,
      TRANSLATION_PROVIDER_INFO.bing,
      TRANSLATION_PROVIDER_INFO.yandex,
    ]);
    assert.deepEqual(factory.createCalls, []);
  });

  it('constructs every concrete provider through the exhaustive production factory', async () => {
    const registry = new TranslationProviderRegistry(
      createProductionFactory(),
      noopTranslationProviderAudit,
      () => 1_000,
    );
    const expectedConstructors = {
      google: GoogleTranslateProvider,
      bing: BingTranslateProvider,
      yandex: YandexTranslateProvider,
    };

    for (const providerId of TRANSLATION_PROVIDER_IDS) {
      const first = registry.getProvider(providerId);
      const second = registry.getProvider(providerId);
      assert.equal(first instanceof expectedConstructors[providerId], true);
      assert.equal(first, second);
      assert.equal(first.info, TRANSLATION_PROVIDER_INFO[providerId]);
      assert.equal(first.info.id, providerId);
    }

    await registry.shutdown();
  });

  it('fails closed for DeepL and unknown or blank identifiers', () => {
    const registry = new TranslationProviderRegistry(
      new TestTranslationProviderFactory(),
      noopTranslationProviderAudit,
      () => 1_000,
    );

    for (const providerId of ['deepl', 'experimental', '', null]) {
      assert.throws(() => registry.getProvider(providerId), /Unknown translation provider/u);
    }
  });

  it('attempts every shutdown and retains only failed provider ownership for retry', async () => {
    const recorder = new RecordingTranslationProviderAudit();
    const factory = new TestTranslationProviderFactory();
    factory.providers.bing.shutdownFails = true;
    let now = 1_000;
    const registry = new TranslationProviderRegistry(factory, recorder, () => {
      now += 1;
      return now;
    });
    registry.getProvider('google');
    registry.getProvider('bing');

    const failed = await registry.shutdown();

    assert.deepEqual(failed, {
      success: false,
      failedProviderIds: ['bing'],
    });
    assert.equal(factory.providers.google.shutdownCalls, 1);
    assert.equal(factory.providers.bing.shutdownCalls, 1);

    factory.providers.bing.shutdownFails = false;
    const retried = await registry.shutdown();

    assert.deepEqual(retried, {
      success: true,
      failedProviderIds: [],
    });
    assert.equal(factory.providers.google.shutdownCalls, 1);
    assert.equal(factory.providers.bing.shutdownCalls, 2);
    assert.deepEqual(
      recorder.operations.map((operation) =>
        'providerId' in operation.input ? operation.input.providerId : undefined,
      ),
      ['google', 'bing', 'bing'],
    );
    assert.deepEqual(
      recorder.operations.map((operation) => operation.events.filter((event) => event.event === 'terminal').length),
      [1, 1, 1],
    );
    const [googleOperation, firstBingOperation, secondBingOperation] = recorder.operations;
    assert.equal(googleOperation?.events[googleOperation.events.length - 1]?.outcome, 'success');
    assert.equal(firstBingOperation?.events[firstBingOperation.events.length - 1]?.outcome, 'failure');
    assert.equal(firstBingOperation?.events[firstBingOperation.events.length - 1]?.metadata?.errorClass, 'cleanup');
    assert.equal(secondBingOperation?.events[secondBingOperation.events.length - 1]?.outcome, 'success');
  });

  it('keeps lazy provider ownership isolated between registries', () => {
    const firstFactory = new TestTranslationProviderFactory();
    const secondFactory = new TestTranslationProviderFactory();
    const first = new TranslationProviderRegistry(firstFactory, noopTranslationProviderAudit, () => 0);
    const second = new TranslationProviderRegistry(secondFactory, noopTranslationProviderAudit, () => 0);

    assert.notEqual(first.getProvider('google'), second.getProvider('google'));
    assert.deepEqual(firstFactory.createCalls, ['google']);
    assert.deepEqual(secondFactory.createCalls, ['google']);
  });
});
