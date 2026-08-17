import type { BrowserContext, Page } from 'playwright-core';
import type { TranscriptionResult, VoiceProviderInfo } from './BaseVoiceProvider';
import { BatchVoiceProvider } from './BatchVoiceProvider';
import type { ChatGPTSessionStore } from './chatgptSessionStore';
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
import type { I18nService } from '../i18n';
import { BrowserNavigationService, retryBrowserNavigation } from '../browserNavigationRetry';
import { StatusCodes } from 'http-status-codes';
import { getTranscriptionRetryAfterSeconds } from './transcriptionErrors';
import {
  type VoiceProviderAudit,
  type VoiceAuditOperationContext,
  type VoiceBatchAuditContext,
} from './voiceProviderAudit';
import { normalizeProviderAuditExceptionType, type ProviderAuditExceptionType } from '@main/providerAudit';
import type { RendererSafeVoiceProviderInfo } from '@shared/voiceProvider';

const CHATGPT_URL = 'https://chatgpt.com';
const CHATGPT_NAVIGATION_TIMEOUT_MS = 60000;
const AUTH_SESSION_TIMEOUT_MS = 15000;
const AUTH_SESSION_RECOVERY_TIMEOUT_MS = 15000;
const TRANSCRIPTION_MAX_ATTEMPTS = 2;
const TRANSCRIPTION_REQUEST_TIMEOUT_MS = 20000;
const TRANSCRIPTION_PAGE_RECOVERY_TIMEOUT_MS = 15000;
const TRANSCRIPTION_RATE_LIMIT_FALLBACK_SECONDS = 60;
const TRANSCRIPTION_RATE_LIMIT_MAX_SECONDS = 10 * 60;
export const CHATGPT_VOICE_PROVIDER_ID = 'chatgpt';

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
  retryAfter?: string;
}

type ChatGptPageTranscriptionResult =
  ({ kind: 'response' } & ChatGptTranscribeResponse) | { kind: 'request-failed'; failure: 'network' | 'timeout' };

type ChatGptTranscriptionAttempt =
  | ({ page: Page } & Extract<ChatGptPageTranscriptionResult, { kind: 'response' }>)
  | {
      failure: 'network' | 'timeout';
      kind: 'request-failed';
      page: Page;
      pageClosed: boolean;
      pageCurrent: boolean;
      exceptionType?: ProviderAuditExceptionType;
    }
  | {
      kind: 'page-failed';
      page: Page | null;
      pageClosed: boolean;
      pageCurrent: boolean;
      exceptionType?: ProviderAuditExceptionType;
    };

export interface ChatGPTVoiceProviderLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface ChatGPTVoiceProviderDependencies {
  audit: VoiceProviderAudit;
  localization: Pick<I18nService, 'translate'>;
  logger: ChatGPTVoiceProviderLogger;
  now(): number;
  reloadPage(page: Page, timeoutMs: number): Promise<void>;
  sessionStore: ChatGPTSessionStore;
  writeClipboardText(text: string): void;
}

export const CHATGPT_VOICE_PROVIDER_INFO = Object.freeze({
  id: CHATGPT_VOICE_PROVIDER_ID,
  name: 'ChatGPT Web',
  authType: 'browserSession',
  category: 'web',
  hasSettings: true,
  transcriptionMode: 'batch',
  loginUrl: CHATGPT_URL,
}) satisfies VoiceProviderInfo;

export const CHATGPT_RENDERER_PROVIDER_INFO = Object.freeze({
  id: CHATGPT_VOICE_PROVIDER_INFO.id,
  name: CHATGPT_VOICE_PROVIDER_INFO.name,
  authType: CHATGPT_VOICE_PROVIDER_INFO.authType,
  category: CHATGPT_VOICE_PROVIDER_INFO.category,
  hasSettings: CHATGPT_VOICE_PROVIDER_INFO.hasSettings,
  transcriptionMode: CHATGPT_VOICE_PROVIDER_INFO.transcriptionMode,
}) satisfies RendererSafeVoiceProviderInfo;

/** Browser-session provider for ChatGPT's transcription endpoint. */
export class ChatGPTVoiceProvider extends BatchVoiceProvider {
  private readonly deps: ChatGPTVoiceProviderDependencies;
  private transcriptionPageRecovery: Promise<void> | null = null;
  private transcriptionRateLimitUntil = 0;

  constructor(deps: ChatGPTVoiceProviderDependencies) {
    super();
    this.deps = deps;
  }

  readonly info = CHATGPT_VOICE_PROVIDER_INFO;

  async initPage(context: BrowserContext): Promise<void> {
    this.transcriptionPageRecovery = null;
    this.transcriptionRateLimitUntil = 0;
    this.context = context;
    this.page = await context.newPage();

    await this.configureChatGptPage(this.page);

    await this.navigateToChatGPT();

    await this.loadInitialAccessToken();
  }

  getLoginUrl(): string {
    return CHATGPT_URL;
  }

  hasSession(): boolean {
    const sessionData = this.readSessionState();
    if (!sessionData) return false;
    if (hasUsableSessionState(sessionData)) return true;

    this.deps.logger.warn('Stored ChatGPT session is missing valid auth cookies; clearing it');
    this.clearSession();
    return false;
  }

  clearSession(): void {
    try {
      this.deps.sessionStore.clearSession();
    } catch {
      // Session cleanup remains fail-open.
    }
    this.transcriptionRateLimitUntil = 0;
    this.clearCachedToken();
  }

  async saveSession(context: BrowserContext): Promise<void> {
    const state = await context.storageState();
    this.deps.sessionStore.saveSession(state);
  }

  async loadSession(context: BrowserContext): Promise<boolean> {
    const sessionData = this.readSessionState();
    if (!sessionData) return false;
    if (!hasUsableSessionState(sessionData)) {
      this.deps.logger.warn('Stored ChatGPT session expired before it could be loaded');
      this.clearSession();
      return false;
    }

    const cookies = getUnexpiredCookies(sessionData.cookies || []);
    await context.addCookies(cookies);
    return true;
  }

  async fetchAccessToken(): Promise<string> {
    if (!this.page) return '';
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
    if (this.accessToken) {
      this.saveCachedToken(this.accessToken);
    } else {
      this.clearCachedToken();
    }
    return this.accessToken;
  }

  async transcribe(
    buffer: ArrayBuffer,
    mimeType = WEBM_OPUS_TRANSCRIPTION_MIME_TYPE,
    auditContext?: VoiceBatchAuditContext,
  ): Promise<TranscriptionResult> {
    const audit = auditContext ?? this.deps.audit.startBatch(this.info.id, buffer, mimeType);
    audit.lifecycle.phaseCompleted('dispatch', this.deps.audit.createBatchMetadata(audit));
    audit.lifecycle.phaseEntered('validation', this.deps.audit.createBatchMetadata(audit));

    try {
      const rateLimitFailure = this.getActiveRateLimitFailure();
      if (rateLimitFailure) {
        this.deps.audit.terminalBatch(audit, 'validation', 'failure', {
          attemptCount: 0,
          causeCode: 'rate-limited',
        });
        return rateLimitFailure;
      }

      audit.lifecycle.phaseCompleted('validation', this.deps.audit.createBatchMetadata(audit));
      if (this.transcriptionPageRecovery) {
        audit.lifecycle.phaseEntered('recovery', this.deps.audit.createBatchMetadata(audit));
        await this.transcriptionPageRecovery;
        audit.lifecycle.phaseCompleted('recovery', this.deps.audit.createBatchMetadata(audit));
      }

      if (!this.page) {
        this.deps.audit.terminalBatch(audit, 'readiness', 'failure', {
          attemptCount: 0,
          causeCode: 'not-authenticated',
          pageClosed: true,
        });
        return { success: false, error: this.deps.localization.translate('error.notLoggedIn') };
      }

      let token = this.accessToken;
      if (!token) {
        audit.lifecycle.phaseEntered('configuration', this.deps.audit.createBatchMetadata(audit));
        token = await this.refreshAccessToken();
        audit.lifecycle.phaseCompleted('configuration', this.deps.audit.createBatchMetadata(audit));
      }
      if (!token) {
        this.deps.audit.terminalBatch(audit, 'configuration', 'failure', {
          attemptCount: 0,
          causeCode: 'not-authenticated',
        });
        return { success: false, error: this.deps.localization.translate('error.noAccessToken') };
      }

      audit.lifecycle.phaseEntered('readiness', this.deps.audit.createBatchMetadata(audit));
      audit.lifecycle.phaseCompleted('readiness', this.deps.audit.createBatchMetadata(audit));
      return await this.transcribeWithRecovery(Buffer.from(buffer).toString('base64'), token, mimeType, audit);
    } catch (error: unknown) {
      this.deps.audit.terminalBatch(audit, 'result', 'failure', {
        causeCode: 'unknown',
        exceptionType: normalizeProviderAuditExceptionType(error),
      });
      return { success: false, error: this.deps.localization.translate('error.notificationUnknown') };
    }
  }

  async shutdown(): Promise<void> {
    this.transcriptionPageRecovery = null;
    this.transcriptionRateLimitUntil = 0;
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

    this.deps.logger.info('Navigating to chatgpt.com...');
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
        onRetry: (event) => this.deps.logger.warn('Retrying ChatGPT page navigation:', event),
      },
    );
    this.deps.logger.info('ChatGPT page loaded:', { status: response?.status() ?? 'n/a' });

    try {
      await this.page.waitForLoadState('load', { timeout: 10000 });
    } catch {
      this.deps.logger.warn('ChatGPT load event did not settle quickly; continuing after DOMContentLoaded');
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

  /** Recovers one transient session-endpoint miss without discarding the saved browser session. */
  private async loadInitialAccessToken(): Promise<void> {
    this.accessToken = this.loadCachedToken();
    if (this.accessToken || !this.page) return;

    this.accessToken = await this.fetchAccessToken();
    if (this.accessToken || !this.page) return;

    try {
      await this.deps.reloadPage(this.page, AUTH_SESSION_RECOVERY_TIMEOUT_MS);
      this.accessToken = await this.fetchAccessToken();
    } catch {
      this.deps.logger.warn('ChatGPT access-token recovery did not complete');
    }
  }

  /** Runs the existing bounded authentication retry under one audit operation. */
  private async transcribeWithRecovery(
    audioBase64: string,
    initialAccessToken: string,
    mimeType: string,
    audit: VoiceBatchAuditContext,
  ): Promise<TranscriptionResult> {
    let accessToken = initialAccessToken;

    for (let attemptNumber = 1; attemptNumber <= TRANSCRIPTION_MAX_ATTEMPTS; attemptNumber += 1) {
      audit.lifecycle.phaseEntered(
        'submission',
        this.deps.audit.createBatchMetadata(audit, {
          attemptCount: attemptNumber,
        }),
      );
      const attempt = await this.runTranscriptionAttempt(audioBase64, accessToken, mimeType);
      if (attempt.kind !== 'response') {
        this.startTranscriptionPageRecovery(attempt.page);
        this.deps.audit.terminalBatch(audit, 'submission', 'failure', {
          attemptCount: attemptNumber,
          causeCode: 'connection-failed',
          exceptionType: attempt.exceptionType,
          pageClosed: attempt.pageClosed,
          recoveryScheduled: this.transcriptionPageRecovery !== null,
        });
        return this.createConnectionFailure();
      }

      audit.lifecycle.phaseCompleted(
        'submission',
        this.deps.audit.createBatchMetadata(audit, {
          attemptCount: attemptNumber,
          httpStatus: attempt.status,
        }),
      );
      if (shouldRefreshTranscribeToken(attempt.status)) {
        if (attemptNumber >= TRANSCRIPTION_MAX_ATTEMPTS) {
          this.deps.audit.terminalBatch(audit, 'configuration', 'failure', {
            attemptCount: attemptNumber,
            causeCode: 'not-authenticated',
            httpStatus: attempt.status,
          });
          return { success: false, error: this.deps.localization.translate('error.noAccessToken') };
        }

        audit.lifecycle.retry(
          'configuration',
          this.deps.audit.createBatchMetadata(audit, {
            attemptCount: attemptNumber + 1,
            httpStatus: attempt.status,
            retryScheduled: true,
          }),
        );
        audit.lifecycle.phaseEntered(
          'configuration',
          this.deps.audit.createBatchMetadata(audit, {
            attemptCount: attemptNumber + 1,
          }),
        );
        accessToken = await this.refreshAccessToken();
        audit.lifecycle.phaseCompleted(
          'configuration',
          this.deps.audit.createBatchMetadata(audit, {
            attemptCount: attemptNumber + 1,
          }),
        );
        if (!accessToken) {
          this.deps.audit.terminalBatch(audit, 'configuration', 'failure', {
            attemptCount: attemptNumber,
            causeCode: 'not-authenticated',
            httpStatus: attempt.status,
          });
          return { success: false, error: this.deps.localization.translate('error.noAccessToken') };
        }
        continue;
      }

      if (attempt.status === Number(StatusCodes.TOO_MANY_REQUESTS)) {
        const result = this.applyRateLimitCooldown(attempt);
        this.deps.audit.terminalBatch(audit, 'result', 'failure', {
          attemptCount: attemptNumber,
          causeCode: 'rate-limited',
          httpStatus: attempt.status,
        });
        return result;
      }

      audit.lifecycle.phaseEntered(
        'result',
        this.deps.audit.createBatchMetadata(audit, {
          attemptCount: attemptNumber,
          httpStatus: attempt.status,
        }),
      );
      const result = this.parseTranscribeResponse(attempt, mimeType);
      if (result.success && result.text) {
        this.deps.audit.terminalBatch(audit, 'result', 'success', {
          attemptCount: attemptNumber,
          httpStatus: attempt.status,
          resultLength: result.text.length,
        });
        return result;
      }

      this.deps.audit.terminalBatch(audit, 'result', 'failure', {
        attemptCount: attemptNumber,
        causeCode: this.classifyTranscriptionFailure(attempt),
        httpStatus: attempt.status,
      });
      return result;
    }

    this.deps.audit.terminalBatch(audit, 'submission', 'failure', {
      attemptCount: TRANSCRIPTION_MAX_ATTEMPTS,
      causeCode: 'connection-failed',
    });
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
    } catch (error: unknown) {
      return {
        exceptionType: normalizeProviderAuditExceptionType(error),
        kind: 'page-failed',
        page,
        pageClosed: page.isClosed(),
        pageCurrent: this.page === page,
      };
    }
  }

  private startTranscriptionPageRecovery(page: Page | null): void {
    if (!page || this.page !== page || page.isClosed() || this.transcriptionPageRecovery) return;

    const audit = this.deps.audit.startOperation(
      this.info.id,
      'recovery',
      'recovery',
      this.deps.audit.createMetadata({ pageClosed: false, recoveryScheduled: true }),
    );
    const recovery = this.recoverTranscriptionPage(page, audit);
    this.transcriptionPageRecovery = recovery;
    void recovery.then(() => {
      if (this.transcriptionPageRecovery === recovery) this.transcriptionPageRecovery = null;
    });
  }

  private async recoverTranscriptionPage(page: Page, audit: VoiceAuditOperationContext): Promise<void> {
    let recovered: boolean;
    try {
      await this.deps.reloadPage(page, TRANSCRIPTION_PAGE_RECOVERY_TIMEOUT_MS);
      recovered = this.page === page && !page.isClosed();
    } catch (error: unknown) {
      this.deps.audit.terminalException(audit, 'recovery', error, {
        causeCode: 'connection-failed',
        pageClosed: page.isClosed(),
        recoveryScheduled: false,
      });
      return;
    }
    audit.lifecycle.phaseCompleted(
      'recovery',
      this.deps.audit.createMetadata({
        durationMs: this.deps.audit.durationMs(audit),
        pageClosed: page.isClosed(),
        recoveryScheduled: false,
      }),
    );
    audit.lifecycle.terminal(
      'recovery',
      recovered ? 'success' : 'failure',
      this.deps.audit.createMetadata({
        ...(recovered ? {} : { causeCode: 'connection-failed' as const }),
        durationMs: this.deps.audit.durationMs(audit),
        pageClosed: page.isClosed(),
        recoveryScheduled: false,
      }),
    );
  }

  private applyRateLimitCooldown(resp: ChatGptTranscribeResponse): TranscriptionResult {
    const retryAfterSeconds = Math.min(
      TRANSCRIPTION_RATE_LIMIT_MAX_SECONDS,
      getTranscriptionRetryAfterSeconds(resp, this.deps.now()) ?? TRANSCRIPTION_RATE_LIMIT_FALLBACK_SECONDS,
    );
    this.transcriptionRateLimitUntil = Math.max(
      this.transcriptionRateLimitUntil,
      this.deps.now() + retryAfterSeconds * 1000,
    );
    return (
      this.getActiveRateLimitFailure() ?? {
        success: false,
        error: this.deps.localization.translate('error.rateLimited'),
      }
    );
  }

  private getRateLimitRemainingSeconds(): number {
    return Math.max(0, Math.ceil((this.transcriptionRateLimitUntil - this.deps.now()) / 1000));
  }

  private getActiveRateLimitFailure(): TranscriptionResult | null {
    const remainingSeconds = this.getRateLimitRemainingSeconds();
    return remainingSeconds > 0
      ? {
          success: false,
          error: this.deps.localization.translate('error.rateLimitedRetryAfter', {
            seconds: String(remainingSeconds),
          }),
        }
      : null;
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
        requestTimeoutMs,
      }: {
        audioBase64: string;
        accessToken: string;
        mimeType: string;
        fileExtension: string;
        defaultMimeType: string;
        uploadFileBasename: string;
        transcriptionModel: string;
        requestTimeoutMs: number;
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

        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), requestTimeoutMs);
        try {
          const res = await fetch('/backend-api/transcribe', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: '*/*',
              'OAI-Language': navigator.language || 'en-US',
            },
            body: formData,
            signal: controller.signal,
          });
          const text = await res.text();
          const retryAfter = res.headers.get('retry-after')?.trim();
          return {
            kind: 'response' as const,
            status: res.status,
            body: text,
            ...(retryAfter && retryAfter.length <= 128 ? { retryAfter } : {}),
          };
        } catch {
          return {
            kind: 'request-failed' as const,
            failure: controller.signal.aborted ? ('timeout' as const) : ('network' as const),
          };
        } finally {
          window.clearTimeout(timer);
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
        requestTimeoutMs: TRANSCRIPTION_REQUEST_TIMEOUT_MS,
      },
    );
  }

  private createConnectionFailure(): TranscriptionResult {
    return {
      success: false,
      error: this.deps.localization.translate('error.chatGptConnectionInterrupted'),
    };
  }

  private parseTranscribeResponse(resp: ChatGptTranscribeResponse, mimeType: string): TranscriptionResult {
    const parsed = parseChatGptTranscribeResponse(resp, mimeType, this.deps.localization);
    if (parsed.success && parsed.text) {
      this.deps.writeClipboardText(parsed.text);
    }
    return parsed;
  }

  private classifyTranscriptionFailure(
    resp: ChatGptTranscribeResponse,
  ): 'request-failed' | 'provider-contract-changed' | 'unexpected-response' | 'empty-result' {
    if (resp.status !== Number(StatusCodes.OK)) return 'request-failed';

    try {
      const result: unknown = JSON.parse(resp.body);
      if (!isRecord(result)) return 'provider-contract-changed';
      if ('error' in result || 'detail' in result || 'message' in result) return 'unexpected-response';
      return 'empty-result';
    } catch {
      return 'provider-contract-changed';
    }
  }

  private loadCachedToken(): string {
    return this.deps.sessionStore.readAccessToken();
  }

  private readSessionState(): SessionState | null {
    return this.deps.sessionStore.readSession();
  }

  private saveCachedToken(accessToken: string): void {
    this.deps.sessionStore.saveAccessToken(accessToken);
  }

  private clearCachedToken(): void {
    this.deps.sessionStore.clearAccessToken();
  }
}
