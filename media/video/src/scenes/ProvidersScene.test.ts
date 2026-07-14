import assert from 'node:assert/strict';
import test from 'node:test';
import { claims } from '../data/content.ts';
import { getProvidersViewState } from '../data/providersState.ts';
import { getVideoUiState } from '../data/uiFixtures.ts';

test('provider proof shows both canonical providers and then the saved ChatGPT Web session', () => {
  assert.equal(getProvidersViewState(0).fixtureId, 'bridgeReady');
  assert.equal(getVideoUiState(getProvidersViewState(0).fixtureId).activeProviderId, 'chatgpt');
  assert.equal(getProvidersViewState(30).fixtureId, 'openAiApiReady');
  assert.equal(getVideoUiState(getProvidersViewState(30).fixtureId).activeProviderId, 'openai-api');
  assert.equal(getProvidersViewState(120).fixtureId, 'chatGptSessionSaved');
  assert.equal(getVideoUiState(getProvidersViewState(120).fixtureId).providerModal, 'chatgpt-session-saved');
});

test('the provider qualification is available for every frame in the 300-frame scene', () => {
  for (const frame of [0, 29, 30, 119, 120, 240, 299]) {
    assert.match(claims.providerQualification, /does not bypass quotas/);
    assert.equal(getProvidersViewState(frame).fixtureId.length > 0, true);
  }
});
