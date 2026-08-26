import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toLocalWhisperArtifactId } from '@shared/localWhisper';

import {
  qualificationRuntimeArchiveBuildDigest,
  qualificationRuntimeRevision,
} from '../../../../scripts/local-whisper/qualification/LinuxQualificationEvidenceLoader';

const DIGEST = 'a'.repeat(64);
const WORKER_ID = toLocalWhisperArtifactId('worker')!;

const expectedFiles = Object.freeze([
  Object.freeze({
    fileId: WORKER_ID,
    kind: 'executable' as const,
    mode: 0o755,
    sizeBytes: 1024,
    sha256: DIGEST,
  }),
]);

describe('qualificationRuntimeRevision', () => {
  it('preserves the exact revision compiled into each reproducible runtime pack', () => {
    assert.equal(
      qualificationRuntimeRevision('cpu', 'linux-x64-cpu-baseline-v1'),
      'whisper-cpp-linux-x64-cpu-baseline-v1',
    );
    assert.equal(
      qualificationRuntimeRevision('cuda', 'linux-x64-cuda-12.8.1-sm120a-v1'),
      'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
    );
  });

  it('rejects candidate-version-derived or cross-backend profile identities', () => {
    assert.throws(() => qualificationRuntimeRevision('cpu', 'linux-x64-cpu-v2.4.0'), /profile invalid/u);
    assert.throws(() => qualificationRuntimeRevision('cuda', 'linux-x64-cpu-baseline-v1'), /profile invalid/u);
  });
});

describe('qualificationRuntimeArchiveBuildDigest', () => {
  it('uses the digest compiled into the authenticated runtime archive', () => {
    assert.equal(
      qualificationRuntimeArchiveBuildDigest('linux-x64-cpu-baseline-v1', expectedFiles, {
        expectedFiles,
        profileId: 'linux-x64-cpu-baseline-v1',
        runtimeBuildDigest: DIGEST,
        workerSha256: DIGEST,
      }),
      DIGEST,
    );
  });

  it('rejects a profile or expected-file mismatch', () => {
    const evidence = {
      expectedFiles,
      profileId: 'linux-x64-cpu-baseline-v1' as const,
      runtimeBuildDigest: DIGEST,
      workerSha256: DIGEST,
    };
    assert.throws(
      () => qualificationRuntimeArchiveBuildDigest('linux-x64-cuda-12.8.1-sm120a-v1', expectedFiles, evidence),
      /archive evidence mismatch/u,
    );
    assert.throws(
      () => qualificationRuntimeArchiveBuildDigest(evidence.profileId, Object.freeze([]), evidence),
      /archive evidence mismatch/u,
    );
  });
});
