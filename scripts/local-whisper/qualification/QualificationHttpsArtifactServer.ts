import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { createServer, type Server } from 'node:https';

import { sha256File } from '../packaging/fileIntegrity';

const SAFE_ROUTE = /^\/[\dA-Za-z][\w./-]{0,510}$/u;
const RANGE_HEADER = /^bytes=(0|[1-9]\d*)-$/u;

export interface QualificationHttpsObject {
  readonly route: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface QualificationHttpsServerIdentity {
  readonly origin: string;
  readonly port: number;
  readonly certificateSha256: string;
}

interface VerifiedObject extends QualificationHttpsObject {
  readonly etag: string;
}

function reject(response: import('node:http').ServerResponse, statusCode: number): void {
  response.writeHead(statusCode, { 'Cache-Control': 'no-store', Connection: 'close', 'Content-Length': '0' });
  response.end();
}

/** Owns one exact-object, credential-free, single-use qualification HTTPS origin. */
export class QualificationHttpsArtifactServer {
  private server: Server | null = null;
  private identity: QualificationHttpsServerIdentity | null = null;

  public constructor(
    private readonly tls: { readonly certificatePem: string; readonly privateKeyPem: string },
    private readonly objects: readonly QualificationHttpsObject[],
  ) {}

  public async start(): Promise<QualificationHttpsServerIdentity> {
    if (this.server || this.identity) throw new Error('Local Whisper qualification HTTPS server already started');
    const verified = await this.verifyObjects();
    const objects = new Map(verified.map((entry) => [entry.route, entry]));
    this.server = createServer(
      {
        cert: this.tls.certificatePem,
        key: this.tls.privateKeyPem,
        minVersion: 'TLSv1.3',
      },
      (request, response) => {
        if (
          request.method !== 'GET' ||
          !request.url ||
          request.url.includes('?') ||
          request.headers.authorization !== undefined ||
          request.headers.cookie !== undefined ||
          request.headers['accept-encoding'] !== 'identity'
        ) {
          reject(response, 400);
          return;
        }
        const artifact = objects.get(request.url);
        if (!artifact) {
          reject(response, 404);
          return;
        }
        const rangeHeader = request.headers.range;
        const ifRange = request.headers['if-range'];
        let start = 0;
        let statusCode = 200;
        if (rangeHeader !== undefined || ifRange !== undefined) {
          if (typeof rangeHeader !== 'string' || typeof ifRange !== 'string' || ifRange !== artifact.etag) {
            reject(response, 412);
            return;
          }
          const range = RANGE_HEADER.exec(rangeHeader);
          start = range ? Number(range[1]) : Number.NaN;
          if (!Number.isSafeInteger(start) || start < 0 || start >= artifact.sizeBytes) {
            reject(response, 416);
            return;
          }
          statusCode = 206;
        }
        const headers: Record<string, string> = {
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
          'Content-Encoding': 'identity',
          'Content-Length': String(artifact.sizeBytes - start),
          'Content-Type': 'application/octet-stream',
          ETag: artifact.etag,
        };
        if (statusCode === 206) {
          headers['Content-Range'] = `bytes ${start}-${artifact.sizeBytes - 1}/${artifact.sizeBytes}`;
        }
        response.writeHead(statusCode, headers);
        const source = createReadStream(artifact.filePath, { start, highWaterMark: 1024 * 1024 });
        source.once('error', () => response.destroy());
        response.once('close', () => source.destroy());
        source.pipe(response);
      },
    );
    await new Promise<void>((resolve, _reject) => {
      const server = this.server;
      if (!server) return _reject(new Error('Local Whisper qualification HTTPS server unavailable'));
      server.once('error', _reject);
      server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
        server.off('error', _reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
      await this.stop();
      throw new Error('Local Whisper qualification HTTPS server bound an unexpected address');
    }
    this.identity = Object.freeze({
      origin: `https://127.0.0.1:${address.port}`,
      port: address.port,
      certificateSha256: createHash('sha256').update(this.tls.certificatePem, 'utf8').digest('hex'),
    });
    return this.identity;
  }

  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.identity = null;
    if (!server) return;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private async verifyObjects(): Promise<readonly VerifiedObject[]> {
    if (this.objects.length === 0) throw new Error('Local Whisper qualification HTTPS object allowlist is empty');
    if (new Set(this.objects.map(({ route }) => route)).size !== this.objects.length) {
      throw new Error('Duplicate Local Whisper qualification HTTPS route');
    }
    const verified: VerifiedObject[] = [];
    for (const object of this.objects) {
      const metadata = await lstat(object.filePath);
      if (
        !SAFE_ROUTE.test(object.route) ||
        object.route.includes('..') ||
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.size !== object.sizeBytes ||
        (await sha256File(object.filePath)) !== object.sha256
      ) {
        throw new Error(`Invalid Local Whisper qualification HTTPS object: ${object.route}`);
      }
      verified.push({ ...object, etag: `"sha256-${object.sha256}"` });
    }
    return verified;
  }
}
