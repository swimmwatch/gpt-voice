import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRANSLATION_PROVIDER_OPTIONS, getTranslationLanguageOptions } from '@renderer/translationLanguageOptions';
import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  type TranslationProviderId,
} from '@shared/translationProvider';

const EXPECTED_TARGET_COUNTS: Readonly<Record<TranslationProviderId, number>> = {
  google: 249,
  bing: 179,
  yandex: 118,
};

describe('translation language options', () => {
  it('exposes exactly three providers and every reviewed target without mutating metadata', () => {
    assert.deepEqual(
      TRANSLATION_PROVIDER_OPTIONS.map((option) => option.value),
      ['google', 'bing', 'yandex'],
    );
    assert.equal(
      TRANSLATION_PROVIDER_OPTIONS.some((option) => option.value === ('deepl' as TranslationProviderId)),
      false,
    );

    for (const providerId of TRANSLATION_PROVIDER_IDS) {
      const metadata = TRANSLATION_PROVIDER_INFO[providerId];
      const before = metadata.targetLanguages.map((language) => ({ ...language }));
      const options = getTranslationLanguageOptions(providerId, 'en');

      assert.equal(options.length, EXPECTED_TARGET_COUNTS[providerId], providerId);
      assert.equal(new Set(options.map((option) => option.value)).size, options.length, providerId);
      assert.ok(
        options.every((option) => option.label.trim().length > 0),
        providerId,
      );
      assert.deepEqual(metadata.targetLanguages, before, providerId);
    }
  });

  it('uses localized display names and retains exact provider codes as values', () => {
    const options = getTranslationLanguageOptions('google', 'test-locale', {
      createCollator: () => ({ compare: (left, right) => left.localeCompare(right) }),
      createDisplayNames: (locale) => {
        assert.equal(locale, 'test-locale');
        return {
          of: (code) => (code === 'en' ? 'Localized English' : `Language ${code}`),
        };
      },
    });
    const english = options.find((option) => option.value === 'en');

    assert.deepEqual(english, { label: 'Localized English', value: 'en' });
  });

  it('falls back to checked-in labels for constructor, lookup, blank, and code-echo failures', () => {
    const first = TRANSLATION_PROVIDER_INFO.google.targetLanguages[0];
    assert.ok(first);

    for (const createDisplayNames of [
      () => {
        throw new Error('constructor failure');
      },
      () => ({
        of: () => {
          throw new Error('lookup failure');
        },
      }),
      () => ({ of: () => '   ' }),
      () => ({ of: (code: string) => code }),
    ]) {
      const option = getTranslationLanguageOptions('google', 'en', {
        createDisplayNames,
      }).find(({ value }) => value === first.code);
      assert.equal(option?.label, first.providerLabel);
    }
  });

  it('sorts by the locale collator and breaks equal labels by exact code', () => {
    const seenLocales: string[] = [];
    const reverseOptions = getTranslationLanguageOptions('bing', 'de', {
      createCollator: (locale) => {
        seenLocales.push(locale);
        return { compare: (left, right) => right.localeCompare(left) };
      },
      createDisplayNames: () => ({ of: (code) => `Label ${code}` }),
    });
    assert.deepEqual(seenLocales, ['de']);
    assert.equal(reverseOptions[0]?.label >= reverseOptions[reverseOptions.length - 1].label, true);

    const tiedOptions = getTranslationLanguageOptions('yandex', 'en', {
      createCollator: () => ({ compare: () => 0 }),
      createDisplayNames: () => ({ of: () => 'Same label' }),
    });
    assert.deepEqual(
      tiedOptions.map((option) => option.value),
      [...tiedOptions.map((option) => option.value)].sort(),
    );
  });
});
