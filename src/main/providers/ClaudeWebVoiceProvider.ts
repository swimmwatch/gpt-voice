import type { BrowserContext, Page } from 'playwright-core';
import type { TranscriptionResult, VoiceProviderInfo } from './BaseVoiceProvider';
import { StreamingVoiceProvider } from './streamingVoiceProvider';
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
  type ClaudeWebPageTransportInput,
  type ClaudeWebPageTransportOperationId,
  type ClaudeWebPageTransportStartInput,
} from './claudeWebPageTransport';
import {
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type CancelStreamingTranscriptionInput,
  type FinishStreamingTranscriptionInput,
  type PushStreamingTranscriptionChunkInput,
  type StartStreamingTranscriptionInput,
  type StreamingTranscriptionCancellation,
  type StreamingTranscriptionChunkAccepted,
  type StreamingTranscriptionError,
  type StreamingTranscriptionOperationId,
  type StreamingTranscriptionResult,
  type StreamingTranscriptionStarted,
  type StreamingVoiceAuditCauseCode,
  type StreamingVoiceProviderOperations,
} from './streamingVoiceProvider';
import { StreamingTranscriptionOperationError } from './StreamingTranscriptionOperationError';
import {
  type VoiceAuditOperationContext,
  type VoiceProviderAudit,
  type VoiceStreamingAuditCounters,
} from './voiceProviderAudit';
import { CLAUDE_WEB_SPEECH_PROTOCOL_VERSION, ClaudeWebProtocolError } from './claudeWebProtocol';
import {
  CLAUDE_WEB_ORIGIN,
  getClaudeWebReadinessFailureCategory,
  type ClaudeWebOrganizationContext,
  type ClaudeWebOrganizationEvidence,
  type ClaudeWebSessionReadResult,
} from './claudeWebSession';
import { t } from '../i18n';
import { CLAUDE_WEB_PROVIDER_ID, type ClaudeWebSettings } from '@shared/claudeWebSettings';
import { WAV_TRANSCRIPTION_MIME_TYPE } from '@shared/transcriptionConstants';
import type { ProviderAuditPhase } from '@main/providerAudit';
import type { ClaudeWebNavigationService } from './claudeWebNavigationService';
import type { RendererSafeVoiceProviderInfo } from '@shared/voiceProvider';

const CLAUDE_WEB_READINESS_TIMEOUT_MS = 10_000;
const CLAUDE_WEB_READINESS_POLL_INTERVAL_MS = 500;
const CLAUDE_WEB_BOOTSTRAP_PATH =
  '/edge-api/bootstrap?statsig_hashing_algorithm=djb2&growthbook_format=sdk&include_system_prompts=false';
const CLAUDE_WEB_RECORD_BUTTON_ACCESSIBLE_NAME = 'Press and hold to record';
const BLOCKED_RESOURCE_TYPES = new Set(['font', 'image', 'media']);
const SUPPORTED_WAV_MIME_TYPES = new Set(['audio/wav', 'audio/wave', 'audio/x-wav']);
const EMPTY_STREAMING_AUDIT_COUNTERS = Object.freeze({
  acceptedByteCount: 0,
  chunkCount: 0,
  frameCount: 0,
}) satisfies VoiceStreamingAuditCounters;

type ClaudeWebAuthenticationStatus = 'authenticated' | 'unauthenticated' | 'unavailable';

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
  ClaudeWebVoiceProviderErrorCode.UnexpectedFailure,
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

type ClaudeWebStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export interface ClaudeWebReadinessSnapshot {
  authentication: ClaudeWebAuthenticationStatus;
  featureAvailable: boolean;
  organizationEvidence: ClaudeWebOrganizationEvidence;
}

export interface ClaudeWebPageTransportLike {
  transcribe(input: ClaudeWebPageTransportInput): Promise<string>;
  start(input: ClaudeWebPageTransportStartInput): Promise<ClaudeWebPageTransportOperationId>;
  push(operationId: ClaudeWebPageTransportOperationId, chunk: Uint8Array): Promise<void>;
  finish(operationId: ClaudeWebPageTransportOperationId, finalChunk?: Uint8Array): Promise<string>;
  cancel(operationId: ClaudeWebPageTransportOperationId): Promise<void>;
  cancelAll(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ClaudeWebVoiceProviderDependencies {
  audit: VoiceProviderAudit;
  getSettings(): ClaudeWebSettings;
  readSession(): ClaudeWebSessionReadResult;
  saveSession(storageState: ClaudeWebStorageState): unknown;
  clearSession(): boolean;
  getStorageState(session: Extract<ClaudeWebSessionReadResult, { status: 'usable' }>['state']): ClaudeWebStorageState;
  resolveOrganization(evidence: ClaudeWebOrganizationEvidence): ClaudeWebOrganizationContext;
  inspectReadiness(page: Page, timeoutMs: number): Promise<ClaudeWebReadinessSnapshot>;
  createTransport(page: Page): ClaudeWebPageTransportLike;
  writeClipboardText(text: string): void;
  navigationService: Pick<ClaudeWebNavigationService, 'navigate'>;
  now(): number;
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

/** Reads only the minimum same-origin state needed to prove authenticated Claude routing. */
export async function inspectClaudeWebReadiness(
  page: Page,
  timeoutMs = CLAUDE_WEB_READINESS_TIMEOUT_MS,
): Promise<ClaudeWebReadinessSnapshot> {
  const unavailableSnapshot: ClaudeWebReadinessSnapshot = {
    authentication: 'unavailable',
    featureAvailable: false,
    organizationEvidence: { activeOrganizationCandidates: [], eligibleOrganizations: [] },
  };
  const inspection = page.evaluate(
    async ({ bootstrapPath, recordButtonAccessibleName, timeoutMs: inspectionTimeoutMs }) => {
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
      const unavailable = {
        authentication: 'unavailable' as const,
        featureAvailable,
        organizationEvidence: {
          activeOrganizationCandidates: Array.from(activeOrganizationCandidates),
          eligibleOrganizations: [],
        },
      };
      const abortController = new AbortController();
      const abortHandle = setTimeout(() => abortController.abort(), inspectionTimeoutMs);
      try {
        const response = await fetch(bootstrapPath, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
          signal: abortController.signal,
        });
        if (!response.ok) {
          return response.status === 401 || response.status === 403
            ? { ...unavailable, authentication: 'unauthenticated' as const }
            : unavailable;
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
          authentication: 'authenticated' as const,
          featureAvailable,
          organizationEvidence: {
            activeOrganizationCandidates: Array.from(activeOrganizationCandidates),
            eligibleOrganizations,
          },
        };
      } catch {
        return unavailable;
      } finally {
        clearTimeout(abortHandle);
      }
    },
    {
      bootstrapPath: CLAUDE_WEB_BOOTSTRAP_PATH,
      recordButtonAccessibleName: CLAUDE_WEB_RECORD_BUTTON_ACCESSIBLE_NAME,
      timeoutMs,
    },
  );
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ClaudeWebReadinessSnapshot>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(unavailableSnapshot), timeoutMs);
  });
  try {
    return await Promise.race([inspection, timeout]);
  } catch {
    return unavailableSnapshot;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

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

function isSupportedWavMimeType(mimeType: string): boolean {
  return SUPPORTED_WAV_MIME_TYPES.has(mimeType.split(';', 1)[0].trim().toLowerCase());
}

function createStreamingError(code: StreamingTranscriptionErrorCode): StreamingTranscriptionError {
  if (code === StreamingTranscriptionErrorCode.Cancelled) {
    return { lifecycle: StreamingTranscriptionLifecycle.Cancelled, code };
  }
  return { lifecycle: StreamingTranscriptionLifecycle.Failed, code };
}

function mapStreamingError(error: unknown): StreamingTranscriptionError {
  if (error instanceof StreamingTranscriptionOperationError) return error.error;
  if (error instanceof ClaudeWebPageTransportError && error.code === ClaudeWebPageTransportErrorCode.Cancelled) {
    return createStreamingError(StreamingTranscriptionErrorCode.Cancelled);
  }
  return createStreamingError(StreamingTranscriptionErrorCode.TransportFailure);
}

function streamingOperationError(
  code: StreamingTranscriptionErrorCode,
  auditCauseCode: StreamingVoiceAuditCauseCode = code,
): StreamingTranscriptionOperationError {
  return new StreamingTranscriptionOperationError(createStreamingError(code), auditCauseCode);
}

function isValidStreamingChunk(chunk: Uint8Array, allowEmpty: boolean): boolean {
  return (
    chunk instanceof Uint8Array &&
    (allowEmpty || chunk.byteLength > 0) &&
    chunk.byteLength % (CLAUDE_WEB_PCM_BITS_PER_SAMPLE / 8) === 0
  );
}

type ClaudeWebTranscriptionContext =
  | { ready: true; transport: ClaudeWebPageTransportLike; input: ClaudeWebPageTransportStartInput }
  | { ready: false; errorCode: ClaudeWebVoiceProviderErrorCode };

interface ClaudeWebStreamingOperation {
  transport: ClaudeWebPageTransportLike;
  transportOperationId: ClaudeWebPageTransportOperationId;
}

export const CLAUDE_WEB_VOICE_PROVIDER_INFO = Object.freeze({
  id: CLAUDE_WEB_PROVIDER_ID,
  name: 'Claude Web',
  authType: 'browserSession',
  category: 'web',
  hasSettings: true,
  transcriptionMode: 'streaming',
  loginUrl: CLAUDE_WEB_ORIGIN,
}) satisfies VoiceProviderInfo;

export const CLAUDE_WEB_RENDERER_PROVIDER_INFO = Object.freeze({
  id: CLAUDE_WEB_VOICE_PROVIDER_INFO.id,
  name: CLAUDE_WEB_VOICE_PROVIDER_INFO.name,
  authType: CLAUDE_WEB_VOICE_PROVIDER_INFO.authType,
  category: CLAUDE_WEB_VOICE_PROVIDER_INFO.category,
  hasSettings: CLAUDE_WEB_VOICE_PROVIDER_INFO.hasSettings,
  transcriptionMode: CLAUDE_WEB_VOICE_PROVIDER_INFO.transcriptionMode,
}) satisfies RendererSafeVoiceProviderInfo;

/** Browser-session Claude provider; organization identity remains operation-local. */
export class ClaudeWebVoiceProvider extends StreamingVoiceProvider implements StreamingVoiceProviderOperations {
  readonly info = CLAUDE_WEB_VOICE_PROVIDER_INFO;

  private readonly deps: ClaudeWebVoiceProviderDependencies;
  private transport: ClaudeWebPageTransportLike | null = null;
  private readonly streamingOperations = new Map<StreamingTranscriptionOperationId, ClaudeWebStreamingOperation>();
  private ready = false;
  private readinessErrorCode: ClaudeWebVoiceProviderErrorCode | null = null;

  constructor(dependencies: ClaudeWebVoiceProviderDependencies) {
    super();
    this.deps = dependencies;
  }

  async initPage(context: BrowserContext): Promise<void> {
    this.context = context;
    this.page = await context.newPage();
    await configureClaudeWebPage(this.page);
    await this.deps.navigationService.navigate(this.page);
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
    const audit = this.deps.audit.startBatch(this.info.id, buffer, mimeType);
    const startMetadata = this.deps.audit.createBatchMetadata(audit);
    let auditPhase: ProviderAuditPhase = 'validation';
    audit.lifecycle.phaseCompleted('dispatch', startMetadata);
    audit.lifecycle.phaseEntered('validation', startMetadata);

    try {
      if (!isSupportedWavMimeType(mimeType)) {
        this.deps.audit.terminalBatch(audit, 'validation', 'failure', {
          causeCode: ClaudeWebVoiceProviderErrorCode.InvalidAudio,
        });
        return { success: false, error: ClaudeWebVoiceProviderErrorCode.InvalidAudio };
      }

      const pcm = extractClaudeWebPcm(new Uint8Array(buffer));
      audit.lifecycle.phaseCompleted('validation', startMetadata);
      const context = await this.resolveTranscriptionContext(audit, startMetadata);
      if (!context.ready) {
        this.deps.audit.terminalBatch(audit, this.getAuditFailurePhase(context.errorCode), 'failure', {
          causeCode: context.errorCode,
        });
        return { success: false, error: context.errorCode };
      }

      auditPhase = 'streaming';
      audit.lifecycle.phaseEntered('streaming', startMetadata);
      const text = await context.transport.transcribe({
        pcm,
        ...context.input,
      });
      audit.lifecycle.phaseCompleted('streaming', startMetadata);
      auditPhase = 'result';
      audit.lifecycle.phaseEntered('result', startMetadata);
      audit.lifecycle.phaseCompleted(
        'result',
        this.deps.audit.createBatchMetadata(audit, { resultLength: text.length }),
      );
      auditPhase = 'cleanup';
      audit.lifecycle.phaseEntered('cleanup', startMetadata);
      this.deps.writeClipboardText(text);
      audit.lifecycle.phaseCompleted('cleanup', startMetadata);
      this.deps.audit.terminalBatch(audit, 'cleanup', 'success', { resultLength: text.length });
      return { success: true, text };
    } catch (error: unknown) {
      const errorCode = getTranscriptionErrorCode(error);
      if (
        errorCode === ClaudeWebVoiceProviderErrorCode.UpgradeOrAuth ||
        errorCode === ClaudeWebVoiceProviderErrorCode.PageShutdown
      ) {
        this.ready = false;
      }
      if (errorCode === ClaudeWebVoiceProviderErrorCode.UnexpectedFailure) {
        this.deps.audit.terminalBatchException(audit, auditPhase, error, { causeCode: errorCode });
      } else {
        this.deps.audit.terminalBatch(
          audit,
          auditPhase,
          errorCode === ClaudeWebVoiceProviderErrorCode.Cancelled ? 'cancelled' : 'failure',
          { causeCode: errorCode },
        );
      }
      return { success: false, error: errorCode };
    }
  }

  async startStreamingTranscription(input: StartStreamingTranscriptionInput): Promise<StreamingTranscriptionStarted> {
    const auditMetadata = input.audit.createStreamingMetadata(input.auditContext, EMPTY_STREAMING_AUDIT_COUNTERS);
    input.auditContext.lifecycle.phaseCompleted('dispatch', auditMetadata);
    input.auditContext.lifecycle.phaseEntered('validation', auditMetadata);
    if (this.streamingOperations.has(input.operationId)) {
      throw streamingOperationError(StreamingTranscriptionErrorCode.OperationConflict);
    }
    input.auditContext.lifecycle.phaseCompleted('validation', auditMetadata);

    const context = await this.resolveTranscriptionContext(input.auditContext, auditMetadata);
    if (!context.ready) {
      throw streamingOperationError(StreamingTranscriptionErrorCode.TransportFailure, context.errorCode);
    }

    try {
      input.auditContext.lifecycle.phaseEntered('context', auditMetadata);
      const transportOperationId = await context.transport.start(context.input);
      input.auditContext.lifecycle.phaseCompleted('context', auditMetadata);
      this.streamingOperations.set(input.operationId, {
        transport: context.transport,
        transportOperationId,
      });
      return {
        operationId: input.operationId,
        lifecycle: StreamingTranscriptionLifecycle.Starting,
      };
    } catch (error: unknown) {
      if (error instanceof StreamingTranscriptionOperationError) throw error;
      const causeCode = getTranscriptionErrorCode(error);
      throw new StreamingTranscriptionOperationError(
        mapStreamingError(error),
        causeCode,
        causeCode === ClaudeWebVoiceProviderErrorCode.UnexpectedFailure
          ? input.audit.getExceptionType(error)
          : undefined,
      );
    }
  }

  async pushStreamingTranscriptionChunk(
    input: PushStreamingTranscriptionChunkInput,
  ): Promise<StreamingTranscriptionChunkAccepted> {
    const operation = this.streamingOperations.get(input.operationId);
    if (!operation) throw streamingOperationError(StreamingTranscriptionErrorCode.InvalidOperation);
    if (!isValidStreamingChunk(input.chunk, false)) {
      this.streamingOperations.delete(input.operationId);
      try {
        await operation.transport.cancel(operation.transportOperationId);
      } catch (error: unknown) {
        throw this.createStreamingCleanupError(error);
      }
      throw streamingOperationError(StreamingTranscriptionErrorCode.InvalidChunk);
    }

    try {
      await operation.transport.push(operation.transportOperationId, input.chunk);
      return {
        operationId: input.operationId,
        lifecycle: StreamingTranscriptionLifecycle.Streaming,
        acceptedSequence: input.sequence,
      };
    } catch (error: unknown) {
      this.streamingOperations.delete(input.operationId);
      try {
        await operation.transport.cancel(operation.transportOperationId);
      } catch (cleanupError: unknown) {
        throw this.createStreamingCleanupError(cleanupError);
      }
      const causeCode = getTranscriptionErrorCode(error);
      throw new StreamingTranscriptionOperationError(
        mapStreamingError(error),
        causeCode,
        causeCode === ClaudeWebVoiceProviderErrorCode.UnexpectedFailure
          ? this.deps.audit.getExceptionType(error)
          : undefined,
      );
    }
  }

  async finishStreamingTranscription(input: FinishStreamingTranscriptionInput): Promise<StreamingTranscriptionResult> {
    const operation = this.streamingOperations.get(input.operationId);
    if (!operation) {
      return {
        auditCauseCode: StreamingTranscriptionErrorCode.InvalidOperation,
        success: false,
        operationId: input.operationId,
        error: createStreamingError(StreamingTranscriptionErrorCode.InvalidOperation),
      };
    }
    if (!isValidStreamingChunk(input.finalChunk, true)) {
      this.streamingOperations.delete(input.operationId);
      try {
        await operation.transport.cancel(operation.transportOperationId);
      } catch (error: unknown) {
        throw this.createStreamingCleanupError(error);
      }
      return {
        auditCauseCode: StreamingTranscriptionErrorCode.InvalidChunk,
        success: false,
        operationId: input.operationId,
        error: createStreamingError(StreamingTranscriptionErrorCode.InvalidChunk),
      };
    }

    let result: StreamingTranscriptionResult;
    try {
      const text = await operation.transport.finish(operation.transportOperationId, input.finalChunk);
      result = {
        success: true,
        operationId: input.operationId,
        lifecycle: StreamingTranscriptionLifecycle.Completed,
        text,
      };
    } catch (error: unknown) {
      const causeCode = getTranscriptionErrorCode(error);
      result = {
        auditCauseCode: causeCode,
        ...(causeCode === ClaudeWebVoiceProviderErrorCode.UnexpectedFailure
          ? { auditExceptionType: this.deps.audit.getExceptionType(error) }
          : {}),
        success: false,
        operationId: input.operationId,
        error: mapStreamingError(error),
      };
    }

    this.streamingOperations.delete(input.operationId);
    try {
      await operation.transport.cancel(operation.transportOperationId);
    } catch (error: unknown) {
      throw this.createStreamingCleanupError(error);
    }
    return result;
  }

  async cancelStreamingTranscription(
    input: CancelStreamingTranscriptionInput,
  ): Promise<StreamingTranscriptionCancellation> {
    const operation = this.streamingOperations.get(input.operationId);
    this.streamingOperations.delete(input.operationId);
    if (operation) await operation.transport.cancel(operation.transportOperationId);
    return {
      operationId: input.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Cancelled,
    };
  }

  async cancelTranscription(): Promise<void> {
    this.streamingOperations.clear();
    await this.transport?.cancelAll();
  }

  async shutdown(): Promise<void> {
    this.ready = false;
    this.readinessErrorCode = null;
    const transport = this.transport;
    this.transport = null;
    this.streamingOperations.clear();
    try {
      await transport?.shutdown();
    } finally {
      await super.shutdown();
    }
  }

  private async resolveTranscriptionContext(
    auditContext: VoiceAuditOperationContext,
    auditMetadata: ReturnType<VoiceProviderAudit['createMetadata']>,
  ): Promise<ClaudeWebTranscriptionContext> {
    if (!this.page || this.page.isClosed() || !this.transport) {
      this.ready = false;
      return { ready: false, errorCode: ClaudeWebVoiceProviderErrorCode.PageShutdown };
    }

    auditContext.lifecycle.phaseEntered('configuration', auditMetadata);
    let settings: ClaudeWebSettings;
    try {
      settings = this.deps.getSettings();
    } catch {
      return { ready: false, errorCode: ClaudeWebVoiceProviderErrorCode.InvalidSettings };
    }
    auditContext.lifecycle.phaseCompleted('configuration', auditMetadata);

    auditContext.lifecycle.phaseEntered('readiness', auditMetadata);
    const readiness = await this.resolveReadiness(this.page);
    this.setReadiness(readiness);
    if (readiness.errorCode || readiness.organization.routing.status !== 'resolved') {
      return {
        ready: false,
        errorCode: readiness.errorCode ?? ClaudeWebVoiceProviderErrorCode.OrganizationMissing,
      };
    }
    auditContext.lifecycle.phaseCompleted('readiness', auditMetadata);

    return {
      ready: true,
      transport: this.transport,
      input: {
        language: settings.language,
        organizationUuid: readiness.organization.routing.organizationUuid,
      },
    };
  }

  private getAuditFailurePhase(errorCode: ClaudeWebVoiceProviderErrorCode): ProviderAuditPhase {
    switch (errorCode) {
      case ClaudeWebVoiceProviderErrorCode.InvalidAudio:
        return 'validation';
      case ClaudeWebVoiceProviderErrorCode.InvalidSettings:
        return 'configuration';
      case ClaudeWebVoiceProviderErrorCode.SessionMissing:
      case ClaudeWebVoiceProviderErrorCode.SessionExpired:
      case ClaudeWebVoiceProviderErrorCode.SessionInvalid:
      case ClaudeWebVoiceProviderErrorCode.FeatureUnavailable:
      case ClaudeWebVoiceProviderErrorCode.OrganizationMissing:
      case ClaudeWebVoiceProviderErrorCode.OrganizationAmbiguous:
      case ClaudeWebVoiceProviderErrorCode.UnexpectedFailure:
        return 'readiness';
      case ClaudeWebVoiceProviderErrorCode.PageShutdown:
        return 'context';
      default:
        return 'result';
    }
  }

  private createStreamingCleanupError(error: unknown): StreamingTranscriptionOperationError {
    return new StreamingTranscriptionOperationError(
      createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
      'cleanup-failed',
      this.deps.audit.getExceptionType(error),
    );
  }

  private async resolveReadiness(
    page: Page,
    timeoutMs = CLAUDE_WEB_READINESS_TIMEOUT_MS,
  ): Promise<ClaudeWebReadinessResolution> {
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

    let snapshot: ClaudeWebReadinessSnapshot;
    try {
      snapshot = await this.deps.inspectReadiness(page, timeoutMs);
    } catch {
      return {
        errorCode: ClaudeWebVoiceProviderErrorCode.UnexpectedFailure,
        organization: this.deps.resolveOrganization({
          activeOrganizationCandidates: [],
          eligibleOrganizations: [],
        }),
      };
    }
    const organization = this.deps.resolveOrganization(snapshot.organizationEvidence);
    if (snapshot.authentication === 'unauthenticated') {
      return { errorCode: ClaudeWebVoiceProviderErrorCode.SessionExpired, organization };
    }
    if (snapshot.authentication === 'unavailable') {
      return { errorCode: ClaudeWebVoiceProviderErrorCode.UnexpectedFailure, organization };
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
    const deadline = this.deps.now() + CLAUDE_WEB_READINESS_TIMEOUT_MS;
    let readiness = await this.resolveReadiness(page, Math.max(1, deadline - this.deps.now()));

    while (
      readiness.errorCode !== null &&
      TRANSIENT_STARTUP_READINESS_ERRORS.has(readiness.errorCode) &&
      this.deps.now() < deadline
    ) {
      const delayMs = Math.min(CLAUDE_WEB_READINESS_POLL_INTERVAL_MS, deadline - this.deps.now());
      await this.deps.waitForReadinessRetry(delayMs);
      const remainingMs = deadline - this.deps.now();
      if (remainingMs <= 0) break;
      readiness = await this.resolveReadiness(page, remainingMs);
    }

    return readiness;
  }

  private setReadiness(readiness: ClaudeWebReadinessResolution): void {
    this.ready = readiness.errorCode === null;
    this.readinessErrorCode = readiness.errorCode;
  }
}
