/* eslint-disable max-classes-per-file -- Transport and typed boundary errors share one auditable protocol boundary. */
import type { Page } from 'playwright-core';
import { CLAUDE_WEB_PCM_CHUNK_BYTES, CLAUDE_WEB_PCM_CHUNK_CADENCE_MS, splitClaudeWebPcm } from './claudeWebAudio';
import {
  CLAUDE_WEB_CLOSE_STREAM_CONTROL,
  CLAUDE_WEB_KEEP_ALIVE_CONTROL,
  applyClaudeWebTranscriptEvent,
  buildClaudeWebSpeechUrl,
  createClaudeWebTranscriptState,
  parseClaudeWebSpeechEvent,
  type ClaudeWebClientControl,
  type ClaudeWebSpeechEvent,
  type ClaudeWebTranscriptState,
} from './claudeWebProtocol';
import type { ClaudeWebLanguage } from '@shared/claudeWebSettings';

export const CLAUDE_WEB_CONNECT_TIMEOUT_MS = 5_000;
export const CLAUDE_WEB_FIRST_EVENT_TIMEOUT_MS = 15_000;
export const CLAUDE_WEB_OVERALL_TIMEOUT_MS = 130_000;
export const CLAUDE_WEB_DRAIN_TIMEOUT_MS = 3_000;
export const CLAUDE_WEB_KEEP_ALIVE_INTERVAL_MS = 4_000;
export const CLAUDE_WEB_SOCKET_POLL_INTERVAL_MS = 25;
export const CLAUDE_WEB_CLOSE_TIMEOUT_MS = 1_000;
export const CLAUDE_WEB_MAX_PAGE_MESSAGE_COUNT = 1_024;
export const CLAUDE_WEB_MAX_PAGE_MESSAGE_BYTES = 1024 * 1024;
export const CLAUDE_WEB_MAX_PAGE_TEXT_MESSAGE_BYTES = 256 * 1024;

const CLAUDE_WEB_PAGE_SOCKET_REGISTRY_KEY = '__gptVoiceClaudePageSocketsV1';

export interface ClaudeWebPageTransportTiming {
  chunkCadenceMs: number;
  closeTimeoutMs: number;
  connectTimeoutMs: number;
  drainTimeoutMs: number;
  firstEventTimeoutMs: number;
  keepAliveIntervalMs: number;
  overallTimeoutMs: number;
  pollIntervalMs: number;
}

const DEFAULT_TRANSPORT_TIMING: ClaudeWebPageTransportTiming = {
  chunkCadenceMs: CLAUDE_WEB_PCM_CHUNK_CADENCE_MS,
  closeTimeoutMs: CLAUDE_WEB_CLOSE_TIMEOUT_MS,
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
  | ClaudeWebPageTransportErrorCode.MalformedEvent
  | ClaudeWebPageTransportErrorCode.RateLimit
  | ClaudeWebPageTransportErrorCode.PageShutdown;

const PAGE_SOCKET_FAILURE_CODES = {
  upgradeOrAuth: ClaudeWebPageTransportErrorCode.UpgradeOrAuth,
  connectionLoss: ClaudeWebPageTransportErrorCode.ConnectionLoss,
  malformedEvent: ClaudeWebPageTransportErrorCode.MalformedEvent,
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
  queuedMessageBytes: number;
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
    /** Opens one page-owned WebSocket without exposing it to main. */
    start: (operationId, url) =>
      evaluatePageSafely(
        page,
        () =>
          page.evaluate(
            ({ failureCodes, limits, registryKey, socketId, socketUrl }) => {
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
                queuedMessageBytes: 0,
              };
              registry.set(socketId, record);

              socket.binaryType = 'arraybuffer';
              socket.onopen = () => {
                record.opened = true;
                record.phase = 'open';
              };
              socket.onmessage = (event: MessageEvent<unknown>) => {
                const retainMessage = (message: ClaudeWebPageMessage, payloadLength: number): void => {
                  if (record.failure) return;
                  if (
                    record.messages.length >= limits.messageCount ||
                    record.queuedMessageBytes + payloadLength > limits.totalBytes
                  ) {
                    record.messages.length = 0;
                    record.queuedMessageBytes = 0;
                    record.failure = failureCodes.malformedEvent;
                    record.phase = 'failed';
                    if (socket.readyState < WebSocket.CLOSING) socket.close(1009);
                    return;
                  }
                  record.messages.push(message);
                  record.queuedMessageBytes += payloadLength;
                };

                if (typeof event.data === 'string') {
                  const payloadLength = new TextEncoder().encode(event.data).byteLength;
                  if (payloadLength > limits.textMessageBytes) {
                    retainMessage({ kind: 'text', payload: '' }, limits.totalBytes + 1);
                    return;
                  }
                  retainMessage({ kind: 'text', payload: event.data }, payloadLength);
                  return;
                }
                const payloadLength =
                  event.data instanceof ArrayBuffer
                    ? event.data.byteLength
                    : event.data instanceof Blob
                      ? event.data.size
                      : null;
                retainMessage({ kind: 'binary', payloadLength }, payloadLength ?? 0);
              };
              socket.onerror = () => {
                record.failure ??= record.opened ? failureCodes.connectionLoss : failureCodes.upgradeOrAuth;
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
              limits: {
                messageCount: CLAUDE_WEB_MAX_PAGE_MESSAGE_COUNT,
                textMessageBytes: CLAUDE_WEB_MAX_PAGE_TEXT_MESSAGE_BYTES,
                totalBytes: CLAUDE_WEB_MAX_PAGE_MESSAGE_BYTES,
              },
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
              const messages = record.messages.splice(0);
              record.queuedMessageBytes = 0;
              return {
                phase: record.phase,
                messages,
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
              record.queuedMessageBytes = 0;
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

export type ClaudeWebPageTransportPhase = 'connecting' | 'streaming' | 'draining';
export type ClaudeWebPageTransportEventType = ClaudeWebSpeechEvent['type'] | 'unknown' | 'malformed';

export interface ClaudeWebPageTransportDiagnostics {
  phase: ClaudeWebPageTransportPhase;
  eventType: ClaudeWebPageTransportEventType | null;
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

declare const CLAUDE_WEB_PAGE_TRANSPORT_OPERATION_ID: unique symbol;

export type ClaudeWebPageTransportOperationId = string & {
  readonly [CLAUDE_WEB_PAGE_TRANSPORT_OPERATION_ID]: never;
};

export interface ClaudeWebPageTransportStartInput {
  language: ClaudeWebLanguage;
  organizationUuid: string;
}

export interface ClaudeWebPageTransportInput extends ClaudeWebPageTransportStartInput {
  pcm: Uint8Array;
}

type DeadlineKind = 'connect' | 'first-event' | 'overall' | 'drain';

interface ActiveOperation {
  id: ClaudeWebPageTransportOperationId;
  controller: AbortController;
  failure: ClaudeWebPageTransportError | null;
  phase: ClaudeWebPageTransportPhase;
  startedAt: number;
  bytesSent: number;
  eventCount: number;
  eventType: ClaudeWebPageTransportEventType | null;
  closeCode: number | null;
  transcript: ClaudeWebTranscriptState;
  endpointCount: number;
  hasServerEvent: boolean;
  deadlineTimers: Map<DeadlineKind, unknown>;
  timeoutHandles: Set<unknown>;
  intervalHandles: Set<unknown>;
  boundaryTail: Promise<void>;
  openPromise: Promise<void> | null;
  finishPromise: Promise<string> | null;
  finishRequested: boolean;
  closeStreamSent: boolean;
  closePromise: Promise<void> | null;
  cleanupPromise: Promise<void> | null;
}

function normalizeTiming(input: Partial<ClaudeWebPageTransportTiming> = {}): ClaudeWebPageTransportTiming {
  const timing = { ...DEFAULT_TRANSPORT_TIMING, ...input };
  for (const [name, value] of Object.entries(timing)) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Invalid Claude Web transport timing: ${name}`);
  }
  return timing;
}

/** Streams raw PCM through fresh native WebSockets owned by the authenticated Claude page. */
export class ClaudeWebPageTransport {
  private readonly boundary: ClaudeWebPageSocketBoundary;
  private readonly clock: ClaudeWebPageTransportClock;
  private readonly timing: ClaudeWebPageTransportTiming;
  private readonly activeOperations = new Map<ClaudeWebPageTransportOperationId, ActiveOperation>();
  private nextOperationId = 1;
  private stopped = false;

  constructor(dependencies: ClaudeWebPageTransportDependencies) {
    this.boundary = dependencies.boundary;
    this.clock = dependencies.clock ?? SYSTEM_CLOCK;
    this.timing = normalizeTiming(dependencies.timing);
  }

  async start(input: ClaudeWebPageTransportStartInput): Promise<ClaudeWebPageTransportOperationId> {
    if (this.stopped) throw this.createInactiveError(ClaudeWebPageTransportErrorCode.PageShutdown);
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
      operation.openPromise = this.openOperation(operation);
      void operation.openPromise.catch(() => this.cleanupOperation(operation));
      return operation.id;
    } catch (error: unknown) {
      await this.cleanupOperation(operation);
      throw error;
    }
  }

  async push(operationId: ClaudeWebPageTransportOperationId, chunk: Uint8Array): Promise<void> {
    this.assertPcmChunk(chunk, false);
    const operation = this.getOperation(operationId);
    if (operation.finishRequested) throw new RangeError('Claude Web transport operation is already finishing');
    const ownedChunk = Uint8Array.from(chunk);

    try {
      await this.getOpenPromise(operation);
      await this.enqueueBoundaryAction(operation, async () => {
        await this.callBoundary(
          operation,
          () => this.boundary.sendBinary(operation.id, ownedChunk),
          ClaudeWebPageTransportErrorCode.ConnectionLoss,
        );
        operation.bytesSent += ownedChunk.byteLength;
        this.processSnapshot(operation, await this.inspectNow(operation));
      });
    } catch (error: unknown) {
      await this.cleanupOperation(operation);
      throw error;
    }
  }

  finish(operationId: ClaudeWebPageTransportOperationId, finalChunk: Uint8Array = new Uint8Array()): Promise<string> {
    this.assertPcmChunk(finalChunk, true);
    const operation = this.getOperation(operationId);
    if (operation.finishPromise) return operation.finishPromise;

    operation.finishRequested = true;
    const ownedFinalChunk = Uint8Array.from(finalChunk);
    operation.finishPromise = this.finishOperation(operation, ownedFinalChunk);
    return operation.finishPromise;
  }

  async cancel(operationId: ClaudeWebPageTransportOperationId): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    this.failOperation(operation, ClaudeWebPageTransportErrorCode.Cancelled);
    await this.cleanupOperation(operation);
  }

  async cancelAll(): Promise<void> {
    await this.stopOperations(ClaudeWebPageTransportErrorCode.Cancelled);
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    await this.stopOperations(ClaudeWebPageTransportErrorCode.PageShutdown);
  }

  async transcribe(input: ClaudeWebPageTransportInput): Promise<string> {
    const chunks = splitClaudeWebPcm(input.pcm);
    const lastChunk = chunks[chunks.length - 1];
    const hasFinalFragment = lastChunk.byteLength < CLAUDE_WEB_PCM_CHUNK_BYTES;
    const completeChunks = hasFinalFragment ? chunks.slice(0, -1) : chunks;
    const finalChunk = hasFinalFragment ? lastChunk : new Uint8Array();
    const operationId = await this.start(input);
    const operation = this.getOperation(operationId);

    try {
      for (let index = 0; index < completeChunks.length; index += 1) {
        await this.push(operationId, completeChunks[index]);
        if (index + 1 < completeChunks.length || finalChunk.byteLength > 0) {
          await this.delay(operation, this.timing.chunkCadenceMs);
        }
      }
      return await this.finish(operationId, finalChunk);
    } catch (error: unknown) {
      await this.cancel(operationId);
      throw error;
    }
  }

  private createOperation(): ActiveOperation {
    const operation: ActiveOperation = {
      id: `claude-web-${this.nextOperationId}` as ClaudeWebPageTransportOperationId,
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
      boundaryTail: Promise.resolve(),
      openPromise: null,
      finishPromise: null,
      finishRequested: false,
      closeStreamSent: false,
      closePromise: null,
      cleanupPromise: null,
    };
    this.nextOperationId += 1;
    return operation;
  }

  private async openOperation(operation: ActiveOperation): Promise<void> {
    await this.waitForOpen(operation);
    this.throwIfFailed(operation);
    this.clearDeadline(operation, 'connect');
    if (!operation.hasServerEvent) {
      this.armDeadline(
        operation,
        'first-event',
        this.timing.firstEventTimeoutMs,
        ClaudeWebPageTransportErrorCode.FirstEventTimeout,
      );
    }
    operation.phase = 'streaming';
    this.startKeepAlive(operation);
  }

  private async waitForOpen(operation: ActiveOperation): Promise<void> {
    while (true) {
      const snapshot = await this.enqueueBoundaryAction(operation, () => this.inspectNow(operation));
      this.processSnapshot(operation, snapshot);
      if (snapshot.phase === 'open') return;
      if (snapshot.phase === 'closed') {
        this.failOperation(operation, ClaudeWebPageTransportErrorCode.UpgradeOrAuth);
        this.throwOperationFailure(operation);
      }
      await this.delay(operation, this.timing.pollIntervalMs);
    }
  }

  private async finishOperation(operation: ActiveOperation, finalChunk: Uint8Array): Promise<string> {
    try {
      await this.getOpenPromise(operation);
      this.stopKeepAlive(operation);
      operation.phase = 'draining';

      const endpointCountAtClose = await this.enqueueBoundaryAction(operation, async () => {
        if (finalChunk.byteLength > 0) {
          await this.callBoundary(
            operation,
            () => this.boundary.sendBinary(operation.id, finalChunk),
            ClaudeWebPageTransportErrorCode.ConnectionLoss,
          );
          operation.bytesSent += finalChunk.byteLength;
        }

        this.processSnapshot(operation, await this.inspectNow(operation));
        const endpointCount = operation.endpointCount;
        if (!operation.closeStreamSent) {
          await this.callBoundary(
            operation,
            () => this.boundary.sendControl(operation.id, CLAUDE_WEB_CLOSE_STREAM_CONTROL),
            ClaudeWebPageTransportErrorCode.ConnectionLoss,
          );
          operation.closeStreamSent = true;
        }
        return endpointCount;
      });

      this.throwIfFailed(operation);
      this.armDeadline(operation, 'drain', this.timing.drainTimeoutMs, ClaudeWebPageTransportErrorCode.DrainTimeout);
      return await this.drainFinalTranscript(operation, endpointCountAtClose);
    } finally {
      await this.cleanupOperation(operation);
    }
  }

  private async drainFinalTranscript(operation: ActiveOperation, endpointCountAtClose: number): Promise<string> {
    while (true) {
      const snapshot = await this.enqueueBoundaryAction(operation, () => this.inspectNow(operation));
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

  private async inspectNow(operation: ActiveOperation): Promise<ClaudeWebPageSocketSnapshot> {
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
        operation.eventType = 'malformed';
        this.failOperation(operation, ClaudeWebPageTransportErrorCode.MalformedEvent);
        this.throwOperationFailure(operation);
      }

      const parsed = parseClaudeWebSpeechEvent(message.payload);
      if (parsed.status !== 'known') {
        operation.eventType = parsed.status;
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
      void this.enqueueBoundaryAction(operation, async () => {
        await this.callBoundary(
          operation,
          () => this.boundary.sendControl(operation.id, CLAUDE_WEB_KEEP_ALIVE_CONTROL),
          ClaudeWebPageTransportErrorCode.ConnectionLoss,
        );
        this.processSnapshot(operation, await this.inspectNow(operation));
      }).catch((error: unknown) => {
        if (!operation.failure) {
          this.failOperation(
            operation,
            error instanceof ClaudeWebPageTransportError ? error.code : ClaudeWebPageTransportErrorCode.ConnectionLoss,
          );
        }
        void this.cleanupOperation(operation);
      });
    }, this.timing.keepAliveIntervalMs);
    operation.intervalHandles.add(handle);
  }

  private stopKeepAlive(operation: ActiveOperation): void {
    for (const handle of operation.intervalHandles) this.clock.clearInterval(handle);
    operation.intervalHandles.clear();
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
      void this.cleanupOperation(operation);
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

  private enqueueBoundaryAction<T>(operation: ActiveOperation, action: () => Promise<T>): Promise<T> {
    const pending = operation.boundaryTail.then(async () => {
      this.throwIfFailed(operation);
      return action();
    });
    operation.boundaryTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
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

  private cleanupOperation(operation: ActiveOperation): Promise<void> {
    operation.cleanupPromise ??= this.performOperationCleanup(operation);
    return operation.cleanupPromise;
  }

  private async performOperationCleanup(operation: ActiveOperation): Promise<void> {
    this.clearAllTimers(operation);
    if (this.activeOperations.get(operation.id) === operation) this.activeOperations.delete(operation.id);
    operation.transcript = createClaudeWebTranscriptState();
    await this.closeOperation(operation);
  }

  private async stopOperations(code: ClaudeWebPageTransportErrorCode): Promise<void> {
    const operations = Array.from(this.activeOperations.values());
    for (const operation of operations) this.failOperation(operation, code);
    await Promise.all(operations.map((operation) => this.cleanupOperation(operation)));
  }

  private getOperation(operationId: ClaudeWebPageTransportOperationId): ActiveOperation {
    const operation = this.activeOperations.get(operationId);
    if (!operation) throw new RangeError('Unknown Claude Web transport operation');
    return operation;
  }

  private getOpenPromise(operation: ActiveOperation): Promise<void> {
    if (!operation.openPromise) throw new RangeError('Claude Web transport operation did not start');
    return operation.openPromise;
  }

  private assertPcmChunk(chunk: Uint8Array, allowEmpty: boolean): void {
    if (!(chunk instanceof Uint8Array)) throw new TypeError('Claude Web PCM chunk must be a Uint8Array');
    if (!allowEmpty && chunk.byteLength === 0) throw new RangeError('Claude Web PCM chunk must not be empty');
    if (chunk.byteLength % 2 !== 0) throw new RangeError('Claude Web PCM chunk must contain complete samples');
  }

  private closeOperation(operation: ActiveOperation): Promise<void> {
    operation.closePromise ??= new Promise<void>((resolve) => {
      let settled = false;
      const timeoutHandle = this.clock.setTimeout(() => settle(), this.timing.closeTimeoutMs);
      operation.timeoutHandles.add(timeoutHandle);
      const settle = (): void => {
        if (settled) return;
        settled = true;
        this.clock.clearTimeout(timeoutHandle);
        operation.timeoutHandles.delete(timeoutHandle);
        resolve();
      };
      void this.boundary.close(operation.id).then(settle, settle);
    });
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
