import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { WorkflowPolicyVerifier } from './WorkflowPolicyVerifier';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const [fixtureWorkflow, releaseWorkflow, fedoraEntrypoint] = await Promise.all([
    readFile(path.join(workspaceRoot, '.github', 'workflows', 'local-whisper-packaging.yml'), 'utf8'),
    readFile(path.join(workspaceRoot, '.github', 'workflows', 'release-builds.yml'), 'utf8'),
    readFile(path.join(workspaceRoot, 'build', 'fedora-release', 'fedora-release-entrypoint.mjs'), 'utf8'),
  ]);
  new WorkflowPolicyVerifier().verify({ fixtureWorkflow, releaseWorkflow, fedoraEntrypoint });
  process.stdout.write('Local Whisper packaging workflow policy verified\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper workflow policy failed'}\n`);
  process.exitCode = 1;
});
