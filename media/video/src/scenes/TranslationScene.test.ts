import assert from 'node:assert/strict';
import test from 'node:test';
import { prompts } from '../data/content.ts';
import { getTranslationViewState } from '../data/translationState.ts';
import { getVideoUiState } from '../data/uiFixtures.ts';

test('translation follows selection, F11, processing, copied, and paste cue frames', () => {
  assert.deepEqual(getTranslationViewState(0), {
    fixtureId: 'translationSelection',
    showHotkey: false,
    showResult: false,
  });
  assert.equal(getTranslationViewState(62).showHotkey, true);
  assert.equal(getTranslationViewState(100).fixtureId, 'translatingSelection');
  assert.equal(getTranslationViewState(221).showResult, false);
  assert.equal(getTranslationViewState(222).fixtureId, 'translationCopied');
  assert.equal(getTranslationViewState(299).showResult, false);
  assert.equal(getTranslationViewState(300).showResult, true);
});

test('translation turns a Russian voice input into an English result without rendering Russian text', () => {
  const translationFixtures = ['translationSelection', 'translatingSelection', 'translationCopied'] as const;

  for (const fixtureId of translationFixtures) assert.equal(getVideoUiState(fixtureId).targetLang, 'en');
  assert.equal(prompts.translation.inputLanguage, 'Russian');
  assert.equal(prompts.translation.targetLanguage, 'English');
  assert.equal(prompts.translation.source, 'Russian voice input');
  assert.match(prompts.translation.result, /^[\x00-\x7F]+$/);
});
