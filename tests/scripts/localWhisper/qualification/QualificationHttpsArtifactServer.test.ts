import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { rootCertificates } from 'node:tls';
import { after, before, describe, it } from 'node:test';

import {
  extendNodeCertificateAuthorities,
  NodeArtifactHttpClient,
} from '@main/localWhisper/artifacts/NodeArtifactHttpClient';
import { sha256Bytes } from '@scripts/local-whisper/packaging/fileIntegrity';
import { QualificationHttpsArtifactServer } from '@scripts/local-whisper/qualification/QualificationHttpsArtifactServer';

async function body(response: Awaited<ReturnType<NodeArtifactHttpClient['open']>>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of response.body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  } finally {
    await response.dispose();
  }
}

let root = '';
let certificatePem = '';
let privateKeyPem = '';
let artifactPath = '';
const artifact = Buffer.from('qualification runtime object bytes\n');

it('extends Node public trust when a task-local certificate authority is configured', () => {
  const taskLocalAuthority = 'task-local-authority';
  const authorities = extendNodeCertificateAuthorities([taskLocalAuthority]);
  assert.deepEqual(authorities.slice(0, rootCertificates.length), rootCertificates);
  assert.equal(authorities[authorities.length - 1], taskLocalAuthority);
});

describe('QualificationHttpsArtifactServer', { skip: process.platform !== 'linux' }, () => {
  before(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'local-whisper-qualification-https-'));
    const certificatePath = path.join(root, 'certificate.pem');
    const privateKeyPath = path.join(root, 'private-key.pem');
    const generated = spawnSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ed25519',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-keyout',
        privateKeyPath,
        '-out',
        certificatePath,
      ],
      { encoding: 'utf8', shell: false },
    );
    assert.equal(generated.status, 0, generated.stderr);
    [certificatePem, privateKeyPem] = await Promise.all([
      readFile(certificatePath, 'utf8'),
      readFile(privateKeyPath, 'utf8'),
    ]);
    artifactPath = path.join(root, 'runtime.tar.gz');
    await writeFile(artifactPath, artifact, { mode: 0o600 });
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('serves only the exact allowlisted object with pinned TLS, ETag, and resume semantics', async () => {
    const server = new QualificationHttpsArtifactServer({ certificatePem, privateKeyPem }, [
      {
        route: '/runtime/cpu.tar.gz',
        filePath: artifactPath,
        sizeBytes: artifact.byteLength,
        sha256: sha256Bytes(artifact),
      },
    ]);
    const identity = await server.start();
    try {
      const client = new NodeArtifactHttpClient({ trustedCertificateAuthorities: [certificatePem] });
      const full = await client.open({
        url: `${identity.origin}/runtime/cpu.tar.gz`,
        rangeStart: null,
        ifRange: null,
        signal: new AbortController().signal,
      });
      assert.equal(full.status, 200);
      assert.deepEqual(await body(full), artifact);
      assert.equal(full.headers.etag, `"sha256-${sha256Bytes(artifact)}"`);

      const resumed = await client.open({
        url: `${identity.origin}/runtime/cpu.tar.gz`,
        rangeStart: 7,
        ifRange: full.headers.etag,
        signal: new AbortController().signal,
      });
      assert.equal(resumed.status, 206);
      assert.equal(resumed.headers.contentRange, `bytes 7-${artifact.byteLength - 1}/${artifact.byteLength}`);
      assert.deepEqual(await body(resumed), artifact.subarray(7));

      const missing = await client.open({
        url: `${identity.origin}/runtime/undeclared.tar.gz`,
        rangeStart: null,
        ifRange: null,
        signal: new AbortController().signal,
      });
      assert.equal(missing.status, 404);
      assert.deepEqual(await body(missing), Buffer.alloc(0));
    } finally {
      await server.stop();
    }
  });

  it('releases abandoned and cancelled HTTPS responses without external traffic', async () => {
    const server = new QualificationHttpsArtifactServer({ certificatePem, privateKeyPem }, [
      {
        route: '/runtime/cpu.tar.gz',
        filePath: artifactPath,
        sizeBytes: artifact.byteLength,
        sha256: sha256Bytes(artifact),
      },
    ]);
    const identity = await server.start();
    try {
      const client = new NodeArtifactHttpClient({ trustedCertificateAuthorities: [certificatePem] });
      const abandoned = await client.open({
        url: `${identity.origin}/runtime/cpu.tar.gz`,
        rangeStart: null,
        ifRange: null,
        signal: new AbortController().signal,
      });
      await Promise.all([abandoned.dispose(), abandoned.dispose()]);

      const controller = new AbortController();
      const cancelled = await client.open({
        url: `${identity.origin}/runtime/cpu.tar.gz`,
        rangeStart: null,
        ifRange: null,
        signal: controller.signal,
      });
      controller.abort();
      await cancelled.dispose();
    } finally {
      await server.stop();
    }
  });

  it('rejects an object whose frozen identity changed before bind', async () => {
    await assert.rejects(
      new QualificationHttpsArtifactServer({ certificatePem, privateKeyPem }, [
        {
          route: '/runtime/cpu.tar.gz',
          filePath: artifactPath,
          sizeBytes: artifact.byteLength,
          sha256: '0'.repeat(64),
        },
      ]).start(),
      /Invalid/u,
    );
  });
});
