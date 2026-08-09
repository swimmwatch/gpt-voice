import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { WorkflowSupplyChainPolicyVerifier } from './WorkflowSupplyChainPolicyVerifier';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const workflowDirectory = path.join(workspaceRoot, '.github', 'workflows');
  const names = (await readdir(workflowDirectory)).filter((name) => name.endsWith('.yml')).sort();
  const workflowEntries = await Promise.all(
    names.map(async (name) => [name, await readFile(path.join(workflowDirectory, name), 'utf8')] as const),
  );
  const fedoraDockerfile = await readFile(path.join(workspaceRoot, 'build', 'fedora-release', 'Dockerfile'), 'utf8');
  new WorkflowSupplyChainPolicyVerifier().verify({ fedoraDockerfile, workflows: Object.fromEntries(workflowEntries) });
  process.stdout.write('Workflow supply-chain policy verified\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Workflow supply-chain policy failed'}\n`);
  process.exitCode = 1;
});
