import * as fs from 'fs';
import * as path from 'path';
import type { BrowserContext } from 'playwright-core';
import { BaseVoiceProvider, type VoiceProviderInfo, type TranscriptionResult } from './BaseVoiceProvider';
import {
  getAudioFileExtension,
  getUnexpiredCookies,
  hasUsableSessionState,
  parseChatGptTranscribeResponse,
  shouldRefreshTranscribeToken,
  type SessionState,
} from './chatgptUtils';
import {
  DEFAULT_TRANSCRIPTION_MIME_TYPE,
  TRANSCRIPTION_MODEL_WHISPER_1,
  TRANSCRIPTION_UPLOAD_FILE_BASENAME,
  WEBM_OPUS_TRANSCRIPTION_MIME_TYPE,
} from '@shared/transcriptionConstants';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { APP_DIR } from '../config';
import { writeClipboardText } from '../electronRuntime';
import { StatusCodes } from 'http-status-codes';

const log = createLogger('chatgpt-provider');

const SESSION_FILE = path.join(APP_DIR, 'chatgpt-session.json');
const TOKEN_FILE = path.join(APP_DIR, 'access-token.json');
const CHATGPT_URL = 'https://chatgpt.com';
const CHATGPT_NAVIGATION_TIMEOUT_MS = 60000;
const AUTH_SESSION_TIMEOUT_MS = 15000;
const TRANSCRIBE_RESPONSE_LOG_PREVIEW_CHARS = 500;

const BLOCKED_DOMAINS = [
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'doubleclick.net',
  'googlesyndication.com',
  'facebook.net',
  'facebook.com/tr',
  'sentry.io',
  'cdn.sentry.io',
  'featuregates.org',
  'statsigapi.net',
  'oaistatic.com',
  'intercom.io',
  'intercomcdn.com',
  'browser-intake-datadoghq.com',
];

const BLOCKED_RESOURCE_TYPES = ['image', 'media', 'font', 'stylesheet'];

export class ChatGPTVoiceProvider extends BaseVoiceProvider {
  readonly info: VoiceProviderInfo = {
    id: 'chatgpt',
    name: 'ChatGPT Web',
    authType: 'browserSession',
    loginUrl: 'https://chatgpt.com',
  };

  async initPage(context: BrowserContext): Promise<void> {
    this.context = context;
    this.page = await context.newPage();

    // Block heavy resources for performance
    await this.page.route('**/*', (route) => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();

      if (BLOCKED_RESOURCE_TYPES.includes(resourceType)) {
        return route.abort();
      }
      if (BLOCKED_DOMAINS.some((d) => url.includes(d))) {
        return route.abort();
      }
      return route.continue();
    });

    await this.navigateToChatGPT();

    // Load token: try cache first, then fetch from page
    this.accessToken = this.loadCachedToken();
    if (!this.accessToken) {
      this.accessToken = await this.fetchAccessToken();
    }
    log.info('Access token ready, length:', this.accessToken.length);
  }

  getLoginUrl(): string {
    return this.info.loginUrl || CHATGPT_URL;
  }

  hasSession(): boolean {
    const sessionData = this.readSessionState();
    if (!sessionData) return false;
    if (hasUsableSessionState(sessionData)) return true;

    log.warn('Stored ChatGPT session is missing valid auth cookies; clearing it');
    this.clearSession();
    return false;
  }

  clearSession(): void {
    try {
      if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
    } catch {
      /* ignore */
    }
    this.clearCachedToken();
  }

  async saveSession(context: BrowserContext): Promise<void> {
    const state = await context.storageState();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
    log.info('Session saved');
  }

  async loadSession(context: BrowserContext): Promise<boolean> {
    const sessionData = this.readSessionState();
    if (!sessionData) return false;
    if (!hasUsableSessionState(sessionData)) {
      log.warn('Stored ChatGPT session expired before it could be loaded');
      this.clearSession();
      return false;
    }

    const cookies = getUnexpiredCookies(sessionData.cookies || []);
    await context.addCookies(cookies);
    return true;
  }

  async fetchAccessToken(): Promise<string> {
    if (!this.page) return '';
    log.info('Fetching access token from page...');
    const token = await this.fetchAccessTokenFromPage();
    if (token) {
      this.accessToken = token;
      this.saveCachedToken(token);
    }
    return token;
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.page) return '';
    this.accessToken = await this.fetchAccessTokenFromPage();
    log.info('Access token refreshed, length:', this.accessToken.length);
    if (this.accessToken) {
      this.saveCachedToken(this.accessToken);
    } else {
      this.clearCachedToken();
    }
    return this.accessToken;
  }

  async transcribe(buffer: ArrayBuffer, mimeType = WEBM_OPUS_TRANSCRIPTION_MIME_TYPE): Promise<TranscriptionResult> {
    try {
      log.info('Transcribing, audio size:', buffer.byteLength, 'bytes', 'mime:', mimeType);

      if (!this.page) {
        return { success: false, error: t('error.notLoggedIn') };
      }

      let token = this.accessToken;
      if (!token) {
        token = await this.refreshAccessToken();
      }
      if (!token) {
        return { success: false, error: t('error.noAccessToken') };
      }

      const audioBase64 = Buffer.from(buffer).toString('base64');
      const resp = await this.transcribeViaPage(audioBase64, token, mimeType);

      log.info('Transcribe response status:', resp.status);
      if (resp.status !== StatusCodes.OK) {
        log.error('Transcribe response body:', resp.body.substring(0, TRANSCRIBE_RESPONSE_LOG_PREVIEW_CHARS));
      }

      if (shouldRefreshTranscribeToken(resp.status)) {
        log.info('Access token may have expired (status', resp.status, '), refreshing...');
        token = await this.refreshAccessToken();
        if (token) {
          const retryResp = await this.transcribeViaPage(audioBase64, token, mimeType);
          log.info('Retry response status:', retryResp.status);
          if (retryResp.status !== StatusCodes.OK) {
            log.error('Retry response body:', retryResp.body.substring(0, TRANSCRIBE_RESPONSE_LOG_PREVIEW_CHARS));
          }
          return this.parseTranscribeResponse(retryResp, mimeType);
        }
      }

      return this.parseTranscribeResponse(resp, mimeType);
    } catch (err: unknown) {
      log.error('Transcribe error:', err instanceof Error ? err.message : err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async shutdown(): Promise<void> {
    this.clearCachedToken();
    await super.shutdown();
  }

  // --- Private helpers ---

  private async navigateToChatGPT(): Promise<void> {
    if (!this.page) return;

    log.info('Navigating to chatgpt.com...');
    const response = await this.page.goto(CHATGPT_URL, {
      waitUntil: 'domcontentloaded',
      timeout: CHATGPT_NAVIGATION_TIMEOUT_MS,
    });
    log.info('Page loaded, URL:', this.page.url(), 'status:', response?.status() ?? 'n/a');

    try {
      await this.page.waitForLoadState('load', { timeout: 10000 });
    } catch {
      log.warn('ChatGPT load event did not settle quickly; continuing after DOMContentLoaded');
    }
  }

  private async fetchAccessTokenFromPage(): Promise<string> {
    if (!this.page) return '';

    return this.page.evaluate(async (timeoutMs: number) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return '';
        const json = await res.json();
        return typeof json.accessToken === 'string' ? json.accessToken : '';
      } catch {
        return '';
      } finally {
        window.clearTimeout(timer);
      }
    }, AUTH_SESSION_TIMEOUT_MS);
  }

  private async transcribeViaPage(audioBase64: string, accessToken: string, mimeType: string) {
    return this.page!.evaluate(
      async ({
        audioBase64: b64,
        accessToken: token,
        mimeType: uploadMimeType,
        fileExtension: uploadExtension,
        defaultMimeType,
        uploadFileBasename,
        transcriptionModel,
      }: {
        audioBase64: string;
        accessToken: string;
        mimeType: string;
        fileExtension: string;
        defaultMimeType: string;
        uploadFileBasename: string;
        transcriptionModel: string;
      }) => {
        const binaryStr = atob(b64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: uploadMimeType || defaultMimeType });
        const formData = new FormData();
        formData.append('file', blob, `${uploadFileBasename}.${uploadExtension}`);
        formData.append('model', transcriptionModel);

        const res = await fetch('/backend-api/transcribe', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: '*/*',
            'OAI-Language': navigator.language || 'en-US',
          },
          body: formData,
        });
        const text = await res.text();
        return { status: res.status, body: text };
      },
      {
        audioBase64,
        accessToken,
        mimeType,
        fileExtension: getAudioFileExtension(mimeType),
        defaultMimeType: DEFAULT_TRANSCRIPTION_MIME_TYPE,
        uploadFileBasename: TRANSCRIPTION_UPLOAD_FILE_BASENAME,
        transcriptionModel: TRANSCRIPTION_MODEL_WHISPER_1,
      },
    );
  }

  private parseTranscribeResponse(resp: { status: number; body: string }, mimeType: string): TranscriptionResult {
    const parsed = parseChatGptTranscribeResponse(resp, mimeType);
    if (parsed.success && parsed.text) {
      log.info('Transcription success, text length:', parsed.text.length);
      writeClipboardText(parsed.text);
    }
    return parsed;
  }

  private loadCachedToken(): string {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
        if (data.accessToken) {
          log.info('Loaded cached token, length:', data.accessToken.length);
          return data.accessToken;
        }
      }
    } catch {
      log.error('Failed to load cached token');
    }
    return '';
  }

  private readSessionState(): SessionState | null {
    try {
      if (!fs.existsSync(SESSION_FILE)) return null;
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    } catch {
      log.error('Failed to load session');
      return null;
    }
  }

  private saveCachedToken(accessToken: string): void {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ accessToken, savedAt: Date.now() }, null, 2));
    } catch {
      log.error('Failed to save cached token');
    }
  }

  private clearCachedToken(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
    } catch {
      /* ignore */
    }
  }
}
