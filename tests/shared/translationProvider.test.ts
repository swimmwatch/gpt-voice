import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getTranslationLanguage,
  getTranslationProviderInfo,
  INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE,
  isTranslationProviderConnectionState,
  isTranslationProviderId,
  isTranslationTargetLanguage,
  sanitizeTranslationProviderConnectionState,
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
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

  it('defines a closed renderer-safe Translation connection contract', () => {
    assert.deepEqual(Object.values(TRANSLATION_PROVIDER_CONNECTION_STATUSES), [
      'checking',
      'connected',
      'not-connected',
    ]);
    assert.deepEqual(Object.values(TRANSLATION_PROVIDER_CONNECTION_DETAILS), [
      'cancelled',
      'cleanup-failed',
      'consent-or-challenge',
      'invalid-settings',
      'navigation-failed',
      'not-started',
      'opening-provider',
      'page-changed',
      'ready',
      'translation-disabled',
      'unexpected-failure',
    ]);
    assert.deepEqual(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS, {
      changed: 'translation-provider-connection-changed',
      get: 'get-translation-provider-connection',
    });
  });

  it('validates status-detail combinations, selections, and exact keys', () => {
    const connected = {
      detail: 'ready',
      providerId: 'google',
      status: 'connected',
      targetLanguage: 'en',
    };
    assert.equal(isTranslationProviderConnectionState(connected), true);
    assert.equal(isTranslationProviderConnectionState({ ...connected, detail: 'opening-provider' }), false);
    assert.equal(isTranslationProviderConnectionState({ ...connected, providerId: 'private-provider' }), false);
    assert.equal(isTranslationProviderConnectionState({ ...connected, targetLanguage: 'private-target' }), false);
    assert.equal(isTranslationProviderConnectionState({ ...connected, message: 'private-canary' }), false);
  });

  it('sanitizes malformed or sensitive connection payloads to the immutable initial state', () => {
    const sanitized = sanitizeTranslationProviderConnectionState({
      detail: 'navigation-failed',
      message: 'private-message-canary',
      providerId: 'google',
      status: 'not-connected',
      targetLanguage: 'en',
      url: 'https://private.example',
    });
    assert.equal(sanitized, INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE);
    assert.equal(Object.isFrozen(sanitized), true);
    assert.doesNotMatch(JSON.stringify(sanitized), /private|https/i);
  });
});
