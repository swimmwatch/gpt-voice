import {
  ARTIFACT_CONNECTION_TIMEOUT_MS,
  ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactHttpClient,
  type ArtifactHttpClientResponse,
  type ArtifactTransportResumeRequest,
  type ArtifactTransportStream,
  type LocalWhisperArtifactDownloadSpec,
} from './ArtifactLifecycleTypes';
import { ArtifactHttpClientError } from './ArtifactHttpClientError';
import { OwnedArtifactTransportStream, withArtifactTimeout } from './OwnedArtifactTransport';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ENCODED_SEPARATOR_OR_DOT_PATTERN = /%(?:2e|2f|5c)/iu;
const MULTIPART_PATTERN = /^multipart\//iu;

function rawPath(value: string): string {
  const authority = /^(?:[a-z][a-z\d+.-]*:)?\/\/[^/?#]*/iu.exec(value);
  const valueAfterAuthority = value.slice(authority?.[0].length ?? 0);
  return valueAfterAuthority.split(/[?#]/u, 1)[0];
}

function assertRawPathIsSafe(value: string): void {
  if (value.includes('\\') || ENCODED_SEPARATOR_OR_DOT_PATTERN.test(rawPath(value))) {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
}

function effectivePort(url: URL): number {
  return url.port === '' ? 443 : Number(url.port);
}

function hasSafePath(parsed: URL): boolean {
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

function assertSafeUrl(parsed: URL): void {
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hash !== '' ||
    !hasSafePath(parsed)
  ) {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
}

function parseSafeUrl(value: string): URL {
  assertRawPathIsSafe(value);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
  assertSafeUrl(parsed);
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
  assertRawPathIsSafe(location);
  let redirected: URL;
  try {
    redirected = new URL(location, current);
  } catch {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
  assertSafeUrl(redirected);
  assertRedirectTarget(redirected, spec);
  return redirected;
}

function mapClientError(error: unknown): LocalWhisperArtifactLifecycleError {
  if (error instanceof LocalWhisperArtifactLifecycleError) return error;
  return new LocalWhisperArtifactLifecycleError(
    error instanceof ArtifactHttpClientError && error.code === 'offline' ? 'DOWNLOAD_OFFLINE' : 'DOWNLOAD_FAILED',
  );
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
    let response: ArtifactHttpClientResponse | null = null;
    try {
      while (true) {
        response = await withArtifactTimeout(
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
        try {
          if (redirectCount >= spec.redirectPolicy.maxRedirects) {
            throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
          }
          const redirected = parseRedirect(url, response.headers.location, spec);
          await this.disposeResponse(response);
          response = null;
          url = redirected;
          redirectCount += 1;
        } catch (error) {
          if (response) {
            await this.disposeResponse(response).catch(() => undefined);
            response = null;
          }
          throw error;
        }
      }
      assertResponse(response, spec.expectedTransferSizeBytes, resume);
      const transport = new OwnedArtifactTransportStream({
        clock: this.dependencies.clock,
        expectedCompleteLength: spec.expectedTransferSizeBytes,
        forwardAbort,
        mapError: mapClientError,
        response,
        resumeOffset: resume?.offset ?? 0,
        signal,
        startedAt,
        transportController,
        validator: response.headers.etag,
      });
      response = null;
      return transport;
    } catch (error) {
      signal.removeEventListener('abort', forwardAbort);
      transportController.abort();
      if (response) await this.disposeResponse(response).catch(() => undefined);
      throw mapClientError(error);
    }
  }

  private async disposeResponse(response: ArtifactHttpClientResponse): Promise<void> {
    await withArtifactTimeout(
      response.dispose(),
      ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
      this.dependencies.clock,
      new AbortController().signal,
    );
  }
}
