import type { VideoUiFixtureId } from './uiFixtures';

export interface ProvidersViewState {
  fixtureId: VideoUiFixtureId;
}

/** Selects the canonical provider toolbar and saved-session states for the proof scene. */
export function getProvidersViewState(frame: number): ProvidersViewState {
  if (frame < 30) return { fixtureId: 'bridgeReady' };
  if (frame < 120) return { fixtureId: 'openAiApiReady' };

  return { fixtureId: 'chatGptSessionSaved' };
}
