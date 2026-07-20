import type { VideoUiFixtureId } from './uiFixtures';

export interface PrettificationViewState {
  fixtureId: VideoUiFixtureId;
  showHotkey: boolean;
  showResult: boolean;
}

/** Selects the deterministic selected-text Prettify states at the approved cue frames. */
export function getPrettificationViewState(frame: number): PrettificationViewState {
  if (frame < 90) return { fixtureId: 'prettifySelection', showHotkey: false, showResult: false };
  if (frame < 120) return { fixtureId: 'prettifySelection', showHotkey: true, showResult: false };
  if (frame < 252) return { fixtureId: 'prettifyingSelection', showHotkey: false, showResult: false };

  return { fixtureId: 'prettifiedSelection', showHotkey: false, showResult: true };
}
