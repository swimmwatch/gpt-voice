import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TranslationSettingsState,
  TranslationSettingsValidationError,
  assertValidTranslationSettings,
  normalizePersistedTranslationSettings,
} from '@main/translationSettings';
import {
  DEFAULT_TRANSLATION_SETTINGS,
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  type TranslationProviderId,
  type TranslationSettings,
} from '@shared/translationProvider';

function createSettings(overrides: Partial<TranslationSettings> = {}): TranslationSettings {
  return {
    providerId: 'google',
    targetLanguageByProvider: {
      google: 'en',
      bing: 'en',
      yandex: 'en',
    },
    ...overrides,
  };
}

describe('translation settings', () => {
  it('uses immutable Google/en defaults without browser state', () => {
    assert.deepEqual(DEFAULT_TRANSLATION_SETTINGS, createSettings());
    assert.equal(Object.isFrozen(DEFAULT_TRANSLATION_SETTINGS), true);
    assert.equal(Object.isFrozen(DEFAULT_TRANSLATION_SETTINGS.targetLanguageByProvider), true);
  });

  it('migrates a legacy target independently through each provider inventory', () => {
    const googleOnly = TRANSLATION_PROVIDER_INFO.google.targetLanguages.find(
      (language) =>
        !TRANSLATION_PROVIDER_INFO.bing.targetLanguages.some((candidate) => candidate.code === language.code) ||
        !TRANSLATION_PROVIDER_INFO.yandex.targetLanguages.some((candidate) => candidate.code === language.code),
    );
    assert.ok(googleOnly);
    const googleOnlyCode: string = googleOnly.code;

    const migrated = normalizePersistedTranslationSettings(undefined, googleOnlyCode);

    assert.equal(migrated.settings.providerId, 'google');
    for (const providerId of TRANSLATION_PROVIDER_IDS) {
      const supported: boolean = TRANSLATION_PROVIDER_INFO[providerId].targetLanguages.some(
        (language): boolean => String(language.code) === googleOnlyCode,
      );
      assert.equal(
        migrated.settings.targetLanguageByProvider[providerId],
        supported ? googleOnlyCode : TRANSLATION_PROVIDER_INFO[providerId].defaultTargetLanguage,
      );
    }
    assert.deepEqual(migrated.notice?.categories, ['legacyMigration']);
  });

  it('repairs unknown providers and each invalid target without echoing rejected values', () => {
    const adversarialProvider = 'deepl-private-value';
    const adversarialTarget = 'secret-target-value';
    const normalized = normalizePersistedTranslationSettings(
      {
        providerId: adversarialProvider,
        targetLanguageByProvider: {
          google: adversarialTarget,
          bing: 'ru',
          deepl: 'de',
        },
      },
      undefined,
    );

    assert.deepEqual(
      normalized.settings,
      createSettings({
        targetLanguageByProvider: {
          google: 'en',
          bing: 'ru',
          yandex: 'en',
        },
      }),
    );
    assert.equal(normalized.repaired, true);
    assert.deepEqual(normalized.notice?.providers, ['google', 'yandex']);
    assert.equal(JSON.stringify(normalized.notice).includes(adversarialProvider), false);
    assert.equal(JSON.stringify(normalized.notice).includes(adversarialTarget), false);
  });

  it('rejects partial, blank, extra-key, unknown-provider, and unavailable-code IPC candidates', () => {
    const invalidCandidates: unknown[] = [
      null,
      {},
      { providerId: 'google', targetLanguageByProvider: { google: 'en', bing: 'en' } },
      {
        providerId: 'deepl',
        targetLanguageByProvider: { google: 'en', bing: 'en', yandex: 'en' },
      },
      {
        providerId: 'google',
        targetLanguageByProvider: { google: '', bing: 'en', yandex: 'en' },
      },
      {
        providerId: 'google',
        targetLanguageByProvider: { google: 'en', bing: 'auto-detect', yandex: 'en' },
      },
      {
        providerId: 'google',
        targetLanguageByProvider: { google: 'en', bing: 'en', yandex: 'en', deepl: 'de' },
      },
      {
        providerId: 'google',
        targetLanguageByProvider: { google: 'en', bing: 'en', yandex: 'en' },
        extra: true,
      },
    ];

    for (const candidate of invalidCandidates) {
      assert.throws(() => assertValidTranslationSettings(candidate), TranslationSettingsValidationError);
    }
    assert.doesNotThrow(() => assertValidTranslationSettings(createSettings()));
  });

  it('updates the legacy Google target only after successful durable state changes', () => {
    const state = new TranslationSettingsState();
    state.load(
      createSettings({
        targetLanguageByProvider: { google: 'ru', bing: 'uk', yandex: 'be' },
      }),
      undefined,
      () => {
        throw new Error('valid persisted values must not be rewritten');
      },
    );
    assert.equal(state.getLegacyGoogleTarget(), 'ru');

    const providerOnly = createSettings({
      providerId: 'yandex',
      targetLanguageByProvider: { google: 'ru', bing: 'uk', yandex: 'be' },
    });
    state.save(providerOnly, () => {});
    assert.equal(state.getSnapshot().providerId, 'yandex');
    assert.equal(state.getLegacyGoogleTarget(), 'ru');

    const previous = state.getSnapshot();
    assert.throws(
      () =>
        state.save(
          createSettings({
            providerId: 'bing',
            targetLanguageByProvider: { google: 'uk', bing: 'ru', yandex: 'be' },
          }),
          () => {
            throw new Error('rename failed');
          },
        ),
      /rename failed/u,
    );
    assert.deepEqual(state.getSnapshot(), previous);
    assert.equal(state.getLegacyGoogleTarget(), 'ru');
  });

  it('persists removed-target repair and exposes one aggregate notice per load', () => {
    const state = new TranslationSettingsState();
    const persisted: TranslationSettings[] = [];
    const result = state.load(
      {
        providerId: 'bing',
        targetLanguageByProvider: {
          google: 'ru',
          bing: 'removed-code',
          yandex: 'uk',
        },
      },
      undefined,
      (settings) => persisted.push(settings),
    );

    assert.equal(result.settings.targetLanguageByProvider.bing, 'en');
    assert.equal(persisted.length, 1);
    assert.deepEqual(persisted[0], result.settings);
    assert.ok(state.consumeRepairNotice());
    assert.equal(state.consumeRepairNotice(), null);
  });

  it('normalizes every target field using its own provider default', () => {
    const normalized = normalizePersistedTranslationSettings({
      providerId: 'google',
      targetLanguageByProvider: {},
    });
    const expected = Object.fromEntries(
      TRANSLATION_PROVIDER_IDS.map((providerId) => [
        providerId,
        TRANSLATION_PROVIDER_INFO[providerId].defaultTargetLanguage,
      ]),
    ) as Record<TranslationProviderId, string>;

    assert.deepEqual(normalized.settings.targetLanguageByProvider, expected);
  });
});
