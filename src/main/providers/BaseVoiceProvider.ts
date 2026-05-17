import type { BrowserContext, Page } from 'playwright-core';

export interface VoiceProviderInfo {
  id: string;
  name: string;
  loginUrl: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  raw?: string;
}

export abstract class BaseVoiceProvider {
  abstract readonly info: VoiceProviderInfo;

  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected accessToken = '';

  /** Initialize provider page within an existing browser context */
  abstract initPage(context: BrowserContext): Promise<void>;

  /** Perform login flow in a visible browser — return the page to navigate */
  abstract getLoginUrl(): string;

  /** Extract and cache the access token from the provider page */
  abstract fetchAccessToken(): Promise<string>;

  /** Refresh an expired access token */
  abstract refreshAccessToken(): Promise<string>;

  /** Transcribe audio buffer → text */
  abstract transcribe(buffer: ArrayBuffer, mimeType?: string): Promise<TranscriptionResult>;

  /** Check if this provider has a valid session file */
  abstract hasSession(): boolean;

  /** Remove persisted session data when it is invalid or expired */
  abstract clearSession(): void;

  /** Save session state from a login browser context */
  abstract saveSession(context: BrowserContext): Promise<void>;

  /** Load persisted session cookies into the given context */
  abstract loadSession(context: BrowserContext): Promise<boolean>;

  /** Cleanup provider-specific resources */
  async shutdown(): Promise<void> {
    this.page = null;
    this.context = null;
    this.accessToken = '';
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
