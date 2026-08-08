import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { it } from 'node:test';

import { EphemeralQualificationTlsIdentityFactory } from '../../../../scripts/local-whisper/qualification/EphemeralQualificationTlsIdentity';

it(
  'creates and destroys one private loopback qualification TLS identity',
  { skip: process.platform !== 'linux' },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-tls-test-'));
    try {
      const identity = await new EphemeralQualificationTlsIdentityFactory().create(root);
      assert.match(identity.certificatePem, /BEGIN CERTIFICATE/u);
      assert.match(identity.privateKeyPem, /BEGIN PRIVATE KEY/u);
      assert.match(identity.certificateSha256, /^[a-f0-9]{64}$/u);
      await identity.destroy();
      assert.deepEqual(await readdir(root), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
