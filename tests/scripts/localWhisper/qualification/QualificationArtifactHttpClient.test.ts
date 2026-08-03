import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';

import type {
  ArtifactHttpClient,
  ArtifactHttpClientRequest,
  ArtifactHttpClientResponse,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { sha256Bytes } from '../../../../scripts/local-whisper/packaging/fileIntegrity';
import { QualificationArtifactHttpClient } from '../../../../scripts/local-whisper/qualification/QualificationArtifactHttpClient';

async function body(response: ArtifactHttpClientResponse): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

describe('QualificationArtifactHttpClient', () => {
  it('serves only exact verified cached HTTPS bytes with strict range validators', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-qualification-http-'));
    try {
      const filePath = path.join(root, 'model.bin');
      const bytes = Buffer.from('verified qualification model bytes', 'utf8');
      await writeFile(filePath, bytes);
      const delegate: ArtifactHttpClient = {
        open: (_request: ArtifactHttpClientRequest) => Promise.reject(new Error('delegate must not run')),
      };
      const client = await QualificationArtifactHttpClient.create(
        [
          {
            url: 'https://huggingface.co/repository/resolve/commit/model.bin',
            filePath,
            sizeBytes: bytes.byteLength,
            sha256: sha256Bytes(bytes),
          },
        ],
        delegate,
      );
      const first = await client.open({
        url: 'https://huggingface.co/repository/resolve/commit/model.bin',
        signal: new AbortController().signal,
        rangeStart: null,
        ifRange: null,
      });
      assert.equal(first.status, 200);
      assert.deepEqual(await body(first), bytes);
      const resumed = await client.open({
        url: 'https://huggingface.co/repository/resolve/commit/model.bin',
        signal: new AbortController().signal,
        rangeStart: 9,
        ifRange: first.headers.etag,
      });
      assert.equal(resumed.status, 206);
      assert.deepEqual(await body(resumed), bytes.subarray(9));
      const mismatch = await client.open({
        url: 'https://huggingface.co/repository/resolve/commit/model.bin',
        signal: new AbortController().signal,
        rangeStart: 9,
        ifRange: '"wrong"',
      });
      assert.equal(mismatch.status, 412);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects changed inputs and delegates unrelated URLs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-qualification-http-'));
    try {
      const filePath = path.join(root, 'model.bin');
      await writeFile(filePath, 'bytes');
      const delegateResponse: ArtifactHttpClientResponse = {
        status: 404,
        body: Readable.from([]),
        headers: { contentLength: 0, contentRange: null, etag: null, location: null },
      };
      const delegate: ArtifactHttpClient = { open: () => Promise.resolve(delegateResponse) };
      await assert.rejects(
        QualificationArtifactHttpClient.create(
          [
            {
              url: 'https://huggingface.co/model.bin',
              filePath,
              sizeBytes: 5,
              sha256: '0'.repeat(64),
            },
          ],
          delegate,
        ),
        /identity/u,
      );
      const client = await QualificationArtifactHttpClient.create([], delegate);
      assert.equal(
        (
          await client.open({
            url: 'https://127.0.0.1:443/runtime',
            signal: new AbortController().signal,
            rangeStart: null,
            ifRange: null,
          })
        ).status,
        404,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
