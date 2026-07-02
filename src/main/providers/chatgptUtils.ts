import type { BrowserContext } from 'playwright-core';
import { StatusCodes } from 'http-status-codes';
import type { TranscriptionResult } from './BaseVoiceProvider';
import { t } from '../i18n';

export type StorageCookie = Parameters<BrowserContext['addCookies']>[0][number];

export interface SessionState {
  cookies?: StorageCookie[];
}

const AUTH_COOKIE_NAMES = new Set([
  'session',
  'oai-client-auth-session',
  'auth-session-minimized',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
]);

const AUTH_COOKIE_NAME_PREFIXES = ['__Secure-next-auth.session-token', 'next-auth.session-token'];
const AUTH_COOKIE_DOMAINS = ['chatgpt.com', 'openai.com', 'auth.openai.com'];
const CHATGPT_ASR_ERROR_DETAIL = 'Error in ASR API';

export function getAudioFileExtension(mimeType: string): string {
  const normalizedMimeType = mimeType || 'audio/webm';
  if (normalizedMimeType.includes('mp4')) return 'm4a';
  if (normalizedMimeType.includes('ogg')) return 'ogg';
  if (normalizedMimeType.includes('wav')) return 'wav';
  return 'webm';
}

export function isUnexpiredCookie(cookie: StorageCookie, nowSeconds = Date.now() / 1000): boolean {
  const expires = typeof cookie.expires === 'number' ? cookie.expires : undefined;
  return expires === undefined || expires <= 0 || expires > nowSeconds;
}

export function getUnexpiredCookies(cookies: StorageCookie[], nowSeconds = Date.now() / 1000): StorageCookie[] {
  return cookies.filter((cookie) => isUnexpiredCookie(cookie, nowSeconds));
}

export function isChatGptAuthCookie(cookie: StorageCookie): boolean {
  const name = typeof cookie.name === 'string' ? cookie.name : '';
  const domain = typeof cookie.domain === 'string' ? cookie.domain : '';
  const normalizedDomain = domain.replace(/^\./, '');
  const hasAuthName =
    AUTH_COOKIE_NAMES.has(name) || AUTH_COOKIE_NAME_PREFIXES.some((prefix) => name.startsWith(prefix));
  const hasAuthDomain = AUTH_COOKIE_DOMAINS.some(
    (authDomain) => normalizedDomain === authDomain || normalizedDomain.endsWith(`.${authDomain}`),
  );
  return hasAuthName && hasAuthDomain;
}

export function hasUsableSessionState(sessionData: SessionState, nowSeconds = Date.now() / 1000): boolean {
  return getUnexpiredCookies(sessionData.cookies || [], nowSeconds).some((cookie) => isChatGptAuthCookie(cookie));
}

export function shouldRefreshTranscribeToken(status: number): boolean {
  return status === StatusCodes.UNAUTHORIZED || status === StatusCodes.FORBIDDEN;
}

export function parseChatGptTranscribeResponse(
  resp: { status: number; body: string },
  mimeType: string,
): TranscriptionResult {
  const parsed = parseTranscribeResponseBody(resp);
  if (
    !parsed.success &&
    resp.status === StatusCodes.INTERNAL_SERVER_ERROR &&
    parsed.error === CHATGPT_ASR_ERROR_DETAIL
  ) {
    return {
      success: false,
      error: t('error.chatGptAsrFailure', { mimeType: mimeType || 'unknown' }),
      raw: parsed.raw ?? resp.body,
    };
  }
  return parsed;
}

export function parseTranscribeResponseBody(resp: { status: number; body: string }): TranscriptionResult {
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
    return { success: true, text };
  }

  const error = getTranscribeErrorMessage(result);
  if (error) {
    return { success: false, error, raw: JSON.stringify(result) };
  }

  return { success: false, error: t('error.noTranscription'), raw: JSON.stringify(result) };
}

function getTranscribeErrorMessage(result: Record<string, unknown>): string {
  const detail = getNestedErrorMessage(result.detail);
  if (detail) return detail;

  const error = getNestedErrorMessage(result.error);
  if (error) return error;

  const message = getNestedErrorMessage(result.message);
  return message || '';
}

function getNestedErrorMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  return (
    getNestedErrorMessage(record.detail) || getNestedErrorMessage(record.message) || getNestedErrorMessage(record.error)
  );
}
