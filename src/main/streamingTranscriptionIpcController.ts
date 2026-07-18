import {
  isStreamingTranscriptionOperationId,
  isStreamingTranscriptionPcmChunk,
  isStreamingTranscriptionRecordingWav,
  isStreamingTranscriptionSequence,
  STREAMING_TRANSCRIPTION_IPC_CHANNELS,
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type CancelStreamingTranscriptionIpcResult,
  type FinishStreamingTranscriptionIpcResult,
  type SendStreamingTranscriptionChunkIpcResult,
  type StartStreamingTranscriptionIpcResult,
  type StreamingTranscriptionError,
  type StreamingTranscriptionIpcFailure,
} from '@shared/streamingTranscription';
import { MainStreamingTranscriptionRejection } from './services/MainStreamingTranscriptionRejection';
import {
  createStreamingTranscriptionOwnerToken,
  type MainStreamingTranscriptionService,
  type StreamingTranscriptionOwnerToken,
} from './services/streamingTranscription';

type StreamingTranscriptionIpcResult =
  | StartStreamingTranscriptionIpcResult
  | SendStreamingTranscriptionChunkIpcResult
  | FinishStreamingTranscriptionIpcResult
  | CancelStreamingTranscriptionIpcResult;

export type StreamingTranscriptionIpcHandler<Sender> = (
  sender: Sender,
  ...args: readonly unknown[]
) => Promise<StreamingTranscriptionIpcResult>;

export interface StreamingTranscriptionIpcControllerDependencies<Sender extends object> {
  readonly addSenderDestroyedListener: (sender: Sender, listener: () => void) => void;
  readonly createOwnerToken?: () => StreamingTranscriptionOwnerToken;
  readonly getMainWindowSender: () => Sender | null;
  readonly isSenderDestroyed: (sender: Sender) => boolean;
  readonly registerBeforeBrowserShutdownHook: (hook: () => Promise<void>) => () => void;
  readonly registerHandler: (channel: string, handler: StreamingTranscriptionIpcHandler<Sender>) => void;
  readonly removeHandler: (channel: string) => void;
  readonly removeSenderDestroyedListener: (sender: Sender, listener: () => void) => void;
  readonly service: MainStreamingTranscriptionService;
}

function createStreamingError(code: StreamingTranscriptionErrorCode): StreamingTranscriptionError {
  if (code === StreamingTranscriptionErrorCode.Cancelled) {
    return { lifecycle: StreamingTranscriptionLifecycle.Cancelled, code };
  }
  return { lifecycle: StreamingTranscriptionLifecycle.Failed, code };
}

function createFailure(code: StreamingTranscriptionErrorCode, retryEligible = false): StreamingTranscriptionIpcFailure {
  return { success: false, error: createStreamingError(code), retryEligible };
}

function mapServiceFailure(error: unknown): StreamingTranscriptionIpcFailure {
  if (error instanceof MainStreamingTranscriptionRejection) {
    return { success: false, error: error.error, retryEligible: error.retryEligible };
  }
  return createFailure(StreamingTranscriptionErrorCode.TransportFailure);
}

/** Binds the current main-window identity to one main-only service owner token. */
export class StreamingTranscriptionIpcController<Sender extends object> {
  private boundOwner: StreamingTranscriptionOwnerToken | null = null;
  private boundSender: Sender | null = null;
  private disposed = false;
  private disposalPromise: Promise<void> | null = null;
  private readonly removeBrowserShutdownHook: () => void;

  private readonly onBoundSenderDestroyed = (): void => {
    this.releaseSenderBinding();
    void this.cancelActiveForLifecycle();
  };

  constructor(private readonly deps: StreamingTranscriptionIpcControllerDependencies<Sender>) {
    this.deps.registerHandler(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, (sender) => this.start(sender));
    this.deps.registerHandler(STREAMING_TRANSCRIPTION_IPC_CHANNELS.sendChunk, (sender, ...args) =>
      this.sendChunk(sender, args[0], args[1], args[2]),
    );
    this.deps.registerHandler(STREAMING_TRANSCRIPTION_IPC_CHANNELS.finish, (sender, ...args) =>
      this.finish(sender, args[0], args[1], args[2], args[3]),
    );
    this.deps.registerHandler(STREAMING_TRANSCRIPTION_IPC_CHANNELS.cancel, (sender, ...args) =>
      this.cancel(sender, args[0]),
    );
    this.removeBrowserShutdownHook = this.deps.registerBeforeBrowserShutdownHook(() => this.cancelActiveForLifecycle());
  }

  dispose(): Promise<void> {
    if (this.disposalPromise) return this.disposalPromise;
    this.disposed = true;
    this.removeBrowserShutdownHook();
    for (const channel of Object.values(STREAMING_TRANSCRIPTION_IPC_CHANNELS)) {
      this.deps.removeHandler(channel);
    }
    this.releaseSenderBinding();
    this.disposalPromise = this.cancelActiveForLifecycle();
    return this.disposalPromise;
  }

  private async start(sender: Sender): Promise<StartStreamingTranscriptionIpcResult> {
    const owner = this.requireCurrentMainWindowOwner(sender);
    try {
      const result = await this.deps.service.start({ owner });
      if (!this.isInvocationCurrent(sender, owner)) return createFailure(StreamingTranscriptionErrorCode.Cancelled);
      return { success: true, ...result };
    } catch (error: unknown) {
      return mapServiceFailure(error);
    }
  }

  private async sendChunk(
    sender: Sender,
    operationId: unknown,
    sequence: unknown,
    chunk: unknown,
  ): Promise<SendStreamingTranscriptionChunkIpcResult> {
    const owner = this.requireCurrentMainWindowOwner(sender);
    if (!isStreamingTranscriptionOperationId(operationId)) {
      return createFailure(StreamingTranscriptionErrorCode.InvalidOperation);
    }

    const shouldCopy = isStreamingTranscriptionSequence(sequence) && isStreamingTranscriptionPcmChunk(chunk, false);
    try {
      const result = await this.deps.service.sendChunk({
        owner,
        operationId,
        sequence,
        chunk: shouldCopy ? Uint8Array.from(chunk) : chunk,
      });
      if (!this.isInvocationCurrent(sender, owner)) return createFailure(StreamingTranscriptionErrorCode.Cancelled);
      return { success: true, ...result };
    } catch (error: unknown) {
      return mapServiceFailure(error);
    }
  }

  private async finish(
    sender: Sender,
    operationId: unknown,
    sequence: unknown,
    finalChunk: unknown,
    recordingWav: unknown,
  ): Promise<FinishStreamingTranscriptionIpcResult> {
    const owner = this.requireCurrentMainWindowOwner(sender);
    if (!isStreamingTranscriptionOperationId(operationId)) {
      return createFailure(StreamingTranscriptionErrorCode.InvalidOperation);
    }

    const shouldCopy =
      isStreamingTranscriptionSequence(sequence) &&
      isStreamingTranscriptionPcmChunk(finalChunk, true) &&
      isStreamingTranscriptionRecordingWav(recordingWav);
    try {
      const result = await this.deps.service.finish({
        owner,
        operationId,
        sequence,
        finalChunk: shouldCopy ? Uint8Array.from(finalChunk) : finalChunk,
        recordingWav: shouldCopy ? recordingWav.slice(0) : recordingWav,
      });
      if (!this.isInvocationCurrent(sender, owner)) return createFailure(StreamingTranscriptionErrorCode.Cancelled);
      return result;
    } catch (error: unknown) {
      return mapServiceFailure(error);
    }
  }

  private async cancel(sender: Sender, operationId: unknown): Promise<CancelStreamingTranscriptionIpcResult> {
    const owner = this.requireCurrentMainWindowOwner(sender);
    if (!isStreamingTranscriptionOperationId(operationId)) {
      return createFailure(StreamingTranscriptionErrorCode.InvalidOperation);
    }

    try {
      const result = await this.deps.service.cancel({ owner, operationId });
      if (!this.isInvocationCurrent(sender, owner)) return createFailure(StreamingTranscriptionErrorCode.Cancelled);
      return { success: true, ...result };
    } catch (error: unknown) {
      return mapServiceFailure(error);
    }
  }

  private requireCurrentMainWindowOwner(sender: Sender): StreamingTranscriptionOwnerToken {
    if (this.disposed) throw new Error('Streaming transcription IPC is unavailable');
    const currentSender = this.deps.getMainWindowSender();
    if (!currentSender || currentSender !== sender || this.deps.isSenderDestroyed(sender)) {
      throw new Error('Streaming transcription IPC requires the current main window');
    }

    if (this.boundSender && this.boundSender !== sender) {
      this.releaseSenderBinding();
      void this.cancelActiveForLifecycle();
      throw new Error('Streaming transcription main window was replaced');
    }
    if (!this.boundOwner) {
      this.boundSender = sender;
      this.boundOwner = (this.deps.createOwnerToken ?? createStreamingTranscriptionOwnerToken)();
      this.deps.addSenderDestroyedListener(sender, this.onBoundSenderDestroyed);
    }
    return this.boundOwner;
  }

  private isInvocationCurrent(sender: Sender, owner: StreamingTranscriptionOwnerToken): boolean {
    return (
      !this.disposed &&
      this.boundSender === sender &&
      this.boundOwner === owner &&
      this.deps.getMainWindowSender() === sender &&
      !this.deps.isSenderDestroyed(sender)
    );
  }

  private releaseSenderBinding(): void {
    const sender = this.boundSender;
    this.boundSender = null;
    this.boundOwner = null;
    if (sender) {
      this.deps.removeSenderDestroyedListener(sender, this.onBoundSenderDestroyed);
    }
  }

  private async cancelActiveForLifecycle(): Promise<void> {
    try {
      await this.deps.service.cancelActiveForLifecycle();
    } catch {
      // Ownership is dropped locally even if best-effort provider cancellation fails.
    }
  }
}
