import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expireBrowserSessionSettings,
  getProviderLoginState,
  isActiveProviderSettingsChange,
  isProviderConfigured,
} from '@renderer/providerState';
import type { ProviderSettings } from '@renderer/types';

describe('providerState', () => {
  it('treats auth-expired background status as logged out even with a saved session', () => {
    assert.deepEqual(getProviderLoginState('browserSession', true, { ready: false, authExpired: true }), {
      isLoggedIn: false,
      isLoading: false,
      sessionExpired: true,
    });
  });

  it('treats ready background status as logged in', () => {
    assert.deepEqual(getProviderLoginState('browserSession', false, { ready: true }), {
      isLoggedIn: true,
      isLoading: false,
      sessionExpired: false,
    });
  });

  it('requires browser readiness when a saved session temporarily fails to start', () => {
    assert.deepEqual(getProviderLoginState('browserSession', true, { ready: false, error: 'Browser startup failed' }), {
      isLoggedIn: false,
      isLoading: false,
      sessionExpired: false,
    });
  });

  it('falls back to saved session state when background status is not resolved', () => {
    assert.deepEqual(getProviderLoginState('browserSession', true), {
      isLoggedIn: false,
      isLoading: true,
      sessionExpired: false,
    });
    assert.deepEqual(getProviderLoginState('browserSession', false), {
      isLoggedIn: false,
      isLoading: false,
      sessionExpired: false,
    });
  });

  it('uses only API-key presence for API-provider readiness', () => {
    assert.deepEqual(getProviderLoginState('apiKey', false, { ready: true }), {
      isLoggedIn: false,
      isLoading: false,
      sessionExpired: false,
    });
    assert.deepEqual(getProviderLoginState('apiKey', true, { ready: false, authExpired: true }), {
      isLoggedIn: true,
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

  it('applies provider settings events only to the active provider', () => {
    const settings: ProviderSettings = {
      providerId: 'claude-web',
      authType: 'browserSession',
      hasSession: true,
      language: 'en-US',
    };

    assert.equal(isActiveProviderSettingsChange(settings, 'claude-web'), true);
    assert.equal(isActiveProviderSettingsChange(settings, 'chatgpt'), false);
    assert.equal(isProviderConfigured(settings), true);
    assert.equal(isProviderConfigured({ ...settings, hasSession: false }), false);
  });
});
