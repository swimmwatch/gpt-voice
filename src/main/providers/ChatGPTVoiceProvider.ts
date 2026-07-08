import * as fs from 'fs';
import * as path from 'path';
import type { BrowserContext, Page, Response } from 'playwright-core';
import {
  BaseVoiceProvider,
  type PrettifyTextOptions,
  type TextProcessingResult,
  type TranscriptionResult,
  type VoiceProviderInfo,
} from './BaseVoiceProvider';
import {
  getAudioFileExtension,
  getUnexpiredCookies,
  hasUsableSessionState,
  parseChatGptTranscribeResponse,
  shouldRefreshTranscribeToken,
  type SessionState,
} from './chatgptUtils';
import {
  buildChatGptConversationUrl,
  extractChatGptConversationId,
  normalizeChatGptConversationId,
  parseChatGptTextChatState,
} from './chatgptTextChatState';
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
const TEXT_CHAT_STATE_FILE = path.join(APP_DIR, 'chatgpt-text-chat.json');
const CHATGPT_URL = 'https://chatgpt.com';
const CHATGPT_NAVIGATION_TIMEOUT_MS = 60000;
const AUTH_SESSION_TIMEOUT_MS = 15000;
const TRANSCRIBE_RESPONSE_LOG_PREVIEW_CHARS = 500;
const CHATGPT_PRETTIFY_RESPONSE_TIMEOUT_MS = 90000;
const CHATGPT_PRETTIFY_RESPONSE_STABLE_MS = 2000;
const CHATGPT_PRETTIFY_POLL_MS = 300;
const CHATGPT_CONVERSATION_HISTORY_TIMEOUT_MS = 20000;
const CHATGPT_SEND_BUTTON_READY_TIMEOUT_MS = 10000;
const CHATGPT_SUBMISSION_SETTLE_MS = 700;
const CHATGPT_SUBMISSION_MAX_ATTEMPTS = 2;
const CHATGPT_COMPOSER_SELECTOR = '#prompt-textarea, [contenteditable="true"][role="textbox"]';
const CHATGPT_MESSAGE_SELECTOR = '[data-message-author-role]';
const CHATGPT_USER_MESSAGE_SELECTOR = '[data-message-author-role="user"]';
const CHATGPT_ASSISTANT_MESSAGE_SELECTORS = [
  '[data-message-author-role="assistant"]',
  '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
  '[data-testid^="conversation-turn-"] .markdown',
  '[data-testid^="conversation-turn-"] [class*="markdown"]',
  'article .markdown',
];
const CHATGPT_SEND_BUTTON_SELECTORS = [
  '[data-testid="send-button"]',
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
  'button[aria-label="Send"]',
];
const CHATGPT_STOP_GENERATING_SELECTORS = [
  '[data-testid="stop-button"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label="Stop streaming"]',
  'button[aria-label="Stop"]',
];
const CHATGPT_TEXT_REQUEST_PATHS = new Set([
  '/backend-api/f/conversation',
  '/backend-api/f/conversation/prepare',
  '/backend-api/sentinel/chat-requirements/prepare',
  '/backend-api/sentinel/chat-requirements/finalize',
]);
const CHATGPT_BLOCKING_ERROR_PATTERNS = [
  { label: 'unusual activity', pattern: 'unusual activity' },
  { label: 'verification challenge', pattern: 'verify|captcha|blocked' },
  { label: 'reply OK challenge', pattern: 'reply\\s*ok' },
  { label: 'try again later', pattern: 'try again later' },
  { label: 'ChatGPT error', pattern: 'something went wrong|unable to load|could not send|failed to send' },
];
const CHATGPT_BLOCKING_ERROR_SURFACE_SELECTOR = [
  '[role="alert"]',
  '[role="dialog"]',
  'dialog',
  '[data-testid*="toast"]',
  '[class*="toast"]',
  '[data-testid*="error"]',
  '[class*="error"]',
  '[data-testid*="notice"]',
  '[class*="notice"]',
].join(',');

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

interface ChatGptAssistantMessageState {
  count: number;
  latestText: string;
}

interface ChatGptPromptSubmissionState {
  composerTextLength: number;
  conversationId: string;
  userMessageCount: number;
}

interface ChatGptTextResponseFailure {
  path: string;
  status: number;
}

interface ChatGptTextResponseMonitor {
  conversationStarted: boolean;
  conversationStatus: number | null;
  failedResponse: ChatGptTextResponseFailure | null;
  dispose(): void;
}

export class ChatGPTVoiceProvider extends BaseVoiceProvider {
  private textChatConversationId = '';
  private textPage: Page | null = null;

  readonly info: VoiceProviderInfo = {
    id: 'chatgpt',
    name: 'ChatGPT Web',
    authType: 'browserSession',
    loginUrl: 'https://chatgpt.com',
  };

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
    this.clearTextChatState();
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

  async prettifyText(text: string, options: PrettifyTextOptions): Promise<TextProcessingResult> {
    return this.processChatGptTextPrompt(`Text to improve:\n${text}`, options, {
      action: 'Prettify',
      emptyResultError: t('error.noPrettifyResult'),
      logMessage: 'Prettifying selected text',
    });
  }

  private async processChatGptTextPrompt(
    text: string,
    options: PrettifyTextOptions,
    context: {
      action: string;
      emptyResultError: string;
      logMessage: string;
    },
  ): Promise<TextProcessingResult> {
    const cancellationError = t('status.prettifyCancelled');
    const removeAbortListener = this.watchChatGptPrettifyAbort(options.signal);

    try {
      log.info(`${context.logMessage}:`, { textLength: text.length, reasoning: options.reasoning });
      if (options.signal?.aborted) {
        return { success: false, error: cancellationError };
      }

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
      if (options.signal?.aborted) {
        return { success: false, error: cancellationError };
      }

      const result = await this.processViaChatGptPage(text, options, cancellationError);
      if (options.signal?.aborted) {
        return { success: false, error: cancellationError };
      }
      if (!result.trim()) {
        return { success: false, error: context.emptyResultError };
      }

      log.info(`${context.action} success, text length:`, result.length);
      return { success: true, text: result };
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        return { success: false, error: cancellationError };
      }

      log.error(`${context.action} error:`, err instanceof Error ? err.message : err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      removeAbortListener();
    }
  }

  async shutdown(): Promise<void> {
    this.clearCachedToken();
    await this.closeChatGptTextPage();
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

  private async processViaChatGptPage(
    text: string,
    options: PrettifyTextOptions,
    cancellationError: string,
  ): Promise<string> {
    return this.sendChatGptTextPrompt(`${options.prompt.trim()}\n\n${text}`, options.signal, cancellationError);
  }

  private async sendChatGptTextPrompt(
    prompt: string,
    signal: AbortSignal | undefined,
    cancellationError: string,
  ): Promise<string> {
    this.throwIfTextPromptCancelled(signal, cancellationError);
    const page = await this.getChatGptTextPage();
    const responseMonitor = this.createChatGptTextResponseMonitor(page);

    try {
      await this.openReusableChatGptComposer(page);
      this.throwIfTextPromptCancelled(signal, cancellationError);
      await this.ensureChatGptTextPageAuthenticated(page);
      this.throwIfTextPromptCancelled(signal, cancellationError);
      await this.throwIfChatGptBlockingErrorVisible(page);
      const previousAssistantState = await this.getAssistantMessageState(page);
      const previousSubmissionState = await this.getPromptSubmissionState(page);
      this.throwIfTextPromptCancelled(signal, cancellationError);
      await this.submitChatGptPrompt(page, prompt, previousSubmissionState, responseMonitor, cancellationError, signal);
      this.throwIfTextPromptCancelled(signal, cancellationError);
      return await this.waitForStableAssistantText(
        page,
        previousAssistantState,
        responseMonitor,
        cancellationError,
        signal,
      );
    } finally {
      responseMonitor.dispose();
      this.saveCurrentTextChatConversationId(page);
    }
  }

  private async getChatGptTextPage(): Promise<Page> {
    if (this.textPage && !this.textPage.isClosed()) {
      return this.textPage;
    }
    if (!this.context) {
      throw new Error(t('error.notLoggedIn'));
    }

    this.textPage = await this.context.newPage();
    await this.configureChatGptPage(this.textPage);
    return this.textPage;
  }

  private async closeChatGptTextPage(): Promise<void> {
    const page = this.textPage;
    this.textPage = null;
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
  }

  private watchChatGptPrettifyAbort(signal?: AbortSignal): () => void {
    if (!signal) {
      return () => undefined;
    }

    const onAbort = (): void => {
      void this.closeChatGptTextPage();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    return () => signal.removeEventListener('abort', onAbort);
  }

  private throwIfTextPromptCancelled(signal: AbortSignal | undefined, cancellationError: string): void {
    if (signal?.aborted) {
      throw new Error(cancellationError);
    }
  }

  private async openReusableChatGptComposer(page: Page): Promise<void> {
    const savedConversationId = this.loadTextChatConversationId();
    if (savedConversationId) {
      try {
        await this.openChatGptComposer(page, buildChatGptConversationUrl(CHATGPT_URL, savedConversationId));

        if (extractChatGptConversationId(page.url()) !== savedConversationId) {
          log.warn('Saved ChatGPT text conversation was not reopened; creating a new text conversation');
          this.clearTextChatState();
        } else if (await this.waitForConversationHistoryHydration(page)) {
          return;
        } else {
          log.warn('Saved ChatGPT text conversation did not hydrate; creating a new text conversation');
          this.clearTextChatState();
        }
      } catch (error: unknown) {
        log.warn(
          'Could not reopen saved ChatGPT text conversation:',
          error instanceof Error ? error.message : String(error),
        );
        this.clearTextChatState();
      }
    }

    await this.openChatGptComposer(page, CHATGPT_URL);
  }

  private async openChatGptComposer(page: Page, url: string): Promise<void> {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: CHATGPT_NAVIGATION_TIMEOUT_MS,
    });
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForSelector(CHATGPT_COMPOSER_SELECTOR, {
      timeout: CHATGPT_NAVIGATION_TIMEOUT_MS,
    });
  }

  private async waitForConversationHistoryHydration(page: Page): Promise<boolean> {
    try {
      await page.waitForFunction(
        (messageSelector: string) => document.querySelectorAll(messageSelector).length > 0,
        CHATGPT_MESSAGE_SELECTOR,
        { timeout: CHATGPT_CONVERSATION_HISTORY_TIMEOUT_MS },
      );
      return true;
    } catch {
      return false;
    }
  }

  private createChatGptTextResponseMonitor(page: Page): ChatGptTextResponseMonitor {
    const monitor: ChatGptTextResponseMonitor = {
      conversationStarted: false,
      conversationStatus: null,
      failedResponse: null,
      dispose: () => {
        page.off('response', onResponse);
      },
    };

    const onResponse = (response: Response): void => {
      const path = getResponsePath(response.url());
      if (!CHATGPT_TEXT_REQUEST_PATHS.has(path)) return;

      const status = response.status();
      if (path === '/backend-api/f/conversation') {
        monitor.conversationStarted = true;
        monitor.conversationStatus = status;
      }
      if (status < StatusCodes.OK || status >= StatusCodes.BAD_REQUEST) {
        monitor.failedResponse = { path, status };
      }
    };

    page.on('response', onResponse);
    return monitor;
  }

  private async ensureChatGptTextPageAuthenticated(page: Page): Promise<void> {
    const sessionState = await page.evaluate(async (timeoutMs: number) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) {
          return { hasAccessToken: false, hasUser: false, status: response.status };
        }
        const json = (await response.json()) as { accessToken?: unknown; user?: unknown };
        return {
          hasAccessToken: typeof json.accessToken === 'string' && json.accessToken.length > 0,
          hasUser: Boolean(json.user),
          status: response.status,
        };
      } catch {
        return { hasAccessToken: false, hasUser: false, status: 0 };
      } finally {
        window.clearTimeout(timer);
      }
    }, AUTH_SESSION_TIMEOUT_MS);

    if (!sessionState.hasUser || !sessionState.hasAccessToken) {
      throw new Error(t('error.noAccessToken'));
    }
  }

  private async submitChatGptPrompt(
    page: Page,
    prompt: string,
    previousSubmissionState: ChatGptPromptSubmissionState,
    responseMonitor: ChatGptTextResponseMonitor,
    cancellationError: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.throwIfTextPromptCancelled(signal, cancellationError);
    const composer = page.locator(CHATGPT_COMPOSER_SELECTOR).last();
    await composer.click({ timeout: CHATGPT_NAVIGATION_TIMEOUT_MS });
    await this.clearChatGptComposer(page);
    this.throwIfTextPromptCancelled(signal, cancellationError);
    await page.keyboard.insertText(prompt);

    let canClickSendButton = await this.waitForEnabledChatGptSendButton(page);
    for (let attempt = 1; attempt <= CHATGPT_SUBMISSION_MAX_ATTEMPTS; attempt += 1) {
      this.throwIfTextPromptCancelled(signal, cancellationError);
      if (canClickSendButton && (await this.clickChatGptSendButton(page))) {
        // Clicked the visible send button.
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(CHATGPT_SUBMISSION_SETTLE_MS);
      this.throwIfTextPromptCancelled(signal, cancellationError);
      this.throwIfChatGptTextRequestFailed(responseMonitor);
      await this.throwIfChatGptBlockingErrorVisible(page);
      if (await this.hasChatGptPromptSubmissionStarted(page, previousSubmissionState, responseMonitor)) {
        return;
      }

      if (attempt < CHATGPT_SUBMISSION_MAX_ATTEMPTS) {
        log.warn('ChatGPT prompt did not submit after send action; retrying once');
        canClickSendButton = await this.waitForEnabledChatGptSendButton(page);
      }
    }

    throw new Error(
      `ChatGPT did not submit the prompt (${await this.getChatGptTextDiagnostics(page, responseMonitor)})`,
    );
  }

  private async clearChatGptComposer(page: Page): Promise<void> {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
  }

  private async waitForEnabledChatGptSendButton(page: Page): Promise<boolean> {
    try {
      await page.waitForFunction(
        (selectors: string[]) => {
          for (const selector of selectors) {
            for (const button of Array.from(document.querySelectorAll(selector))) {
              const element = button as HTMLElement;
              const rect = element.getBoundingClientRect();
              const disabled =
                element.getAttribute('aria-disabled') === 'true' ||
                ('disabled' in element && Boolean((element as HTMLButtonElement).disabled));
              if (!disabled && rect.width > 0 && rect.height > 0) {
                return true;
              }
            }
          }
          return false;
        },
        CHATGPT_SEND_BUTTON_SELECTORS,
        { timeout: CHATGPT_SEND_BUTTON_READY_TIMEOUT_MS },
      );
      return true;
    } catch {
      return false;
    }
  }

  private async clickChatGptSendButton(page: Page): Promise<boolean> {
    try {
      return await page.evaluate((selectors: string[]) => {
        for (const selector of selectors) {
          const buttons = Array.from(document.querySelectorAll(selector)).reverse();
          for (const button of buttons) {
            const element = button as HTMLElement;
            const rect = element.getBoundingClientRect();
            const disabled =
              element.getAttribute('aria-disabled') === 'true' ||
              ('disabled' in element && Boolean((element as HTMLButtonElement).disabled));
            if (!disabled && rect.width > 0 && rect.height > 0) {
              element.click();
              return true;
            }
          }
        }
        return false;
      }, CHATGPT_SEND_BUTTON_SELECTORS);
    } catch (error: unknown) {
      log.warn('Could not click ChatGPT send button:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async getPromptSubmissionState(page: Page): Promise<ChatGptPromptSubmissionState> {
    const state = await page.evaluate(
      ({ composerSelector, userMessageSelector }: { composerSelector: string; userMessageSelector: string }) => {
        return {
          composerTextLength: (document.querySelector(composerSelector)?.textContent?.trim() || '').length,
          userMessageCount: document.querySelectorAll(userMessageSelector).length,
        };
      },
      {
        composerSelector: CHATGPT_COMPOSER_SELECTOR,
        userMessageSelector: CHATGPT_USER_MESSAGE_SELECTOR,
      },
    );

    return {
      ...state,
      conversationId: extractChatGptConversationId(page.url()),
    };
  }

  private async hasChatGptPromptSubmissionStarted(
    page: Page,
    previousSubmissionState: ChatGptPromptSubmissionState,
    responseMonitor: ChatGptTextResponseMonitor,
  ): Promise<boolean> {
    if (responseMonitor.conversationStarted) return true;

    const nextSubmissionState = await this.getPromptSubmissionState(page);
    return (
      nextSubmissionState.composerTextLength === 0 ||
      nextSubmissionState.userMessageCount > previousSubmissionState.userMessageCount ||
      Boolean(
        nextSubmissionState.conversationId &&
        nextSubmissionState.conversationId !== previousSubmissionState.conversationId,
      )
    );
  }

  private async getChatGptBlockingError(page: Page): Promise<string> {
    return page.evaluate(
      ({
        patterns,
        surfaceSelector,
      }: {
        patterns: typeof CHATGPT_BLOCKING_ERROR_PATTERNS;
        surfaceSelector: string;
      }) => {
        const surfaceText = Array.from(document.querySelectorAll(surfaceSelector))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map((element) => element.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ');

        if (!surfaceText) {
          return '';
        }

        for (const { label, pattern } of patterns) {
          if (new RegExp(pattern, 'i').test(surfaceText)) {
            return label;
          }
        }
        return '';
      },
      { patterns: CHATGPT_BLOCKING_ERROR_PATTERNS, surfaceSelector: CHATGPT_BLOCKING_ERROR_SURFACE_SELECTOR },
    );
  }

  private async throwIfChatGptBlockingErrorVisible(page: Page): Promise<void> {
    const blockingError = await this.getChatGptBlockingError(page);
    if (blockingError) {
      throw new Error(`ChatGPT could not process the request because the page shows ${blockingError}`);
    }
  }

  private throwIfChatGptTextRequestFailed(responseMonitor: ChatGptTextResponseMonitor): void {
    if (responseMonitor.failedResponse) {
      throw new Error(
        `ChatGPT request failed (${responseMonitor.failedResponse.path} ${responseMonitor.failedResponse.status})`,
      );
    }
  }

  private async getAssistantMessageState(page: Page): Promise<ChatGptAssistantMessageState> {
    return page.evaluate((selectors: string[]) => {
      const assistantMessages: Element[] = [];
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          const text = element.textContent?.trim() || '';
          if (!text) continue;
          if (assistantMessages.some((existing) => existing === element || existing.contains(element))) continue;
          const containedIndex = assistantMessages.findIndex((existing) => element.contains(existing));
          if (containedIndex >= 0) {
            assistantMessages.splice(containedIndex, 1);
          }
          assistantMessages.push(element);
        }
      }

      return {
        count: assistantMessages.length,
        latestText: assistantMessages[assistantMessages.length - 1]?.textContent?.trim() || '',
      };
    }, CHATGPT_ASSISTANT_MESSAGE_SELECTORS);
  }

  private async readLatestAssistantText(
    page: Page,
    previousAssistantState: ChatGptAssistantMessageState,
  ): Promise<string> {
    return page.evaluate(
      ({
        messageSelectors,
        previousState,
      }: {
        messageSelectors: string[];
        previousState: ChatGptAssistantMessageState;
      }) => {
        const assistantMessages: Element[] = [];
        for (const selector of messageSelectors) {
          for (const element of Array.from(document.querySelectorAll(selector))) {
            const text = element.textContent?.trim() || '';
            if (!text) continue;
            if (assistantMessages.some((existing) => existing === element || existing.contains(element))) continue;
            const containedIndex = assistantMessages.findIndex((existing) => element.contains(existing));
            if (containedIndex >= 0) {
              assistantMessages.splice(containedIndex, 1);
            }
            assistantMessages.push(element);
          }
        }

        for (let index = assistantMessages.length - 1; index >= previousState.count; index -= 1) {
          const text = assistantMessages[index]?.textContent?.trim() || '';
          if (text) return text;
        }

        const latestText = assistantMessages[assistantMessages.length - 1]?.textContent?.trim() || '';
        if (latestText && latestText !== previousState.latestText) return latestText;

        return '';
      },
      { messageSelectors: CHATGPT_ASSISTANT_MESSAGE_SELECTORS, previousState: previousAssistantState },
    );
  }

  private async hasActiveGenerationControl(page: Page): Promise<boolean> {
    return page.evaluate(
      ({ selectors }: { selectors: string[] }) => {
        return selectors.some((selector) => {
          const element = document.querySelector(selector) as HTMLElement | null;
          if (!element) return false;
          if (element.getAttribute('aria-disabled') === 'true') return false;
          if ('disabled' in element && Boolean((element as HTMLButtonElement).disabled)) return false;

          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      },
      { selectors: CHATGPT_STOP_GENERATING_SELECTORS },
    );
  }

  private async waitForStableAssistantText(
    page: Page,
    previousAssistantState: ChatGptAssistantMessageState,
    responseMonitor: ChatGptTextResponseMonitor,
    cancellationError: string,
    signal?: AbortSignal,
  ): Promise<string> {
    let latestText = '';
    let stableSince = Date.now();
    const deadline = Date.now() + CHATGPT_PRETTIFY_RESPONSE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      this.throwIfTextPromptCancelled(signal, cancellationError);
      this.throwIfChatGptTextRequestFailed(responseMonitor);
      await this.throwIfChatGptBlockingErrorVisible(page);

      const nextText = await this.readLatestAssistantText(page, previousAssistantState);
      if (nextText && nextText !== latestText) {
        latestText = nextText;
        stableSince = Date.now();
      }

      const isGenerating = await this.hasActiveGenerationControl(page);
      if (latestText && !isGenerating && Date.now() - stableSince >= CHATGPT_PRETTIFY_RESPONSE_STABLE_MS) {
        return latestText;
      }

      await page.waitForTimeout(CHATGPT_PRETTIFY_POLL_MS);
    }

    throw new Error(
      `Timed out waiting for ChatGPT response (${await this.getChatGptTextDiagnostics(page, responseMonitor)})`,
    );
  }

  private async getChatGptTextDiagnostics(page: Page, responseMonitor: ChatGptTextResponseMonitor): Promise<string> {
    const diagnostics = await page.evaluate(
      ({
        composerSelector,
        userMessageSelector,
        assistantMessageSelectors,
        blockingErrorPatterns,
        blockingErrorSurfaceSelector,
      }: {
        composerSelector: string;
        userMessageSelector: string;
        assistantMessageSelectors: string[];
        blockingErrorPatterns: typeof CHATGPT_BLOCKING_ERROR_PATTERNS;
        blockingErrorSurfaceSelector: string;
      }) => {
        const assistantMessages = new Set<Element>();
        for (const selector of assistantMessageSelectors) {
          for (const element of Array.from(document.querySelectorAll(selector))) {
            if (element.textContent?.trim()) {
              assistantMessages.add(element);
            }
          }
        }

        const surfaceText = Array.from(document.querySelectorAll(blockingErrorSurfaceSelector))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map((element) => element.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ');
        const blockingError =
          blockingErrorPatterns.find(({ pattern }) => new RegExp(pattern, 'i').test(surfaceText))?.label || 'none';

        return {
          assistantMessageCount: assistantMessages.size,
          blockingError,
          composerTextLength: (document.querySelector(composerSelector)?.textContent?.trim() || '').length,
          userMessageCount: document.querySelectorAll(userMessageSelector).length,
        };
      },
      {
        assistantMessageSelectors: CHATGPT_ASSISTANT_MESSAGE_SELECTORS,
        blockingErrorPatterns: CHATGPT_BLOCKING_ERROR_PATTERNS,
        blockingErrorSurfaceSelector: CHATGPT_BLOCKING_ERROR_SURFACE_SELECTOR,
        composerSelector: CHATGPT_COMPOSER_SELECTOR,
        userMessageSelector: CHATGPT_USER_MESSAGE_SELECTOR,
      },
    );

    return [
      `urlSection=${getUrlSection(page.url())}`,
      `composerEmpty=${diagnostics.composerTextLength === 0}`,
      `userMessages=${diagnostics.userMessageCount}`,
      `assistantMessages=${diagnostics.assistantMessageCount}`,
      `conversationStarted=${responseMonitor.conversationStarted}`,
      `conversationStatus=${responseMonitor.conversationStatus ?? 'none'}`,
      `blockingError=${diagnostics.blockingError}`,
    ].join(', ');
  }

  private loadTextChatConversationId(): string {
    if (this.textChatConversationId) return this.textChatConversationId;

    try {
      if (!fs.existsSync(TEXT_CHAT_STATE_FILE)) return '';

      const state = parseChatGptTextChatState(JSON.parse(fs.readFileSync(TEXT_CHAT_STATE_FILE, 'utf-8')));
      this.textChatConversationId = state?.conversationId || '';
    } catch {
      log.warn('Failed to load saved ChatGPT text conversation');
    }

    return this.textChatConversationId;
  }

  private saveCurrentTextChatConversationId(page: Page): void {
    const conversationId = extractChatGptConversationId(page.url());
    if (!conversationId) return;

    this.saveTextChatConversationId(conversationId);
  }

  private saveTextChatConversationId(conversationId: string): void {
    const normalizedConversationId = normalizeChatGptConversationId(conversationId);
    if (!normalizedConversationId || normalizedConversationId === this.textChatConversationId) return;

    this.textChatConversationId = normalizedConversationId;
    try {
      fs.writeFileSync(
        TEXT_CHAT_STATE_FILE,
        JSON.stringify(
          {
            conversationId: normalizedConversationId,
            savedAt: Date.now(),
          },
          null,
          2,
        ),
      );
      log.info('Saved ChatGPT text conversation id');
    } catch {
      log.warn('Failed to save ChatGPT text conversation id');
    }
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

  private clearTextChatState(): void {
    this.textChatConversationId = '';
    try {
      if (fs.existsSync(TEXT_CHAT_STATE_FILE)) fs.unlinkSync(TEXT_CHAT_STATE_FILE);
    } catch {
      /* ignore */
    }
  }
}

function getResponsePath(urlString: string): string {
  try {
    return new URL(urlString).pathname;
  } catch {
    return '';
  }
}

function getUrlSection(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.pathname.split('/').slice(0, 2).join('/') || '/';
  } catch {
    return 'unknown';
  }
}
