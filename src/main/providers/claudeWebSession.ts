import * as path from 'node:path';
import type { BrowserContext } from 'playwright-core';
import { APP_DIR } from '../config';
import { readClaudeWebPrivateJson, removeClaudeWebPrivateFile, writeClaudeWebPrivateJson } from './claudeWebSettings';

type PlaywrightStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export type ClaudeWebSessionCookie = PlaywrightStorageState['cookies'][number];
export type ClaudeWebOriginState = PlaywrightStorageState['origins'][number];

export const CLAUDE_WEB_SESSION_FILE = path.join(APP_DIR, 'claude-web-session.json');
export const CLAUDE_WEB_SESSION_SCHEMA_VERSION = 1;
export const CLAUDE_WEB_ORIGIN = 'https://claude.ai';
export const DEFAULT_CLAUDE_WEB_ACCOUNT_SCOPE = 'unknown';

export type ClaudeWebAccountScope = 'personal' | 'organization' | 'unknown';
export type ClaudeWebSessionStatus =
  'usable' | 'missing' | 'malformed' | 'unsupported-version' | 'expired' | 'missing-origin';
export type ClaudeWebReadinessFailureCategory = 'missing' | 'expired' | 'feature-unavailable' | 'ambiguous';

export interface ClaudeWebSessionState extends PlaywrightStorageState {
  schemaVersion: typeof CLAUDE_WEB_SESSION_SCHEMA_VERSION;
}

export type ClaudeWebSessionReadResult =
  { status: 'usable'; state: ClaudeWebSessionState } | { status: Exclude<ClaudeWebSessionStatus, 'usable'> };

export interface ClaudeWebSessionValidationOptions {
  nowSeconds?: number;
  origin?: string;
}

export interface ClaudeWebEligibleOrganization {
  uuid: string;
}

export interface ClaudeWebOrganizationEvidence {
  activeOrganizationCandidates: readonly string[];
  eligibleOrganizations: readonly ClaudeWebEligibleOrganization[];
}

export type ClaudeWebOrganizationRouting =
  { status: 'resolved'; organizationUuid: string } | { status: 'missing' | 'ambiguous' };

export interface ClaudeWebOrganizationContext {
  routing: ClaudeWebOrganizationRouting;
  accountScope: ClaudeWebAccountScope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSessionCookie(value: unknown): value is ClaudeWebSessionCookie {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.name) &&
    typeof value.value === 'string' &&
    isNonEmptyString(value.domain) &&
    isNonEmptyString(value.path) &&
    typeof value.expires === 'number' &&
    Number.isFinite(value.expires) &&
    typeof value.httpOnly === 'boolean' &&
    typeof value.secure === 'boolean' &&
    (value.sameSite === 'Strict' || value.sameSite === 'Lax' || value.sameSite === 'None')
  );
}

function isOriginState(value: unknown): value is ClaudeWebOriginState {
  if (!isRecord(value) || !isNonEmptyString(value.origin) || !Array.isArray(value.localStorage)) return false;
  return value.localStorage.every(
    (entry) => isRecord(entry) && isNonEmptyString(entry.name) && typeof entry.value === 'string',
  );
}

function getExpectedOrigin(options: ClaudeWebSessionValidationOptions): string {
  return options.origin ?? CLAUDE_WEB_ORIGIN;
}

function getExpectedCookieDomain(options: ClaudeWebSessionValidationOptions): string {
  try {
    return new URL(getExpectedOrigin(options)).hostname;
  } catch {
    return '';
  }
}

function cookieMatchesDomain(cookie: ClaudeWebSessionCookie, expectedDomain: string): boolean {
  const domain = cookie.domain.replace(/^\./, '').toLowerCase();
  const expected = expectedDomain.toLowerCase();
  return Boolean(expected) && (domain === expected || domain.endsWith(`.${expected}`));
}

function isUnexpiredCookie(cookie: ClaudeWebSessionCookie, nowSeconds: number): boolean {
  return cookie.expires <= 0 || cookie.expires > nowSeconds;
}

function getRelevantCookies(
  cookies: readonly ClaudeWebSessionCookie[],
  options: ClaudeWebSessionValidationOptions,
): ClaudeWebSessionCookie[] {
  const expectedDomain = getExpectedCookieDomain(options);
  return cookies.filter(
    (cookie) =>
      cookieMatchesDomain(cookie, expectedDomain) && cookie.secure && cookie.httpOnly && cookie.value.length > 0,
  );
}

function getRelevantOrigins(
  origins: readonly ClaudeWebOriginState[],
  options: ClaudeWebSessionValidationOptions,
): ClaudeWebOriginState[] {
  const expectedOrigin = getExpectedOrigin(options);
  return origins.filter((origin) => origin.origin === expectedOrigin && origin.localStorage.length > 0);
}

function parseClaudeWebSessionState(
  value: unknown,
  options: ClaudeWebSessionValidationOptions,
): ClaudeWebSessionReadResult {
  if (!isRecord(value)) return { status: 'malformed' };
  if (typeof value.schemaVersion !== 'number') return { status: 'malformed' };
  if (value.schemaVersion !== CLAUDE_WEB_SESSION_SCHEMA_VERSION) return { status: 'unsupported-version' };
  if (!Array.isArray(value.cookies) || !value.cookies.every(isSessionCookie)) return { status: 'malformed' };
  if (!Array.isArray(value.origins) || !value.origins.every(isOriginState)) return { status: 'malformed' };

  const relevantCookies = getRelevantCookies(value.cookies, options);
  if (!relevantCookies.length) return { status: 'missing' };

  const nowSeconds = options.nowSeconds ?? Date.now() / 1000;
  const unexpiredCookies = relevantCookies.filter((cookie) => isUnexpiredCookie(cookie, nowSeconds));
  if (!unexpiredCookies.length) return { status: 'expired' };

  const relevantOrigins = getRelevantOrigins(value.origins, options);
  if (relevantOrigins.length !== 1) return { status: 'missing-origin' };

  return {
    status: 'usable',
    state: {
      schemaVersion: CLAUDE_WEB_SESSION_SCHEMA_VERSION,
      cookies: unexpiredCookies,
      origins: relevantOrigins,
    },
  };
}

export function createClaudeWebSessionState(
  storageState: PlaywrightStorageState,
  options: ClaudeWebSessionValidationOptions = {},
): ClaudeWebSessionState {
  return {
    schemaVersion: CLAUDE_WEB_SESSION_SCHEMA_VERSION,
    cookies: getRelevantCookies(storageState.cookies, options),
    origins: getRelevantOrigins(storageState.origins, options),
  };
}

export function saveClaudeWebSession(
  storageState: PlaywrightStorageState,
  filePath = CLAUDE_WEB_SESSION_FILE,
  options: ClaudeWebSessionValidationOptions = {},
): ClaudeWebSessionState {
  const state = createClaudeWebSessionState(storageState, options);
  const result = parseClaudeWebSessionState(state, options);
  if (result.status !== 'usable') {
    throw new Error(`Claude Web session state is not usable: ${result.status}`);
  }
  writeClaudeWebPrivateJson(filePath, result.state);
  return result.state;
}

export function readClaudeWebSession(
  filePath = CLAUDE_WEB_SESSION_FILE,
  options: ClaudeWebSessionValidationOptions = {},
): ClaudeWebSessionReadResult {
  const result = readClaudeWebPrivateJson(filePath);
  if (result.status === 'missing') return { status: 'missing' };
  if (result.status === 'malformed') return { status: 'malformed' };
  return parseClaudeWebSessionState(result.value, options);
}

export function clearClaudeWebSession(filePath = CLAUDE_WEB_SESSION_FILE): boolean {
  return removeClaudeWebPrivateFile(filePath);
}

export function getPlaywrightStorageState(state: ClaudeWebSessionState): PlaywrightStorageState {
  return { cookies: state.cookies, origins: state.origins };
}

export function resolveClaudeWebOrganization(evidence: ClaudeWebOrganizationEvidence): ClaudeWebOrganizationContext {
  const accountScope = DEFAULT_CLAUDE_WEB_ACCOUNT_SCOPE;
  const candidates = evidence.activeOrganizationCandidates;
  if (candidates.length === 0 || !isNonEmptyString(candidates[0])) {
    return { routing: { status: 'missing' }, accountScope };
  }
  if (candidates.length !== 1) {
    return { routing: { status: 'ambiguous' }, accountScope };
  }

  const matches = evidence.eligibleOrganizations.filter(
    (organization) => isRecord(organization) && organization.uuid === candidates[0],
  );
  if (matches.length === 0) return { routing: { status: 'missing' }, accountScope };
  if (matches.length !== 1) return { routing: { status: 'ambiguous' }, accountScope };

  return {
    routing: { status: 'resolved', organizationUuid: candidates[0] },
    accountScope,
  };
}

export function getClaudeWebReadinessFailureCategory(
  sessionStatus: ClaudeWebSessionStatus,
  featureAvailable: boolean,
  routing: ClaudeWebOrganizationRouting,
): ClaudeWebReadinessFailureCategory | null {
  if (sessionStatus === 'expired') return 'expired';
  if (sessionStatus !== 'usable') return 'missing';
  if (!featureAvailable) return 'feature-unavailable';
  if (routing.status === 'missing') return 'missing';
  if (routing.status === 'ambiguous') return 'ambiguous';
  return null;
}
