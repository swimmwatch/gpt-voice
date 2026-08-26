import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { REQUIRED_RUNNER_LABELS, RunnerPolicyVerifier } from './RunnerPolicyVerifier';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const workflow = await readFile(path.join(workspaceRoot, '.github', 'workflows', 'pr-checks.yml'), 'utf8');
  new RunnerPolicyVerifier().verify(workflow, {
    linux: process.env.CI_LINUX_RUNNER ?? REQUIRED_RUNNER_LABELS.linux,
    windows: process.env.CI_WINDOWS_RUNNER ?? REQUIRED_RUNNER_LABELS.windows,
  });
  process.stdout.write('Native CI runner policy verified\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native CI runner policy failed'}\n`);
  process.exitCode = 1;
});
