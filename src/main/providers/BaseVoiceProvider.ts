import type { BrowserContext, Page } from 'playwright-core';

export type VoiceProviderAuthType = 'browserSession' | 'apiKey';

export interface VoiceProviderInfo {
  id: string;
  name: string;
  authType: VoiceProviderAuthType;
  loginUrl?: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  raw?: string;
}

/** Shared lifecycle and transcription contract for every supported voice provider. */
export abstract class BaseVoiceProvider {
  abstract readonly info: VoiceProviderInfo;

  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected accessToken = '';

  /** Whether this provider needs a persistent browser context for transcription */
  requiresBrowserSession(): boolean {
    return this.info.authType === 'browserSession';
  }

  /** Initialize provider page within an existing browser context */
  initPage(_context: BrowserContext): Promise<void> {
    return Promise.resolve();
  }

  /** Perform login flow in a visible browser — return the page to navigate */
  getLoginUrl(): string {
    return this.info.loginUrl || '';
  }

  /** Extract and cache the access token from the provider page */
  fetchAccessToken(): Promise<string> {
    return Promise.resolve('');
  }

  /** Refresh an expired access token */
  refreshAccessToken(): Promise<string> {
    return Promise.resolve('');
  }

  /** Transcribe audio buffer → text */
  abstract transcribe(buffer: ArrayBuffer, mimeType?: string): Promise<TranscriptionResult>;

  /** Check if this provider has a valid session file */
  abstract hasSession(): boolean;

  /** Remove persisted session data when it is invalid or expired */
  abstract clearSession(): void;

  /** Save session state from a login browser context */
  saveSession(_context: BrowserContext): Promise<void> {
    return Promise.resolve();
  }

  /** Load persisted session cookies into the given context */
  loadSession(_context: BrowserContext): Promise<boolean> {
    return Promise.resolve(this.hasSession());
  }

  /** Cleanup provider-specific resources */
  shutdown(): Promise<void> {
    this.page = null;
    this.context = null;
    this.accessToken = '';
    return Promise.resolve();
  }

  getPage(): Page | null {
    return this.page;
  }

  getAccessToken(): string {
    return this.accessToken;
  }

  isReady(): boolean {
    return this.page !== null && this.accessToken.length > 0;
  }
}
