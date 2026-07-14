import assert from 'node:assert/strict';
import test from 'node:test';
import { audioCues, type AudioCue } from '../data/audioCues.ts';
import { posterFrame, scenes, totalFrames } from '../data/timeline.ts';
import { getTimelineValidationErrors, type TimelineValidationInput } from './validateTimeline.ts';

function createInput(overrides: Partial<TimelineValidationInput> = {}): TimelineValidationInput {
  return {
    audioCues,
    posterFrame,
    scenes,
    totalFrames,
    ...overrides,
  };
}

test('accepts the approved 3600-frame timeline', () => {
  assert.deepEqual(getTimelineValidationErrors(), []);
});

test('rejects a scene gap', () => {
  const invalidScenes = {
    ...scenes,
    productBridge: { ...scenes.productBridge, from: 901 },
  };

  assert.match(
    getTimelineValidationErrors(createInput({ scenes: invalidScenes })).join('\n'),
    /productBridge starts at 901/,
  );
});

test('rejects a non-positive scene duration', () => {
  const invalidScenes = {
    ...scenes,
    retry: { ...scenes.retry, durationInFrames: 0 },
  };

  assert.match(
    getTimelineValidationErrors(createInput({ scenes: invalidScenes })).join('\n'),
    /retry has an invalid frame range/,
  );
});

test('rejects a final scene that does not end at frame 3600', () => {
  const invalidScenes = {
    ...scenes,
    cta: { ...scenes.cta, durationInFrames: 179 },
  };

  assert.match(getTimelineValidationErrors(createInput({ scenes: invalidScenes })).join('\n'), /Timeline ends at 3599/);
});

test('rejects an audio cue outside its assigned scene', () => {
  const invalidAudioCues: AudioCue[] = [
    ...audioCues,
    { id: 'outside-transcription', from: 1140, scene: 'transcription', to: 1740 },
  ];

  assert.match(
    getTimelineValidationErrors(createInput({ audioCues: invalidAudioCues })).join('\n'),
    /outside-transcription falls outside/,
  );
});

test('rejects a poster frame outside the stable CTA hold', () => {
  assert.match(
    getTimelineValidationErrors(createInput({ posterFrame: 3539 })).join('\n'),
    /outside the stable poster range/,
  );
});
