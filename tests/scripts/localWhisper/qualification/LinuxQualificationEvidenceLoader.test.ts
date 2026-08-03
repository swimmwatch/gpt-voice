import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { qualificationRuntimeRevision } from '../../../../scripts/local-whisper/qualification/LinuxQualificationEvidenceLoader';

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
