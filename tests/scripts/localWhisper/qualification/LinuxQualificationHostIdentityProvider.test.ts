import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LinuxQualificationHostIdentityProvider,
  type LinuxQualificationSourceIdentityInput,
} from '../../../../scripts/local-whisper/qualification/LinuxQualificationHostIdentityProvider';
import type { QualificationCommandPort } from '../../../../scripts/local-whisper/qualification/QualificationCommandRunner';

const SOURCE_COMMIT = 'b'.repeat(40);
const MANIFEST_DIGEST = 'a'.repeat(64);

class SourceIdentityCommandPort implements QualificationCommandPort {
  public async run(request: Parameters<QualificationCommandPort['run']>[0]): Promise<string> {
    if (request.command === 'git' && request.arguments[0] === 'status') return '';
    if (request.command === 'git' && request.arguments[0] === 'rev-parse') return SOURCE_COMMIT;
    if (request.command === 'git' && request.arguments[0] === 'ls-tree') return '100644 blob source-lock';
    if (request.command === '/usr/bin/git' && request.arguments[0] === '--version') return 'git version 2.43.0';
    throw new Error('Unexpected source identity command');
  }
}

async function sourceFixture(root: string): Promise<LinuxQualificationSourceIdentityInput> {
  const lockPath = path.join(root, 'runtime/local-whisper/sources/locks/whisper-cpp-v1.9.1-f049fff.json');
  const patchPath = path.join(
    root,
    'runtime/local-whisper/whisper-cpp/patches/device-cancel/local-whisper-whisper-cpp-device-cancel-v1.json',
  );
  await Promise.all([
    mkdir(path.dirname(lockPath), { recursive: true }),
    mkdir(path.dirname(patchPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(lockPath, JSON.stringify({ materialization: { manifestSha256: MANIFEST_DIGEST } }, null, 2), 'utf8'),
    writeFile(patchPath, '{"patch":"fixture"}', 'utf8'),
  ]);
  return Object.freeze({ candidateWorktree: root, sourceCommit: SOURCE_COMMIT });
}

describe('LinuxQualificationHostIdentityProvider', () => {
  it('accepts the bounded tracked source-lock representation without rewriting its bytes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-host-identity-test-'));
    try {
      const input = await sourceFixture(root);
      const identity = await new LinuxQualificationHostIdentityProvider(new SourceIdentityCommandPort()).source(input);
      assert.equal(identity.candidate.commit, SOURCE_COMMIT);
      assert.equal(identity.candidate.sharedSourceManifestDigest, MANIFEST_DIGEST);
      assert.equal(identity.sharedTools.length, 2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
