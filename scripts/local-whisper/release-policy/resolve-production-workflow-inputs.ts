import { appendFile, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { isRecord } from '../packaging/contracts';
import { resolveProductionWorkflowInputs } from './ProductionWorkflowInputs';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing production workflow input: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const packageDocument: unknown = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, 'package.json'), 'utf8'));
  if (!isRecord(packageDocument) || typeof packageDocument.version !== 'string') {
    throw new Error('Production workflow package revision is invalid');
  }
  const publishValue = requiredEnvironment('LOCAL_WHISPER_WORKFLOW_PUBLISH');
  if (publishValue !== 'true' && publishValue !== 'false') {
    throw new Error('Production workflow publish input must be true or false');
  }
  const resolved = resolveProductionWorkflowInputs({
    appRevision: packageDocument.version,
    candidateLabel: requiredEnvironment('LOCAL_WHISPER_WORKFLOW_CANDIDATE_LABEL'),
    publish: publishValue === 'true',
    releaseTag: process.env.LOCAL_WHISPER_WORKFLOW_RELEASE_TAG,
  });
  const outputPath = requiredEnvironment('GITHUB_OUTPUT');
  await appendFile(
    outputPath,
    `candidate_target=${resolved.candidateTarget}\ntarget_kind=${resolved.targetKind}\napp_revision=${resolved.appRevision}\n`,
    { encoding: 'utf8' },
  );
  process.stdout.write(`Production workflow inputs accepted for ${resolved.targetKind} construction\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Production workflow input validation failed'}\n`);
  process.exitCode = 1;
});
