import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BaseTranslateProvider } from '@main/translateProviders/BaseTranslateProvider';
import { TRANSLATION_PROVIDER_DEFINITIONS, TranslationProviderRegistry } from '@main/translateProviders';
import { TRANSLATION_PROVIDER_IDS, TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';

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
    const registry = new TranslationProviderRegistry(definitions);

    assert.deepEqual(Object.keys(TRANSLATION_PROVIDER_DEFINITIONS), ['google', 'bing', 'yandex']);
    assert.deepEqual(registry.getAvailableProviderInfo(), [
      TRANSLATION_PROVIDER_INFO.google,
      TRANSLATION_PROVIDER_INFO.bing,
      TRANSLATION_PROVIDER_INFO.yandex,
    ]);
    assert.equal(factoryCalls, 0);
  });

  it('constructs at most one valid provider per exact ID', async () => {
    const registry = new TranslationProviderRegistry();

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
    const registry = new TranslationProviderRegistry();

    for (const providerId of ['deepl', 'experimental', '', null]) {
      assert.throws(() => registry.getProvider(providerId), /Unknown translation provider/u);
    }
  });
});
