import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getTranslationLanguage,
  getTranslationProviderInfo,
  isTranslationProviderId,
  isTranslationTargetLanguage,
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  type TranslationProviderId,
  type TranslationSettings,
} from '@shared/translationProvider';

describe('translation provider contracts', () => {
  it('defines exactly the approved providers and metadata', () => {
    assert.deepEqual(TRANSLATION_PROVIDER_IDS, ['google', 'bing', 'yandex']);
    assert.deepEqual(
      TRANSLATION_PROVIDER_IDS.map((providerId) => {
        const provider = TRANSLATION_PROVIDER_INFO[providerId];
        return {
          contractVersion: provider.contractVersion,
          defaultTargetLanguage: provider.defaultTargetLanguage,
          id: provider.id,
          maxInputCharacters: provider.maxInputCharacters,
          name: provider.name,
          targetCount: provider.targetLanguages.length,
        };
      }),
      [
        {
          contractVersion: '2026-07-25',
          defaultTargetLanguage: 'en',
          id: 'google',
          maxInputCharacters: 5_000,
          name: 'Google',
          targetCount: 249,
        },
        {
          contractVersion: '2026-07-25',
          defaultTargetLanguage: 'en',
          id: 'bing',
          maxInputCharacters: 1_000,
          name: 'Bing',
          targetCount: 179,
        },
        {
          contractVersion: '2026-07-25',
          defaultTargetLanguage: 'en',
          id: 'yandex',
          maxInputCharacters: 10_000,
          name: 'Yandex',
          targetCount: 118,
        },
      ],
    );
  });

  it('fails closed for unknown provider IDs and target codes', () => {
    for (const providerId of TRANSLATION_PROVIDER_IDS) {
      assert.equal(isTranslationProviderId(providerId), true);
      assert.equal(getTranslationProviderInfo(providerId)?.id, providerId);
      assert.equal(isTranslationTargetLanguage(providerId, 'en'), true);
      assert.equal(getTranslationLanguage(providerId, 'en')?.code, 'en');
    }

    for (const value of ['', 'Google', 'deepl', null, 1]) {
      assert.equal(isTranslationProviderId(value), false);
      assert.equal(getTranslationProviderInfo(value), undefined);
      assert.equal(getTranslationLanguage(value, 'en'), undefined);
    }

    for (const code of ['', 'auto', 'auto-detect', 'EN', null, 1]) {
      assert.equal(isTranslationTargetLanguage('google', code), false);
      assert.equal(getTranslationLanguage('google', code), undefined);
    }
  });

  it('keeps provider-specific Yandex codes distinct', () => {
    for (const code of ['pt-BR', 'sr-Latn', 'kazlat', 'uzbcyr']) {
      assert.equal(getTranslationLanguage('yandex', code)?.code, code);
    }
    assert.notEqual(getTranslationLanguage('yandex', 'pt-BR'), getTranslationLanguage('yandex', 'pt'));
  });

  it('contains no DeepL provider, metadata, inventory, or placeholder', () => {
    assert.equal(isTranslationProviderId('deepl'), false);
    assert.equal('deepl' in TRANSLATION_PROVIDER_INFO, false);
    assert.equal(
      TRANSLATION_PROVIDER_IDS.some((providerId) =>
        TRANSLATION_PROVIDER_INFO[providerId].targetLanguages.some(
          ({ code, providerLabel }) =>
            code.toLowerCase().includes('deepl') || providerLabel.toLowerCase().includes('deepl'),
        ),
      ),
      false,
    );
  });

  it('requires complete provider settings at the type boundary', () => {
    const providerId: TranslationProviderId = 'google';
    const settings: TranslationSettings = {
      providerId,
      targetLanguageByProvider: {
        bing: 'en',
        google: 'en',
        yandex: 'en',
      },
    };
    assert.equal(settings.targetLanguageByProvider[providerId], 'en');
  });
});
