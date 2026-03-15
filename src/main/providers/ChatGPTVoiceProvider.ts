import * as fs from 'fs';
import * as path from 'path';
import { clipboard } from 'electron';
import type { BrowserContext } from 'playwright';
import { BaseVoiceProvider, type VoiceProviderInfo, type TranscriptionResult } from './BaseVoiceProvider';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { APP_DIR } from '../config';
import { StatusCodes } from 'http-status-codes';

const log = createLogger('chatgpt-provider');

const SESSION_FILE = path.join(APP_DIR, 'chatgpt-session.json');
const TOKEN_FILE = path.join(APP_DIR, 'access-token.json');

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
    name: 'ChatGPT',
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

    log.info('Navigating to chatgpt.com...');
    await this.page.goto('https://chatgpt.com', { waitUntil: 'networkidle' });
    log.info('Page loaded, URL:', this.page.url());

    // Load token: try cache first, then fetch from page
    this.accessToken = this.loadCachedToken();
    if (!this.accessToken) {
      this.accessToken = await this.fetchAccessToken();
    }
    log.info('Access token ready, length:', this.accessToken.length);
  }

  getLoginUrl(): string {
    return this.info.loginUrl;
  }

  hasSession(): boolean {
    return fs.existsSync(SESSION_FILE);
  }

  async saveSession(context: BrowserContext): Promise<void> {
    const state = await context.storageState();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
    log.info('Session saved');
  }

  async loadSession(context: BrowserContext): Promise<boolean> {
    if (!fs.existsSync(SESSION_FILE)) return false;
    try {
      const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      await context.addCookies(sessionData.cookies || []);
      return true;
    } catch {
      log.error('Failed to load session');
      return false;
    }
  }

  async fetchAccessToken(): Promise<string> {
    if (!this.page) return '';
    log.info('Fetching access token from page...');
    const token = await this.page.evaluate(async () => {
      const res = await fetch('/api/auth/session');
      const json = await res.json();
      return json.accessToken || '';
    });
    if (token) {
      this.accessToken = token;
      this.saveCachedToken(token);
    }
    return token;
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.page) return '';
    this.accessToken = await this.page.evaluate(async () => {
      const res = await fetch('/api/auth/session');
      const json = await res.json();
      return json.accessToken || '';
    });
    log.info('Access token refreshed, length:', this.accessToken.length);
    if (this.accessToken) {
      this.saveCachedToken(this.accessToken);
    } else {
      this.clearCachedToken();
    }
    return this.accessToken;
  }

  async transcribe(buffer: ArrayBuffer): Promise<TranscriptionResult> {
    try {
      log.info('Transcribing, audio size:', buffer.byteLength, 'bytes');

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
      const resp = await this.transcribeViaPage(audioBase64, token);

      log.info('Transcribe response status:', resp.status);
      if (resp.status !== StatusCodes.OK) {
        log.error('Transcribe response body:', resp.body.substring(0, 500));
      }

      // If auth error or server error, try refreshing the token once and retry
      if (
        resp.status === StatusCodes.UNAUTHORIZED ||
        resp.status === StatusCodes.FORBIDDEN ||
        resp.status === StatusCodes.INTERNAL_SERVER_ERROR
      ) {
        log.info('Token may have expired (status', resp.status, '), refreshing...');
        token = await this.refreshAccessToken();
        if (token) {
          const retryResp = await this.transcribeViaPage(audioBase64, token);
          log.info('Retry response status:', retryResp.status);
          if (retryResp.status !== StatusCodes.OK) {
            log.error('Retry response body:', retryResp.body.substring(0, 500));
          }
          return this.parseTranscribeResponse(retryResp);
        }
      }

      return this.parseTranscribeResponse(resp);
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

  private async transcribeViaPage(audioBase64: string, accessToken: string) {
    return this.page!.evaluate(
      async ({ audioBase64, accessToken }: { audioBase64: string; accessToken: string }) => {
        const binaryStr = atob(audioBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        formData.append('model', 'whisper-1');

        const res = await fetch('/backend-api/transcribe', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: '*/*',
            'OAI-Language': navigator.language || 'en-US',
          },
          body: formData,
        });
        const text = await res.text();
        return { status: res.status, body: text };
      },
      { audioBase64, accessToken },
    );
  }

  private parseTranscribeResponse(resp: { status: number; body: string }): TranscriptionResult {
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(resp.body);
    } catch {
      return {
        success: false,
        error: t('error.nonJsonResponse', { status: String(resp.status), body: resp.body.substring(0, 300) }),
      };
    }

    const text = String(result.text || result.transcript || '');
    if (text) {
      log.info('Transcription success:', text);
      clipboard.writeText(text);
      return { success: true, text };
    }
    return { success: false, error: t('error.noTranscription'), raw: JSON.stringify(result) };
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
