import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { RunnerPolicyVerifier } from './RunnerPolicyVerifier';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const workflow = await readFile(path.join(workspaceRoot, '.github', 'workflows', 'pr-checks.yml'), 'utf8');
  new RunnerPolicyVerifier().verify(workflow);
  process.stdout.write('Native CI runner policy verified\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native CI runner policy failed'}\n`);
  process.exitCode = 1;
});
