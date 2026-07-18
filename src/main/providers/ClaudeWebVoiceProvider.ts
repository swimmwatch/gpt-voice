import type { BrowserContext, Page } from 'playwright-core';
import { BaseVoiceProvider, type TranscriptionResult, type VoiceProviderInfo } from './BaseVoiceProvider';
import {
  CLAUDE_WEB_PCM_BITS_PER_SAMPLE,
  CLAUDE_WEB_PCM_CHANNELS,
  CLAUDE_WEB_PCM_CHUNK_BYTES,
  CLAUDE_WEB_PCM_CHUNK_CADENCE_MS,
  CLAUDE_WEB_PCM_SAMPLE_RATE_HZ,
  ClaudeWebAudioError,
  extractClaudeWebPcm,
} from './claudeWebAudio';
import {
  ClaudeWebPageTransportError,
  ClaudeWebPageTransportErrorCode,
  createClaudeWebPageTransport,
  type ClaudeWebPageTransportInput,
} from './claudeWebPageTransport';
import { CLAUDE_WEB_SPEECH_PROTOCOL_VERSION, ClaudeWebProtocolError } from './claudeWebProtocol';
import {
  CLAUDE_WEB_ORIGIN,
  clearClaudeWebSession,
  getClaudeWebReadinessFailureCategory,
  getPlaywrightStorageState,
  readClaudeWebSession,
  resolveClaudeWebOrganization,
  saveClaudeWebSession,
  type ClaudeWebOrganizationContext,
  type ClaudeWebOrganizationEvidence,
  type ClaudeWebSessionReadResult,
} from './claudeWebSession';
import { getClaudeWebSettings } from './claudeWebSettings';
import { BrowserNavigationService, retryBrowserNavigation } from '../browserNavigationRetry';
import { writeClipboardText } from '../electronRuntime';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { CLAUDE_WEB_PROVIDER_ID, type ClaudeWebSettings } from '@shared/claudeWebSettings';
import { WAV_TRANSCRIPTION_MIME_TYPE } from '@shared/transcriptionConstants';

const log = createLogger('claude-web-provider');
const CLAUDE_WEB_NAVIGATION_TIMEOUT_MS = 30_000;
const CLAUDE_WEB_LOAD_SETTLE_TIMEOUT_MS = 10_000;
const CLAUDE_WEB_READINESS_TIMEOUT_MS = 10_000;
const CLAUDE_WEB_READINESS_POLL_INTERVAL_MS = 500;
const CLAUDE_WEB_BOOTSTRAP_PATH =
  '/edge-api/bootstrap?statsig_hashing_algorithm=djb2&growthbook_format=sdk&include_system_prompts=false';
const CLAUDE_WEB_RECORD_BUTTON_ACCESSIBLE_NAME = 'Press and hold to record';
const BLOCKED_RESOURCE_TYPES = new Set(['font', 'image', 'media']);
const SUPPORTED_WAV_MIME_TYPES = new Set(['audio/wav', 'audio/wave', 'audio/x-wav']);

export enum ClaudeWebVoiceProviderErrorCode {
  SessionMissing = 'session-missing',
  SessionExpired = 'session-expired',
  SessionInvalid = 'session-invalid',
  FeatureUnavailable = 'feature-unavailable',
  OrganizationMissing = 'organization-missing',
  OrganizationAmbiguous = 'organization-ambiguous',
  InvalidSettings = 'invalid-settings',
  InvalidAudio = 'invalid-audio',
  UpgradeOrAuth = 'upgrade-or-auth',
  ConnectTimeout = 'connect-timeout',
  ConnectionLoss = 'connection-loss',
  MalformedEvent = 'malformed-event',
  RateLimit = 'rate-limit',
  FirstEventTimeout = 'first-event-timeout',
  OverallTimeout = 'overall-timeout',
  DrainTimeout = 'drain-timeout',
  EmptyResult = 'empty-result',
  Cancelled = 'cancelled',
  PageShutdown = 'page-shutdown',
  UnexpectedFailure = 'unexpected-failure',
}

const TRANSIENT_STARTUP_READINESS_ERRORS = new Set<ClaudeWebVoiceProviderErrorCode>([
  ClaudeWebVoiceProviderErrorCode.SessionExpired,
  ClaudeWebVoiceProviderErrorCode.FeatureUnavailable,
  ClaudeWebVoiceProviderErrorCode.OrganizationMissing,
  ClaudeWebVoiceProviderErrorCode.OrganizationAmbiguous,
]);

const TRANSPORT_ERROR_CODES: Readonly<Record<ClaudeWebPageTransportErrorCode, ClaudeWebVoiceProviderErrorCode>> = {
  [ClaudeWebPageTransportErrorCode.UpgradeOrAuth]: ClaudeWebVoiceProviderErrorCode.UpgradeOrAuth,
  [ClaudeWebPageTransportErrorCode.ConnectTimeout]: ClaudeWebVoiceProviderErrorCode.ConnectTimeout,
  [ClaudeWebPageTransportErrorCode.ConnectionLoss]: ClaudeWebVoiceProviderErrorCode.ConnectionLoss,
  [ClaudeWebPageTransportErrorCode.MalformedEvent]: ClaudeWebVoiceProviderErrorCode.MalformedEvent,
  [ClaudeWebPageTransportErrorCode.RateLimit]: ClaudeWebVoiceProviderErrorCode.RateLimit,
  [ClaudeWebPageTransportErrorCode.FirstEventTimeout]: ClaudeWebVoiceProviderErrorCode.FirstEventTimeout,
  [ClaudeWebPageTransportErrorCode.OverallTimeout]: ClaudeWebVoiceProviderErrorCode.OverallTimeout,
  [ClaudeWebPageTransportErrorCode.DrainTimeout]: ClaudeWebVoiceProviderErrorCode.DrainTimeout,
  [ClaudeWebPageTransportErrorCode.EmptyResult]: ClaudeWebVoiceProviderErrorCode.EmptyResult,
  [ClaudeWebPageTransportErrorCode.Cancelled]: ClaudeWebVoiceProviderErrorCode.Cancelled,
  [ClaudeWebPageTransportErrorCode.PageShutdown]: ClaudeWebVoiceProviderErrorCode.PageShutdown,
};

type ClaudeWebStorageState = ReturnType<typeof getPlaywrightStorageState>;

export interface ClaudeWebReadinessSnapshot {
  authenticated: boolean;
  featureAvailable: boolean;
  organizationEvidence: ClaudeWebOrganizationEvidence;
}

export interface ClaudeWebPageTransportLike {
  transcribe(input: ClaudeWebPageTransportInput): Promise<string>;
  cancel(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ClaudeWebVoiceProviderDependencies {
  getSettings(): ClaudeWebSettings;
  readSession(): ClaudeWebSessionReadResult;
  saveSession(storageState: ClaudeWebStorageState): unknown;
  clearSession(): boolean;
  getStorageState(session: Extract<ClaudeWebSessionReadResult, { status: 'usable' }>['state']): ClaudeWebStorageState;
  resolveOrganization(evidence: ClaudeWebOrganizationEvidence): ClaudeWebOrganizationContext;
  inspectReadiness(page: Page): Promise<ClaudeWebReadinessSnapshot>;
  createTransport(page: Page): ClaudeWebPageTransportLike;
  writeClipboardText(text: string): void;
  navigatePage(page: Page): Promise<void>;
  waitForReadinessRetry(delayMs: number): Promise<void>;
}

interface ClaudeWebReadinessResolution {
  errorCode: ClaudeWebVoiceProviderErrorCode | null;
  organization: ClaudeWebOrganizationContext;
}

async function configureClaudeWebPage(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) return route.abort();
    return route.continue();
  });
}

async function navigateClaudeWebPage(page: Page): Promise<void> {
  await retryBrowserNavigation(
    {
      navigate: () =>
        page.goto(CLAUDE_WEB_ORIGIN, {
          waitUntil: 'domcontentloaded',
          timeout: CLAUDE_WEB_NAVIGATION_TIMEOUT_MS,
        }),
      service: BrowserNavigationService.Claude,
    },
    {
      onRetry: (event) => log.warn('Retrying Claude page navigation:', event),
    },
  );

  try {
    await page.waitForLoadState('load', { timeout: CLAUDE_WEB_LOAD_SETTLE_TIMEOUT_MS });
  } catch {
    log.warn('Claude load event did not settle quickly; continuing after DOMContentLoaded');
  }
}

/** Reads only the minimum same-origin state needed to prove authenticated Claude routing. */
export async function inspectClaudeWebReadiness(page: Page): Promise<ClaudeWebReadinessSnapshot> {
  return page.evaluate(
    async ({ bootstrapPath, recordButtonAccessibleName }) => {
      const activeOrganizationCandidates = new Set<string>();
      for (const entry of performance.getEntriesByType('resource')) {
        try {
          const path = new URL(entry.name, window.location.href).pathname;
          const match = /^\/api\/bootstrap\/([^/]+)\/current_user_access$/.exec(path);
          if (match?.[1]) activeOrganizationCandidates.add(decodeURIComponent(match[1]));
        } catch {
          // Ignore malformed or cross-runtime performance entries.
        }
      }

      const featureAvailable = Array.from(document.querySelectorAll('button')).some(
        (button) => button.getAttribute('aria-label') === recordButtonAccessibleName,
      );
      try {
        const response = await fetch(bootstrapPath, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          return {
            authenticated: false,
            featureAvailable,
            organizationEvidence: {
              activeOrganizationCandidates: Array.from(activeOrganizationCandidates),
              eligibleOrganizations: [],
            },
          };
        }

        const value: unknown = await response.json();
        const account =
          typeof value === 'object' && value !== null && 'account' in value
            ? (value as { account?: unknown }).account
            : null;
        const memberships =
          typeof account === 'object' && account !== null && 'memberships' in account
            ? (account as { memberships?: unknown }).memberships
            : [];
        const eligibleOrganizations = Array.isArray(memberships)
          ? memberships.flatMap((membership) => {
              if (typeof membership !== 'object' || membership === null || !('organization' in membership)) return [];
              const organization = (membership as { organization?: unknown }).organization;
              if (typeof organization !== 'object' || organization === null || !('uuid' in organization)) return [];
              const uuid = (organization as { uuid?: unknown }).uuid;
              return typeof uuid === 'string' && uuid.length > 0 ? [{ uuid }] : [];
            })
          : [];
        return {
          authenticated: true,
          featureAvailable,
          organizationEvidence: {
            activeOrganizationCandidates: Array.from(activeOrganizationCandidates),
            eligibleOrganizations,
          },
        };
      } catch {
        return {
          authenticated: false,
          featureAvailable,
          organizationEvidence: {
            activeOrganizationCandidates: Array.from(activeOrganizationCandidates),
            eligibleOrganizations: [],
          },
        };
      }
    },
    {
      bootstrapPath: CLAUDE_WEB_BOOTSTRAP_PATH,
      recordButtonAccessibleName: CLAUDE_WEB_RECORD_BUTTON_ACCESSIBLE_NAME,
    },
  );
}

const DEFAULT_DEPENDENCIES: ClaudeWebVoiceProviderDependencies = {
  getSettings: getClaudeWebSettings,
  readSession: readClaudeWebSession,
  saveSession: saveClaudeWebSession,
  clearSession: clearClaudeWebSession,
  getStorageState: getPlaywrightStorageState,
  resolveOrganization: resolveClaudeWebOrganization,
  inspectReadiness: inspectClaudeWebReadiness,
  createTransport: createClaudeWebPageTransport,
  writeClipboardText,
  navigatePage: navigateClaudeWebPage,
  waitForReadinessRetry: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
};

function getSessionErrorCode(result: ClaudeWebSessionReadResult): ClaudeWebVoiceProviderErrorCode | null {
  if (result.status === 'usable') return null;
  if (result.status === 'missing') return ClaudeWebVoiceProviderErrorCode.SessionMissing;
  if (result.status === 'expired') return ClaudeWebVoiceProviderErrorCode.SessionExpired;
  return ClaudeWebVoiceProviderErrorCode.SessionInvalid;
}

function getTranscriptionErrorCode(error: unknown): ClaudeWebVoiceProviderErrorCode {
  if (error instanceof ClaudeWebAudioError) return ClaudeWebVoiceProviderErrorCode.InvalidAudio;
  if (error instanceof ClaudeWebProtocolError) {
    return error.code === 'invalid-language'
      ? ClaudeWebVoiceProviderErrorCode.InvalidSettings
      : ClaudeWebVoiceProviderErrorCode.OrganizationMissing;
  }
  if (error instanceof ClaudeWebPageTransportError) return TRANSPORT_ERROR_CODES[error.code];
  return ClaudeWebVoiceProviderErrorCode.UnexpectedFailure;
}

function getSafeErrorMetadata(error: unknown): Record<string, unknown> {
  const errorCode = getTranscriptionErrorCode(error);
  if (!(error instanceof ClaudeWebPageTransportError)) return { errorCode };
  return { errorCode, ...error.diagnostics };
}

function isSupportedWavMimeType(mimeType: string): boolean {
  return SUPPORTED_WAV_MIME_TYPES.has(mimeType.split(';', 1)[0].trim().toLowerCase());
}

/** Browser-session Claude provider; organization identity remains operation-local. */
export class ClaudeWebVoiceProvider extends BaseVoiceProvider {
  readonly info: VoiceProviderInfo = {
    id: CLAUDE_WEB_PROVIDER_ID,
    name: 'Claude Web',
    authType: 'browserSession',
    category: 'web',
    hasSettings: true,
    loginUrl: CLAUDE_WEB_ORIGIN,
  };

  private readonly deps: ClaudeWebVoiceProviderDependencies;
  private transport: ClaudeWebPageTransportLike | null = null;
  private ready = false;
  private readinessErrorCode: ClaudeWebVoiceProviderErrorCode | null = null;

  constructor(dependencies: Partial<ClaudeWebVoiceProviderDependencies> = {}) {
    super();
    this.deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  }

  async initPage(context: BrowserContext): Promise<void> {
    this.context = context;
    this.page = await context.newPage();
    await configureClaudeWebPage(this.page);
    await this.deps.navigatePage(this.page);
    this.setReadiness(await this.resolveStartupReadiness(this.page));
    this.transport = this.deps.createTransport(this.page);
  }

  hasSession(): boolean {
    try {
      const result = this.deps.readSession();
      if (result.status === 'usable') return true;
      if (result.status !== 'missing') this.deps.clearSession();
      return false;
    } catch {
      this.deps.clearSession();
      return false;
    }
  }

  clearSession(): void {
    this.ready = false;
    this.readinessErrorCode = null;
    this.deps.clearSession();
  }

  async saveSession(context: BrowserContext): Promise<void> {
    this.deps.saveSession(await context.storageState());
    this.ready = false;
    this.readinessErrorCode = null;
  }

  async loadSession(context: BrowserContext): Promise<boolean> {
    const result = this.deps.readSession();
    if (result.status !== 'usable') {
      if (result.status !== 'missing') this.deps.clearSession();
      this.ready = false;
      this.readinessErrorCode = getSessionErrorCode(result);
      return false;
    }

    const storageState = this.deps.getStorageState(result.state);
    await context.addCookies(storageState.cookies);
    for (const origin of storageState.origins) {
      await context.addInitScript(
        ({ entries, expectedOrigin }) => {
          if (window.location.origin !== expectedOrigin) return;
          for (const entry of entries) window.localStorage.setItem(entry.name, entry.value);
        },
        { entries: origin.localStorage, expectedOrigin: origin.origin },
      );
    }
    return true;
  }

  isReady(): boolean {
    return this.ready && this.page !== null && !this.page.isClosed() && this.transport !== null;
  }

  getReadinessError(): string | null {
    return this.readinessErrorCode ? t(`error.claudeWeb.${this.readinessErrorCode}`) : null;
  }

  getTranscriptionCacheContext(): readonly string[] {
    const settings = this.deps.getSettings();
    return [
      'language',
      settings.language,
      'protocol-version',
      String(CLAUDE_WEB_SPEECH_PROTOCOL_VERSION),
      'sample-rate-hz',
      String(CLAUDE_WEB_PCM_SAMPLE_RATE_HZ),
      'channels',
      String(CLAUDE_WEB_PCM_CHANNELS),
      'bits-per-sample',
      String(CLAUDE_WEB_PCM_BITS_PER_SAMPLE),
      'chunk-bytes',
      String(CLAUDE_WEB_PCM_CHUNK_BYTES),
      'chunk-cadence-ms',
      String(CLAUDE_WEB_PCM_CHUNK_CADENCE_MS),
    ];
  }

  async transcribe(buffer: ArrayBuffer, mimeType = WAV_TRANSCRIPTION_MIME_TYPE): Promise<TranscriptionResult> {
    try {
      if (!this.page || this.page.isClosed() || !this.transport) {
        this.ready = false;
        return { success: false, error: ClaudeWebVoiceProviderErrorCode.PageShutdown };
      }
      if (!isSupportedWavMimeType(mimeType)) {
        return { success: false, error: ClaudeWebVoiceProviderErrorCode.InvalidAudio };
      }

      const pcm = extractClaudeWebPcm(new Uint8Array(buffer));
      let settings: ClaudeWebSettings;
      try {
        settings = this.deps.getSettings();
      } catch {
        return { success: false, error: ClaudeWebVoiceProviderErrorCode.InvalidSettings };
      }
      const readiness = await this.resolveReadiness(this.page);
      this.setReadiness(readiness);
      if (readiness.errorCode || readiness.organization.routing.status !== 'resolved') {
        return {
          success: false,
          error: readiness.errorCode ?? ClaudeWebVoiceProviderErrorCode.OrganizationMissing,
        };
      }

      const text = await this.transport.transcribe({
        pcm,
        language: settings.language,
        organizationUuid: readiness.organization.routing.organizationUuid,
      });
      this.deps.writeClipboardText(text);
      return { success: true, text };
    } catch (error: unknown) {
      const errorCode = getTranscriptionErrorCode(error);
      if (
        errorCode === ClaudeWebVoiceProviderErrorCode.UpgradeOrAuth ||
        errorCode === ClaudeWebVoiceProviderErrorCode.PageShutdown
      ) {
        this.ready = false;
      }
      log.error('Claude transcription failed:', getSafeErrorMetadata(error));
      return { success: false, error: errorCode };
    }
  }

  async cancelTranscription(): Promise<void> {
    await this.transport?.cancel();
  }

  async shutdown(): Promise<void> {
    this.ready = false;
    this.readinessErrorCode = null;
    const transport = this.transport;
    this.transport = null;
    try {
      await transport?.shutdown();
    } finally {
      await super.shutdown();
    }
  }

  private async resolveReadiness(page: Page): Promise<ClaudeWebReadinessResolution> {
    let session: ClaudeWebSessionReadResult;
    try {
      session = this.deps.readSession();
    } catch {
      return {
        errorCode: ClaudeWebVoiceProviderErrorCode.SessionInvalid,
        organization: this.deps.resolveOrganization({
          activeOrganizationCandidates: [],
          eligibleOrganizations: [],
        }),
      };
    }
    const sessionErrorCode = getSessionErrorCode(session);
    if (sessionErrorCode) {
      return {
        errorCode: sessionErrorCode,
        organization: this.deps.resolveOrganization({
          activeOrganizationCandidates: [],
          eligibleOrganizations: [],
        }),
      };
    }

    const snapshot = await this.deps.inspectReadiness(page);
    const organization = this.deps.resolveOrganization(snapshot.organizationEvidence);
    if (!snapshot.authenticated) {
      return { errorCode: ClaudeWebVoiceProviderErrorCode.SessionExpired, organization };
    }

    const category = getClaudeWebReadinessFailureCategory(
      session.status,
      snapshot.featureAvailable,
      organization.routing,
    );
    if (category === 'feature-unavailable') {
      return { errorCode: ClaudeWebVoiceProviderErrorCode.FeatureUnavailable, organization };
    }
    if (category === 'ambiguous') {
      return { errorCode: ClaudeWebVoiceProviderErrorCode.OrganizationAmbiguous, organization };
    }
    if (category === 'missing') {
      return { errorCode: ClaudeWebVoiceProviderErrorCode.OrganizationMissing, organization };
    }
    if (category === 'expired') {
      return { errorCode: ClaudeWebVoiceProviderErrorCode.SessionExpired, organization };
    }
    return { errorCode: null, organization };
  }

  private async resolveStartupReadiness(page: Page): Promise<ClaudeWebReadinessResolution> {
    let readiness = await this.resolveReadiness(page);
    let elapsedMs = 0;

    while (
      readiness.errorCode !== null &&
      TRANSIENT_STARTUP_READINESS_ERRORS.has(readiness.errorCode) &&
      elapsedMs < CLAUDE_WEB_READINESS_TIMEOUT_MS
    ) {
      const delayMs = Math.min(CLAUDE_WEB_READINESS_POLL_INTERVAL_MS, CLAUDE_WEB_READINESS_TIMEOUT_MS - elapsedMs);
      await this.deps.waitForReadinessRetry(delayMs);
      elapsedMs += delayMs;
      readiness = await this.resolveReadiness(page);
    }

    return readiness;
  }

  private setReadiness(readiness: ClaudeWebReadinessResolution): void {
    this.ready = readiness.errorCode === null;
    this.readinessErrorCode = readiness.errorCode;
  }
}
