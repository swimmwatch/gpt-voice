import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserContext } from 'playwright-core';
import type { TranscriptionResult, VoiceProviderInfo } from '@main/providers/BaseVoiceProvider';
import { BatchVoiceProvider } from '@main/providers/BatchVoiceProvider';

class TestVoiceProvider extends BatchVoiceProvider {
  readonly info = {
    id: 'test',
    name: 'Test Provider',
    authType: 'browserSession',
    category: 'web',
    hasSettings: true,
    transcriptionMode: 'batch',
    loginUrl: 'https://example.com/login',
  } satisfies VoiceProviderInfo;

  async initPage(context: BrowserContext): Promise<void> {
    this.context = context;
  }

  getLoginUrl(): string {
    return this.info.loginUrl || '';
  }

  async fetchAccessToken(): Promise<string> {
    this.accessToken = 'token';
    return this.accessToken;
  }

  async refreshAccessToken(): Promise<string> {
    return this.fetchAccessToken();
  }

  async transcribe(): Promise<TranscriptionResult> {
    return { success: true, text: 'text' };
  }

  hasSession(): boolean {
    return true;
  }

  clearSession(): void {
    this.accessToken = '';
  }

  async saveSession(): Promise<void> {
    return undefined;
  }

  async loadSession(): Promise<boolean> {
    return true;
  }
}

describe('BaseVoiceProvider', () => {
  it('starts without an active page or access token', () => {
    const provider = new TestVoiceProvider();

    assert.equal(provider.getPage(), null);
    assert.equal(provider.getAccessToken(), '');
    assert.equal(provider.isReady(), false);
    assert.deepEqual(provider.getTranscriptionCacheContext(), []);
  });

  it('exposes access token state through the base getter', async () => {
    const provider = new TestVoiceProvider();

    await provider.fetchAccessToken();

    assert.equal(provider.getAccessToken(), 'token');
    assert.equal(provider.isReady(), false);
  });

  it('clears provider runtime state on shutdown', async () => {
    const provider = new TestVoiceProvider();
    await provider.fetchAccessToken();

    await provider.shutdown();

    assert.equal(provider.getPage(), null);
    assert.equal(provider.getAccessToken(), '');
    assert.equal(provider.isReady(), false);
  });
});
