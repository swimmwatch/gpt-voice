import type { VideoUiFixtureId } from './uiFixtures';

export interface TranscriptionViewState {
  fixtureId: VideoUiFixtureId;
  hotkey: 'F10' | 'F9' | null;
  showPastedPrompt: boolean;
  stage: 'copied' | 'recording' | 'stopping' | 'transcribing' | 'waiting';
}

/** Selects a canonical product fixture at every named transcription cue. */
export function getTranscriptionViewState(frame: number): TranscriptionViewState {
  if (frame < 30) return { fixtureId: 'bridgeReady', hotkey: null, showPastedPrompt: false, stage: 'waiting' };
  if (frame < 288) return { fixtureId: 'recordingPrompt', hotkey: 'F9', showPastedPrompt: false, stage: 'recording' };
  if (frame < 390) return { fixtureId: 'stoppingPrompt', hotkey: 'F10', showPastedPrompt: false, stage: 'stopping' };
  if (frame < 480) return { fixtureId: 'transcribingPrompt', hotkey: null, showPastedPrompt: false, stage: 'transcribing' };

  return {
    fixtureId: 'transcriptionCopied',
    hotkey: null,
    showPastedPrompt: frame >= 552,
    stage: 'copied',
  };
}
