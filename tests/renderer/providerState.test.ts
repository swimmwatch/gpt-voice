import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expireBrowserSessionSettings, getProviderLoginState } from '@renderer/providerState';
import type { ProviderSettings } from '@renderer/types';

describe('providerState', () => {
  it('treats auth-expired background status as logged out even with a saved session', () => {
    assert.deepEqual(getProviderLoginState(true, { ready: false, authExpired: true }), {
      isLoggedIn: false,
      isLoading: false,
      sessionExpired: true,
    });
  });

  it('treats ready background status as logged in', () => {
    assert.deepEqual(getProviderLoginState(false, { ready: true }), {
      isLoggedIn: true,
      isLoading: false,
      sessionExpired: false,
    });
  });

  it('keeps a saved session logged in when browser startup temporarily fails', () => {
    assert.deepEqual(getProviderLoginState(true, { ready: false, error: 'Browser startup failed' }), {
      isLoggedIn: true,
      isLoading: false,
      sessionExpired: false,
    });
  });

  it('falls back to saved session state when background status is not resolved', () => {
    assert.deepEqual(getProviderLoginState(true), {
      isLoggedIn: true,
      isLoading: true,
      sessionExpired: false,
    });
    assert.deepEqual(getProviderLoginState(false), {
      isLoggedIn: false,
      isLoading: false,
      sessionExpired: false,
    });
  });

  it('marks open browser-session settings as expired', () => {
    const settings: ProviderSettings = {
      providerId: 'chatgpt',
      authType: 'browserSession',
      hasSession: true,
    };

    assert.deepEqual(expireBrowserSessionSettings(settings), {
      providerId: 'chatgpt',
      authType: 'browserSession',
      hasSession: false,
    });
  });
});
