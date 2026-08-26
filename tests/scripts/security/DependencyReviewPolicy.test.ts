import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DependencyReviewPolicy } from '@scripts/security/dependencyReviewPolicy';

describe('Dependency review policy', () => {
  it('accepts clean supported npm evidence and leaves native source locks unclassified', () => {
    const policy = new DependencyReviewPolicy();
    assert.doesNotThrow(() => policy.verify({ changedFiles: ['package-lock.json'], evidence: { advisories: [] } }));
    assert.doesNotThrow(() =>
      policy.verify({
        changedFiles: ['runtime/local-whisper/sources/whisper-cpp.lock.json'],
        evidence: 'not npm evidence',
      }),
    );
  });

  for (const [evidence, expected] of [
    [{ advisories: [{ severity: 'high' }] }, /high or critical/u],
    [{ advisories: [{ severity: 'critical' }] }, /high or critical/u],
    [{ advisories: [{ severity: 1 }] }, /evidence malformed/u],
    [{}, /evidence malformed/u],
  ] as const) {
    it('fails closed on a malformed or high-severity supported result', () => {
      assert.throws(() => new DependencyReviewPolicy().verify({ changedFiles: ['package.json'], evidence }), expected);
    });
  }
});
