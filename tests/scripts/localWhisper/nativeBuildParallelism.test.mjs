import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveNativeBuildJobs } from '../../../scripts/local-whisper/native-build/native-build-parallelism.mjs';

const GIBIBYTE = 1024 ** 3;

describe('native build parallelism', () => {
  it('uses bounded multi-core CUDA and CPU parallelism', () => {
    assert.equal(resolveNativeBuildJobs({ backend: 'cuda', availableCores: 24, freeMemoryBytes: 10 * GIBIBYTE }), 8);
    assert.equal(resolveNativeBuildJobs({ backend: 'cpu', availableCores: 24, freeMemoryBytes: 10 * GIBIBYTE }), 16);
    assert.equal(resolveNativeBuildJobs({ backend: 'cuda', availableCores: 24, freeMemoryBytes: 30 * GIBIBYTE }), 8);
    assert.equal(resolveNativeBuildJobs({ backend: 'cpu', availableCores: 24, freeMemoryBytes: 30 * GIBIBYTE }), 24);
  });

  it('does not oversubscribe constrained hosts', () => {
    assert.equal(resolveNativeBuildJobs({ backend: 'cuda', availableCores: 4, freeMemoryBytes: 30 * GIBIBYTE }), 4);
    assert.equal(resolveNativeBuildJobs({ backend: 'cpu', availableCores: 24, freeMemoryBytes: GIBIBYTE }), 1);
  });

  it('accepts only canonical affinity-bounded overrides', () => {
    assert.equal(
      resolveNativeBuildJobs({
        backend: 'cuda',
        availableCores: 24,
        freeMemoryBytes: GIBIBYTE,
        override: '12',
      }),
      12,
    );
    for (const override of ['0', '01', '-1', '2.5', '25', 'unbounded']) {
      assert.throws(
        () => resolveNativeBuildJobs({ backend: 'cpu', availableCores: 24, freeMemoryBytes: 30 * GIBIBYTE, override }),
        /LOCAL_WHISPER_BUILD_JOBS/u,
      );
    }
  });
});
