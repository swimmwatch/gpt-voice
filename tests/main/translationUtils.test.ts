import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleTranslateUrl,
  createTranslationLogMetadata,
  normalizeGoogleTranslateTargetLang,
  shouldNavigateGoogleTranslate,
} from '@main/services/translationUtils';

describe('translationUtils', () => {
  it('builds Google Translate URLs for the requested target language', () => {
    const url = new URL(buildGoogleTranslateUrl(' uk '));

    assert.equal(url.origin, 'https://translate.google.ru');
    assert.equal(url.searchParams.get('sl'), 'auto');
    assert.equal(url.searchParams.get('tl'), 'uk');
    assert.equal(url.searchParams.get('op'), 'translate');
  });

  it('falls back to English when the target language is blank', () => {
    assert.equal(normalizeGoogleTranslateTargetLang('  '), 'en');
    assert.equal(new URL(buildGoogleTranslateUrl('')).searchParams.get('tl'), 'en');
  });

  it('detects whether Google Translate needs target-language navigation', () => {
    assert.equal(shouldNavigateGoogleTranslate('ru', ' ru '), false);
    assert.equal(shouldNavigateGoogleTranslate('ru', 'uk'), true);
    assert.equal(shouldNavigateGoogleTranslate(null, 'en'), true);
  });

  it('creates safe translation log metadata without transcript contents', () => {
    const metadata = createTranslationLogMetadata('private transcript', ' be ');

    assert.deepEqual(metadata, {
      textLength: 18,
      targetLang: 'be',
    });
    assert.equal(JSON.stringify(metadata).includes('private transcript'), false);
  });
});
