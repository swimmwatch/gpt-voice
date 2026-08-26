import {
  ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
  ARTIFACT_MAX_BUFFER_BYTES,
  ARTIFACT_NO_PROGRESS_TIMEOUT_MS,
  ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactHttpClientResponse,
  type ArtifactTransportStream,
} from './ArtifactLifecycleTypes';

export interface OwnedArtifactHttpClientResponseOptions {
  readonly body: AsyncIterable<Uint8Array>;
  readonly close: () => void | Promise<void>;
  readonly headers: ArtifactHttpClientResponse['headers'];
  readonly onDisposed?: () => void;
  readonly status: number;
}

/** Owns one opened HTTP response until the transport disposes or transfers it. */
export class OwnedArtifactHttpClientResponse implements ArtifactHttpClientResponse {
  public readonly body: AsyncIterable<Uint8Array>;
  public readonly headers: ArtifactHttpClientResponse['headers'];
  public readonly status: number;
  private disposal: Promise<void> | null = null;

  public constructor(private readonly options: OwnedArtifactHttpClientResponseOptions) {
    this.body = options.body;
    this.headers = options.headers;
    this.status = options.status;
  }

  public async dispose(): Promise<void> {
    if (!this.disposal) {
      this.disposal = Promise.resolve().then(async () => {
        try {
          await this.options.close();
        } finally {
          this.options.onDisposed?.();
        }
      });
    }
    await this.disposal;
  }
}

export function withArtifactTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  clock: ArtifactClock,
  signal: AbortSignal,
  onTimeout: () => void = () => undefined,
): Promise<T> {
  if (signal.aborted) return Promise.reject(new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED'));
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const handle = clock.setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      onTimeout();
      reject(new LocalWhisperArtifactLifecycleError('OPERATION_TIMEOUT'));
    }, timeoutMs);
    function abort(): void {
      if (settled) return;
      settled = true;
      clock.clearTimeout(handle);
      reject(new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED'));
    }
    signal.addEventListener('abort', abort, { once: true });
    void promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clock.clearTimeout(handle);
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clock.clearTimeout(handle);
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error('Artifact HTTP client failed'));
      },
    );
  });
}

export interface OwnedArtifactTransportStreamOptions {
  readonly clock: ArtifactClock;
  readonly expectedCompleteLength: number;
  readonly forwardAbort: () => void;
  readonly mapError: (error: unknown) => LocalWhisperArtifactLifecycleError;
  readonly response: ArtifactHttpClientResponse;
  readonly resumeOffset: number;
  readonly signal: AbortSignal;
  readonly startedAt: number;
  readonly transportController: AbortController;
  readonly validator: string | null;
}

/** Owns bounded final-stream iteration, response teardown, and abort-listener removal. */
export class OwnedArtifactTransportStream implements ArtifactTransportStream {
  public readonly body: AsyncIterable<Uint8Array>;
  public readonly expectedCompleteLength: number;
  public readonly resumeOffset: number;
  public readonly validator: string | null;
  private disposal: Promise<void> | null = null;
  private iterator: AsyncIterator<Uint8Array> | null = null;
  private sourceComplete = false;

  public constructor(private readonly options: OwnedArtifactTransportStreamOptions) {
    this.expectedCompleteLength = options.expectedCompleteLength;
    this.resumeOffset = options.resumeOffset;
    this.validator = options.validator;
    this.body = Object.freeze({
      [Symbol.asyncIterator]: (): AsyncIterator<Uint8Array> => this.createBodyIterator(),
    });
  }

  public async dispose(): Promise<void> {
    if (!this.disposal) this.disposal = this.disposeOwned();
    await this.disposal;
  }

  private createBodyIterator(): AsyncIterator<Uint8Array> {
    return {
      next: async (): Promise<IteratorResult<Uint8Array>> => await this.nextChunk(),
      return: async (): Promise<IteratorResult<Uint8Array>> => {
        await this.disposeIgnoringFailure();
        return this.done();
      },
    };
  }

  private async nextChunk(): Promise<IteratorResult<Uint8Array>> {
    if (this.disposal) return this.done();
    try {
      const iterator = this.iterator ?? (this.iterator = this.options.response.body[Symbol.asyncIterator]());
      const elapsed = this.options.clock.now() - this.options.startedAt;
      const remaining = ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS - elapsed;
      if (remaining <= 0) throw new LocalWhisperArtifactLifecycleError('OPERATION_TIMEOUT');
      const next = await withArtifactTimeout(
        iterator.next(),
        Math.min(ARTIFACT_NO_PROGRESS_TIMEOUT_MS, remaining),
        this.options.clock,
        this.options.transportController.signal,
        () => this.options.transportController.abort(),
      );
      if (this.disposal) return this.done();
      if (next.done) {
        this.sourceComplete = true;
        void this.disposeIgnoringFailure();
        return next;
      }
      if (!(next.value instanceof Uint8Array) || next.value.byteLength > ARTIFACT_MAX_BUFFER_BYTES) {
        throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
      }
      return next;
    } catch (error) {
      void this.disposeIgnoringFailure();
      throw this.options.mapError(error);
    }
  }

  private async disposeOwned(): Promise<void> {
    this.options.transportController.abort();
    this.options.signal.removeEventListener('abort', this.options.forwardAbort);
    const responseDisposal = this.options.response.dispose();
    const iterator = this.iterator;
    if (iterator && !this.sourceComplete && iterator.return) {
      await Promise.all([
        this.withTeardownBound(Promise.resolve(iterator.return()).then(() => undefined)).catch(() => undefined),
        this.withTeardownBound(responseDisposal),
      ]);
      return;
    }
    await this.withTeardownBound(responseDisposal);
  }

  private async disposeIgnoringFailure(): Promise<void> {
    await this.dispose().catch(() => undefined);
  }

  private done(): IteratorResult<Uint8Array> {
    return { done: true, value: undefined as never };
  }

  private async withTeardownBound(operation: Promise<void>): Promise<void> {
    await withArtifactTimeout(
      operation,
      ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
      this.options.clock,
      new AbortController().signal,
    );
  }
}
