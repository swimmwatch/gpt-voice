/* eslint-disable max-classes-per-file -- The deterministic clock and socket boundary are paired test doubles. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Page } from 'playwright-core';
import {
  CLAUDE_WEB_CONNECT_TIMEOUT_MS,
  CLAUDE_WEB_DRAIN_TIMEOUT_MS,
  CLAUDE_WEB_FIRST_EVENT_TIMEOUT_MS,
  CLAUDE_WEB_KEEP_ALIVE_INTERVAL_MS,
  CLAUDE_WEB_OVERALL_TIMEOUT_MS,
  ClaudeWebPageSocketError,
  ClaudeWebPageTransport,
  ClaudeWebPageTransportError,
  ClaudeWebPageTransportErrorCode,
  createClaudeWebPageSocketBoundary,
  type ClaudeWebPageMessage,
  type ClaudeWebPageSocketBoundary,
  type ClaudeWebPageSocketFailureCode,
  type ClaudeWebPageSocketSnapshot,
  type ClaudeWebPageTransportClock,
  type ClaudeWebPageTransportTiming,
} from '@main/providers/claudeWebPageTransport';
import { CLAUDE_WEB_PCM_CHUNK_BYTES } from '@main/providers/claudeWebAudio';
import type { ClaudeWebClientControl } from '@main/providers/claudeWebProtocol';

const SYNTHETIC_ORGANIZATION_UUID = '11111111-2222-3333-4444-555555555555';
const TEST_TIMING: ClaudeWebPageTransportTiming = {
  chunkCadenceMs: 5,
  connectTimeoutMs: 20,
  drainTimeoutMs: 20,
  firstEventTimeoutMs: 20,
  keepAliveIntervalMs: 4,
  overallTimeoutMs: 100,
  pollIntervalMs: 1,
};

interface ManualTimer {
  callback: () => void;
  dueAt: number;
  intervalMs: number | null;
}

class ManualClock implements ClaudeWebPageTransportClock {
  private currentTime = 0;
  private nextTimerId = 1;
  private readonly timers = new Map<number, ManualTimer>();

  now(): number {
    return this.currentTime;
  }

  setTimeout(callback: () => void, delayMs: number): unknown {
    return this.addTimer(callback, delayMs, null);
  }

  clearTimeout(handle: unknown): void {
    if (typeof handle === 'number') this.timers.delete(handle);
  }

  setInterval(callback: () => void, intervalMs: number): unknown {
    return this.addTimer(callback, intervalMs, intervalMs);
  }

  clearInterval(handle: unknown): void {
    this.clearTimeout(handle);
  }

  advanceBy(durationMs: number): void {
    const targetTime = this.currentTime + durationMs;
    while (true) {
      const next = Array.from(this.timers.entries())
        .filter(([, timer]) => timer.dueAt <= targetTime)
        .sort(([leftId, left], [rightId, right]) => left.dueAt - right.dueAt || leftId - rightId)[0];
      if (!next) break;

      const [timerId, timer] = next;
      this.currentTime = timer.dueAt;
      if (timer.intervalMs === null) {
        this.timers.delete(timerId);
      } else {
        timer.dueAt += timer.intervalMs;
      }
      timer.callback();
    }
    this.currentTime = targetTime;
  }

  get activeTimerCount(): number {
    return this.timers.size;
  }

  private addTimer(callback: () => void, delayMs: number, intervalMs: number | null): number {
    const timerId = this.nextTimerId;
    this.nextTimerId += 1;
    this.timers.set(timerId, {
      callback,
      dueAt: this.currentTime + delayMs,
      intervalMs,
    });
    return timerId;
  }
}

interface FakeSocketRecord {
  closeCode: number | null;
  failure: ClaudeWebPageSocketFailureCode | null;
  messages: ClaudeWebPageMessage[];
  phase: ClaudeWebPageSocketSnapshot['phase'];
}

class FakePageSocketBoundary implements ClaudeWebPageSocketBoundary {
  readonly binaryFrames: Uint8Array[] = [];
  readonly controls: ClaudeWebClientControl[] = [];
  readonly operationIds: string[] = [];
  readonly closedOperationIds = new Set<string>();
  maxConcurrentWrites = 0;
  autoOpen = true;
  inspectError: ClaudeWebPageSocketError | null = null;
  onBinary: ((operationId: string, bytes: Uint8Array) => void) | null = null;
  onControl: ((operationId: string, control: ClaudeWebClientControl) => void) | null = null;
  onStart: ((operationId: string) => void) | null = null;
  private activeWrites = 0;
  private readonly records = new Map<string, FakeSocketRecord>();

  async start(operationId: string, _url: string): Promise<void> {
    this.operationIds.push(operationId);
    this.records.set(operationId, {
      closeCode: null,
      failure: null,
      messages: [],
      phase: this.autoOpen ? 'open' : 'connecting',
    });
    this.onStart?.(operationId);
  }

  async inspect(operationId: string): Promise<ClaudeWebPageSocketSnapshot> {
    if (this.inspectError) throw this.inspectError;
    const record = this.getRecord(operationId);
    const messages = record.messages.splice(0);
    return {
      closeCode: record.closeCode,
      failure: record.failure,
      messages,
      phase: record.phase,
    };
  }

  async sendBinary(operationId: string, bytes: Uint8Array): Promise<void> {
    this.beginWrite();
    try {
      this.getRecord(operationId);
      const copy = Uint8Array.from(bytes);
      this.binaryFrames.push(copy);
      this.onBinary?.(operationId, copy);
      await Promise.resolve();
    } finally {
      this.activeWrites -= 1;
    }
  }

  async sendControl(operationId: string, control: ClaudeWebClientControl): Promise<void> {
    this.beginWrite();
    try {
      this.getRecord(operationId);
      this.controls.push(control);
      this.onControl?.(operationId, control);
      await Promise.resolve();
    } finally {
      this.activeWrites -= 1;
    }
  }

  async close(operationId: string): Promise<void> {
    this.closedOperationIds.add(operationId);
    this.records.delete(operationId);
  }

  emit(operationId: string, payload: string): void {
    this.getRecord(operationId).messages.push({ kind: 'text', payload });
  }

  closeRemotely(operationId: string, closeCode = 1000): void {
    const record = this.getRecord(operationId);
    record.closeCode = closeCode;
    record.phase = 'closed';
  }

  open(operationId: string): void {
    this.getRecord(operationId).phase = 'open';
  }

  fail(operationId: string, failure: ClaudeWebPageSocketFailureCode, closeCode: number | null = null): void {
    const record = this.getRecord(operationId);
    record.closeCode = closeCode;
    record.failure = failure;
    record.phase = 'failed';
  }

  private getRecord(operationId: string): FakeSocketRecord {
    const record = this.records.get(operationId);
    if (!record) throw new ClaudeWebPageSocketError(ClaudeWebPageTransportErrorCode.PageShutdown);
    return record;
  }

  private beginWrite(): void {
    this.activeWrites += 1;
    this.maxConcurrentWrites = Math.max(this.maxConcurrentWrites, this.activeWrites);
  }
}

class FakeNativeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSING = 2;

  readonly sent: unknown[] = [];
  readonly closeCodes: number[] = [];
  binaryType = 'blob';
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(readonly url: string) {}

  send(value: unknown): void {
    this.sent.push(value);
  }

  close(code: number): void {
    this.readyState = FakeNativeWebSocket.CLOSING;
    this.closeCodes.push(code);
  }

  open(): void {
    this.readyState = FakeNativeWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: unknown): void {
    this.onmessage?.({ data });
  }
}

function syntheticPcm(byteLength: number): Uint8Array {
  assert.equal(byteLength % 2, 0);
  return Uint8Array.from({ length: byteLength }, (_, index) => index % 251);
}

function transcribe(transport: ClaudeWebPageTransport, pcm = syntheticPcm(4)): Promise<string> {
  return transport.transcribe({
    language: 'en-US',
    organizationUuid: SYNTHETIC_ORGANIZATION_UUID,
    pcm,
  });
}

function startTransport(transport: ClaudeWebPageTransport) {
  return transport.start({
    language: 'en-US',
    organizationUuid: SYNTHETIC_ORGANIZATION_UUID,
  });
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function advanceClock(clock: ManualClock, durationMs: number): Promise<void> {
  for (let elapsed = 0; elapsed < durationMs; elapsed += 1) {
    clock.advanceBy(1);
    await flushMicrotasks();
  }
}

async function settleWithClock<T>(promise: Promise<T>, clock: ManualClock, maxDurationMs = 200): Promise<T> {
  let outcome: { status: 'fulfilled'; value: T } | { status: 'rejected'; error: unknown } | null = null;
  void promise.then(
    (value) => {
      outcome = { status: 'fulfilled', value };
    },
    (error: unknown) => {
      outcome = { status: 'rejected', error };
    },
  );

  for (let elapsed = 0; elapsed <= maxDurationMs && outcome === null; elapsed += 1) {
    await flushMicrotasks();
    if (outcome === null) clock.advanceBy(1);
  }
  const settled = outcome as { status: 'fulfilled'; value: T } | { status: 'rejected'; error: unknown } | null;
  if (settled === null) throw new Error('Synthetic transport operation did not settle');
  if (settled.status === 'rejected') throw settled.error;
  return settled.value;
}

async function expectTransportFailure(
  promise: Promise<string>,
  clock: ManualClock,
  code: ClaudeWebPageTransportErrorCode,
): Promise<ClaudeWebPageTransportError> {
  try {
    await settleWithClock(promise, clock);
  } catch (error: unknown) {
    assert.equal(error instanceof ClaudeWebPageTransportError, true);
    const transportError = error as ClaudeWebPageTransportError;
    assert.equal(transportError.code, code);
    return transportError;
  }
  throw new Error(`Expected Claude Web transport failure: ${code}`);
}

function createHarness(timing: Partial<ClaudeWebPageTransportTiming> = {}): {
  boundary: FakePageSocketBoundary;
  clock: ManualClock;
  transport: ClaudeWebPageTransport;
} {
  const boundary = new FakePageSocketBoundary();
  const clock = new ManualClock();
  const transport = new ClaudeWebPageTransport({
    boundary,
    clock,
    timing: { ...TEST_TIMING, ...timing },
  });
  return { boundary, clock, transport };
}

describe('Claude Web page transport', () => {
  it('publishes the Gate A timeout and keepalive constants', () => {
    assert.equal(CLAUDE_WEB_CONNECT_TIMEOUT_MS, 5_000);
    assert.equal(CLAUDE_WEB_FIRST_EVENT_TIMEOUT_MS, 15_000);
    assert.equal(CLAUDE_WEB_OVERALL_TIMEOUT_MS, 130_000);
    assert.equal(CLAUDE_WEB_DRAIN_TIMEOUT_MS, 3_000);
    assert.equal(CLAUDE_WEB_KEEP_ALIVE_INTERVAL_MS, 4_000);
  });

  it('creates and controls the native socket through short page evaluations', async () => {
    const originalWebSocket = globalThis.WebSocket;
    const nativeSockets: FakeNativeWebSocket[] = [];
    const evaluations: Array<(argument: unknown) => unknown> = [];
    const page = {
      isClosed: () => false,
      evaluate: async (operation: (argument: unknown) => unknown, argument: unknown) => {
        evaluations.push(operation);
        return operation(argument);
      },
    } as unknown as Page;
    class CapturedWebSocket extends FakeNativeWebSocket {
      constructor(url: string) {
        super(url);
        nativeSockets.push(this);
      }
    }
    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      value: CapturedWebSocket,
      writable: true,
    });

    try {
      const boundary = createClaudeWebPageSocketBoundary(page);
      await boundary.start('synthetic-operation', 'wss://example.invalid/synthetic');
      assert.equal(nativeSockets.length, 1);
      const socket = nativeSockets[0];
      socket.open();

      assert.equal((await boundary.inspect('synthetic-operation')).phase, 'open');
      await boundary.sendBinary('synthetic-operation', Uint8Array.of(1, 2));
      await boundary.sendControl('synthetic-operation', { type: 'KeepAlive' });
      socket.message('{"type":"ProviderNotice","data":"synthetic private body"}');
      assert.deepEqual((await boundary.inspect('synthetic-operation')).messages, [
        { kind: 'text', payload: '{"type":"ProviderNotice","data":"synthetic private body"}' },
      ]);
      await boundary.close('synthetic-operation');

      assert.equal(socket.url, 'wss://example.invalid/synthetic');
      assert.deepEqual(socket.sent[0], Uint8Array.of(1, 2));
      assert.equal(socket.sent[1], '{"type":"KeepAlive"}');
      assert.deepEqual(socket.closeCodes, [1000]);
      assert.equal(evaluations.length, 6);
    } finally {
      Object.defineProperty(globalThis, 'WebSocket', {
        configurable: true,
        value: originalWebSocket,
        writable: true,
      });
    }
  });

  it('returns an operation before socket open and serializes queued audio before Stop', async () => {
    const { boundary, clock, transport } = createHarness();
    boundary.autoOpen = false;
    boundary.onControl = (operationId, control) => {
      if (control.type !== 'CloseStream') return;
      boundary.emit(operationId, '{"type":"TranscriptText","data":"synthetic final"}');
      boundary.emit(operationId, '{"type":"TranscriptEndpoint"}');
    };

    const operationId = await startTransport(transport);
    const firstChunk = new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES).fill(1);
    const secondChunk = new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES).fill(2);
    const firstPush = transport.push(operationId, firstChunk);
    const secondPush = transport.push(operationId, secondChunk);
    const finish = transport.finish(operationId, Uint8Array.of(3, 0));
    firstChunk.fill(9);
    secondChunk.fill(9);
    await flushMicrotasks();

    assert.equal(boundary.binaryFrames.length, 0);
    assert.equal(boundary.controls.length, 0);
    boundary.open(operationId);

    const [, , text] = await settleWithClock(Promise.all([firstPush, secondPush, finish]), clock);
    assert.equal(text, 'synthetic final');
    assert.deepEqual(
      boundary.binaryFrames.map((chunk) => [chunk.byteLength, chunk[0]]),
      [
        [CLAUDE_WEB_PCM_CHUNK_BYTES, 1],
        [CLAUDE_WEB_PCM_CHUNK_BYTES, 2],
        [2, 3],
      ],
    );
    assert.equal(boundary.controls.filter((control) => control.type === 'CloseStream').length, 1);
    assert.equal(boundary.maxConcurrentWrites, 1);
    assert.equal(clock.activeTimerCount, 0);
  });

  it('keeps the open socket alive while paused and commits only the latest cumulative endpoint', async () => {
    const { boundary, clock, transport } = createHarness({ firstEventTimeoutMs: 30 });
    boundary.onBinary = (operationId) => {
      boundary.emit(operationId, '{"type":"TranscriptInterim","data":"synthetic"}');
      boundary.emit(operationId, '{"type":"TranscriptEndpoint"}');
    };
    boundary.onControl = (operationId, control) => {
      if (control.type !== 'CloseStream') return;
      boundary.emit(operationId, '{"type":"TranscriptText","data":"synthetic final"}');
      boundary.emit(operationId, '{"type":"TranscriptEndpoint"}');
    };

    const operationId = await startTransport(transport);
    await settleWithClock(transport.push(operationId, Uint8Array.of(1, 0)), clock);
    await advanceClock(clock, 12);

    assert.equal(boundary.controls.filter((control) => control.type === 'KeepAlive').length, 3);
    assert.equal(
      boundary.controls.some((control) => control.type === 'CloseStream'),
      false,
    );
    assert.equal(await settleWithClock(transport.finish(operationId), clock), 'synthetic final');
    assert.equal(boundary.controls.filter((control) => control.type === 'CloseStream').length, 1);
    assert.equal(clock.activeTimerCount, 0);
  });

  it('rejects empty or sample-unaligned streamed chunks without closing a valid operation', async () => {
    const { boundary, clock, transport } = createHarness();
    const operationId = await startTransport(transport);

    await assert.rejects(() => transport.push(operationId, new Uint8Array()), RangeError);
    await assert.rejects(() => transport.push(operationId, Uint8Array.of(1)), RangeError);
    assert.throws(() => transport.finish(operationId, Uint8Array.of(1)), RangeError);
    assert.equal(boundary.binaryFrames.length, 0);
    assert.equal(
      boundary.controls.some((control) => control.type === 'CloseStream'),
      false,
    );

    await transport.cancel(operationId);
    assert.equal(boundary.closedOperationIds.size, 1);
    assert.equal(clock.activeTimerCount, 0);
  });

  it('paces complete chunks, sends keepalives and one CloseStream, and accepts a late final endpoint', async () => {
    const { boundary, clock, transport } = createHarness();
    const pcm = syntheticPcm(CLAUDE_WEB_PCM_CHUNK_BYTES * 2 + 4);
    boundary.onControl = (operationId, control) => {
      if (control.type !== 'CloseStream') return;
      clock.setTimeout(() => {
        boundary.emit(operationId, '{"type":"TranscriptText","data":"synthetic final"}');
        boundary.emit(operationId, '{"type":"TranscriptEndpoint"}');
      }, 2);
    };

    const result = await settleWithClock(transcribe(transport, pcm), clock);

    assert.equal(result, 'synthetic final');
    assert.deepEqual(
      boundary.binaryFrames.map((frame) => frame.byteLength),
      [CLAUDE_WEB_PCM_CHUNK_BYTES, CLAUDE_WEB_PCM_CHUNK_BYTES, 4],
    );
    assert.deepEqual(Buffer.concat(boundary.binaryFrames.map((frame) => Buffer.from(frame))), Buffer.from(pcm));
    assert.equal(boundary.controls.filter((control) => control.type === 'KeepAlive').length, 3);
    assert.equal(boundary.controls.filter((control) => control.type === 'CloseStream').length, 1);
    assert.equal(boundary.closedOperationIds.size, 1);
    assert.equal(clock.activeTimerCount, 0);
  });

  it('uses distinct sockets and isolated transcript accumulators for sequential operations', async () => {
    const { boundary, clock, transport } = createHarness();
    boundary.onControl = (operationId, control) => {
      if (control.type !== 'CloseStream') return;
      const sequence = boundary.operationIds.indexOf(operationId) + 1;
      boundary.emit(operationId, JSON.stringify({ type: 'TranscriptText', data: `synthetic ${sequence}` }));
      boundary.emit(operationId, '{"type":"TranscriptEndpoint"}');
    };

    const first = await settleWithClock(transcribe(transport), clock);
    const second = await settleWithClock(transcribe(transport), clock);

    assert.deepEqual([first, second], ['synthetic 1', 'synthetic 2']);
    assert.equal(new Set(boundary.operationIds).size, 2);
    assert.equal(boundary.closedOperationIds.size, 2);
    assert.equal(clock.activeTimerCount, 0);
  });

  it('ignores unknown events without exposing their content or blocking finalization', async () => {
    const { boundary, clock, transport } = createHarness();
    boundary.onControl = (operationId, control) => {
      if (control.type !== 'CloseStream') return;
      boundary.emit(operationId, '{"type":"ProviderNotice","data":"synthetic private body"}');
      boundary.emit(operationId, '{"type":"TranscriptText","data":"synthetic result"}');
      boundary.emit(operationId, '{"type":"TranscriptEndpoint"}');
    };

    assert.equal(await settleWithClock(transcribe(transport), clock), 'synthetic result');
    assert.equal(clock.activeTimerCount, 0);
  });

  it('classifies upgrade, connection, malformed-event, rate-limit, empty-result, and page-shutdown failures', async () => {
    const cases: ReadonlyArray<{
      code: ClaudeWebPageTransportErrorCode;
      configure(boundary: FakePageSocketBoundary): void;
    }> = [
      {
        code: ClaudeWebPageTransportErrorCode.UpgradeOrAuth,
        configure: (boundary) => {
          boundary.onStart = (operationId) => boundary.fail(operationId, ClaudeWebPageTransportErrorCode.UpgradeOrAuth);
        },
      },
      {
        code: ClaudeWebPageTransportErrorCode.ConnectionLoss,
        configure: (boundary) => {
          boundary.onBinary = (operationId) =>
            boundary.fail(operationId, ClaudeWebPageTransportErrorCode.ConnectionLoss, 1006);
        },
      },
      {
        code: ClaudeWebPageTransportErrorCode.MalformedEvent,
        configure: (boundary) => {
          boundary.onBinary = (operationId) => boundary.emit(operationId, '{not-json');
        },
      },
      {
        code: ClaudeWebPageTransportErrorCode.RateLimit,
        configure: (boundary) => {
          boundary.onBinary = (operationId) =>
            boundary.fail(operationId, ClaudeWebPageTransportErrorCode.RateLimit, 1013);
        },
      },
      {
        code: ClaudeWebPageTransportErrorCode.EmptyResult,
        configure: (boundary) => {
          boundary.onControl = (operationId, control) => {
            if (control.type === 'CloseStream') boundary.closeRemotely(operationId);
          };
        },
      },
      {
        code: ClaudeWebPageTransportErrorCode.PageShutdown,
        configure: (boundary) => {
          boundary.inspectError = new ClaudeWebPageSocketError(ClaudeWebPageTransportErrorCode.PageShutdown);
        },
      },
    ];

    for (const testCase of cases) {
      const { boundary, clock, transport } = createHarness();
      testCase.configure(boundary);
      const error = await expectTransportFailure(transcribe(transport), clock, testCase.code);
      assert.equal(error.diagnostics.eventCount >= 0, true);
      assert.equal('url' in error.diagnostics, false);
      assert.equal('organizationUuid' in error.diagnostics, false);
      assert.equal('transcript' in error.diagnostics, false);
      assert.equal(boundary.operationIds.length, 1);
      assert.equal(boundary.closedOperationIds.size, 1);
      assert.equal(clock.activeTimerCount, 0);
    }
  });

  it('classifies connect, first-event, overall, and drain timeouts independently', async () => {
    const connect = createHarness({ connectTimeoutMs: 5 });
    connect.boundary.autoOpen = false;
    await expectTransportFailure(
      transcribe(connect.transport),
      connect.clock,
      ClaudeWebPageTransportErrorCode.ConnectTimeout,
    );
    assert.equal(connect.clock.activeTimerCount, 0);

    const firstEvent = createHarness({ chunkCadenceMs: 2, firstEventTimeoutMs: 5 });
    await expectTransportFailure(
      transcribe(firstEvent.transport, syntheticPcm(CLAUDE_WEB_PCM_CHUNK_BYTES * 10)),
      firstEvent.clock,
      ClaudeWebPageTransportErrorCode.FirstEventTimeout,
    );
    assert.equal(firstEvent.clock.activeTimerCount, 0);

    const overall = createHarness({ chunkCadenceMs: 2, firstEventTimeoutMs: 50, overallTimeoutMs: 5 });
    overall.boundary.onBinary = (operationId) => {
      if (overall.boundary.binaryFrames.length === 1) {
        overall.boundary.emit(operationId, '{"type":"TranscriptText","data":"synthetic partial"}');
      }
    };
    await expectTransportFailure(
      transcribe(overall.transport, syntheticPcm(CLAUDE_WEB_PCM_CHUNK_BYTES * 10)),
      overall.clock,
      ClaudeWebPageTransportErrorCode.OverallTimeout,
    );
    assert.equal(overall.clock.activeTimerCount, 0);

    const drain = createHarness({ drainTimeoutMs: 5 });
    drain.boundary.onBinary = (operationId) => {
      drain.boundary.emit(operationId, '{"type":"TranscriptText","data":"synthetic partial"}');
    };
    await expectTransportFailure(
      transcribe(drain.transport),
      drain.clock,
      ClaudeWebPageTransportErrorCode.DrainTimeout,
    );
    assert.equal(drain.clock.activeTimerCount, 0);
  });

  it('cancels promptly and idempotently during connect, streaming, and drain', async () => {
    for (const phase of ['connect', 'streaming', 'drain'] as const) {
      const { boundary, clock, transport } = createHarness();
      if (phase === 'connect') boundary.autoOpen = false;
      const pcm = phase === 'streaming' ? syntheticPcm(CLAUDE_WEB_PCM_CHUNK_BYTES * 3) : syntheticPcm(4);
      const operation = transcribe(transport, pcm);

      if (phase === 'connect') {
        await flushMicrotasks();
      } else if (phase === 'streaming') {
        while (boundary.binaryFrames.length === 0) await advanceClock(clock, 1);
      } else {
        while (!boundary.controls.some((control) => control.type === 'CloseStream')) await advanceClock(clock, 1);
      }

      await transport.cancelAll();
      assert.equal(clock.activeTimerCount, 0, `timers remain after ${phase} cancellation`);
      await transport.cancelAll();
      await expectTransportFailure(operation, clock, ClaudeWebPageTransportErrorCode.Cancelled);
      if (phase !== 'drain') {
        assert.equal(
          boundary.controls.some((control) => control.type === 'CloseStream'),
          false,
        );
      }
      assert.equal(boundary.operationIds.length, 1);
      assert.equal(boundary.closedOperationIds.size, 1);
      assert.equal(clock.activeTimerCount, 0);
    }
  });

  it('maps shutdown distinctly and rejects future operations without creating a socket', async () => {
    const { boundary, clock, transport } = createHarness();
    boundary.autoOpen = false;
    const pending = transcribe(transport);
    await flushMicrotasks();

    await transport.shutdown();

    await expectTransportFailure(pending, clock, ClaudeWebPageTransportErrorCode.PageShutdown);
    await expectTransportFailure(transcribe(transport), clock, ClaudeWebPageTransportErrorCode.PageShutdown);
    assert.equal(boundary.operationIds.length, 1);
    assert.equal(boundary.closedOperationIds.size, 1);
    assert.equal(clock.activeTimerCount, 0);
  });

  it('does not reconnect or replay chunks after a mid-stream failure', async () => {
    const { boundary, clock, transport } = createHarness();
    boundary.onBinary = (operationId) => {
      if (boundary.binaryFrames.length === 2) {
        boundary.fail(operationId, ClaudeWebPageTransportErrorCode.ConnectionLoss, 1006);
      }
    };

    await expectTransportFailure(
      transcribe(transport, syntheticPcm(CLAUDE_WEB_PCM_CHUNK_BYTES * 4)),
      clock,
      ClaudeWebPageTransportErrorCode.ConnectionLoss,
    );
    await advanceClock(clock, 20);

    assert.equal(boundary.operationIds.length, 1);
    assert.equal(boundary.binaryFrames.length, 2);
    assert.equal(
      boundary.controls.some((control) => control.type === 'CloseStream'),
      false,
    );
    assert.equal(clock.activeTimerCount, 0);
  });
});
