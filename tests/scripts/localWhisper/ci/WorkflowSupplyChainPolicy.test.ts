import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  ACTIONLINT_IMAGE,
  FEDORA_44_IMAGE,
  WorkflowSupplyChainPolicyVerifier,
} from '@scripts/local-whisper/ci/WorkflowSupplyChainPolicyVerifier';
import { WORKSPACE_ROOT } from '../packaging/packagingTestUtils';

const fixtureDirectory = path.join(WORKSPACE_ROOT, 'tests', 'fixtures', 'localWhisper', 'workflow-policy');
const safeDockerfile = `FROM ${FEDORA_44_IMAGE}\n`;

async function fixture(name: string): Promise<string> {
  return readFile(path.join(fixtureDirectory, name), 'utf8');
}

async function verifyFixture(name: string): Promise<void> {
  new WorkflowSupplyChainPolicyVerifier().verify({
    fedoraDockerfile: safeDockerfile,
    workflows: { 'actionlint.yml': `${await fixture(name)}\n# ${ACTIONLINT_IMAGE}\n` },
  });
}

describe('Workflow supply-chain policy', () => {
  it('accepts immutable actions, least privilege, nonpersistent checkout, and trusted cache inputs', async () => {
    await verifyFixture('safe.yml');
  });

  for (const [fixtureName, expected] of [
    ['mutable-action.yml', /mutable or uncommented Action/u],
    ['excessive-permissions.yml', /permissions/u],
    ['persisted-checkout.yml', /persist-credentials/u],
    ['unsafe-interpolation.yml', /untrusted data/u],
    ['unverified-download.yml', /unverified download/u],
    ['untrusted-cache.yml', /untrusted cache/u],
    ['broad-analyzer-suppression.yml', /broad analyzer suppression/u],
    ['tag-only-container.yml', /tag@sha256/u],
  ] as const) {
    it(`rejects ${fixtureName}`, async () => {
      await assert.rejects(() => verifyFixture(fixtureName), expected);
    });
  }

  it('rejects a builder tag without a reviewed digest', async () => {
    await assert.rejects(
      async () =>
        new WorkflowSupplyChainPolicyVerifier().verify({
          fedoraDockerfile: 'FROM fedora:44\n',
          workflows: { 'actionlint.yml': `${await fixture('safe.yml')}\n# ${ACTIONLINT_IMAGE}\n` },
        }),
      /tag@sha256/u,
    );
  });

  it('rejects an unreviewed Fedora digest', async () => {
    await assert.rejects(
      async () =>
        new WorkflowSupplyChainPolicyVerifier().verify({
          fedoraDockerfile: `FROM fedora:44@sha256:${'0'.repeat(64)}\n`,
          workflows: { 'actionlint.yml': `${await fixture('safe.yml')}\n# ${ACTIONLINT_IMAGE}\n` },
        }),
      /unreviewed image digest/u,
    );
  });

  it('rejects a mutable external action in a local composite action', () => {
    assert.throws(
      () =>
        new WorkflowSupplyChainPolicyVerifier().verify({
          actions: {
            'setup-ci-project/action.yml': `runs:\n  using: composite\n  steps:\n    - uses: actions/setup-node@v7\n`,
          },
          fedoraDockerfile: safeDockerfile,
          workflows: { 'actionlint.yml': `# ${ACTIONLINT_IMAGE}\njobs: {}\npermissions:\n  contents: read\n` },
        }),
      /mutable or uncommented Action/u,
    );
  });
});
