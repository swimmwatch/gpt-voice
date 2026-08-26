import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RepositorySecurityGatePolicy,
  type RepositorySecurityGate,
} from '@scripts/security/repositorySecurityGatePolicy';

const GATES: readonly RepositorySecurityGate[] = ['dependency', 'npm-signatures', 'secrets', 'docker'];

describe('Repository security gate policy', () => {
  it('accepts clean aggregate gate evidence', () => {
    assert.doesNotThrow(() =>
      new RepositorySecurityGatePolicy().verify({
        dependency: () => {},
        docker: () => {},
        npmSignatures: () => {},
        secrets: () => {},
      }),
    );
  });

  for (const failedGate of GATES) {
    it(`propagates a failed ${failedGate} gate without raw failure output`, () => {
      const rawFailure = '/private/repository-security-canary';
      assert.throws(
        () =>
          new RepositorySecurityGatePolicy().verify({
            dependency: () => {
              if (failedGate === 'dependency') throw new Error(rawFailure);
            },
            docker: () => {
              if (failedGate === 'docker') throw new Error(rawFailure);
            },
            npmSignatures: () => {
              if (failedGate === 'npm-signatures') throw new Error(rawFailure);
            },
            secrets: () => {
              if (failedGate === 'secrets') throw new Error(rawFailure);
            },
          }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === `Repository security gate failed: ${failedGate}` &&
          !error.message.includes(rawFailure),
      );
    });
  }
});
