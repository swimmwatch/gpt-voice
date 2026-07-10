import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSessionStartupState, getBrowserSessionStartupState } from '@main/browser';

describe('browser session startup state', () => {
  it('treats a missing access token after loading a saved session as temporary', () => {
    assert.equal(
      getBrowserSessionStartupState({ providerReady: false, sessionLoaded: true }),
      BrowserSessionStartupState.TemporaryFailure,
    );
  });

  it('treats an unloadable saved session as expired', () => {
    assert.equal(
      getBrowserSessionStartupState({ providerReady: false, sessionLoaded: false }),
      BrowserSessionStartupState.Expired,
    );
  });

  it('treats a loaded and ready provider as ready', () => {
    assert.equal(
      getBrowserSessionStartupState({ providerReady: true, sessionLoaded: true }),
      BrowserSessionStartupState.Ready,
    );
  });
});
