import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';
import { rootCertificates } from 'node:tls';

import type {
  ArtifactHttpClient,
  ArtifactHttpClientRequest,
  ArtifactHttpClientResponse,
} from './ArtifactLifecycleTypes';
import { ArtifactHttpClientError } from './ArtifactHttpClientError';
import { OwnedArtifactHttpClientResponse } from './OwnedArtifactTransport';

const OFFLINE_CODES = new Set(['EAI_AGAIN', 'ENETDOWN', 'ENETUNREACH', 'ENOTFOUND', 'EHOSTUNREACH']);

function singleHeader(headers: IncomingHttpHeaders, name: string): string | null {
  const value = headers[name];
  if (value === undefined) return null;
  if (Array.isArray(value)) throw new ArtifactHttpClientError('failed');
  return value;
}

function contentLength(headers: IncomingHttpHeaders): number | null {
  const value = singleHeader(headers, 'content-length');
  if (value === null || !/^(?:0|[1-9]\d*)$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function mapNetworkError(error: unknown): ArtifactHttpClientError {
  const code = (error as NodeJS.ErrnoException).code;
  return new ArtifactHttpClientError(typeof code === 'string' && OFFLINE_CODES.has(code) ? 'offline' : 'failed');
}

export interface NodeArtifactHttpClientOptions {
  readonly trustedCertificateAuthorities?: readonly string[];
}

/** Preserves Node's public trust roots while adding authenticated task-local authorities. */
export function extendNodeCertificateAuthorities(additional: readonly string[]): string[] {
  return [...rootCertificates, ...additional];
}

/** Credential-free HTTPS adapter used only after the catalog transport authenticates the URL policy. */
export class NodeArtifactHttpClient implements ArtifactHttpClient {
  public constructor(private readonly options: NodeArtifactHttpClientOptions = {}) {}

  public async open(input: ArtifactHttpClientRequest): Promise<ArtifactHttpClientResponse> {
    return await new Promise<ArtifactHttpClientResponse>((resolve, reject) => {
      const headers: Record<string, string> = { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity' };
      if (input.rangeStart !== null) headers.Range = `bytes=${input.rangeStart}-`;
      if (input.ifRange !== null) headers['If-Range'] = input.ifRange;
      const clientRequest = request(
        input.url,
        {
          method: 'GET',
          headers,
          rejectUnauthorized: true,
          ...(this.options.trustedCertificateAuthorities
            ? { ca: extendNodeCertificateAuthorities(this.options.trustedCertificateAuthorities) }
            : {}),
        },
        (response) => {
          // The bounded transport may intentionally destroy the response after its async iterator closes.
          // Keep one terminal listener so a late ECONNRESET cannot escape as an uncaught process error.
          response.on('error', () => undefined);
          try {
            const responseHeaders = Object.freeze({
              acceptRanges: singleHeader(response.headers, 'accept-ranges'),
              contentEncoding: singleHeader(response.headers, 'content-encoding'),
              contentLength: contentLength(response.headers),
              contentRange: singleHeader(response.headers, 'content-range'),
              contentType: singleHeader(response.headers, 'content-type'),
              etag: singleHeader(response.headers, 'etag'),
              location: singleHeader(response.headers, 'location'),
            });
            resolve(
              new OwnedArtifactHttpClientResponse({
                status: response.statusCode ?? 0,
                body: response,
                headers: responseHeaders,
                close: () => {
                  if (!response.destroyed) response.destroy();
                  if (!clientRequest.destroyed) clientRequest.destroy();
                },
                onDisposed: () => input.signal.removeEventListener('abort', abort),
              }),
            );
          } catch (error) {
            response.destroy();
            input.signal.removeEventListener('abort', abort);
            reject(error instanceof Error ? error : new ArtifactHttpClientError('failed'));
          }
        },
      );
      const abort = (): void => {
        clientRequest.destroy(new ArtifactHttpClientError('failed'));
      };
      input.signal.addEventListener('abort', abort, { once: true });
      clientRequest.once('close', () => input.signal.removeEventListener('abort', abort));
      clientRequest.once('error', (error) => {
        input.signal.removeEventListener('abort', abort);
        reject(mapNetworkError(error));
      });
      if (input.signal.aborted) abort();
      clientRequest.end();
    });
  }
}
