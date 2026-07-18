import { randomUUID } from 'node:crypto';
import { getActiveProvider } from '../browser';
import { createLogger } from '../logger';
import type { BaseVoiceProvider } from '../providers/BaseVoiceProvider';
import { extractClaudeWebPcm, CLAUDE_WEB_PCM_CHUNK_BYTES } from '../providers/claudeWebAudio';
import { resolveStreamingVoiceProviderCapability } from '../providers/streamingVoiceProviderCapability';
import {
  copyStreamingTranscriptionChunk,
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type CopiedStreamingTranscriptionChunk,
  type StreamingTranscriptionCancellation,
  type StreamingTranscriptionChunkAccepted,
  type StreamingTranscriptionError,
  type StreamingTranscriptionOperationId,
  type StreamingTranscriptionStarted,
  type StreamingVoiceProviderCapability,
  type StreamingVoiceProviderOperations,
} from '../providers/streamingVoiceProvider';
import { StreamingTranscriptionOperationError } from '../providers/StreamingTranscriptionOperationError';
import { MainStreamingTranscriptionRejection } from './MainStreamingTranscriptionRejection';
import {
  completeStreamingTranscription,
  createTranscriptionCompletionSnapshot,
  defaultTranscriptionCompletionDependencies,
  type TranscriptionCompletionDependencies,
  type TranscriptionCompletionSnapshot,
} from './transcriptionCompletion';
import { WAV_TRANSCRIPTION_MIME_TYPE } from '@shared/transcriptionConstants';

const log = createLogger('streaming-transcription');
const STREAMING_TRANSCRIPTION_OWNER_TOKEN: unique symbol = Symbol('streaming-transcription-owner-token');

export type StreamingTranscriptionOwnerToken = Readonly<{
  [STREAMING_TRANSCRIPTION_OWNER_TOKEN]: true;
}>;

export function createStreamingTranscriptionOwnerToken(): StreamingTranscriptionOwnerToken {
  return Object.freeze({ [STREAMING_TRANSCRIPTION_OWNER_TOKEN]: true });
}

export interface StartMainStreamingTranscriptionInput {
  readonly owner: StreamingTranscriptionOwnerToken;
}

export interface SendMainStreamingTranscriptionChunkInput {
  readonly owner: StreamingTranscriptionOwnerToken;
  readonly operationId: StreamingTranscriptionOperationId;
  readonly sequence: number;
  readonly chunk: Uint8Array;
}

export interface FinishMainStreamingTranscriptionInput {
  readonly owner: StreamingTranscriptionOwnerToken;
  readonly operationId: StreamingTranscriptionOperationId;
  readonly sequence: number;
  readonly finalChunk: Uint8Array;
  readonly recordingWav: ArrayBuffer;
}

export interface CancelMainStreamingTranscriptionInput {
  readonly owner: StreamingTranscriptionOwnerToken;
  readonly operationId: StreamingTranscriptionOperationId;
}

export type MainStreamingTranscriptionStarted = StreamingTranscriptionStarted;
export type MainStreamingTranscriptionChunkAccepted = StreamingTranscriptionChunkAccepted;
export type MainStreamingTranscriptionCancellation = StreamingTranscriptionCancellation;

export type MainStreamingTranscriptionResult =
  | {
      readonly success: true;
      readonly lifecycle: StreamingTranscriptionLifecycle.Completed;
      readonly text: string;
    }
  | {
      readonly success: false;
      readonly error: StreamingTranscriptionError;
      readonly retryEligible: boolean;
    };
export { MainStreamingTranscriptionRejection } from './MainStreamingTranscriptionRejection';

export interface StreamingTranscriptionDiagnostic {
  readonly acceptedByteCount: number;
  readonly acceptedFrameCount: number;
  readonly durationMs: number;
  readonly errorCode?: StreamingTranscriptionErrorCode;
  readonly retryEligible: boolean;
}

export type StreamingTranscriptionDiagnosticOutcome = 'cancelled' | 'completed' | 'failed';

export interface MainStreamingTranscriptionServiceDependencies extends TranscriptionCompletionDependencies {
  createOperationId: () => StreamingTranscriptionOperationId;
  getActiveProvider: () => BaseVoiceProvider | null;
  getMonotonicTimeMs: () => number;
  getRequestedAt: () => string;
  reportDiagnostic: (
    outcome: StreamingTranscriptionDiagnosticOutcome,
    diagnostic: StreamingTranscriptionDiagnostic,
  ) => void;
  resolveCapability: (provider: BaseVoiceProvider | null) => StreamingVoiceProviderCapability | null;
}

export interface MainStreamingTranscriptionService {
  start(input: StartMainStreamingTranscriptionInput): Promise<MainStreamingTranscriptionStarted>;
  sendChunk(input: SendMainStreamingTranscriptionChunkInput): Promise<MainStreamingTranscriptionChunkAccepted>;
  finish(input: FinishMainStreamingTranscriptionInput): Promise<MainStreamingTranscriptionResult>;
  cancel(input: CancelMainStreamingTranscriptionInput): Promise<MainStreamingTranscriptionCancellation>;
  cancelActiveForLifecycle(): Promise<void>;
}

interface TerminalFailure {
  readonly error: StreamingTranscriptionError;
  readonly retryEligible: boolean;
}

interface ActiveStreamingTranscription {
  acceptedByteCount: number;
  acceptedFrameCount: number;
  chunks: CopiedStreamingTranscriptionChunk[];
  completionSnapshot: TranscriptionCompletionSnapshot | null;
  finishClaimed: boolean;
  liveAudioAttempted: boolean;
  nextSequence: number;
  operationId: StreamingTranscriptionOperationId | null;
  operations: StreamingVoiceProviderOperations | null;
  owner: StreamingTranscriptionOwnerToken | null;
  provider: BaseVoiceProvider | null;
  pushInFlight: boolean;
  recordingWav: Uint8Array | null;
  startedAtMs: number;
  terminalFailure: TerminalFailure | null;
}

function createStreamingError(code: StreamingTranscriptionErrorCode): StreamingTranscriptionError {
  if (code === StreamingTranscriptionErrorCode.Cancelled) {
    return { lifecycle: StreamingTranscriptionLifecycle.Cancelled, code };
  }
  return { lifecycle: StreamingTranscriptionLifecycle.Failed, code };
}

function mapProviderError(error: unknown): StreamingTranscriptionError {
  if (error instanceof MainStreamingTranscriptionRejection) return error.error;
  if (error instanceof StreamingTranscriptionOperationError) return error.error;
  return createStreamingError(StreamingTranscriptionErrorCode.TransportFailure);
}

function isValidSequence(sequence: number, expected: number): boolean {
  return Number.isSafeInteger(sequence) && sequence >= 0 && sequence === expected;
}

function isValidPcmChunk(chunk: unknown, allowEmpty: boolean): chunk is Uint8Array {
  return (
    chunk instanceof Uint8Array &&
    (allowEmpty || chunk.byteLength > 0) &&
    chunk.byteLength <= CLAUDE_WEB_PCM_CHUNK_BYTES &&
    chunk.byteLength % 2 === 0
  );
}

function isMatchingPcmRecording(
  recordingPcm: Uint8Array,
  chunks: readonly Uint8Array[],
  finalChunk: Uint8Array,
): boolean {
  const expectedLength = chunks.reduce((total, chunk) => total + chunk.byteLength, finalChunk.byteLength);
  if (recordingPcm.byteLength !== expectedLength) return false;

  let offset = 0;
  for (const chunk of [...chunks, finalChunk]) {
    for (let index = 0; index < chunk.byteLength; index += 1) {
      if (recordingPcm[offset + index] !== chunk[index]) return false;
    }
    offset += chunk.byteLength;
  }
  return true;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function copyValidatedRecordingWav(
  recordingWav: ArrayBuffer,
  chunks: readonly Uint8Array[],
  finalChunk: Uint8Array,
): Uint8Array | null {
  const copy = Uint8Array.from(new Uint8Array(recordingWav));
  try {
    const recordingPcm = extractClaudeWebPcm(copy);
    if (!isMatchingPcmRecording(recordingPcm, chunks, finalChunk)) {
      copy.fill(0);
      return null;
    }
    return copy;
  } catch {
    copy.fill(0);
    return null;
  }
}

function isMatchingStartedResult(
  result: StreamingTranscriptionStarted,
  operationId: StreamingTranscriptionOperationId,
): boolean {
  return result.operationId === operationId && result.lifecycle === StreamingTranscriptionLifecycle.Starting;
}

function isMatchingChunkResult(
  result: StreamingTranscriptionChunkAccepted,
  operationId: StreamingTranscriptionOperationId,
  sequence: number,
): boolean {
  return (
    result.operationId === operationId &&
    result.lifecycle === StreamingTranscriptionLifecycle.Streaming &&
    result.acceptedSequence === sequence
  );
}

function getRetryEligibility(operation: ActiveStreamingTranscription, error: StreamingTranscriptionError): boolean {
  return (
    operation.liveAudioAttempted &&
    error.code !== StreamingTranscriptionErrorCode.Cancelled &&
    error.code !== StreamingTranscriptionErrorCode.InvalidAudio
  );
}

function getDurationMs(now: number, startedAtMs: number): number {
  return Math.max(0, Math.round(now - startedAtMs));
}

function defaultReportDiagnostic(
  outcome: StreamingTranscriptionDiagnosticOutcome,
  diagnostic: StreamingTranscriptionDiagnostic,
): void {
  if (outcome === 'completed') {
    log.info('Streaming transcription completed:', diagnostic);
    return;
  }
  log.warn('Streaming transcription terminated:', diagnostic);
}

/** Owns the one live main-process transcription operation and its terminal side effects. */
export class StreamingTranscriptionService implements MainStreamingTranscriptionService {
  private activeOperation: ActiveStreamingTranscription | null = null;

  constructor(private readonly deps: MainStreamingTranscriptionServiceDependencies) {}

  async start(input: StartMainStreamingTranscriptionInput): Promise<MainStreamingTranscriptionStarted> {
    if (this.activeOperation) {
      throw this.createStandaloneRejection(StreamingTranscriptionErrorCode.OperationConflict);
    }

    const provider = this.deps.getActiveProvider();
    const capability = this.deps.resolveCapability(provider);
    if (!provider || !provider.isReady() || !capability || capability.provider !== provider) {
      throw this.createStandaloneRejection(StreamingTranscriptionErrorCode.InvalidOperation);
    }

    let completionSnapshot: TranscriptionCompletionSnapshot;
    let operationId: StreamingTranscriptionOperationId;
    try {
      completionSnapshot = createTranscriptionCompletionSnapshot(provider, this.deps.getRequestedAt());
      operationId = this.deps.createOperationId();
    } catch {
      throw this.createStandaloneRejection(StreamingTranscriptionErrorCode.TransportFailure);
    }

    const operation: ActiveStreamingTranscription = {
      acceptedByteCount: 0,
      acceptedFrameCount: 0,
      chunks: [],
      completionSnapshot,
      finishClaimed: false,
      liveAudioAttempted: false,
      nextSequence: 0,
      operationId,
      operations: capability.operations,
      owner: input.owner,
      provider,
      pushInFlight: false,
      recordingWav: null,
      startedAtMs: this.deps.getMonotonicTimeMs(),
      terminalFailure: null,
    };
    this.activeOperation = operation;

    const operations = capability.operations;
    try {
      const result = await operations.startStreamingTranscription({ operationId });
      if (operation.terminalFailure) {
        await this.cancelProviderOperation(operations, operationId);
        throw new MainStreamingTranscriptionRejection(
          operation.terminalFailure.error,
          operation.terminalFailure.retryEligible,
        );
      }
      if (this.hasProviderChanged(operation)) {
        const failure = await this.terminate(
          operation,
          createStreamingError(StreamingTranscriptionErrorCode.ProviderChanged),
        );
        throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
      }
      if (!isMatchingStartedResult(result, operationId)) {
        const failure = await this.terminate(
          operation,
          createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
        );
        throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof MainStreamingTranscriptionRejection) throw error;
      if (operation.terminalFailure) {
        throw new MainStreamingTranscriptionRejection(
          operation.terminalFailure.error,
          operation.terminalFailure.retryEligible,
        );
      }
      const failure = await this.terminate(operation, mapProviderError(error));
      throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
    }
  }

  /** Validates, copies, and forwards the next exact PCM sequence. */
  async sendChunk(input: SendMainStreamingTranscriptionChunkInput): Promise<MainStreamingTranscriptionChunkAccepted> {
    const operation = this.getOwnedOperation(input.owner, input.operationId);
    if (!operation) {
      throw this.createStandaloneRejection(StreamingTranscriptionErrorCode.InvalidOperation);
    }
    if (operation.finishClaimed || operation.pushInFlight) {
      throw this.createStandaloneRejection(StreamingTranscriptionErrorCode.OperationConflict);
    }
    if (this.hasProviderChanged(operation)) {
      const failure = await this.terminate(
        operation,
        createStreamingError(StreamingTranscriptionErrorCode.ProviderChanged),
      );
      throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
    }
    if (!isValidSequence(input.sequence, operation.nextSequence)) {
      const failure = await this.terminate(
        operation,
        createStreamingError(StreamingTranscriptionErrorCode.InvalidSequence),
      );
      throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
    }
    if (!isValidPcmChunk(input.chunk, false)) {
      const failure = await this.terminate(
        operation,
        createStreamingError(StreamingTranscriptionErrorCode.InvalidChunk),
      );
      throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
    }

    const chunk = copyStreamingTranscriptionChunk(input.chunk);
    const operations = operation.operations;
    const operationId = operation.operationId;
    if (!operations || !operationId) {
      const failure = await this.terminate(
        operation,
        createStreamingError(StreamingTranscriptionErrorCode.InvalidOperation),
      );
      throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
    }

    operation.pushInFlight = true;
    operation.liveAudioAttempted = true;
    try {
      const result = await operations.pushStreamingTranscriptionChunk({
        operationId,
        sequence: input.sequence,
        chunk,
      });
      if (operation.terminalFailure) {
        throw new MainStreamingTranscriptionRejection(
          operation.terminalFailure.error,
          operation.terminalFailure.retryEligible,
        );
      }
      if (this.hasProviderChanged(operation)) {
        const failure = await this.terminate(
          operation,
          createStreamingError(StreamingTranscriptionErrorCode.ProviderChanged),
        );
        throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
      }
      if (!isMatchingChunkResult(result, operationId, input.sequence)) {
        const failure = await this.terminate(
          operation,
          createStreamingError(StreamingTranscriptionErrorCode.TransportFailure),
        );
        throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
      }

      operation.chunks.push(chunk);
      operation.acceptedByteCount += chunk.byteLength;
      operation.acceptedFrameCount += 1;
      operation.nextSequence += 1;
      return result;
    } catch (error: unknown) {
      if (error instanceof MainStreamingTranscriptionRejection) throw error;
      if (operation.terminalFailure) {
        throw new MainStreamingTranscriptionRejection(
          operation.terminalFailure.error,
          operation.terminalFailure.retryEligible,
        );
      }
      const failure = await this.terminate(operation, mapProviderError(error));
      throw new MainStreamingTranscriptionRejection(failure.error, failure.retryEligible);
    } finally {
      operation.pushInFlight = false;
    }
  }

  /** Proves the canonical WAV matches all accepted PCM before completing once. */
  async finish(input: FinishMainStreamingTranscriptionInput): Promise<MainStreamingTranscriptionResult> {
    const operation = this.getOwnedOperation(input.owner, input.operationId);
    if (!operation) return this.createStandaloneTerminalFailure(StreamingTranscriptionErrorCode.InvalidOperation);
    if (operation.finishClaimed || operation.pushInFlight) {
      return this.createStandaloneTerminalFailure(StreamingTranscriptionErrorCode.OperationConflict);
    }

    operation.finishClaimed = true;
    if (this.hasProviderChanged(operation)) {
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.ProviderChanged)),
      );
    }
    if (!isValidSequence(input.sequence, operation.nextSequence)) {
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.InvalidSequence)),
      );
    }
    if (!isValidPcmChunk(input.finalChunk, true)) {
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.InvalidChunk)),
      );
    }
    if (!(input.recordingWav instanceof ArrayBuffer)) {
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.InvalidAudio), false),
      );
    }

    const finalChunk = copyStreamingTranscriptionChunk(input.finalChunk);
    const recordingWav = copyValidatedRecordingWav(input.recordingWav, operation.chunks, finalChunk);
    if (!recordingWav) {
      finalChunk.fill(0);
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.InvalidAudio), false),
      );
    }

    operation.recordingWav = recordingWav;
    operation.acceptedByteCount += finalChunk.byteLength;
    if (finalChunk.byteLength === CLAUDE_WEB_PCM_CHUNK_BYTES) operation.acceptedFrameCount += 1;
    if (finalChunk.byteLength > 0) operation.liveAudioAttempted = true;

    const operations = operation.operations;
    const operationId = operation.operationId;
    if (!operations || !operationId) {
      finalChunk.fill(0);
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.InvalidOperation)),
      );
    }

    let providerResult;
    try {
      providerResult = await operations.finishStreamingTranscription({
        operationId,
        sequence: input.sequence,
        finalChunk,
      });
    } catch (error: unknown) {
      if (operation.terminalFailure) return this.toTerminalFailure(operation.terminalFailure);
      return this.toTerminalFailure(await this.terminate(operation, mapProviderError(error)));
    } finally {
      finalChunk.fill(0);
    }

    if (operation.terminalFailure) return this.toTerminalFailure(operation.terminalFailure);
    if (this.hasProviderChanged(operation)) {
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.ProviderChanged)),
      );
    }
    if (providerResult.operationId !== operationId) {
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.TransportFailure)),
      );
    }
    if (!providerResult.success) {
      return this.toTerminalFailure(await this.terminate(operation, providerResult.error));
    }
    if (providerResult.lifecycle !== StreamingTranscriptionLifecycle.Completed || !providerResult.text.trim()) {
      return this.toTerminalFailure(
        await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.TransportFailure)),
      );
    }

    const snapshot = operation.completionSnapshot;
    const wave = operation.recordingWav;
    const diagnostic = this.createDiagnostic(operation, false);
    operation.recordingWav = null;
    this.releaseOperation(operation);
    if (!snapshot || !wave) {
      const failure = createStreamingError(StreamingTranscriptionErrorCode.TransportFailure);
      this.reportDiagnostic('failed', { ...diagnostic, errorCode: failure.code, retryEligible: true });
      return { success: false, error: failure, retryEligible: true };
    }

    try {
      completeStreamingTranscription(
        this.deps,
        snapshot,
        copyToArrayBuffer(wave),
        WAV_TRANSCRIPTION_MIME_TYPE,
        providerResult.text,
      );
      this.reportDiagnostic('completed', diagnostic);
      return {
        success: true,
        lifecycle: StreamingTranscriptionLifecycle.Completed,
        text: providerResult.text,
      };
    } catch {
      const error = createStreamingError(StreamingTranscriptionErrorCode.TransportFailure);
      const retryEligible = true;
      this.reportDiagnostic('failed', { ...diagnostic, errorCode: error.code, retryEligible });
      return { success: false, error, retryEligible };
    } finally {
      wave.fill(0);
    }
  }

  async cancel(input: CancelMainStreamingTranscriptionInput): Promise<MainStreamingTranscriptionCancellation> {
    const operation = this.getOwnedOperation(input.owner, input.operationId);
    if (operation) {
      await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.Cancelled), false);
    }
    return {
      operationId: input.operationId,
      lifecycle: StreamingTranscriptionLifecycle.Cancelled,
    };
  }

  async cancelActiveForLifecycle(): Promise<void> {
    const operation = this.activeOperation;
    if (!operation) return;
    await this.terminate(operation, createStreamingError(StreamingTranscriptionErrorCode.Cancelled), false);
  }

  private getOwnedOperation(
    owner: StreamingTranscriptionOwnerToken,
    operationId: StreamingTranscriptionOperationId,
  ): ActiveStreamingTranscription | null {
    const operation = this.activeOperation;
    if (!operation || operation.owner !== owner || operation.operationId !== operationId) return null;
    return operation;
  }

  private hasProviderChanged(operation: ActiveStreamingTranscription): boolean {
    return (
      !operation.provider ||
      !operation.completionSnapshot ||
      this.deps.getActiveProvider() !== operation.provider ||
      operation.provider.info.id !== operation.completionSnapshot.providerId
    );
  }

  private createStandaloneRejection(code: StreamingTranscriptionErrorCode): MainStreamingTranscriptionRejection {
    return new MainStreamingTranscriptionRejection(createStreamingError(code), false);
  }

  private createStandaloneTerminalFailure(code: StreamingTranscriptionErrorCode): MainStreamingTranscriptionResult {
    return { success: false, error: createStreamingError(code), retryEligible: false };
  }

  private toTerminalFailure(failure: TerminalFailure): MainStreamingTranscriptionResult {
    return { success: false, error: failure.error, retryEligible: failure.retryEligible };
  }

  private async terminate(
    operation: ActiveStreamingTranscription,
    error: StreamingTranscriptionError,
    retryEligible = getRetryEligibility(operation, error),
  ): Promise<TerminalFailure> {
    if (operation.terminalFailure) return operation.terminalFailure;

    const failure = { error, retryEligible } satisfies TerminalFailure;
    operation.terminalFailure = failure;
    const operations = operation.operations;
    const operationId = operation.operationId;
    const diagnostic = this.createDiagnostic(operation, retryEligible, error.code);
    this.releaseOperation(operation);
    if (operations && operationId) await this.cancelProviderOperation(operations, operationId);
    this.reportDiagnostic(
      error.code === StreamingTranscriptionErrorCode.Cancelled ? 'cancelled' : 'failed',
      diagnostic,
    );
    return failure;
  }

  private releaseOperation(operation: ActiveStreamingTranscription): void {
    if (this.activeOperation === operation) this.activeOperation = null;
    for (const chunk of operation.chunks) chunk.fill(0);
    operation.chunks.length = 0;
    operation.recordingWav?.fill(0);
    operation.recordingWav = null;
    operation.completionSnapshot = null;
    operation.operationId = null;
    operation.operations = null;
    operation.owner = null;
    operation.provider = null;
  }

  private createDiagnostic(
    operation: ActiveStreamingTranscription,
    retryEligible: boolean,
    errorCode?: StreamingTranscriptionErrorCode,
  ): StreamingTranscriptionDiagnostic {
    return {
      acceptedByteCount: operation.acceptedByteCount,
      acceptedFrameCount: operation.acceptedFrameCount,
      durationMs: getDurationMs(this.deps.getMonotonicTimeMs(), operation.startedAtMs),
      ...(errorCode ? { errorCode } : {}),
      retryEligible,
    };
  }

  private reportDiagnostic(
    outcome: StreamingTranscriptionDiagnosticOutcome,
    diagnostic: StreamingTranscriptionDiagnostic,
  ): void {
    try {
      this.deps.reportDiagnostic(outcome, diagnostic);
    } catch {
      // Diagnostics never alter operation ownership or terminal results.
    }
  }

  private async cancelProviderOperation(
    operations: StreamingVoiceProviderOperations,
    operationId: StreamingTranscriptionOperationId,
  ): Promise<void> {
    try {
      await operations.cancelStreamingTranscription({ operationId });
    } catch {
      // Provider cancellation is best effort; main ownership is already cleared.
    }
  }
}

function createDefaultOperationId(): StreamingTranscriptionOperationId {
  return randomUUID() as StreamingTranscriptionOperationId;
}

export function createMainStreamingTranscriptionService(
  dependencies: Partial<MainStreamingTranscriptionServiceDependencies> = {},
): MainStreamingTranscriptionService {
  return new StreamingTranscriptionService({
    ...defaultTranscriptionCompletionDependencies,
    createOperationId: createDefaultOperationId,
    getActiveProvider,
    getMonotonicTimeMs: () => performance.now(),
    getRequestedAt: () => new Date().toISOString(),
    reportDiagnostic: defaultReportDiagnostic,
    resolveCapability: resolveStreamingVoiceProviderCapability,
    ...dependencies,
  });
}

export const streamingTranscriptionService = createMainStreamingTranscriptionService();
