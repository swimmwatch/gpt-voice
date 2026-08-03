import {
  ARTIFACT_CONNECTION_TIMEOUT_MS,
  ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
  ARTIFACT_MAX_BUFFER_BYTES,
  ARTIFACT_NO_PROGRESS_TIMEOUT_MS,
  ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactHttpClient,
  type ArtifactHttpClientResponse,
  type ArtifactTransportResumeRequest,
  type ArtifactTransportStream,
  type LocalWhisperArtifactDownloadSpec,
} from './ArtifactLifecycleTypes';
import { ArtifactHttpClientError } from './ArtifactHttpClientError';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ENCODED_SEPARATOR_OR_DOT_PATTERN = /%(?:2e|2f|5c)/iu;
const MULTIPART_PATTERN = /^multipart\//iu;

function effectivePort(url: URL): number {
  return url.port === '' ? 443 : Number(url.port);
}

function hasSafePath(value: string, parsed: URL): boolean {
  if (parsed.pathname.includes('\\') || ENCODED_SEPARATOR_OR_DOT_PATTERN.test(parsed.pathname)) return false;
  try {
    return parsed.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .every((segment) => segment !== '.' && segment !== '..' && !segment.includes('/') && !segment.includes('\\'));
  } catch {
    return false;
  }
}

function parseSafeUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hash !== '' ||
    !hasSafePath(value, parsed)
  ) {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
  return parsed;
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname.startsWith(prefix) && (prefix.endsWith('/') || pathname.length === prefix.length);
}

function assertInitialPolicy(url: URL, spec: LocalWhisperArtifactDownloadSpec): void {
  const policy = spec.redirectPolicy;
  if (
    url.origin !== spec.origin ||
    policy.initialScheme !== 'https' ||
    url.hostname !== policy.initialHost ||
    effectivePort(url) !== policy.initialPort ||
    !pathMatchesPrefix(url.pathname, policy.initialPathPrefix)
  ) {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
}

function assertRedirectTarget(url: URL, spec: LocalWhisperArtifactDownloadSpec): void {
  const matches = spec.redirectPolicy.allowedTargets.some(
    (target) =>
      url.hostname === target.host &&
      effectivePort(url) === target.port &&
      pathMatchesPrefix(url.pathname, target.pathPrefix),
  );
  if (!matches) throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
}

function parseRedirect(current: URL, location: string | null, spec: LocalWhisperArtifactDownloadSpec): URL {
  if (!location) throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  let redirected: URL;
  try {
    redirected = new URL(location, current);
  } catch {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
  parseSafeUrl(redirected.toString());
  assertRedirectTarget(redirected, spec);
  return redirected;
}

function mapClientError(error: unknown): LocalWhisperArtifactLifecycleError {
  if (error instanceof LocalWhisperArtifactLifecycleError) return error;
  return new LocalWhisperArtifactLifecycleError(
    error instanceof ArtifactHttpClientError && error.code === 'offline' ? 'DOWNLOAD_OFFLINE' : 'DOWNLOAD_FAILED',
  );
}

function withTimeout<T>(
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

function assertResponse(
  response: ArtifactHttpClientResponse,
  expectedLength: number,
  resume: ArtifactTransportResumeRequest | null,
): void {
  const contentEncoding = response.headers.contentEncoding;
  if (
    (contentEncoding !== undefined && contentEncoding !== null && contentEncoding.toLowerCase() !== 'identity') ||
    (typeof response.headers.contentType === 'string' && MULTIPART_PATTERN.test(response.headers.contentType))
  ) {
    throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
  }
  if (resume) {
    const remaining = expectedLength - resume.offset;
    const expectedRange = `bytes ${resume.offset}-${expectedLength - 1}/${expectedLength}`;
    if (
      response.status !== 206 ||
      response.headers.acceptRanges !== 'bytes' ||
      response.headers.contentRange !== expectedRange ||
      response.headers.contentLength !== remaining ||
      response.headers.etag !== resume.validator
    ) {
      throw new LocalWhisperArtifactLifecycleError('RESUME_INVALID');
    }
    return;
  }
  if (
    response.status !== 200 ||
    response.headers.contentRange !== null ||
    response.headers.contentLength !== expectedLength
  ) {
    throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
  }
}

export interface CatalogHttpTransportDependencies {
  readonly client: ArtifactHttpClient;
  readonly clock: ArtifactClock;
}

/** Enforces the authenticated HTTPS allowlist, redirect policy, and transfer time bounds. */
export class CatalogHttpTransport {
  public constructor(private readonly dependencies: CatalogHttpTransportDependencies) {}

  public async open(
    spec: LocalWhisperArtifactDownloadSpec,
    resume: ArtifactTransportResumeRequest | null,
    signal: AbortSignal,
  ): Promise<ArtifactTransportStream> {
    const startedAt = this.dependencies.clock.now();
    let url = parseSafeUrl(spec.requestUrl);
    assertInitialPolicy(url, spec);
    const transportController = new AbortController();
    const forwardAbort = (): void => transportController.abort();
    signal.addEventListener('abort', forwardAbort, { once: true });
    if (signal.aborted) transportController.abort();
    let redirectCount = 0;
    let response: ArtifactHttpClientResponse;
    try {
      while (true) {
        response = await withTimeout(
          this.dependencies.client.open({
            signal: transportController.signal,
            url: url.toString(),
            rangeStart:
              redirectCount === 0 || spec.redirectPolicy.forwardRangeHeaders ? (resume?.offset ?? null) : null,
            ifRange:
              redirectCount === 0 || spec.redirectPolicy.forwardRangeHeaders ? (resume?.validator ?? null) : null,
          }),
          ARTIFACT_CONNECTION_TIMEOUT_MS,
          this.dependencies.clock,
          signal,
          () => transportController.abort(),
        );
        if (!REDIRECT_STATUSES.has(response.status)) break;
        if (redirectCount >= spec.redirectPolicy.maxRedirects) {
          throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
        }
        url = parseRedirect(url, response.headers.location, spec);
        redirectCount += 1;
      }
      assertResponse(response, spec.expectedTransferSizeBytes, resume);
      return Object.freeze({
        body: this.boundedBody(response.body, signal, transportController, forwardAbort, startedAt),
        expectedCompleteLength: spec.expectedTransferSizeBytes,
        resumeOffset: resume?.offset ?? 0,
        validator: response.headers.etag,
      });
    } catch (error) {
      signal.removeEventListener('abort', forwardAbort);
      transportController.abort();
      throw mapClientError(error);
    }
  }

  private async *boundedBody(
    source: AsyncIterable<Uint8Array>,
    signal: AbortSignal,
    transportController: AbortController,
    forwardAbort: () => void,
    startedAt: number,
  ): AsyncIterable<Uint8Array> {
    const iterator = source[Symbol.asyncIterator]();
    try {
      while (true) {
        const elapsed = this.dependencies.clock.now() - startedAt;
        const remaining = ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS - elapsed;
        if (remaining <= 0) throw new LocalWhisperArtifactLifecycleError('OPERATION_TIMEOUT');
        const next = await withTimeout(
          iterator.next(),
          Math.min(ARTIFACT_NO_PROGRESS_TIMEOUT_MS, remaining),
          this.dependencies.clock,
          signal,
          () => transportController.abort(),
        );
        if (next.done) return;
        if (!(next.value instanceof Uint8Array) || next.value.byteLength > ARTIFACT_MAX_BUFFER_BYTES) {
          throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
        }
        yield next.value;
      }
    } catch (error) {
      throw mapClientError(error);
    } finally {
      transportController.abort();
      signal.removeEventListener('abort', forwardAbort);
      try {
        const closing = iterator.return?.();
        if (closing) {
          await withTimeout(
            Promise.resolve(closing),
            ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
            this.dependencies.clock,
            new AbortController().signal,
          );
        }
      } catch {
        // Transport teardown is bounded and never replaces the primary result.
      }
    }
  }
}
