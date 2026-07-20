import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BrowserSessionStartupState,
  getBrowserSessionStartupError,
  getBrowserSessionStartupState,
} from '@main/browser';
import { t } from '@main/i18n';

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

  it('classifies a switched provider from its own restored-session state', () => {
    const previousProviderState = getBrowserSessionStartupState({ providerReady: true, sessionLoaded: true });
    const switchedProviderState = getBrowserSessionStartupState({ providerReady: false, sessionLoaded: false });

    assert.equal(previousProviderState, BrowserSessionStartupState.Ready);
    assert.equal(switchedProviderState, BrowserSessionStartupState.Expired);
  });

  it('preserves a provider-specific readiness failure and falls back for legacy providers', () => {
    const providerError = 'Claude readiness failed safely';

    assert.equal(getBrowserSessionStartupError(providerError), providerError);
    assert.equal(getBrowserSessionStartupError(null), t('error.noAccessToken'));
  });
});
