import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { WorkflowPolicyVerifier } from '@scripts/local-whisper/packaging/WorkflowPolicyVerifier';

import { WORKSPACE_ROOT } from './packagingTestUtils';

async function inputs() {
  const [fixtureWorkflow, releaseWorkflow, fedoraEntrypoint] = await Promise.all([
    readFile(path.join(WORKSPACE_ROOT, '.github', 'workflows', 'local-whisper-packaging.yml'), 'utf8'),
    readFile(path.join(WORKSPACE_ROOT, '.github', 'workflows', 'release-builds.yml'), 'utf8'),
    readFile(path.join(WORKSPACE_ROOT, 'build', 'fedora-release', 'fedora-release-entrypoint.mjs'), 'utf8'),
  ]);
  return { fixtureWorkflow, releaseWorkflow, fedoraEntrypoint };
}

describe('Local Whisper packaging workflow policy', () => {
  it('parses the producer, authorization-gated consumer matrix, and release guards', async () => {
    new WorkflowPolicyVerifier().verify(await inputs());
    assert.ok(true);
  });

  it('rejects a second producer and a missing Windows authorization input', async () => {
    const actual = await inputs();
    assert.throws(
      () =>
        new WorkflowPolicyVerifier().verify({
          ...actual,
          fixtureWorkflow: `${actual.fixtureWorkflow}\n# generate:local-whisper:packaging:fixture\n`,
        }),
      /exactly one producer/u,
    );
    assert.throws(
      () =>
        new WorkflowPolicyVerifier().verify({
          ...actual,
          fixtureWorkflow: actual.fixtureWorkflow.replace(
            '      windows_qualification_authorized:',
            '      removed_input:',
          ),
        }),
      /authorization/u,
    );
  });

  it('rejects an unguarded Fedora release collection', async () => {
    const actual = await inputs();
    assert.throws(
      () =>
        new WorkflowPolicyVerifier().verify({
          ...actual,
          fedoraEntrypoint: actual.fedoraEntrypoint.replace(/if \(productionPackaging\) \{/gu, 'if (true) {'),
        }),
      /release-collection guard/u,
    );
  });
});
