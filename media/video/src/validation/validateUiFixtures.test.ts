import assert from 'node:assert/strict';
import test from 'node:test';
import { VIDEO_UI_PATHS, videoUiFixtures } from '../data/uiFixtures.ts';
import { validateVideoUiFixtures } from './validateUiFixtures.ts';

function cloneFixtures() {
  return structuredClone(videoUiFixtures);
}

test('video UI fixtures cover the approved deterministic states', () => {
  validateVideoUiFixtures(videoUiFixtures);
  assert.deepEqual(VIDEO_UI_PATHS.retry, ['recognitionFailed', 'retryingStoredAudio']);
  assert.deepEqual(VIDEO_UI_PATHS.translation, ['translationSelection', 'translatingSelection', 'translationCopied']);
  assert.equal(videoUiFixtures.translatingSelection.statusDetail, 'Translating selection...');
  assert.equal(videoUiFixtures.translationCopied.promptMode, 'translated');
  assert.equal(videoUiFixtures.prettifyingSelection.statusDetail, 'Prettifying selection...');
  assert.equal(videoUiFixtures.prettifiedSelection.promptMode, 'prettified');
});

test('video UI fixtures reject invalid providers, content, translation targets, and retry identity', () => {
  const unsupportedProvider = cloneFixtures();
  unsupportedProvider.bridgeReady.activeProviderId = 'unsupported' as never;
  assert.throws(() => validateVideoUiFixtures(unsupportedProvider));

  const missingContent = cloneFixtures();
  missingContent.prettifySelection.contentId = '';
  assert.throws(() => validateVideoUiFixtures(missingContent));

  const wrongTarget = cloneFixtures();
  wrongTarget.translationSelection.targetLang = 'ru';
  assert.throws(() => validateVideoUiFixtures(wrongTarget));

  const mismatchedRetry = cloneFixtures();
  mismatchedRetry.retryingStoredAudio.audio.requestAudioId = 'different-audio';
  assert.throws(() => validateVideoUiFixtures(mismatchedRetry));
});

test('video UI fixtures reject a retry path that records a second time', () => {
  const fixtures = cloneFixtures();
  fixtures.recognitionFailed.lifecycle = 'recording';
  assert.throws(() => validateVideoUiFixtures(fixtures));
});
