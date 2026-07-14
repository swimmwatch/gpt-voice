import type { VideoUiFixtureId } from './uiFixtures';

export interface RetryViewState {
  fixtureId: VideoUiFixtureId;
  showComparison: boolean;
  showHotkey: boolean;
  showRecoveredPrompt: boolean;
  storedAudioState: 'ready' | 'resending';
}

/** Keeps retry on the original recording; this path intentionally has no recording phase. */
export function getRetryViewState(frame: number): RetryViewState {
  if (frame < 162) {
    return {
      fixtureId: 'recognitionFailed',
      showComparison: true,
      showHotkey: false,
      showRecoveredPrompt: false,
      storedAudioState: 'ready',
    };
  }

  if (frame < 210) {
    return {
      fixtureId: 'recognitionFailed',
      showComparison: true,
      showHotkey: true,
      showRecoveredPrompt: false,
      storedAudioState: 'ready',
    };
  }

  if (frame < 300) {
    return {
      fixtureId: 'retryingStoredAudio',
      showComparison: false,
      showHotkey: false,
      showRecoveredPrompt: false,
      storedAudioState: 'resending',
    };
  }

  return {
    fixtureId: 'transcriptionCopied',
    showComparison: false,
    showHotkey: false,
    showRecoveredPrompt: true,
    storedAudioState: 'ready',
  };
}
