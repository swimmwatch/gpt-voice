import {
  VIDEO_UI_FIXTURE_IDS,
  VIDEO_UI_PATHS,
  type VideoUiFixtureId,
  type VideoUiFixtures,
  type VideoUiState,
} from '../data/uiFixtures.ts';

const providerIds = new Set(['chatgpt', 'openai-api']);
const promptModes = new Set(['draft', 'prettified', 'rough', 'selected', 'translated']);
const recordingLifecycleStates = new Set([
  'idle',
  'starting',
  'recording',
  'paused',
  'stopping',
  'transcribing',
  'retrying',
]);
const retryableAudioStates = new Set(['none', 'resending', 'stored']);

function requireValidState(id: VideoUiFixtureId, state: VideoUiState): void {
  if (!providerIds.has(state.activeProviderId)) throw new Error(`${id}: unsupported provider`);
  if (!recordingLifecycleStates.has(state.lifecycle)) throw new Error(`${id}: unsupported lifecycle`);
  if (!promptModes.has(state.promptMode)) throw new Error(`${id}: unsupported prompt mode`);
  if (!retryableAudioStates.has(state.retryableAudio)) throw new Error(`${id}: unsupported retryable audio state`);
  if (state.targetLang !== 'en') throw new Error(`${id}: target language must be English`);
  if (!state.contentId.trim()) throw new Error(`${id}: content identifier is required`);

  if (state.lifecycle === 'retrying') {
    if (state.retryableAudio !== 'resending') throw new Error(`${id}: retry must be resending stored audio`);
    if (!state.audio.id || state.audio.id !== state.audio.requestAudioId) {
      throw new Error(`${id}: retry must reuse the original audio identity`);
    }
  }
}

export function validateVideoUiFixtures(fixtures: VideoUiFixtures): void {
  for (const id of VIDEO_UI_FIXTURE_IDS) requireValidState(id, fixtures[id]);

  for (const id of VIDEO_UI_PATHS.retry) {
    if (fixtures[id].lifecycle === 'recording') throw new Error('retry path must not contain a second recording state');
  }

  for (const id of VIDEO_UI_PATHS.translation) {
    if (fixtures[id].targetLang !== 'en') throw new Error('translation path must target English');
  }
}
