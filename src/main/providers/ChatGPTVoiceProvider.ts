import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';
import type { TranscriptionResult, VoiceProviderInfo } from './BaseVoiceProvider';
import { BatchVoiceProvider } from './BatchVoiceProvider';
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
import { presentNotificationError } from '@shared/notifications';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { BrowserNavigationService, retryBrowserNavigation } from '../browserNavigationRetry';
import { APP_DIR } from '../config';
import { writeClipboardText } from '../electronRuntime';
import { StatusCodes } from 'http-status-codes';

const log = createLogger('chatgpt-provider');

const SESSION_FILE = path.join(APP_DIR, 'chatgpt-session.json');
const TOKEN_FILE = path.join(APP_DIR, 'access-token.json');
const CHATGPT_URL = 'https://chatgpt.com';
const CHATGPT_NAVIGATION_TIMEOUT_MS = 60000;
const AUTH_SESSION_TIMEOUT_MS = 15000;
const TRANSCRIPTION_MAX_ATTEMPTS = 2;
const TRANSCRIPTION_RETRY_DELAY_MS = 500;
const TRANSCRIPTION_PAGE_RECOVERY_TIMEOUT_MS = 5000;

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
  'intercom.io',
  'intercomcdn.com',
  'browser-intake-datadoghq.com',
];

const BLOCKED_RESOURCE_TYPES = ['image', 'media', 'font', 'stylesheet'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface ChatGptTranscribeResponse {
  status: number;
  body: string;
}

type ChatGptPageTranscriptionResult = ({ kind: 'response' } & ChatGptTranscribeResponse) | { kind: 'request-failed' };

type ChatGptTranscriptionAttempt =
  | ({ page: Page } & Extract<ChatGptPageTranscriptionResult, { kind: 'response' }>)
  | {
      kind: 'page-failed' | 'request-failed';
      page: Page | null;
      pageClosed: boolean;
      pageCurrent: boolean;
    };

interface ChatGPTVoiceProviderDependencies {
  waitForTranscriptionRetry(delayMs: number): Promise<void>;
  writeClipboardText(text: string): void;
}

function waitForDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/** Browser-session provider for ChatGPT's transcription endpoint. */
export class ChatGPTVoiceProvider extends BatchVoiceProvider {
  private readonly deps: ChatGPTVoiceProviderDependencies;

  constructor(deps: Partial<ChatGPTVoiceProviderDependencies> = {}) {
    super();
    this.deps = {
      waitForTranscriptionRetry: deps.waitForTranscriptionRetry || waitForDelay,
      writeClipboardText: deps.writeClipboardText || writeClipboardText,
    };
  }

  readonly info = {
    id: 'chatgpt',
    name: 'ChatGPT Web',
    authType: 'browserSession',
    category: 'web',
    hasSettings: true,
    transcriptionMode: 'batch',
    loginUrl: 'https://chatgpt.com',
  } satisfies VoiceProviderInfo;

  async initPage(context: BrowserContext): Promise<void> {
    this.context = context;
    this.page = await context.newPage();

    await this.configureChatGptPage(this.page);

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

      return await this.transcribeWithRecovery(Buffer.from(buffer).toString('base64'), token, mimeType);
    } catch (error: unknown) {
      log.error('Transcribe error:', presentNotificationError(error, { context: 'transcription' }).safeLogMetadata);
      return { success: false, error: t('error.notificationUnknown') };
    }
  }

  async shutdown(): Promise<void> {
    this.clearCachedToken();
    await super.shutdown();
  }

  // --- Private helpers ---

  private async configureChatGptPage(page: Page): Promise<void> {
    // Block heavy resources for performance.
    await page.route('**/*', (route) => {
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
  }

  private async navigateToChatGPT(): Promise<void> {
    if (!this.page) return;

    log.info('Navigating to chatgpt.com...');
    let response: Awaited<ReturnType<Page['goto']>> | undefined;
    await retryBrowserNavigation(
      {
        navigate: async () => {
          response = await this.page!.goto(CHATGPT_URL, {
            waitUntil: 'domcontentloaded',
            timeout: CHATGPT_NAVIGATION_TIMEOUT_MS,
          });
        },
        service: BrowserNavigationService.ChatGPT,
      },
      {
        onRetry: (event) => log.warn('Retrying ChatGPT page navigation:', event),
      },
    );
    log.info('ChatGPT page loaded:', { status: response?.status() ?? 'n/a' });

    try {
      await this.page.waitForLoadState('load', { timeout: 10000 });
    } catch {
      log.warn('ChatGPT load event did not settle quickly; continuing after DOMContentLoaded');
    }
  }

  private async fetchAccessTokenFromPage(): Promise<string> {
    if (!this.page) return '';

    const token: unknown = await this.page.evaluate(async (timeoutMs: number) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return '';
        const json: unknown = await res.json();
        if (typeof json !== 'object' || json === null || !('accessToken' in json)) return '';
        return typeof json.accessToken === 'string' ? json.accessToken : '';
      } catch {
        return '';
      } finally {
        window.clearTimeout(timer);
      }
    }, AUTH_SESSION_TIMEOUT_MS);
    return typeof token === 'string' ? token : '';
  }

  private async transcribeWithRecovery(
    audioBase64: string,
    initialAccessToken: string,
    mimeType: string,
  ): Promise<TranscriptionResult> {
    let accessToken = initialAccessToken;

    for (let attemptNumber = 1; attemptNumber <= TRANSCRIPTION_MAX_ATTEMPTS; attemptNumber += 1) {
      const attempt = await this.runTranscriptionAttempt(audioBase64, accessToken, mimeType);
      if (attempt.kind !== 'response') {
        const retryScheduled =
          attemptNumber < TRANSCRIPTION_MAX_ATTEMPTS && (await this.prepareTransientRetry(attempt));
        log.warn('ChatGPT transcription transport failed:', {
          attempt: attemptNumber,
          cause: attempt.kind === 'request-failed' ? 'page-request' : 'page-context',
          maxAttempts: TRANSCRIPTION_MAX_ATTEMPTS,
          pageClosed: attempt.pageClosed,
          pageCurrent: attempt.pageCurrent,
          retryScheduled,
        });
        if (retryScheduled) continue;
        return this.createConnectionFailure();
      }

      this.logTranscribeResponse(attempt, attemptNumber);
      if (shouldRefreshTranscribeToken(attempt.status)) {
        if (attemptNumber >= TRANSCRIPTION_MAX_ATTEMPTS) {
          return { success: false, error: t('error.noAccessToken') };
        }

        log.info('Access token may have expired; refreshing before one retry:', { status: attempt.status });
        accessToken = await this.refreshAccessToken();
        if (!accessToken) {
          return { success: false, error: t('error.noAccessToken') };
        }
        continue;
      }

      return this.parseTranscribeResponse(attempt, mimeType);
    }

    return this.createConnectionFailure();
  }

  private async runTranscriptionAttempt(
    audioBase64: string,
    accessToken: string,
    mimeType: string,
  ): Promise<ChatGptTranscriptionAttempt> {
    const page = this.page;
    if (!page) {
      return { kind: 'page-failed', page: null, pageClosed: true, pageCurrent: false };
    }

    try {
      const result = await this.transcribeViaPage(page, audioBase64, accessToken, mimeType);
      return result.kind === 'response'
        ? { ...result, page }
        : {
            ...result,
            page,
            pageClosed: page.isClosed(),
            pageCurrent: this.page === page,
          };
    } catch {
      return {
        kind: 'page-failed',
        page,
        pageClosed: page.isClosed(),
        pageCurrent: this.page === page,
      };
    }
  }

  private async prepareTransientRetry(
    attempt: Exclude<ChatGptTranscriptionAttempt, { kind: 'response' }>,
  ): Promise<boolean> {
    const { page } = attempt;
    if (!page || this.page !== page || page.isClosed()) return false;

    await this.deps.waitForTranscriptionRetry(TRANSCRIPTION_RETRY_DELAY_MS);
    if (this.page !== page || page.isClosed()) return false;
    if (attempt.kind === 'request-failed') return true;

    try {
      await page.waitForLoadState('domcontentloaded', { timeout: TRANSCRIPTION_PAGE_RECOVERY_TIMEOUT_MS });
      return this.page === page && !page.isClosed();
    } catch {
      return false;
    }
  }

  private async transcribeViaPage(
    page: Page,
    audioBase64: string,
    accessToken: string,
    mimeType: string,
  ): Promise<ChatGptPageTranscriptionResult> {
    return page.evaluate(
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

        try {
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
          return { kind: 'response' as const, status: res.status, body: text };
        } catch {
          return { kind: 'request-failed' as const };
        }
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

  private logTranscribeResponse(resp: ChatGptTranscribeResponse, attemptNumber: number): void {
    log.info('Transcribe response status:', { attempt: attemptNumber, status: resp.status });
    if (resp.status !== Number(StatusCodes.OK)) {
      log.error('Transcribe response failed:', { bodyLength: resp.body.length, status: resp.status });
    }
  }

  private createConnectionFailure(): TranscriptionResult {
    return {
      success: false,
      error: t('error.chatGptConnectionInterrupted'),
    };
  }

  private parseTranscribeResponse(resp: ChatGptTranscribeResponse, mimeType: string): TranscriptionResult {
    const parsed = parseChatGptTranscribeResponse(resp, mimeType);
    if (parsed.success && parsed.text) {
      log.info('Transcription success, text length:', parsed.text.length);
      this.deps.writeClipboardText(parsed.text);
    }
    return parsed;
  }

  private loadCachedToken(): string {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data: unknown = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
        if (isRecord(data) && typeof data.accessToken === 'string' && data.accessToken) {
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
      const sessionState: unknown = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      return isRecord(sessionState) ? sessionState : null;
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
