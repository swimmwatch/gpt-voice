import type { VideoUiFixtureId } from './uiFixtures';

export interface TranslationViewState {
  fixtureId: VideoUiFixtureId;
  showHotkey: boolean;
  showResult: boolean;
}

/** Selects the deterministic Russian-speech-to-English states at the approved cue frames. */
export function getTranslationViewState(frame: number): TranslationViewState {
  if (frame < 62) return { fixtureId: 'translationSelection', showHotkey: false, showResult: false };
  if (frame < 100) return { fixtureId: 'translationSelection', showHotkey: true, showResult: false };
  if (frame < 222) return { fixtureId: 'translatingSelection', showHotkey: false, showResult: false };

  return { fixtureId: 'translationCopied', showHotkey: false, showResult: frame >= 300 };
}
