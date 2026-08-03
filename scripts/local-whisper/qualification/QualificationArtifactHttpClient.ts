import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { Readable } from 'node:stream';

import type {
  ArtifactHttpClient,
  ArtifactHttpClientRequest,
  ArtifactHttpClientResponse,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';

import { sha256File } from '../packaging/fileIntegrity';

export interface QualificationCachedArtifact {
  readonly url: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

interface VerifiedQualificationCachedArtifact extends QualificationCachedArtifact {
  readonly etag: string;
}

function emptyResponse(status: number): ArtifactHttpClientResponse {
  return Object.freeze({
    status,
    body: Readable.from([]),
    headers: Object.freeze({
      acceptRanges: 'bytes',
      contentEncoding: 'identity',
      contentLength: 0,
      contentRange: null,
      contentType: 'application/octet-stream',
      etag: null,
      location: null,
    }),
  });
}

async function verifyArtifact(input: QualificationCachedArtifact): Promise<VerifiedQualificationCachedArtifact> {
  const url = new URL(input.url);
  const metadata = await lstat(input.filePath);
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size !== input.sizeBytes ||
    (await sha256File(input.filePath)) !== input.sha256
  ) {
    throw new Error('Qualification cached artifact identity is invalid');
  }
  return Object.freeze({ ...input, etag: `"sha256-${input.sha256}"` });
}

/**
 * Replays already verified public model bytes through the production artifact
 * pipeline while delegating every non-model HTTPS request to the real client.
 */
export class QualificationArtifactHttpClient implements ArtifactHttpClient {
  private constructor(
    private readonly cached: ReadonlyMap<string, VerifiedQualificationCachedArtifact>,
    private readonly delegate: ArtifactHttpClient,
  ) {}

  public static async create(
    artifacts: readonly QualificationCachedArtifact[],
    delegate: ArtifactHttpClient,
  ): Promise<QualificationArtifactHttpClient> {
    const verified = await Promise.all(artifacts.map(verifyArtifact));
    const cached = new Map(verified.map((entry) => [entry.url, entry]));
    if (cached.size !== artifacts.length) throw new Error('Duplicate qualification cached artifact URL');
    return new QualificationArtifactHttpClient(cached, delegate);
  }

  public async open(request: ArtifactHttpClientRequest): Promise<ArtifactHttpClientResponse> {
    const artifact = this.cached.get(request.url);
    if (!artifact) return await this.delegate.open(request);
    if (request.signal.aborted) throw new Error('Qualification cached artifact request was cancelled');

    const hasRange = request.rangeStart !== null;
    if (hasRange !== (request.ifRange !== null) || (hasRange && request.ifRange !== artifact.etag)) {
      return emptyResponse(412);
    }
    const start = request.rangeStart ?? 0;
    if (!Number.isSafeInteger(start) || start < 0 || start >= artifact.sizeBytes) return emptyResponse(416);
    const stream = createReadStream(artifact.filePath, { start, highWaterMark: 1024 * 1024 });
    const abort = (): void => {
      stream.destroy(new Error('Qualification cached artifact request was cancelled'));
    };
    request.signal.addEventListener('abort', abort, { once: true });
    stream.once('close', () => request.signal.removeEventListener('abort', abort));
    return Object.freeze({
      status: hasRange ? 206 : 200,
      body: stream,
      headers: Object.freeze({
        acceptRanges: 'bytes',
        contentEncoding: 'identity',
        contentLength: artifact.sizeBytes - start,
        contentRange: hasRange ? `bytes ${start}-${artifact.sizeBytes - 1}/${artifact.sizeBytes}` : null,
        contentType: 'application/octet-stream',
        etag: artifact.etag,
        location: null,
      }),
    });
  }
}
