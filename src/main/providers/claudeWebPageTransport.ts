/* eslint-disable max-classes-per-file -- The packet keeps transport and its typed boundary errors in one module. */
import type { Page } from 'playwright-core';
import { CLAUDE_WEB_PCM_CHUNK_CADENCE_MS, splitClaudeWebPcm } from './claudeWebAudio';
import {
  CLAUDE_WEB_CLOSE_STREAM_CONTROL,
  CLAUDE_WEB_KEEP_ALIVE_CONTROL,
  applyClaudeWebTranscriptEvent,
  buildClaudeWebSpeechUrl,
  createClaudeWebTranscriptState,
  parseClaudeWebSpeechEvent,
  type ClaudeWebClientControl,
  type ClaudeWebTranscriptState,
} from './claudeWebProtocol';
import type { ClaudeWebLanguage } from '@shared/claudeWebSettings';

export const CLAUDE_WEB_CONNECT_TIMEOUT_MS = 5_000;
export const CLAUDE_WEB_FIRST_EVENT_TIMEOUT_MS = 15_000;
export const CLAUDE_WEB_OVERALL_TIMEOUT_MS = 130_000;
export const CLAUDE_WEB_DRAIN_TIMEOUT_MS = 3_000;
export const CLAUDE_WEB_KEEP_ALIVE_INTERVAL_MS = 4_000;
export const CLAUDE_WEB_SOCKET_POLL_INTERVAL_MS = 25;

const CLAUDE_WEB_PAGE_SOCKET_REGISTRY_KEY = '__gptVoiceClaudePageSocketsV1';
const MAX_EVENT_TYPE_METADATA_LENGTH = 80;

export interface ClaudeWebPageTransportTiming {
  chunkCadenceMs: number;
  connectTimeoutMs: number;
  drainTimeoutMs: number;
  firstEventTimeoutMs: number;
  keepAliveIntervalMs: number;
  overallTimeoutMs: number;
  pollIntervalMs: number;
}

const DEFAULT_TRANSPORT_TIMING: ClaudeWebPageTransportTiming = {
  chunkCadenceMs: CLAUDE_WEB_PCM_CHUNK_CADENCE_MS,
  connectTimeoutMs: CLAUDE_WEB_CONNECT_TIMEOUT_MS,
  drainTimeoutMs: CLAUDE_WEB_DRAIN_TIMEOUT_MS,
  firstEventTimeoutMs: CLAUDE_WEB_FIRST_EVENT_TIMEOUT_MS,
  keepAliveIntervalMs: CLAUDE_WEB_KEEP_ALIVE_INTERVAL_MS,
  overallTimeoutMs: CLAUDE_WEB_OVERALL_TIMEOUT_MS,
  pollIntervalMs: CLAUDE_WEB_SOCKET_POLL_INTERVAL_MS,
};

export enum ClaudeWebPageTransportErrorCode {
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
}

export type ClaudeWebPageSocketFailureCode =
  | ClaudeWebPageTransportErrorCode.UpgradeOrAuth
  | ClaudeWebPageTransportErrorCode.ConnectionLoss
  | ClaudeWebPageTransportErrorCode.RateLimit
  | ClaudeWebPageTransportErrorCode.PageShutdown;

const PAGE_SOCKET_FAILURE_CODES = {
  upgradeOrAuth: ClaudeWebPageTransportErrorCode.UpgradeOrAuth,
  connectionLoss: ClaudeWebPageTransportErrorCode.ConnectionLoss,
  rateLimit: ClaudeWebPageTransportErrorCode.RateLimit,
  pageShutdown: ClaudeWebPageTransportErrorCode.PageShutdown,
} as const;

export type ClaudeWebPageMessage = { kind: 'text'; payload: string } | { kind: 'binary'; payloadLength: number | null };

export interface ClaudeWebPageSocketSnapshot {
  phase: 'connecting' | 'open' | 'closed' | 'failed';
  messages: ClaudeWebPageMessage[];
  failure: ClaudeWebPageSocketFailureCode | null;
  closeCode: number | null;
}

export interface ClaudeWebPageSocketBoundary {
  start(operationId: string, url: string): Promise<void>;
  inspect(operationId: string): Promise<ClaudeWebPageSocketSnapshot>;
  sendBinary(operationId: string, bytes: Uint8Array): Promise<void>;
  sendControl(operationId: string, control: ClaudeWebClientControl): Promise<void>;
  close(operationId: string): Promise<void>;
}

/** Identifies a page-owned socket failure without exposing a browser error. */
export class ClaudeWebPageSocketError extends Error {
  readonly code: ClaudeWebPageSocketFailureCode;

  constructor(code: ClaudeWebPageSocketFailureCode) {
    super('Claude Web page socket failed');
    this.name = 'ClaudeWebPageSocketError';
    this.code = code;
  }
}

interface BrowserPageSocketRecord {
  socket: WebSocket;
  phase: ClaudeWebPageSocketSnapshot['phase'];
  messages: ClaudeWebPageMessage[];
  failure: ClaudeWebPageSocketFailureCode | null;
  closeCode: number | null;
  opened: boolean;
}

type BrowserPageSocketRegistry = Map<string, BrowserPageSocketRecord>;

async function evaluatePageSafely<T>(
  page: Page,
  operation: () => Promise<T>,
  fallbackCode: ClaudeWebPageSocketFailureCode,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new ClaudeWebPageSocketError(page.isClosed() ? ClaudeWebPageTransportErrorCode.PageShutdown : fallbackCode);
  }
}

/** Creates the native WebSocket boundary that remains inside the authenticated Claude page. */
export function createClaudeWebPageSocketBoundary(page: Page): ClaudeWebPageSocketBoundary {
  return {
    start: (operationId, url) =>
      evaluatePageSafely(
        page,
        () =>
          page.evaluate(
            ({ failureCodes, registryKey, socketId, socketUrl }) => {
              const root = globalThis as unknown as Record<string, unknown>;
              let registry = root[registryKey] as BrowserPageSocketRegistry | undefined;
              if (!(registry instanceof Map)) {
                registry = new Map<string, BrowserPageSocketRecord>();
                root[registryKey] = registry;
              }

              const previous = registry.get(socketId);
              if (previous && previous.socket.readyState < WebSocket.CLOSING) {
                previous.socket.close(1000);
              }

              const socket = new WebSocket(socketUrl);
              const record: BrowserPageSocketRecord = {
                socket,
                phase: 'connecting',
                messages: [],
                failure: null,
                closeCode: null,
                opened: false,
              };
              registry.set(socketId, record);

              socket.binaryType = 'arraybuffer';
              socket.onopen = () => {
                record.opened = true;
                record.phase = 'open';
              };
              socket.onmessage = (event: MessageEvent<unknown>) => {
                if (typeof event.data === 'string') {
                  record.messages.push({ kind: 'text', payload: event.data });
                  return;
                }
                const payloadLength =
                  event.data instanceof ArrayBuffer
                    ? event.data.byteLength
                    : event.data instanceof Blob
                      ? event.data.size
                      : null;
                record.messages.push({ kind: 'binary', payloadLength });
              };
              socket.onerror = () => {
                record.failure = record.opened ? failureCodes.connectionLoss : failureCodes.upgradeOrAuth;
                record.phase = 'failed';
              };
              socket.onclose = (event: CloseEvent) => {
                record.closeCode = event.code;
                if (event.code === 1013) {
                  record.failure = failureCodes.rateLimit;
                } else if (event.code !== 1000 && !record.failure) {
                  record.failure = record.opened ? failureCodes.connectionLoss : failureCodes.upgradeOrAuth;
                }
                record.phase = 'closed';
              };
            },
            {
              registryKey: CLAUDE_WEB_PAGE_SOCKET_REGISTRY_KEY,
              socketId: operationId,
              socketUrl: url,
              failureCodes: PAGE_SOCKET_FAILURE_CODES,
            },
          ),
        ClaudeWebPageTransportErrorCode.UpgradeOrAuth,
      ),
    inspect: (operationId) =>
      evaluatePageSafely(
        page,
        () =>
          page.evaluate(
            ({ failureCodes, registryKey, socketId }): ClaudeWebPageSocketSnapshot => {
              const root = globalThis as unknown as Record<string, unknown>;
              const registry = root[registryKey] as BrowserPageSocketRegistry | undefined;
              const record = registry instanceof Map ? registry.get(socketId) : undefined;
              if (!record) {
                return {
                  phase: 'failed',
                  messages: [],
                  failure: failureCodes.pageShutdown,
                  closeCode: null,
                };
              }
              return {
                phase: record.phase,
                messages: record.messages.splice(0),
                failure: record.failure,
                closeCode: record.closeCode,
              };
            },
            {
              failureCodes: PAGE_SOCKET_FAILURE_CODES,
              registryKey: CLAUDE_WEB_PAGE_SOCKET_REGISTRY_KEY,
              socketId: operationId,
            },
          ),
        ClaudeWebPageTransportErrorCode.ConnectionLoss,
      ),
    sendBinary: (operationId, bytes) =>
      evaluatePageSafely(
        page,
        () =>
          page.evaluate(
            ({ registryKey, socketId, values }) => {
              const root = globalThis as unknown as Record<string, unknown>;
              const registry = root[registryKey] as BrowserPageSocketRegistry | undefined;
              const record = registry instanceof Map ? registry.get(socketId) : undefined;
              if (!record || record.socket.readyState !== WebSocket.OPEN) throw new Error('Socket is not open');
              record.socket.send(new Uint8Array(values));
            },
            {
              registryKey: CLAUDE_WEB_PAGE_SOCKET_REGISTRY_KEY,
              socketId: operationId,
              values: Array.from(bytes),
            },
          ),
        ClaudeWebPageTransportErrorCode.ConnectionLoss,
      ),
    sendControl: (operationId, control) =>
      evaluatePageSafely(
        page,
        () =>
          page.evaluate(
            ({ registryKey, socketId, value }) => {
              const root = globalThis as unknown as Record<string, unknown>;
              const registry = root[registryKey] as BrowserPageSocketRegistry | undefined;
              const record = registry instanceof Map ? registry.get(socketId) : undefined;
              if (!record || record.socket.readyState !== WebSocket.OPEN) throw new Error('Socket is not open');
              record.socket.send(JSON.stringify(value));
            },
            { registryKey: CLAUDE_WEB_PAGE_SOCKET_REGISTRY_KEY, socketId: operationId, value: control },
          ),
        ClaudeWebPageTransportErrorCode.ConnectionLoss,
      ),
    close: (operationId) =>
      evaluatePageSafely(
        page,
        () =>
          page.evaluate(
            ({ registryKey, socketId }) => {
              const root = globalThis as unknown as Record<string, unknown>;
              const registry = root[registryKey] as BrowserPageSocketRegistry | undefined;
              if (!(registry instanceof Map)) return;
              const record = registry.get(socketId);
              if (!record) return;

              registry.delete(socketId);
              record.messages.length = 0;
              record.socket.onopen = null;
              record.socket.onmessage = null;
              record.socket.onerror = null;
              record.socket.onclose = null;
              if (record.socket.readyState < WebSocket.CLOSING) {
                record.socket.close(1000);
              }
            },
            { registryKey: CLAUDE_WEB_PAGE_SOCKET_REGISTRY_KEY, socketId: operationId },
          ),
        ClaudeWebPageTransportErrorCode.PageShutdown,
      ),
  };
}

export type ClaudeWebPageTransportPhase = 'connecting' | 'replaying' | 'draining';

export interface ClaudeWebPageTransportDiagnostics {
  phase: ClaudeWebPageTransportPhase;
  eventType: string | null;
  bytesSent: number;
  eventCount: number;
  durationMs: number;
  closeCode: number | null;
}

const TRANSPORT_ERROR_MESSAGES: Readonly<Record<ClaudeWebPageTransportErrorCode, string>> = {
  [ClaudeWebPageTransportErrorCode.UpgradeOrAuth]: 'Claude Web could not open the authenticated speech connection',
  [ClaudeWebPageTransportErrorCode.ConnectTimeout]: 'Claude Web speech connection timed out',
  [ClaudeWebPageTransportErrorCode.ConnectionLoss]: 'Claude Web speech connection was lost',
  [ClaudeWebPageTransportErrorCode.MalformedEvent]: 'Claude Web returned an unsupported speech event',
  [ClaudeWebPageTransportErrorCode.RateLimit]: 'Claude Web speech transcription is temporarily rate limited',
  [ClaudeWebPageTransportErrorCode.FirstEventTimeout]: 'Claude Web did not return a speech event in time',
  [ClaudeWebPageTransportErrorCode.OverallTimeout]: 'Claude Web speech transcription timed out',
  [ClaudeWebPageTransportErrorCode.DrainTimeout]: 'Claude Web did not finalize the transcript in time',
  [ClaudeWebPageTransportErrorCode.EmptyResult]: 'Claude Web returned no finalized transcript',
  [ClaudeWebPageTransportErrorCode.Cancelled]: 'Claude Web speech transcription was cancelled',
  [ClaudeWebPageTransportErrorCode.PageShutdown]: 'The authenticated Claude page is no longer available',
};

/** A safe typed transport failure containing metadata only. */
export class ClaudeWebPageTransportError extends Error {
  readonly code: ClaudeWebPageTransportErrorCode;
  readonly diagnostics: ClaudeWebPageTransportDiagnostics;

  constructor(code: ClaudeWebPageTransportErrorCode, diagnostics: ClaudeWebPageTransportDiagnostics) {
    super(TRANSPORT_ERROR_MESSAGES[code]);
    this.name = 'ClaudeWebPageTransportError';
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export interface ClaudeWebPageTransportClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

const SYSTEM_CLOCK: ClaudeWebPageTransportClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export interface ClaudeWebPageTransportDependencies {
  boundary: ClaudeWebPageSocketBoundary;
  clock?: ClaudeWebPageTransportClock;
  timing?: Partial<ClaudeWebPageTransportTiming>;
}

export interface ClaudeWebPageTransportInput {
  pcm: Uint8Array;
  language: ClaudeWebLanguage;
  organizationUuid: string;
}

type DeadlineKind = 'connect' | 'first-event' | 'overall' | 'drain';

interface ActiveOperation {
  id: string;
  controller: AbortController;
  failure: ClaudeWebPageTransportError | null;
  phase: ClaudeWebPageTransportPhase;
  startedAt: number;
  bytesSent: number;
  eventCount: number;
  eventType: string | null;
  closeCode: number | null;
  transcript: ClaudeWebTranscriptState;
  endpointCount: number;
  hasServerEvent: boolean;
  deadlineTimers: Map<DeadlineKind, unknown>;
  timeoutHandles: Set<unknown>;
  intervalHandles: Set<unknown>;
  closePromise: Promise<void> | null;
}

function normalizeTiming(input: Partial<ClaudeWebPageTransportTiming> = {}): ClaudeWebPageTransportTiming {
  const timing = { ...DEFAULT_TRANSPORT_TIMING, ...input };
  for (const [name, value] of Object.entries(timing)) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Invalid Claude Web transport timing: ${name}`);
  }
  return timing;
}

function sanitizeEventType(value: string | null): string | null {
  return value ? value.slice(0, MAX_EVENT_TYPE_METADATA_LENGTH) : null;
}

/** Replays raw PCM through a fresh native WebSocket owned by the authenticated Claude page. */
export class ClaudeWebPageTransport {
  private readonly boundary: ClaudeWebPageSocketBoundary;
  private readonly clock: ClaudeWebPageTransportClock;
  private readonly timing: ClaudeWebPageTransportTiming;
  private readonly activeOperations = new Map<string, ActiveOperation>();
  private nextOperationId = 1;
  private stopped = false;

  constructor(dependencies: ClaudeWebPageTransportDependencies) {
    this.boundary = dependencies.boundary;
    this.clock = dependencies.clock ?? SYSTEM_CLOCK;
    this.timing = normalizeTiming(dependencies.timing);
  }

  async transcribe(input: ClaudeWebPageTransportInput): Promise<string> {
    if (this.stopped) throw this.createInactiveError(ClaudeWebPageTransportErrorCode.PageShutdown);
    const chunks = splitClaudeWebPcm(input.pcm);
    const url = buildClaudeWebSpeechUrl(input);
    const operation = this.createOperation();
    this.activeOperations.set(operation.id, operation);

    try {
      this.armDeadline(
        operation,
        'overall',
        this.timing.overallTimeoutMs,
        ClaudeWebPageTransportErrorCode.OverallTimeout,
      );
      this.armDeadline(
        operation,
        'connect',
        this.timing.connectTimeoutMs,
        ClaudeWebPageTransportErrorCode.ConnectTimeout,
      );
      await this.callBoundary(
        operation,
        () => this.boundary.start(operation.id, url),
        ClaudeWebPageTransportErrorCode.UpgradeOrAuth,
      );
      await this.waitForOpen(operation);
      this.clearDeadline(operation, 'connect');
      if (!operation.hasServerEvent) {
        this.armDeadline(
          operation,
          'first-event',
          this.timing.firstEventTimeoutMs,
          ClaudeWebPageTransportErrorCode.FirstEventTimeout,
        );
      }
      this.startKeepAlive(operation);

      operation.phase = 'replaying';
      await this.replayChunks(operation, chunks);
      await this.callBoundary(
        operation,
        () => this.boundary.sendControl(operation.id, CLAUDE_WEB_CLOSE_STREAM_CONTROL),
        ClaudeWebPageTransportErrorCode.ConnectionLoss,
      );

      operation.phase = 'draining';
      const endpointCountAtClose = operation.endpointCount;
      this.armDeadline(operation, 'drain', this.timing.drainTimeoutMs, ClaudeWebPageTransportErrorCode.DrainTimeout);
      return await this.drainFinalTranscript(operation, endpointCountAtClose);
    } finally {
      this.clearAllTimers(operation);
      this.activeOperations.delete(operation.id);
      await this.closeOperation(operation);
    }
  }

  async cancel(): Promise<void> {
    const operations = Array.from(this.activeOperations.values());
    for (const operation of operations) {
      this.failOperation(operation, ClaudeWebPageTransportErrorCode.Cancelled);
      this.clearAllTimers(operation);
    }
    await Promise.all(operations.map((operation) => this.closeOperation(operation)));
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    const operations = Array.from(this.activeOperations.values());
    for (const operation of operations) {
      this.failOperation(operation, ClaudeWebPageTransportErrorCode.PageShutdown);
      this.clearAllTimers(operation);
    }
    await Promise.all(operations.map((operation) => this.closeOperation(operation)));
  }

  private createOperation(): ActiveOperation {
    const operation: ActiveOperation = {
      id: `claude-web-${this.nextOperationId}`,
      controller: new AbortController(),
      failure: null,
      phase: 'connecting',
      startedAt: this.clock.now(),
      bytesSent: 0,
      eventCount: 0,
      eventType: null,
      closeCode: null,
      transcript: createClaudeWebTranscriptState(),
      endpointCount: 0,
      hasServerEvent: false,
      deadlineTimers: new Map(),
      timeoutHandles: new Set(),
      intervalHandles: new Set(),
      closePromise: null,
    };
    this.nextOperationId += 1;
    return operation;
  }

  private async waitForOpen(operation: ActiveOperation): Promise<void> {
    while (true) {
      const snapshot = await this.inspect(operation);
      this.processSnapshot(operation, snapshot);
      if (snapshot.phase === 'open') return;
      if (snapshot.phase === 'closed') {
        this.failOperation(operation, ClaudeWebPageTransportErrorCode.UpgradeOrAuth);
        this.throwOperationFailure(operation);
      }
      await this.delay(operation, this.timing.pollIntervalMs);
    }
  }

  private async replayChunks(operation: ActiveOperation, chunks: readonly Uint8Array[]): Promise<void> {
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      await this.callBoundary(
        operation,
        () => this.boundary.sendBinary(operation.id, chunk),
        ClaudeWebPageTransportErrorCode.ConnectionLoss,
      );
      operation.bytesSent += chunk.byteLength;

      const snapshot = await this.inspect(operation);
      this.processSnapshot(operation, snapshot);
      if (snapshot.phase !== 'open') {
        this.failOperation(operation, ClaudeWebPageTransportErrorCode.ConnectionLoss);
        this.throwOperationFailure(operation);
      }
      if (index + 1 < chunks.length) await this.delay(operation, this.timing.chunkCadenceMs);
    }
  }

  private async drainFinalTranscript(operation: ActiveOperation, endpointCountAtClose: number): Promise<string> {
    while (true) {
      const snapshot = await this.inspect(operation);
      this.processSnapshot(operation, snapshot);

      if (snapshot.phase === 'closed') {
        if (snapshot.closeCode !== null && snapshot.closeCode !== 1000) {
          this.failOperation(operation, ClaudeWebPageTransportErrorCode.ConnectionLoss);
          this.throwOperationFailure(operation);
        }
        if (operation.transcript.finalTranscript) return operation.transcript.finalTranscript;
        this.failOperation(operation, ClaudeWebPageTransportErrorCode.EmptyResult);
        this.throwOperationFailure(operation);
      }
      if (operation.endpointCount > endpointCountAtClose) {
        if (operation.transcript.finalTranscript) return operation.transcript.finalTranscript;
        this.failOperation(operation, ClaudeWebPageTransportErrorCode.EmptyResult);
        this.throwOperationFailure(operation);
      }
      await this.delay(operation, this.timing.pollIntervalMs);
    }
  }

  private async inspect(operation: ActiveOperation): Promise<ClaudeWebPageSocketSnapshot> {
    return this.callBoundary(
      operation,
      () => this.boundary.inspect(operation.id),
      ClaudeWebPageTransportErrorCode.ConnectionLoss,
    );
  }

  private processSnapshot(operation: ActiveOperation, snapshot: ClaudeWebPageSocketSnapshot): void {
    operation.closeCode = snapshot.closeCode;
    for (const message of snapshot.messages) {
      operation.eventCount += 1;
      operation.hasServerEvent = true;
      this.clearDeadline(operation, 'first-event');
      if (message.kind !== 'text') {
        operation.eventType = null;
        this.failOperation(operation, ClaudeWebPageTransportErrorCode.MalformedEvent);
        this.throwOperationFailure(operation);
      }

      const parsed = parseClaudeWebSpeechEvent(message.payload);
      if (parsed.status !== 'known') {
        operation.eventType = sanitizeEventType(parsed.metadata.eventType);
        if (parsed.status === 'malformed') {
          this.failOperation(operation, ClaudeWebPageTransportErrorCode.MalformedEvent);
          this.throwOperationFailure(operation);
        }
        continue;
      }

      operation.eventType = parsed.event.type;
      const update = applyClaudeWebTranscriptEvent(operation.transcript, parsed.event);
      operation.transcript = update.state;
      if (parsed.event.type === 'TranscriptEndpoint') operation.endpointCount += 1;
    }

    if (snapshot.failure) {
      this.failOperation(operation, snapshot.failure);
      this.throwOperationFailure(operation);
    }
    if (snapshot.phase === 'failed') {
      this.failOperation(
        operation,
        operation.phase === 'connecting'
          ? ClaudeWebPageTransportErrorCode.UpgradeOrAuth
          : ClaudeWebPageTransportErrorCode.ConnectionLoss,
      );
      this.throwOperationFailure(operation);
    }
    this.throwIfFailed(operation);
  }

  private startKeepAlive(operation: ActiveOperation): void {
    const handle = this.clock.setInterval(() => {
      if (operation.controller.signal.aborted) return;
      void this.callBoundary(
        operation,
        () => this.boundary.sendControl(operation.id, CLAUDE_WEB_KEEP_ALIVE_CONTROL),
        ClaudeWebPageTransportErrorCode.ConnectionLoss,
      ).catch((error: unknown) => {
        if (!operation.failure) {
          this.failOperation(
            operation,
            error instanceof ClaudeWebPageTransportError ? error.code : ClaudeWebPageTransportErrorCode.ConnectionLoss,
          );
        }
      });
    }, this.timing.keepAliveIntervalMs);
    operation.intervalHandles.add(handle);
  }

  private armDeadline(
    operation: ActiveOperation,
    kind: DeadlineKind,
    delayMs: number,
    code: ClaudeWebPageTransportErrorCode,
  ): void {
    this.clearDeadline(operation, kind);
    const handle = this.clock.setTimeout(() => {
      operation.timeoutHandles.delete(handle);
      operation.deadlineTimers.delete(kind);
      this.failOperation(operation, code);
    }, delayMs);
    operation.timeoutHandles.add(handle);
    operation.deadlineTimers.set(kind, handle);
  }

  private clearDeadline(operation: ActiveOperation, kind: DeadlineKind): void {
    const handle = operation.deadlineTimers.get(kind);
    if (handle === undefined) return;
    this.clock.clearTimeout(handle);
    operation.deadlineTimers.delete(kind);
    operation.timeoutHandles.delete(handle);
  }

  private async delay(operation: ActiveOperation, delayMs: number): Promise<void> {
    this.throwIfFailed(operation);
    await new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        this.clock.clearTimeout(handle);
        operation.timeoutHandles.delete(handle);
        operation.controller.signal.removeEventListener('abort', onAbort);
        reject(operation.failure ?? this.createOperationError(operation, ClaudeWebPageTransportErrorCode.Cancelled));
      };
      const handle = this.clock.setTimeout(() => {
        operation.timeoutHandles.delete(handle);
        operation.controller.signal.removeEventListener('abort', onAbort);
        resolve();
      }, delayMs);
      operation.timeoutHandles.add(handle);
      operation.controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    this.throwIfFailed(operation);
  }

  private async callBoundary<T>(
    operation: ActiveOperation,
    action: () => Promise<T>,
    fallbackCode: ClaudeWebPageTransportErrorCode,
  ): Promise<T> {
    this.throwIfFailed(operation);
    try {
      return await this.awaitWithCancellation(operation, action);
    } catch (error: unknown) {
      if (!operation.failure) {
        this.failOperation(operation, error instanceof ClaudeWebPageSocketError ? error.code : fallbackCode);
      }
      this.throwOperationFailure(operation);
    }
  }

  private async awaitWithCancellation<T>(operation: ActiveOperation, action: () => Promise<T>): Promise<T> {
    const pending = action();
    return new Promise<T>((resolve, reject) => {
      const onAbort = (): void => {
        operation.controller.signal.removeEventListener('abort', onAbort);
        reject(operation.failure ?? this.createOperationError(operation, ClaudeWebPageTransportErrorCode.Cancelled));
      };
      operation.controller.signal.addEventListener('abort', onAbort, { once: true });
      void pending.then(
        (value) => {
          operation.controller.signal.removeEventListener('abort', onAbort);
          if (operation.controller.signal.aborted) {
            this.closeAfterAbortedBoundaryCall(operation);
            return;
          }
          resolve(value);
        },
        (error: unknown) => {
          operation.controller.signal.removeEventListener('abort', onAbort);
          reject(
            error instanceof Error
              ? error
              : new ClaudeWebPageSocketError(ClaudeWebPageTransportErrorCode.ConnectionLoss),
          );
        },
      );
    });
  }

  private failOperation(operation: ActiveOperation, code: ClaudeWebPageTransportErrorCode): void {
    if (operation.failure) return;
    operation.failure = this.createOperationError(operation, code);
    operation.controller.abort();
  }

  private throwIfFailed(operation: ActiveOperation): void {
    if (operation.failure) throw operation.failure;
  }

  private throwOperationFailure(operation: ActiveOperation): never {
    throw operation.failure ?? this.createOperationError(operation, ClaudeWebPageTransportErrorCode.ConnectionLoss);
  }

  private createOperationError(
    operation: ActiveOperation,
    code: ClaudeWebPageTransportErrorCode,
  ): ClaudeWebPageTransportError {
    return new ClaudeWebPageTransportError(code, {
      phase: operation.phase,
      eventType: operation.eventType,
      bytesSent: operation.bytesSent,
      eventCount: operation.eventCount,
      durationMs: Math.max(0, this.clock.now() - operation.startedAt),
      closeCode: operation.closeCode,
    });
  }

  private createInactiveError(code: ClaudeWebPageTransportErrorCode): ClaudeWebPageTransportError {
    return new ClaudeWebPageTransportError(code, {
      phase: 'connecting',
      eventType: null,
      bytesSent: 0,
      eventCount: 0,
      durationMs: 0,
      closeCode: null,
    });
  }

  private clearAllTimers(operation: ActiveOperation): void {
    for (const handle of operation.timeoutHandles) this.clock.clearTimeout(handle);
    for (const handle of operation.intervalHandles) this.clock.clearInterval(handle);
    operation.timeoutHandles.clear();
    operation.intervalHandles.clear();
    operation.deadlineTimers.clear();
  }

  private closeOperation(operation: ActiveOperation): Promise<void> {
    operation.closePromise ??= this.boundary.close(operation.id).catch(() => undefined);
    return operation.closePromise;
  }

  private closeAfterAbortedBoundaryCall(operation: ActiveOperation): void {
    void this.boundary.close(operation.id).catch(() => undefined);
  }
}

/** Creates a transport backed by a Playwright page and optional injected timing dependencies. */
export function createClaudeWebPageTransport(
  page: Page,
  options: Omit<ClaudeWebPageTransportDependencies, 'boundary'> = {},
): ClaudeWebPageTransport {
  return new ClaudeWebPageTransport({
    ...options,
    boundary: createClaudeWebPageSocketBoundary(page),
  });
}
