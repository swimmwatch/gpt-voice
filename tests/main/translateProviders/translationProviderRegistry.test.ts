import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BaseTranslateProvider } from '@main/translateProviders/BaseTranslateProvider';
import { TRANSLATION_PROVIDER_DEFINITIONS, TranslationProviderRegistry } from '@main/translateProviders';
import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  type TranslationProviderId,
} from '@shared/translationProvider';
import {
  createTranslationAuditRecorder,
  noopTranslationProviderAudit,
} from './translationAuditTestUtils';

const NOOP_AUDIT_DEPENDENCIES = {
  audit: noopTranslationProviderAudit,
  now: () => 1_000,
};

describe('translation provider registry', () => {
  it('is exhaustive and exposes shared metadata without constructing providers', () => {
    let factoryCalls = 0;
    const createFactory = (providerId: (typeof TRANSLATION_PROVIDER_IDS)[number]) => () => {
      factoryCalls += 1;
      return TRANSLATION_PROVIDER_DEFINITIONS[providerId].factory();
    };
    const definitions: typeof TRANSLATION_PROVIDER_DEFINITIONS = {
      google: { factory: createFactory('google'), info: TRANSLATION_PROVIDER_INFO.google },
      bing: { factory: createFactory('bing'), info: TRANSLATION_PROVIDER_INFO.bing },
      yandex: { factory: createFactory('yandex'), info: TRANSLATION_PROVIDER_INFO.yandex },
    };
    const registry = new TranslationProviderRegistry(definitions, NOOP_AUDIT_DEPENDENCIES);

    assert.deepEqual(Object.keys(TRANSLATION_PROVIDER_DEFINITIONS), ['google', 'bing', 'yandex']);
    assert.deepEqual(registry.getAvailableProviderInfo(), [
      TRANSLATION_PROVIDER_INFO.google,
      TRANSLATION_PROVIDER_INFO.bing,
      TRANSLATION_PROVIDER_INFO.yandex,
    ]);
    assert.equal(factoryCalls, 0);
  });

  it('constructs at most one valid provider per exact ID', async () => {
    const registry = new TranslationProviderRegistry(TRANSLATION_PROVIDER_DEFINITIONS, NOOP_AUDIT_DEPENDENCIES);

    for (const providerId of TRANSLATION_PROVIDER_IDS) {
      const first = registry.getProvider(providerId);
      const second = registry.getProvider(providerId);
      assert.equal(first instanceof BaseTranslateProvider, true);
      assert.equal(first, second);
      assert.equal(first.info, TRANSLATION_PROVIDER_INFO[providerId]);
      assert.equal(first.info.id, providerId);
    }

    await registry.shutdown();
  });

  it('fails closed for DeepL and unknown or blank identifiers', () => {
    const registry = new TranslationProviderRegistry(TRANSLATION_PROVIDER_DEFINITIONS, NOOP_AUDIT_DEPENDENCIES);

    for (const providerId of ['deepl', 'experimental', '', null]) {
      assert.throws(() => registry.getProvider(providerId), /Unknown translation provider/u);
    }
  });

  it('attempts every shutdown and retains only failed provider ownership for retry', async () => {
    const recorder = createTranslationAuditRecorder();
    let now = 1_000;
    const registry = new TranslationProviderRegistry(TRANSLATION_PROVIDER_DEFINITIONS, {
      audit: recorder.audit,
      now: () => {
        now += 1;
        return now;
      },
    });
    const instances = (
      registry as unknown as {
        instances: Map<TranslationProviderId, BaseTranslateProvider>;
      }
    ).instances;
    let bingFails = true;
    const google = {
      shutdown: async () => {},
    } as unknown as BaseTranslateProvider;
    const bing = {
      shutdown: async () => {
        if (bingFails) throw new Error('synthetic close failure');
      },
    } as unknown as BaseTranslateProvider;
    instances.set('google', google);
    instances.set('bing', bing);

    const failed = await registry.shutdown();

    assert.deepEqual(failed, {
      success: false,
      failedProviderIds: ['bing'],
    });
    assert.equal(instances.has('google'), false);
    assert.equal(instances.get('bing'), bing);

    bingFails = false;
    const retried = await registry.shutdown();

    assert.deepEqual(retried, {
      success: true,
      failedProviderIds: [],
    });
    assert.equal(instances.size, 0);
    assert.deepEqual(
      recorder.operations.map((operation) =>
        'providerId' in operation.input ? operation.input.providerId : undefined,
      ),
      ['google', 'bing', 'bing'],
    );
    assert.deepEqual(
      recorder.operations.map(
        (operation) => operation.events.filter((event) => event.event === 'terminal').length,
      ),
      [1, 1, 1],
    );
    const [googleOperation, firstBingOperation, secondBingOperation] = recorder.operations;
    assert.equal(googleOperation?.events[googleOperation.events.length - 1]?.outcome, 'success');
    assert.equal(firstBingOperation?.events[firstBingOperation.events.length - 1]?.outcome, 'failure');
    assert.equal(
      firstBingOperation?.events[firstBingOperation.events.length - 1]?.metadata?.errorClass,
      'cleanup',
    );
    assert.equal(secondBingOperation?.events[secondBingOperation.events.length - 1]?.outcome, 'success');
  });
});
