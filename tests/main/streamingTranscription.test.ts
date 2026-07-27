/* eslint-disable max-classes-per-file -- Stateful provider, cache, and deferred fakes belong to this service harness. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TranscriptionResult, VoiceProviderInfo } from '@main/providers/BaseVoiceProvider';
import { ClaudeWebVoiceProvider } from '@main/providers/ClaudeWebVoiceProvider';
import { CLAUDE_WEB_PCM_CHUNK_BYTES } from '@main/providers/claudeWebAudio';
import { resolveStreamingVoiceProviderCapability } from '@main/providers/streamingVoiceProviderCapability';
import {
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  StreamingVoiceProvider,
  copyStreamingTranscriptionChunk,
  type CancelStreamingTranscriptionInput,
  type FinishStreamingTranscriptionInput,
  type PushStreamingTranscriptionChunkInput,
  type StartStreamingTranscriptionInput,
  type StreamingTranscriptionCancellation,
  type StreamingTranscriptionChunkAccepted,
  type StreamingTranscriptionOperationId,
  type StreamingTranscriptionResult,
  type StreamingTranscriptionStarted,
  type StreamingVoiceProviderOperations,
} from '@main/providers/streamingVoiceProvider';
import { StreamingTranscriptionOperationError } from '@main/providers/StreamingTranscriptionOperationError';
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';
import { RecordingVoiceProviderAudit, getTerminalEvents } from './providers/voiceAuditTestUtils';
import { RecordingTranscriptionHistoryRepository } from './repositories/recordingTranscriptionHistoryRepository';
import {
  MainStreamingTranscriptionRejection,
  StreamingTranscriptionService,
  createStreamingTranscriptionOwnerToken,
  type MainStreamingTranscriptionServiceDependencies,
  type StreamingTranscriptionDiagnostic,
  type StreamingTranscriptionDiagnosticOutcome,
} from '@main/services/streamingTranscription';
import { createTranscriptionResultCacheKey } from '@main/services/transcriptionResultCache';
import type { TextActionResultCache } from '@main/services/textActionCache';
import { CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';
import { WAV_TRANSCRIPTION_MIME_TYPE } from '@shared/transcriptionConstants';

function asOperationId(value: string): StreamingTranscriptionOperationId {
  return value as StreamingTranscriptionOperationId;
}

function createStreamingError(code: StreamingTranscriptionErrorCode) {
  if (code === StreamingTranscriptionErrorCode.Cancelled) {
    return { lifecycle: StreamingTranscriptionLifecycle.Cancelled, code } as const;
  }
  return { lifecycle: StreamingTranscriptionLifecycle.Failed, code } as const;
}

class Deferred<T> {
  readonly promise: Promise<T>;
  private resolvePromise: ((value: T) => void) | null = null;
  private rejectPromise: ((error: unknown) => void) | null = null;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
  }

  resolve(value: T): void {
    this.resolvePromise?.(value);
  }

  reject(error: unknown): void {
    this.rejectPromise?.(error);
  }
}

class TestStreamingProvider extends StreamingVoiceProvider implements StreamingVoiceProviderOperations {
  readonly info = {
    id: CLAUDE_WEB_PROVIDER_ID,
    name: 'Claude Web Test',
    authType: 'browserSession',
    category: 'web',
    hasSettings: true,
    transcriptionMode: 'streaming',
  } satisfies VoiceProviderInfo;

  ready = true;
  cacheContext: readonly string[] = ['language', 'en-US'];
  transcribeCalls = 0;
  readonly startCalls: StartStreamingTranscriptionInput[] = [];
  readonly pushCalls: Array<Omit<PushStreamingTranscriptionChunkInput, 'chunk'> & { chunk: Uint8Array }> = [];
  readonly finishCalls: Array<Omit<FinishStreamingTranscriptionInput, 'finalChunk'> & { finalChunk: Uint8Array }> = [];
  readonly cancelCalls: CancelStreamingTranscriptionInput[] = [];
  startHandler: (input: StartStreamingTranscriptionInput) => Promise<StreamingTranscriptionStarted> = async (
    input,
  ) => ({
    operationId: input.operationId,
    lifecycle: StreamingTranscriptionLifecycle.Starting,
  });
  pushHandler: (input: PushStreamingTranscriptionChunkInput) => Promise<StreamingTranscriptionChunkAccepted> = async (
    input,
  ) => ({
    operationId: input.operationId,
    lifecycle: StreamingTranscriptionLifecycle.Streaming,
    acceptedSequence: input.sequence,
  });
  finishHandler: (input: FinishStreamingTranscriptionInput) => Promise<StreamingTranscriptionResult> = async (
    input,
  ) => ({
    success: true,
    operationId: input.operationId,
    lifecycle: StreamingTranscriptionLifecycle.Completed,
    text: 'streamed text',
  });
  cancelHandler: (input: CancelStreamingTranscriptionInput) => Promise<void> = async () => undefined;

  clearSession(): void {}

  hasSession(): boolean {
    return this.ready;
  }

  isReady(): boolean {
    return this.ready;
  }

  getTranscriptionCacheContext(): readonly string[] {
    return this.cacheContext;
  }

  async transcribe(): Promise<TranscriptionResult> {
    this.transcribeCalls += 1;
    return { success: true, text: 'batch text' };
  }

  async startStreamingTranscription(input: StartStreamingTranscriptionInput): Promise<StreamingTranscriptionStarted> {
    this.startCalls.push(input);
    return this.startHandler(input);
  }

  async pushStreamingTranscriptionChunk(
    input: PushStreamingTranscriptionChunkInput,
  ): Promise<StreamingTranscriptionChunkAccepted> {
    this.pushCalls.push({ ...input, chunk: Uint8Array.from(input.chunk) });
    return this.pushHandler(input);
  }

  async finishStreamingTranscription(input: FinishStreamingTranscriptionInput): Promise<StreamingTranscriptionResult> {
    this.finishCalls.push({ ...input, finalChunk: Uint8Array.from(input.finalChunk) });
    return this.finishHandler(input);
  }

  async cancelStreamingTranscription(
    input: CancelStreamingTranscriptionInput,
  ): Promise<StreamingTranscriptionCancellation> {
    this.cancelCalls.push(input);
    await this.cancelHandler(input);
    return {
      operationId: input.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Cancelled,
    };
  }
}

class TestCache implements TextActionResultCache {
  readonly values = new Map<string, string>();
  setCalls = 0;

  constructor(private readonly onSet: () => void = () => undefined) {}

  clear(): void {
    this.values.clear();
  }

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.onSet();
    this.setCalls += 1;
    this.values.set(key, value);
  }

  size(): number {
    return this.values.size;
  }
}

interface DiagnosticRecord {
  outcome: StreamingTranscriptionDiagnosticOutcome;
  diagnostic: StreamingTranscriptionDiagnostic;
}

function createPcm16Wav(pcm: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  bytes.set(pcm, 44);
  return buffer;
}

function combineBytes(...chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function createHarness(overrides: Partial<MainStreamingTranscriptionServiceDependencies> = {}) {
  const audit = new RecordingVoiceProviderAudit();
  const provider = new TestStreamingProvider();
  let activeProvider: TestStreamingProvider | null = provider;
  let monotonicTimeMs = 1_000;
  const operationId = asOperationId('11111111-2222-4333-8444-000000000004');
  const cache = new TestCache();
  const clipboard: string[] = [];
  const historyRepository = new RecordingTranscriptionHistoryRepository();
  const diagnostics: DiagnosticRecord[] = [];
  const deps: MainStreamingTranscriptionServiceDependencies = {
    audit,
    cache,
    createOperationId: () => operationId,
    getActiveProvider: () => activeProvider,
    getMonotonicTimeMs: () => monotonicTimeMs,
    getRequestedAt: () => '2026-07-18T12:00:00.000Z',
    historyRepository,
    reportDiagnostic: (outcome, diagnostic) => diagnostics.push({ outcome, diagnostic }),
    resolveCapability: (candidate) =>
      candidate === provider
        ? {
            provider,
            operations: provider,
          }
        : null,
    writeClipboardText: (text) => clipboard.push(text),
    ...overrides,
  };
  const service = new StreamingTranscriptionService(deps);

  return {
    audit,
    cache,
    clipboard,
    diagnostics,
    history: historyRepository.addedEntries,
    operationId,
    provider,
    service,
    setActiveProvider: (value: TestStreamingProvider | null) => {
      activeProvider = value;
    },
    setMonotonicTimeMs: (value: number) => {
      monotonicTimeMs = value;
    },
  };
}

async function assertServiceRejection(
  promise: Promise<unknown>,
  code: StreamingTranscriptionErrorCode,
  retryEligible = false,
): Promise<void> {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof MainStreamingTranscriptionRejection &&
      error.error.code === code &&
      error.retryEligible === retryEligible,
  );
}

describe('streaming provider capability resolver', () => {
  it('resolves only the nominal Claude Web provider, not matching metadata or duck typing', () => {
    const claude = new ClaudeWebVoiceProvider();
    const lookalike = new TestStreamingProvider();

    assert.deepEqual(resolveStreamingVoiceProviderCapability(claude), {
      provider: claude,
      operations: claude,
    });
    assert.equal(resolveStreamingVoiceProviderCapability(lookalike), null);
    assert.equal(resolveStreamingVoiceProviderCapability(null), null);
  });
});

describe('main streaming transcription service', () => {
  it('checks readiness and capability before creating an operation ID', async () => {
    let idCalls = 0;
    const harness = createHarness({
      createOperationId: () => {
        idCalls += 1;
        return asOperationId('generated');
      },
      resolveCapability: () => null,
    });
    const owner = createStreamingTranscriptionOwnerToken();

    await assertServiceRejection(harness.service.start({ owner }), StreamingTranscriptionErrorCode.InvalidOperation);
    assert.equal(idCalls, 0);

    harness.provider.ready = false;
    await assertServiceRejection(harness.service.start({ owner }), StreamingTranscriptionErrorCode.InvalidOperation);
    assert.equal(idCalls, 0);
  });

  it('uses fresh internal IDs for standalone rejections and keeps sink arguments metadata-only', async () => {
    const serializedEvents: string[] = [];
    const internalRejectionId = '99999999-8888-4777-8666-000000000004';
    const audit = new VoiceProviderAudit({
      getSink: () => ({
        error: (_label, serialized) => serializedEvents.push(serialized as string),
        info: (_label, serialized) => serializedEvents.push(serialized as string),
        warn: (_label, serialized) => serializedEvents.push(serialized as string),
      }),
      now: () => new Date('2026-07-26T00:00:00.000Z'),
      randomUUID: () => internalRejectionId,
    });
    const harness = createHarness({ audit });
    const rendererCandidate = asOperationId('renderer-candidate https://private.invalid?token=private');
    const owner = createStreamingTranscriptionOwnerToken();

    assert.deepEqual(
      await harness.service.finish({
        owner,
        operationId: rendererCandidate,
        sequence: 0,
        finalChunk: Uint8Array.of(31, 41),
        recordingWav: createPcm16Wav(Uint8Array.of(31, 41)),
      }),
      {
        success: false,
        error: createStreamingError(StreamingTranscriptionErrorCode.InvalidOperation),
        retryEligible: false,
      },
    );

    const records = serializedEvents.map((serialized) => JSON.parse(serialized) as Record<string, unknown>);
    assert.equal(records.length, 3);
    assert.equal(
      records.every((record) => record.operationId === internalRejectionId),
      true,
    );
    assert.equal(
      records.every((record) => record.providerId === CLAUDE_WEB_PROVIDER_ID),
      true,
    );
    assert.equal(serializedEvents.join('').includes(rendererCandidate), false);
    assert.deepEqual(records[records.length - 1], {
      schemaVersion: 1,
      occurredAt: '2026-07-26T00:00:00.000Z',
      family: 'voice',
      providerId: 'claude-web',
      operation: 'transcribe-stream',
      operationId: internalRejectionId,
      sequence: 3,
      event: 'terminal',
      phase: 'validation',
      outcome: 'failure',
      acceptedByteCount: 0,
      chunkCount: 0,
      durationMs: records[records.length - 1]?.durationMs,
      frameCount: 0,
      causeCode: 'invalid-operation',
      errorClass: 'provider-rejection',
      transcriptionMode: 'streaming',
    });

    const exceptionCanary =
      'private session organization account https://private.invalid/query provider-payload message stack-private';
    harness.provider.cacheContext = [exceptionCanary];
    harness.provider.pushHandler = async () => {
      throw new TypeError(exceptionCanary);
    };
    await harness.service.start({ owner });
    await assertServiceRejection(
      harness.service.sendChunk({
        owner,
        operationId: harness.operationId,
        sequence: 0,
        chunk: Uint8Array.of(31, 41),
      }),
      StreamingTranscriptionErrorCode.TransportFailure,
      true,
    );
    assert.equal(serializedEvents.join('').includes(exceptionCanary), false);
    assert.equal(serializedEvents.join('').includes('31,41'), false);
  });

  it('keeps provider behavior fail-open when every audit sink invocation throws', async () => {
    const privacyCanary = 'private sink https://private.invalid stack-private';
    const audit = new VoiceProviderAudit({
      getSink: () => ({
        error: () => {
          throw new Error(privacyCanary);
        },
        info: () => {
          throw new Error(privacyCanary);
        },
        warn: () => {
          throw new Error(privacyCanary);
        },
      }),
    });
    const harness = createHarness({ audit });
    const owner = createStreamingTranscriptionOwnerToken();
    const finalChunk = Uint8Array.of(1, 0);

    assert.deepEqual(await harness.service.start({ owner }), {
      operationId: harness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    assert.deepEqual(
      await harness.service.finish({
        owner,
        operationId: harness.operationId,
        sequence: 0,
        finalChunk,
        recordingWav: createPcm16Wav(finalChunk),
      }),
      {
        success: true,
        lifecycle: StreamingTranscriptionLifecycle.Completed,
        text: 'streamed text',
      },
    );
  });

  it('claims the operation before provider start and returns the injected opaque ID', async () => {
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    const otherOwner = createStreamingTranscriptionOwnerToken();
    const startDeferred = new Deferred<StreamingTranscriptionStarted>();
    harness.provider.startHandler = () => startDeferred.promise;

    const start = harness.service.start({ owner });
    await assertServiceRejection(
      harness.service.start({ owner: otherOwner }),
      StreamingTranscriptionErrorCode.OperationConflict,
    );
    startDeferred.resolve({
      operationId: harness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });

    assert.deepEqual(await start, {
      operationId: harness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    assert.equal(harness.provider.startCalls.length, 1);
    assert.equal(getTerminalEvents(harness.audit.operations[0]).length, 0);
    assert.equal(
      getTerminalEvents(harness.audit.operations[1])[0]?.metadata?.causeCode,
      StreamingTranscriptionErrorCode.OperationConflict,
    );
  });

  it('maps provider startup failure and a provider switch during startup without retaining the operation', async () => {
    const failed = createHarness();
    const failedOwner = createStreamingTranscriptionOwnerToken();
    failed.provider.startHandler = async () => {
      throw new StreamingTranscriptionOperationError(
        createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
      );
    };
    await assertServiceRejection(
      failed.service.start({ owner: failedOwner }),
      StreamingTranscriptionErrorCode.TransportFailure,
    );
    assert.equal(failed.provider.cancelCalls.length, 1);
    failed.provider.startHandler = async (input) => ({
      operationId: input.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    await failed.service.start({ owner: failedOwner });

    const switched = createHarness();
    const switchedOwner = createStreamingTranscriptionOwnerToken();
    const startDeferred = new Deferred<StreamingTranscriptionStarted>();
    switched.provider.startHandler = () => startDeferred.promise;
    const starting = switched.service.start({ owner: switchedOwner });
    switched.setActiveProvider(new TestStreamingProvider());
    startDeferred.resolve({
      operationId: switched.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    await assertServiceRejection(starting, StreamingTranscriptionErrorCode.ProviderChanged);
    assert.equal(switched.provider.cancelCalls.length, 1);
    assert.equal(
      getTerminalEvents(failed.audit.operations[0])[0]?.metadata?.causeCode,
      StreamingTranscriptionErrorCode.TransportFailure,
    );
    assert.equal(
      getTerminalEvents(switched.audit.operations[0])[0]?.metadata?.causeCode,
      StreamingTranscriptionErrorCode.ProviderChanged,
    );
  });

  it('does not let wrong owners or unknown IDs mutate another operation', async () => {
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    const wrongOwner = createStreamingTranscriptionOwnerToken();
    await harness.service.start({ owner });

    await assertServiceRejection(
      harness.service.sendChunk({
        owner: wrongOwner,
        operationId: harness.operationId,
        sequence: 0,
        chunk: Uint8Array.of(1, 0),
      }),
      StreamingTranscriptionErrorCode.InvalidOperation,
    );
    await harness.service.cancel({ owner: wrongOwner, operationId: harness.operationId });
    await harness.service.cancel({ owner, operationId: asOperationId('unknown') });
    const wrongFinish = await harness.service.finish({
      owner: wrongOwner,
      operationId: harness.operationId,
      sequence: 0,
      finalChunk: Uint8Array.of(1, 0),
      recordingWav: createPcm16Wav(Uint8Array.of(1, 0)),
    });
    assert.deepEqual(wrongFinish, {
      success: false,
      error: createStreamingError(StreamingTranscriptionErrorCode.InvalidOperation),
      retryEligible: false,
    });
    assert.equal(harness.provider.cancelCalls.length, 0);

    const accepted = await harness.service.sendChunk({
      owner,
      operationId: harness.operationId,
      sequence: 0,
      chunk: Uint8Array.of(1, 0),
    });
    assert.equal(accepted.acceptedSequence, 0);
  });

  it('terminates exact-sequence violations, including negative, fractional, skipped, and replayed values', async () => {
    const cases = [-1, 0.5, 1];
    for (const sequence of cases) {
      const harness = createHarness();
      const owner = createStreamingTranscriptionOwnerToken();
      await harness.service.start({ owner });
      await assertServiceRejection(
        harness.service.sendChunk({
          owner,
          operationId: harness.operationId,
          sequence,
          chunk: Uint8Array.of(1, 0),
        }),
        StreamingTranscriptionErrorCode.InvalidSequence,
      );
      assert.equal(harness.provider.pushCalls.length, 0);
      assert.equal(harness.provider.cancelCalls.length, 1);
      assert.deepEqual(
        getTerminalEvents(harness.audit.operations[0]).map((event) => event.metadata?.causeCode),
        [StreamingTranscriptionErrorCode.InvalidSequence],
      );
    }

    const replay = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    await replay.service.start({ owner });
    await replay.service.sendChunk({
      owner,
      operationId: replay.operationId,
      sequence: 0,
      chunk: Uint8Array.of(1, 0),
    });
    await assertServiceRejection(
      replay.service.sendChunk({
        owner,
        operationId: replay.operationId,
        sequence: 0,
        chunk: Uint8Array.of(2, 0),
      }),
      StreamingTranscriptionErrorCode.InvalidSequence,
      true,
    );
    assert.equal(replay.provider.cancelCalls.length, 1);
    assert.equal(
      getTerminalEvents(replay.audit.operations[0])[0]?.metadata?.acceptedByteCount,
      Uint8Array.of(1, 0).byteLength,
    );
  });

  it('terminates empty, odd, oversized, and non-Uint8Array normal chunks before provider use', async () => {
    const cases: unknown[] = [
      new Uint8Array(),
      Uint8Array.of(1),
      new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES + 2),
      new ArrayBuffer(2),
    ];
    for (const chunk of cases) {
      const harness = createHarness();
      const owner = createStreamingTranscriptionOwnerToken();
      await harness.service.start({ owner });
      await assertServiceRejection(
        harness.service.sendChunk({
          owner,
          operationId: harness.operationId,
          sequence: 0,
          chunk,
        }),
        StreamingTranscriptionErrorCode.InvalidChunk,
      );
      assert.equal(harness.provider.pushCalls.length, 0);
      assert.equal(harness.provider.cancelCalls.length, 1);
      assert.deepEqual(
        getTerminalEvents(harness.audit.operations[0]).map((event) => event.metadata?.causeCode),
        [StreamingTranscriptionErrorCode.InvalidChunk],
      );
    }

    const afterAudio = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    await afterAudio.service.start({ owner });
    await afterAudio.service.sendChunk({
      owner,
      operationId: afterAudio.operationId,
      sequence: 0,
      chunk: Uint8Array.of(1, 0),
    });
    await assertServiceRejection(
      afterAudio.service.sendChunk({
        owner,
        operationId: afterAudio.operationId,
        sequence: 1,
        chunk: Uint8Array.of(1),
      }),
      StreamingTranscriptionErrorCode.InvalidChunk,
      true,
    );
  });

  it('accepts and copies a maximum-sized frame before awaiting the provider', async () => {
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    const pushDeferred = new Deferred<StreamingTranscriptionChunkAccepted>();
    harness.provider.pushHandler = () => pushDeferred.promise;
    await harness.service.start({ owner });
    const source = new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES);
    source[0] = 7;

    const sending = harness.service.sendChunk({
      owner,
      operationId: harness.operationId,
      sequence: 0,
      chunk: source,
    });
    source[0] = 99;
    pushDeferred.resolve({
      operationId: harness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Streaming,
      acceptedSequence: 0,
    });

    assert.equal((await sending).acceptedSequence, 0);
    assert.equal(harness.provider.pushCalls[0].chunk[0], 7);
  });

  it('validates the canonical WAV and completes cache, clipboard, and history exactly once from start snapshots', async () => {
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    const chunk = Uint8Array.of(1, 0, 2, 0);
    const finalChunk = Uint8Array.of(3, 0);
    const pcm = combineBytes(chunk, finalChunk);
    await harness.service.start({ owner });
    await harness.service.sendChunk({ owner, operationId: harness.operationId, sequence: 0, chunk });
    harness.provider.cacheContext = ['language', 'fr-FR'];
    harness.setMonotonicTimeMs(1_125);

    const result = await harness.service.finish({
      owner,
      operationId: harness.operationId,
      sequence: 1,
      finalChunk,
      recordingWav: createPcm16Wav(pcm),
    });

    assert.deepEqual(result, {
      success: true,
      lifecycle: StreamingTranscriptionLifecycle.Completed,
      text: 'streamed text',
    });
    assert.equal(harness.cache.setCalls, 1);
    assert.deepEqual(harness.clipboard, ['streamed text']);
    assert.deepEqual(harness.history, [
      {
        requestedAt: '2026-07-18T12:00:00.000Z',
        providerId: CLAUDE_WEB_PROVIDER_ID,
        providerName: 'Claude Web Test',
        text: 'streamed text',
      },
    ]);
    const oldKey = createTranscriptionResultCacheKey({
      audio: createPcm16Wav(pcm),
      mimeType: WAV_TRANSCRIPTION_MIME_TYPE,
      providerContext: ['language', 'en-US'],
      providerId: CLAUDE_WEB_PROVIDER_ID,
    });
    const newKey = createTranscriptionResultCacheKey({
      audio: createPcm16Wav(pcm),
      mimeType: WAV_TRANSCRIPTION_MIME_TYPE,
      providerContext: harness.provider.cacheContext,
      providerId: CLAUDE_WEB_PROVIDER_ID,
    });
    assert.equal(harness.cache.get(oldKey), 'streamed text');
    assert.equal(harness.cache.get(newKey), null);
    assert.deepEqual(harness.diagnostics, [
      {
        outcome: 'completed',
        diagnostic: {
          acceptedByteCount: pcm.byteLength,
          acceptedFrameCount: 1,
          durationMs: 125,
          retryEligible: false,
        },
      },
    ]);
    assert.equal(harness.audit.operations.length, 1);
    const auditOperation = harness.audit.operations[0];
    assert.equal(auditOperation.input.operation, 'transcribe-stream');
    assert.equal(auditOperation.input.operationId, harness.operationId);
    assert.deepEqual(
      auditOperation.events.map((event) => [event.event, event.phase]),
      [
        ['started', 'dispatch'],
        ['phase-entered', 'dispatch'],
        ['phase-entered', 'streaming'],
        ['phase-completed', 'streaming'],
        ['phase-entered', 'result'],
        ['phase-completed', 'result'],
        ['phase-entered', 'cleanup'],
        ['phase-completed', 'cleanup'],
        ['terminal', 'cleanup'],
      ],
    );
    assert.deepEqual(getTerminalEvents(auditOperation), [
      {
        event: 'terminal',
        phase: 'cleanup',
        outcome: 'success',
        metadata: {
          acceptedByteCount: pcm.byteLength,
          chunkCount: 2,
          durationMs: getTerminalEvents(auditOperation)[0]?.metadata?.durationMs,
          frameCount: 0,
          resultLength: 'streamed text'.length,
          transcriptionMode: 'streaming',
        },
      },
    ]);

    const duplicate = await harness.service.finish({
      owner,
      operationId: harness.operationId,
      sequence: 1,
      finalChunk,
      recordingWav: createPcm16Wav(pcm),
    });
    assert.equal(duplicate.success, false);
    assert.equal(harness.cache.setCalls, 1);
    assert.equal(harness.clipboard.length, 1);
    assert.equal(harness.history.length, 1);
    assert.equal(harness.provider.transcribeCalls, 0);
    assert.equal(getTerminalEvents(auditOperation).length, 1);
  });

  it('terminates the provider lifecycle before cache, clipboard, and history side effects', async () => {
    const audit = new RecordingVoiceProviderAudit();
    const observedTerminalCounts: number[] = [];
    const cache = new TestCache(() => {
      observedTerminalCounts.push(getTerminalEvents(audit.operations[0]).length);
    });
    const harness = createHarness({
      audit,
      cache,
      historyRepository: new RecordingTranscriptionHistoryRepository(() => {
        observedTerminalCounts.push(getTerminalEvents(audit.operations[0]).length);
      }),
      writeClipboardText: () => {
        observedTerminalCounts.push(getTerminalEvents(audit.operations[0]).length);
      },
    });
    const owner = createStreamingTranscriptionOwnerToken();
    const finalChunk = Uint8Array.of(1, 0);
    await harness.service.start({ owner });

    assert.equal(
      (
        await harness.service.finish({
          owner,
          operationId: harness.operationId,
          sequence: 0,
          finalChunk,
          recordingWav: createPcm16Wav(finalChunk),
        })
      ).success,
      true,
    );
    assert.deepEqual(observedTerminalCounts, [1, 1, 1]);
  });

  it('supports final-only audio and an empty final fragment after streamed audio', async () => {
    const finalOnly = createHarness();
    const finalOwner = createStreamingTranscriptionOwnerToken();
    const finalChunk = Uint8Array.of(4, 0, 5, 0);
    await finalOnly.service.start({ owner: finalOwner });
    assert.equal(
      (
        await finalOnly.service.finish({
          owner: finalOwner,
          operationId: finalOnly.operationId,
          sequence: 0,
          finalChunk,
          recordingWav: createPcm16Wav(finalChunk),
        })
      ).success,
      true,
    );

    const streamed = createHarness();
    const streamedOwner = createStreamingTranscriptionOwnerToken();
    const chunk = Uint8Array.of(6, 0);
    await streamed.service.start({ owner: streamedOwner });
    await streamed.service.sendChunk({
      owner: streamedOwner,
      operationId: streamed.operationId,
      sequence: 0,
      chunk,
    });
    assert.equal(
      (
        await streamed.service.finish({
          owner: streamedOwner,
          operationId: streamed.operationId,
          sequence: 1,
          finalChunk: new Uint8Array(),
          recordingWav: createPcm16Wav(chunk),
        })
      ).success,
      true,
    );
  });

  it('keeps audit volume independent of chunk count and records exact aggregate counters', async () => {
    const minimal = createHarness();
    const minimalOwner = createStreamingTranscriptionOwnerToken();
    const minimalFinalChunk = Uint8Array.of(1, 0);
    await minimal.service.start({ owner: minimalOwner });
    assert.equal(
      (
        await minimal.service.finish({
          owner: minimalOwner,
          operationId: minimal.operationId,
          sequence: 0,
          finalChunk: minimalFinalChunk,
          recordingWav: createPcm16Wav(minimalFinalChunk),
        })
      ).success,
      true,
    );

    const many = createHarness();
    const manyOwner = createStreamingTranscriptionOwnerToken();
    const fullChunks = [
      new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES),
      new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES),
      new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES),
    ];
    const finalFragment = Uint8Array.of(7, 0);
    await many.service.start({ owner: manyOwner });
    for (const [sequence, chunk] of fullChunks.entries()) {
      await many.service.sendChunk({
        owner: manyOwner,
        operationId: many.operationId,
        sequence,
        chunk,
      });
    }
    assert.equal(
      (
        await many.service.finish({
          owner: manyOwner,
          operationId: many.operationId,
          sequence: fullChunks.length,
          finalChunk: finalFragment,
          recordingWav: createPcm16Wav(combineBytes(...fullChunks, finalFragment)),
        })
      ).success,
      true,
    );

    assert.equal(many.audit.operations[0].events.length, minimal.audit.operations[0].events.length);
    assert.deepEqual(getTerminalEvents(many.audit.operations[0])[0]?.metadata, {
      acceptedByteCount: CLAUDE_WEB_PCM_CHUNK_BYTES * fullChunks.length + finalFragment.byteLength,
      chunkCount: fullChunks.length + 1,
      durationMs: getTerminalEvents(many.audit.operations[0])[0]?.metadata?.durationMs,
      frameCount: fullChunks.length,
      resultLength: 'streamed text'.length,
      transcriptionMode: 'streaming',
    });
  });

  it('terminates invalid finish sequences and final-fragment boundaries before provider finish', async () => {
    const cases: Array<{ sequence: number; finalChunk: unknown; expected: StreamingTranscriptionErrorCode }> = [
      { sequence: -1, finalChunk: Uint8Array.of(1, 0), expected: StreamingTranscriptionErrorCode.InvalidSequence },
      { sequence: 0.5, finalChunk: Uint8Array.of(1, 0), expected: StreamingTranscriptionErrorCode.InvalidSequence },
      { sequence: 1, finalChunk: Uint8Array.of(1, 0), expected: StreamingTranscriptionErrorCode.InvalidSequence },
      { sequence: 0, finalChunk: Uint8Array.of(1), expected: StreamingTranscriptionErrorCode.InvalidChunk },
      {
        sequence: 0,
        finalChunk: new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES + 2),
        expected: StreamingTranscriptionErrorCode.InvalidChunk,
      },
      { sequence: 0, finalChunk: new ArrayBuffer(2), expected: StreamingTranscriptionErrorCode.InvalidChunk },
    ];

    for (const { sequence, finalChunk, expected } of cases) {
      const harness = createHarness();
      const owner = createStreamingTranscriptionOwnerToken();
      await harness.service.start({ owner });
      const result = await harness.service.finish({
        owner,
        operationId: harness.operationId,
        sequence,
        finalChunk,
        recordingWav: createPcm16Wav(Uint8Array.of(1, 0)),
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.code, expected);
        assert.equal(result.retryEligible, false);
      }
      assert.equal(harness.provider.finishCalls.length, 0);
      assert.equal(harness.provider.cancelCalls.length, 1);
    }

    const afterAudio = createHarness();
    const afterAudioOwner = createStreamingTranscriptionOwnerToken();
    const acceptedChunk = Uint8Array.of(1, 0);
    await afterAudio.service.start({ owner: afterAudioOwner });
    await afterAudio.service.sendChunk({
      owner: afterAudioOwner,
      operationId: afterAudio.operationId,
      sequence: 0,
      chunk: acceptedChunk,
    });
    const invalidFinal = await afterAudio.service.finish({
      owner: afterAudioOwner,
      operationId: afterAudio.operationId,
      sequence: 1,
      finalChunk: Uint8Array.of(1),
      recordingWav: createPcm16Wav(acceptedChunk),
    });
    assert.deepEqual(invalidFinal, {
      success: false,
      error: createStreamingError(StreamingTranscriptionErrorCode.InvalidChunk),
      retryEligible: true,
    });

    const maximum = createHarness();
    const maximumOwner = createStreamingTranscriptionOwnerToken();
    const maximumFinal = new Uint8Array(CLAUDE_WEB_PCM_CHUNK_BYTES);
    await maximum.service.start({ owner: maximumOwner });
    assert.equal(
      (
        await maximum.service.finish({
          owner: maximumOwner,
          operationId: maximum.operationId,
          sequence: 0,
          finalChunk: maximumFinal,
          recordingWav: createPcm16Wav(maximumFinal),
        })
      ).success,
      true,
    );
  });

  it('rejects malformed, mismatched, missing, and extra WAV PCM without provider finish or retry eligibility', async () => {
    const cases = [
      new ArrayBuffer(4),
      createPcm16Wav(Uint8Array.of(9, 0)),
      createPcm16Wav(Uint8Array.of(1, 0)),
      createPcm16Wav(Uint8Array.of(1, 0, 2, 0, 3, 0)),
    ];
    for (const recordingWav of cases) {
      const harness = createHarness();
      const owner = createStreamingTranscriptionOwnerToken();
      const chunk = Uint8Array.of(1, 0, 2, 0);
      await harness.service.start({ owner });
      await harness.service.sendChunk({ owner, operationId: harness.operationId, sequence: 0, chunk });

      const result = await harness.service.finish({
        owner,
        operationId: harness.operationId,
        sequence: 1,
        finalChunk: new Uint8Array(),
        recordingWav,
      });
      assert.deepEqual(result, {
        success: false,
        error: createStreamingError(StreamingTranscriptionErrorCode.InvalidAudio),
        retryEligible: false,
      });
      assert.equal(harness.provider.finishCalls.length, 0);
      assert.equal(harness.provider.cancelCalls.length, 1);
      assert.equal(harness.cache.setCalls, 0);
      assert.equal(harness.clipboard.length, 0);
      assert.equal(harness.history.length, 0);
      const terminal = getTerminalEvents(harness.audit.operations[0]);
      assert.equal(terminal.length, 1);
      assert.equal(terminal[0]?.metadata?.causeCode, StreamingTranscriptionErrorCode.InvalidAudio);
      assert.equal(terminal[0]?.metadata?.acceptedByteCount, chunk.byteLength);
      assert.equal(terminal[0]?.metadata?.chunkCount, 1);
    }
  });

  it('makes duplicate finish and late push fail without disturbing a claimed finish', async () => {
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    const finishDeferred = new Deferred<StreamingTranscriptionResult>();
    harness.provider.finishHandler = () => finishDeferred.promise;
    const finalChunk = Uint8Array.of(1, 0);
    const recordingWav = createPcm16Wav(finalChunk);
    await harness.service.start({ owner });

    const finishing = harness.service.finish({
      owner,
      operationId: harness.operationId,
      sequence: 0,
      finalChunk,
      recordingWav,
    });
    finalChunk[0] = 9;
    new Uint8Array(recordingWav)[44] = 9;
    const duplicate = await harness.service.finish({
      owner,
      operationId: harness.operationId,
      sequence: 0,
      finalChunk,
      recordingWav: createPcm16Wav(finalChunk),
    });
    assert.deepEqual(duplicate, {
      success: false,
      error: createStreamingError(StreamingTranscriptionErrorCode.OperationConflict),
      retryEligible: false,
    });
    await assertServiceRejection(
      harness.service.sendChunk({
        owner,
        operationId: harness.operationId,
        sequence: 0,
        chunk: Uint8Array.of(2, 0),
      }),
      StreamingTranscriptionErrorCode.OperationConflict,
    );
    finishDeferred.resolve({
      success: true,
      operationId: harness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Completed,
      text: 'streamed text',
    });

    assert.equal((await finishing).success, true);
    assert.equal(harness.cache.setCalls, 1);
    assert.equal(harness.clipboard.length, 1);
    assert.equal(harness.history.length, 1);
    assert.deepEqual(harness.provider.finishCalls[0].finalChunk, Uint8Array.of(1, 0));
  });

  it('detects provider switches while push and finish calls are pending', async () => {
    const pushingHarness = createHarness();
    const pushingOwner = createStreamingTranscriptionOwnerToken();
    const pushDeferred = new Deferred<StreamingTranscriptionChunkAccepted>();
    pushingHarness.provider.pushHandler = () => pushDeferred.promise;
    await pushingHarness.service.start({ owner: pushingOwner });
    const pushing = pushingHarness.service.sendChunk({
      owner: pushingOwner,
      operationId: pushingHarness.operationId,
      sequence: 0,
      chunk: Uint8Array.of(1, 0),
    });
    pushingHarness.setActiveProvider(new TestStreamingProvider());
    pushDeferred.resolve({
      operationId: pushingHarness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Streaming,
      acceptedSequence: 0,
    });
    await assertServiceRejection(pushing, StreamingTranscriptionErrorCode.ProviderChanged, true);

    const finishingHarness = createHarness();
    const finishingOwner = createStreamingTranscriptionOwnerToken();
    const finishDeferred = new Deferred<StreamingTranscriptionResult>();
    const finalChunk = Uint8Array.of(1, 0);
    finishingHarness.provider.finishHandler = () => finishDeferred.promise;
    await finishingHarness.service.start({ owner: finishingOwner });
    const finishing = finishingHarness.service.finish({
      owner: finishingOwner,
      operationId: finishingHarness.operationId,
      sequence: 0,
      finalChunk,
      recordingWav: createPcm16Wav(finalChunk),
    });
    finishingHarness.setActiveProvider(new TestStreamingProvider());
    finishDeferred.resolve({
      success: true,
      operationId: finishingHarness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Completed,
      text: 'late text',
    });
    assert.deepEqual(await finishing, {
      success: false,
      error: createStreamingError(StreamingTranscriptionErrorCode.ProviderChanged),
      retryEligible: true,
    });
    assert.equal(finishingHarness.cache.setCalls, 0);
    assert.equal(finishingHarness.clipboard.length, 0);
    assert.equal(finishingHarness.history.length, 0);
  });

  it('cancels safely during provider start, push, and finish and ignores every late completion', async () => {
    const startHarness = createHarness();
    const startOwner = createStreamingTranscriptionOwnerToken();
    const startDeferred = new Deferred<StreamingTranscriptionStarted>();
    startHarness.provider.startHandler = () => startDeferred.promise;
    const starting = startHarness.service.start({ owner: startOwner });
    await startHarness.service.cancel({ owner: startOwner, operationId: startHarness.operationId });
    startDeferred.resolve({
      operationId: startHarness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    await assertServiceRejection(starting, StreamingTranscriptionErrorCode.Cancelled);
    assert.equal(startHarness.provider.cancelCalls.length, 2);

    const pushHarness = createHarness();
    const pushOwner = createStreamingTranscriptionOwnerToken();
    const pushDeferred = new Deferred<StreamingTranscriptionChunkAccepted>();
    pushHarness.provider.pushHandler = () => pushDeferred.promise;
    await pushHarness.service.start({ owner: pushOwner });
    const pushing = pushHarness.service.sendChunk({
      owner: pushOwner,
      operationId: pushHarness.operationId,
      sequence: 0,
      chunk: Uint8Array.of(1, 0),
    });
    await pushHarness.service.cancel({ owner: pushOwner, operationId: pushHarness.operationId });
    pushDeferred.resolve({
      operationId: pushHarness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Streaming,
      acceptedSequence: 0,
    });
    await assertServiceRejection(pushing, StreamingTranscriptionErrorCode.Cancelled);

    const finishHarness = createHarness();
    const finishOwner = createStreamingTranscriptionOwnerToken();
    const finishDeferred = new Deferred<StreamingTranscriptionResult>();
    finishHarness.provider.finishHandler = () => finishDeferred.promise;
    const finalChunk = Uint8Array.of(1, 0);
    await finishHarness.service.start({ owner: finishOwner });
    const finishing = finishHarness.service.finish({
      owner: finishOwner,
      operationId: finishHarness.operationId,
      sequence: 0,
      finalChunk,
      recordingWav: createPcm16Wav(finalChunk),
    });
    await finishHarness.service.cancel({ owner: finishOwner, operationId: finishHarness.operationId });
    finishDeferred.resolve({
      success: true,
      operationId: finishHarness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Completed,
      text: 'late text',
    });
    assert.deepEqual(await finishing, {
      success: false,
      error: createStreamingError(StreamingTranscriptionErrorCode.Cancelled),
      retryEligible: false,
    });
    assert.equal(finishHarness.cache.setCalls, 0);
    assert.equal(finishHarness.clipboard.length, 0);
    assert.equal(finishHarness.history.length, 0);
    for (const audit of [startHarness.audit, pushHarness.audit, finishHarness.audit]) {
      const terminal = getTerminalEvents(audit.operations[0]);
      assert.equal(terminal.length, 1);
      assert.equal(terminal[0]?.outcome, 'cancelled');
      assert.equal(terminal[0]?.metadata?.causeCode, StreamingTranscriptionErrorCode.Cancelled);
      assert.equal(audit.operations[0].events[audit.operations[0].events.length - 1]?.event, 'terminal');
    }
  });

  it('cancels on provider-instance changes and reports retry eligibility only after live audio was attempted', async () => {
    const beforeAudio = createHarness();
    const beforeOwner = createStreamingTranscriptionOwnerToken();
    await beforeAudio.service.start({ owner: beforeOwner });
    beforeAudio.setActiveProvider(new TestStreamingProvider());
    await assertServiceRejection(
      beforeAudio.service.sendChunk({
        owner: beforeOwner,
        operationId: beforeAudio.operationId,
        sequence: 0,
        chunk: Uint8Array.of(1, 0),
      }),
      StreamingTranscriptionErrorCode.ProviderChanged,
    );

    const afterAudio = createHarness();
    const afterOwner = createStreamingTranscriptionOwnerToken();
    const chunk = Uint8Array.of(1, 0);
    await afterAudio.service.start({ owner: afterOwner });
    await afterAudio.service.sendChunk({
      owner: afterOwner,
      operationId: afterAudio.operationId,
      sequence: 0,
      chunk,
    });
    afterAudio.setActiveProvider(new TestStreamingProvider());
    const result = await afterAudio.service.finish({
      owner: afterOwner,
      operationId: afterAudio.operationId,
      sequence: 1,
      finalChunk: new Uint8Array(),
      recordingWav: createPcm16Wav(chunk),
    });
    assert.deepEqual(result, {
      success: false,
      error: createStreamingError(StreamingTranscriptionErrorCode.ProviderChanged),
      retryEligible: true,
    });
    assert.equal(afterAudio.provider.transcribeCalls, 0);
    assert.equal(afterAudio.cache.setCalls, 0);
    assert.equal(afterAudio.clipboard.length, 0);
    assert.equal(afterAudio.history.length, 0);
  });

  it('treats a changed provider ID on the same instance as a provider change', async () => {
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    await harness.service.start({ owner });
    Object.assign(harness.provider.info, { id: 'changed-provider-id' });

    await assertServiceRejection(
      harness.service.sendChunk({
        owner,
        operationId: harness.operationId,
        sequence: 0,
        chunk: Uint8Array.of(1, 0),
      }),
      StreamingTranscriptionErrorCode.ProviderChanged,
    );
    assert.equal(harness.provider.pushCalls.length, 0);
    assert.equal(harness.provider.cancelCalls.length, 1);
  });

  it('maps provider push and finish failures without automatic batch replay', async () => {
    const pushHarness = createHarness();
    const pushOwner = createStreamingTranscriptionOwnerToken();
    pushHarness.provider.pushHandler = async () => {
      throw new StreamingTranscriptionOperationError(
        createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
      );
    };
    await pushHarness.service.start({ owner: pushOwner });
    await assertServiceRejection(
      pushHarness.service.sendChunk({
        owner: pushOwner,
        operationId: pushHarness.operationId,
        sequence: 0,
        chunk: Uint8Array.of(1, 0),
      }),
      StreamingTranscriptionErrorCode.TransportFailure,
      true,
    );
    assert.equal(pushHarness.provider.transcribeCalls, 0);
    assert.deepEqual(
      getTerminalEvents(pushHarness.audit.operations[0]).map((event) => event.metadata?.causeCode),
      [StreamingTranscriptionErrorCode.TransportFailure],
    );

    const finishHarness = createHarness();
    const finishOwner = createStreamingTranscriptionOwnerToken();
    const finalChunk = Uint8Array.of(1, 0);
    finishHarness.provider.finishHandler = async (input) => ({
      auditCauseCode: 'rate-limit',
      success: false,
      operationId: input.operationId,
      error: createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
    });
    await finishHarness.service.start({ owner: finishOwner });
    const result = await finishHarness.service.finish({
      owner: finishOwner,
      operationId: finishHarness.operationId,
      sequence: 0,
      finalChunk,
      recordingWav: createPcm16Wav(finalChunk),
    });
    assert.deepEqual(result, {
      success: false,
      error: createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
      retryEligible: true,
    });
    assert.equal(finishHarness.provider.transcribeCalls, 0);
    assert.equal(finishHarness.cache.setCalls, 0);
    assert.equal(finishHarness.clipboard.length, 0);
    assert.equal(finishHarness.history.length, 0);
    const finishTerminal = getTerminalEvents(finishHarness.audit.operations[0])[0];
    assert.equal(finishTerminal?.metadata?.causeCode, 'rate-limit');
    assert.equal(finishTerminal?.metadata?.errorClass, 'rate-limit');

    const exceptionCanary = 'private exception https://private.invalid session=private stack-private';
    const exceptionHarness = createHarness();
    const exceptionOwner = createStreamingTranscriptionOwnerToken();
    exceptionHarness.provider.pushHandler = async () => {
      throw new TypeError(exceptionCanary);
    };
    await exceptionHarness.service.start({ owner: exceptionOwner });
    await assertServiceRejection(
      exceptionHarness.service.sendChunk({
        owner: exceptionOwner,
        operationId: exceptionHarness.operationId,
        sequence: 0,
        chunk: Uint8Array.of(1, 0),
      }),
      StreamingTranscriptionErrorCode.TransportFailure,
      true,
    );
    const exceptionTerminal = getTerminalEvents(exceptionHarness.audit.operations[0])[0];
    assert.equal(exceptionTerminal?.metadata?.causeCode, StreamingTranscriptionErrorCode.TransportFailure);
    assert.equal(exceptionTerminal?.metadata?.exceptionType, 'TypeError');
    assert.equal(exceptionTerminal?.metadata?.errorClass, 'internal');
    assert.equal(JSON.stringify(exceptionHarness.audit.operations).includes(exceptionCanary), false);
  });

  it('audits malformed provider contracts and empty results with closed error causes', async () => {
    const malformed = createHarness();
    const malformedOwner = createStreamingTranscriptionOwnerToken();
    malformed.provider.startHandler = async () => ({
      operationId: asOperationId('22222222-3333-4444-8555-000000000004'),
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    await assertServiceRejection(
      malformed.service.start({ owner: malformedOwner }),
      StreamingTranscriptionErrorCode.TransportFailure,
    );
    const malformedTerminal = getTerminalEvents(malformed.audit.operations[0])[0];
    assert.equal(malformedTerminal?.metadata?.causeCode, 'provider-contract-changed');
    assert.equal(malformedTerminal?.metadata?.errorClass, 'contract');

    const empty = createHarness();
    const emptyOwner = createStreamingTranscriptionOwnerToken();
    const finalChunk = Uint8Array.of(1, 0);
    empty.provider.finishHandler = async (input) => ({
      success: true,
      operationId: input.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Completed,
      text: '   ',
    });
    await empty.service.start({ owner: emptyOwner });
    assert.deepEqual(
      await empty.service.finish({
        owner: emptyOwner,
        operationId: empty.operationId,
        sequence: 0,
        finalChunk,
        recordingWav: createPcm16Wav(finalChunk),
      }),
      {
        success: false,
        error: createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
        retryEligible: true,
      },
    );
    const emptyTerminal = getTerminalEvents(empty.audit.operations[0])[0];
    assert.equal(emptyTerminal?.metadata?.causeCode, 'empty-result');
    assert.equal(emptyTerminal?.metadata?.errorClass, 'provider-rejection');
  });

  it('makes explicit and lifecycle cancellation idempotent and reusable', async () => {
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    await harness.service.start({ owner });
    await harness.service.cancel({ owner, operationId: harness.operationId });
    await harness.service.cancel({ owner, operationId: harness.operationId });
    assert.equal(harness.provider.cancelCalls.length, 1);

    await harness.service.start({ owner });
    await harness.service.cancelActiveForLifecycle();
    await harness.service.cancelActiveForLifecycle();
    assert.equal(harness.provider.cancelCalls.length, 2);

    await harness.service.start({ owner });
    assert.equal(harness.provider.startCalls.length, 3);
    assert.deepEqual(
      harness.audit.operations.map((operation) =>
        getTerminalEvents(operation).map((event) => [event.outcome, event.metadata?.causeCode]),
      ),
      [
        [['cancelled', StreamingTranscriptionErrorCode.Cancelled]],
        [['cancelled', StreamingTranscriptionErrorCode.Cancelled]],
        [],
      ],
    );
  });

  it('keeps cancellation behavior while auditing cleanup uncertainty as an error', async () => {
    const privacyCanary = 'private cancel exception https://private.invalid stack-private';
    const harness = createHarness();
    const owner = createStreamingTranscriptionOwnerToken();
    harness.provider.cancelHandler = async () => {
      throw new TypeError(privacyCanary);
    };
    await harness.service.start({ owner });

    assert.deepEqual(await harness.service.cancel({ owner, operationId: harness.operationId }), {
      operationId: harness.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Cancelled,
    });
    const terminal = getTerminalEvents(harness.audit.operations[0]);
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0]?.phase, 'cleanup');
    assert.equal(terminal[0]?.outcome, 'failure');
    assert.equal(terminal[0]?.metadata?.causeCode, 'cleanup-failed');
    assert.equal(terminal[0]?.metadata?.exceptionType, 'TypeError');
    assert.equal(terminal[0]?.metadata?.errorClass, 'cleanup');
    assert.equal(JSON.stringify(harness.audit.operations).includes(privacyCanary), false);
  });

  it('emits only privacy-safe diagnostic fields before and after accepted live audio', async () => {
    const before = createHarness();
    const beforeOwner = createStreamingTranscriptionOwnerToken();
    await before.service.start({ owner: beforeOwner });
    await assertServiceRejection(
      before.service.sendChunk({
        owner: beforeOwner,
        operationId: before.operationId,
        sequence: 2,
        chunk: Uint8Array.of(1, 0),
      }),
      StreamingTranscriptionErrorCode.InvalidSequence,
    );
    assert.deepEqual(Object.keys(before.diagnostics[0].diagnostic).sort(), [
      'acceptedByteCount',
      'acceptedFrameCount',
      'durationMs',
      'errorCode',
      'retryEligible',
    ]);
    assert.deepEqual(before.diagnostics[0].diagnostic, {
      acceptedByteCount: 0,
      acceptedFrameCount: 0,
      durationMs: 0,
      errorCode: StreamingTranscriptionErrorCode.InvalidSequence,
      retryEligible: false,
    });

    const after = createHarness();
    const afterOwner = createStreamingTranscriptionOwnerToken();
    await after.service.start({ owner: afterOwner });
    await after.service.sendChunk({
      owner: afterOwner,
      operationId: after.operationId,
      sequence: 0,
      chunk: Uint8Array.of(1, 0),
    });
    after.setMonotonicTimeMs(1_050);
    await assertServiceRejection(
      after.service.sendChunk({
        owner: afterOwner,
        operationId: after.operationId,
        sequence: 0,
        chunk: Uint8Array.of(2, 0),
      }),
      StreamingTranscriptionErrorCode.InvalidSequence,
      true,
    );
    assert.deepEqual(after.diagnostics[0], {
      outcome: 'failed',
      diagnostic: {
        acceptedByteCount: 2,
        acceptedFrameCount: 1,
        durationMs: 50,
        errorCode: StreamingTranscriptionErrorCode.InvalidSequence,
        retryEligible: true,
      },
    });
    assert.equal(JSON.stringify(after.diagnostics).includes('injected-operation-id'), false);
    assert.equal(JSON.stringify(after.diagnostics).includes('streamed text'), false);
  });

  it('copies the exported chunk type helper independently of the source buffer', () => {
    const source = Uint8Array.of(1, 2);
    const copied = copyStreamingTranscriptionChunk(source);
    source[0] = 9;
    assert.deepEqual(copied, Uint8Array.of(1, 2));
  });
});
