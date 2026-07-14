import type { SceneId } from './timeline.ts';

export interface AudioCue {
  from: number;
  id: string;
  scene: SceneId;
  to?: number;
}

export const audioCues = [
  { id: 'music-start', from: 0, scene: 'promptProblems' },
  { id: 'problem-structure', from: 150, scene: 'promptProblems' },
  { id: 'problem-clarity', from: 330, scene: 'promptProblems' },
  { id: 'problem-language', from: 510, scene: 'promptProblems' },
  { id: 'problem-workflow', from: 690, scene: 'promptProblems' },
  { id: 'recognition-failure', from: 708, scene: 'promptProblems' },
  { id: 'product-reveal', from: 900, scene: 'productBridge' },
  { id: 'action-node-one', from: 966, scene: 'productBridge' },
  { id: 'action-node-two', from: 990, scene: 'productBridge' },
  { id: 'action-node-three', from: 1014, scene: 'productBridge' },
  { id: 'action-node-four', from: 1038, scene: 'productBridge' },
  { id: 'record-hotkey', from: 1170, scene: 'transcription' },
  { id: 'live-sample', from: 1200, to: 1409, scene: 'transcription' },
  { id: 'stop-hotkey', from: 1428, scene: 'transcription' },
  { id: 'transcription-processing', from: 1530, to: 1619, scene: 'transcription' },
  { id: 'transcription-success', from: 1620, scene: 'transcription' },
  { id: 'transcription-paste', from: 1692, scene: 'transcription' },
  { id: 'retry-failure', from: 1752, scene: 'retry' },
  { id: 'retry-hotkey', from: 1902, scene: 'retry' },
  { id: 'retry-processing', from: 1950, to: 2039, scene: 'retry' },
  { id: 'retry-success', from: 2040, scene: 'retry' },
  { id: 'translate-hotkey', from: 2342, scene: 'translation' },
  { id: 'translation-processing', from: 2380, to: 2489, scene: 'translation' },
  { id: 'translation-copied', from: 2502, scene: 'translation' },
  { id: 'translation-paste', from: 2580, scene: 'translation' },
  { id: 'prettify-hotkey', from: 2790, scene: 'prettification' },
  { id: 'prettify-processing', from: 2820, to: 2939, scene: 'prettification' },
  { id: 'prettify-success', from: 2952, scene: 'prettification' },
  { id: 'provider-selection', from: 3150, scene: 'providers' },
  { id: 'session-confirmation', from: 3240, scene: 'providers' },
  { id: 'cta-resolve', from: 3420, to: 3480, scene: 'cta' },
  { id: 'final-fade', from: 3546, to: 3599, scene: 'cta' },
] as const satisfies readonly AudioCue[];
