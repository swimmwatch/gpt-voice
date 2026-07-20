export const fps = 60;
export const totalFrames = 3600;

export const sceneIds = [
  'promptProblems',
  'productBridge',
  'transcription',
  'retry',
  'translation',
  'prettification',
  'providers',
  'cta',
] as const;

export type SceneId = (typeof sceneIds)[number];

export interface SceneTiming {
  from: number;
  durationInFrames: number;
}

export const scenes: Record<SceneId, SceneTiming> = {
  promptProblems: { from: 0, durationInFrames: 900 },
  productBridge: { from: 900, durationInFrames: 240 },
  transcription: { from: 1140, durationInFrames: 600 },
  retry: { from: 1740, durationInFrames: 540 },
  translation: { from: 2280, durationInFrames: 420 },
  prettification: { from: 2700, durationInFrames: 420 },
  providers: { from: 3120, durationInFrames: 300 },
  cta: { from: 3420, durationInFrames: 180 },
};

export const posterFrame = 3540;
export const stablePosterRange = { from: 3540, to: 3599 } as const;
