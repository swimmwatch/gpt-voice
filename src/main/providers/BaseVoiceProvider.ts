import type { BrowserContext, Page } from 'playwright-core';
import type { PrettifyReasoning } from '@shared/prettifySettings';

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

export interface TextProcessingResult {
  success: boolean;
  text?: string;
  error?: string;
  raw?: string;
}

export interface PrettifyTextOptions {
  prompt: string;
  reasoning: PrettifyReasoning;
  signal?: AbortSignal;
}

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
  async initPage(_context: BrowserContext): Promise<void> {
    return undefined;
  }

  /** Perform login flow in a visible browser — return the page to navigate */
  getLoginUrl(): string {
    return this.info.loginUrl || '';
  }

  /** Extract and cache the access token from the provider page */
  async fetchAccessToken(): Promise<string> {
    return '';
  }

  /** Refresh an expired access token */
  async refreshAccessToken(): Promise<string> {
    return '';
  }

  /** Transcribe audio buffer → text */
  abstract transcribe(buffer: ArrayBuffer, mimeType?: string): Promise<TranscriptionResult>;

  /** Improve selected text using the provider's text model */
  abstract prettifyText(text: string, options: PrettifyTextOptions): Promise<TextProcessingResult>;

  /** Check if this provider has a valid session file */
  abstract hasSession(): boolean;

  /** Remove persisted session data when it is invalid or expired */
  abstract clearSession(): void;

  /** Save session state from a login browser context */
  async saveSession(_context: BrowserContext): Promise<void> {
    return undefined;
  }

  /** Load persisted session cookies into the given context */
  async loadSession(_context: BrowserContext): Promise<boolean> {
    return this.hasSession();
  }

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
