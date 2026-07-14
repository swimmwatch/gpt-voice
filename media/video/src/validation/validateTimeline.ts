import { audioCues, type AudioCue } from '../data/audioCues.ts';
import {
  fps,
  posterFrame,
  sceneIds,
  scenes,
  stablePosterRange,
  totalFrames,
  type SceneId,
  type SceneTiming,
} from '../data/timeline.ts';

export interface TimelineValidationInput {
  audioCues: readonly AudioCue[];
  posterFrame: number;
  scenes: Readonly<Record<SceneId, SceneTiming>>;
  totalFrames: number;
}

const defaultInput: TimelineValidationInput = {
  audioCues,
  posterFrame,
  scenes,
  totalFrames,
};

function sceneEnd(scene: SceneTiming): number {
  return scene.from + scene.durationInFrames;
}

function isInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function getTimelineValidationErrors(input: TimelineValidationInput = defaultInput): string[] {
  const errors: string[] = [];
  let expectedStart = 0;

  for (const sceneId of sceneIds) {
    const scene = input.scenes[sceneId];

    if (!isInteger(scene.from) || !Number.isInteger(scene.durationInFrames) || scene.durationInFrames <= 0) {
      errors.push(`${sceneId} has an invalid frame range.`);
      continue;
    }

    if (scene.from !== expectedStart) {
      errors.push(`${sceneId} starts at ${scene.from}, expected ${expectedStart}.`);
    }

    expectedStart = sceneEnd(scene);
  }

  if (expectedStart !== input.totalFrames) {
    errors.push(`Timeline ends at ${expectedStart}, expected ${input.totalFrames}.`);
  }

  const cta = input.scenes.cta;
  const ctaLastFrame = sceneEnd(cta) - 1;
  if (input.posterFrame < stablePosterRange.from || input.posterFrame > stablePosterRange.to) {
    errors.push(`Poster frame ${input.posterFrame} is outside the stable poster range.`);
  }
  if (input.posterFrame < cta.from || input.posterFrame > ctaLastFrame) {
    errors.push(`Poster frame ${input.posterFrame} is outside the CTA scene.`);
  }

  for (const cue of input.audioCues) {
    const cueEnd = cue.to ?? cue.from;
    const owner = input.scenes[cue.scene];
    const ownerLastFrame = sceneEnd(owner) - 1;

    if (!isInteger(cue.from) || !isInteger(cueEnd) || cueEnd < cue.from) {
      errors.push(`${cue.id} has an invalid cue range.`);
      continue;
    }

    if (cue.from < owner.from || cueEnd > ownerLastFrame) {
      errors.push(`${cue.id} falls outside its ${cue.scene} scene.`);
    }
  }

  return errors;
}

export function assertValidTimeline(input: TimelineValidationInput = defaultInput): void {
  const errors = getTimelineValidationErrors(input);

  if (errors.length > 0) {
    throw new Error(`Timeline validation failed:\n- ${errors.join('\n- ')}`);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assertValidTimeline();
  process.stdout.write(`Timeline validation passed at ${fps} fps.\n`);
}
