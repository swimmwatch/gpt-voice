import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  createTranslationSettingsCandidate,
  getSelectedTranslationTarget,
  resolveTranslationSettingsSave,
} from '@renderer/translationSettingsViewState';
import type { TranslationSettings } from '@shared/translationProvider';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function createSettings(): TranslationSettings {
  return {
    providerId: 'bing',
    targetLanguageByProvider: {
      google: 'ru',
      bing: 'uk',
      yandex: 'be',
    },
  };
}

describe('translation settings renderer compatibility state', () => {
  it('derives the selected provider target and changes only that provider', () => {
    const confirmed = createSettings();
    const candidate = createTranslationSettingsCandidate(confirmed, 'en');

    assert.equal(getSelectedTranslationTarget(confirmed), 'uk');
    assert.deepEqual(candidate, {
      providerId: 'bing',
      targetLanguageByProvider: {
        google: 'ru',
        bing: 'en',
        yandex: 'be',
      },
    });
    assert.deepEqual(confirmed, createSettings());
  });

  it('adopts only successful authoritative responses', () => {
    const confirmed = createSettings();
    const authoritative: TranslationSettings = {
      providerId: 'yandex',
      targetLanguageByProvider: {
        google: 'en',
        bing: 'ru',
        yandex: 'uk',
      },
    };

    assert.equal(resolveTranslationSettingsSave(confirmed, { success: true, settings: authoritative }), authoritative);
    assert.equal(
      resolveTranslationSettingsSave(confirmed, {
        success: false,
        settings: authoritative,
        error: 'safe localized error',
      }),
      confirmed,
    );
  });

  it('keeps App on confirmed complete snapshots without adding provider controls', () => {
    const app = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/App.tsx'), 'utf8');
    const translateSection = app.slice(app.indexOf('<TranslateSection'), app.indexOf('</main>'));

    assert.match(app, /useState<TranslationSettings>\(DEFAULT_TRANSLATION_SETTINGS\)/u);
    assert.match(app, /getSelectedTranslationTarget\(translationSettings\)/u);
    assert.match(translateSection, /createTranslationSettingsCandidate\(confirmed, lang\)/u);
    assert.match(translateSection, /resolveTranslationSettingsSave\(current, result\)/u);
    assert.doesNotMatch(translateSection, /providerId=.*Select|TranslationProviderSelect/u);
  });
});
