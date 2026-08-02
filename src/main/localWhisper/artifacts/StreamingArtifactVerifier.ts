import {
  ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
  ARTIFACT_MAX_BUFFER_BYTES,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactSignatureVerifier,
  type ArtifactStreamingWorker,
  type ArtifactTransportStream,
  type ArtifactWorkerProcessResult,
  type LocalWhisperArtifactDownloadSpec,
  type LocalWhisperArtifactOperationId,
} from './ArtifactLifecycleTypes';

function waitForWorkerStop(
  work: Promise<ArtifactWorkerProcessResult>,
  clock: ArtifactClock,
): Promise<'stopped' | 'timeout'> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = clock.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve('timeout');
    }, ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS);
    void work.then(
      () => {
        if (settled) return;
        settled = true;
        clock.clearTimeout(timeout);
        resolve('stopped');
      },
      () => {
        if (settled) return;
        settled = true;
        clock.clearTimeout(timeout);
        resolve('stopped');
      },
    );
  });
}

export interface StreamingArtifactVerifierDependencies {
  readonly clock: ArtifactClock;
  readonly signatureVerifier: ArtifactSignatureVerifier;
  readonly worker: ArtifactStreamingWorker;
}

export interface StreamingArtifactVerificationInput {
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly spec: LocalWhisperArtifactDownloadSpec;
  readonly transport: ArtifactTransportStream;
  readonly resume: { readonly offset: number; readonly spoolId: string } | null;
  readonly signal: AbortSignal;
  readonly onProgress: (receivedBytes: number) => Promise<void>;
}

/** Supervises bounded off-main streaming work and validates its complete-object evidence. */
export class StreamingArtifactVerifier {
  public constructor(private readonly dependencies: StreamingArtifactVerifierDependencies) {}

  public async verify(input: StreamingArtifactVerificationInput): Promise<ArtifactWorkerProcessResult> {
    const work = this.dependencies.worker.process({
      artifactId: input.spec.artifactId,
      expectedFiles: input.spec.expectedFiles,
      operationId: input.operationId,
      resume: input.resume,
      signal: input.signal,
      stream: input.transport.body,
      onProgress: input.onProgress,
    });
    let rejectCancellation: (error: LocalWhisperArtifactLifecycleError) => void = () => undefined;
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectCancellation = reject;
    });
    const abort = (): void => {
      void this.stopWorker(input.operationId, work).finally(() => {
        rejectCancellation(new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED'));
      });
    };
    input.signal.addEventListener('abort', abort, { once: true });
    if (input.signal.aborted) abort();
    try {
      const result = await Promise.race([work, cancellation]);
      if (input.signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
      if (result.receivedBytes !== input.spec.expectedTransferSizeBytes) {
        throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
      }
      if (result.transferSha256 !== input.spec.expectedTransferSha256) {
        throw new LocalWhisperArtifactLifecycleError('HASH_MISMATCH');
      }
      if (
        !Number.isSafeInteger(result.peakBufferedBytes) ||
        result.peakBufferedBytes < 0 ||
        result.peakBufferedBytes > ARTIFACT_MAX_BUFFER_BYTES
      ) {
        throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
      }
      const signature = input.spec.artifactSignature;
      if (
        signature &&
        !(await this.dependencies.signatureVerifier.verify({
          digest: result.transferSha256,
          keyId: signature.keyId,
          signatureBase64: signature.signatureBase64,
        }))
      ) {
        throw new LocalWhisperArtifactLifecycleError('SIGNATURE_INVALID');
      }
      return result;
    } catch (error) {
      if (input.signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
      if (error instanceof LocalWhisperArtifactLifecycleError) throw error;
      throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
    } finally {
      input.signal.removeEventListener('abort', abort);
    }
  }

  public async discard(spoolId: string): Promise<void> {
    await this.dependencies.worker.discard(spoolId);
  }

  private async stopWorker(
    operationId: LocalWhisperArtifactOperationId,
    work: Promise<ArtifactWorkerProcessResult>,
  ): Promise<void> {
    void this.dependencies.worker.cancel(operationId).catch(() => undefined);
    const stopped = await waitForWorkerStop(work, this.dependencies.clock);
    if (stopped === 'timeout') void this.dependencies.worker.terminate(operationId).catch(() => undefined);
  }
}
