import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { LOCAL_WHISPER_RELEASE_TARGETS } from './ReleaseProtocol';
import { ReleaseWorkflowPolicyVerifier } from './ReleaseWorkflowPolicyVerifier';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');
const SUPPORTED_MODES = new Set([
  'build',
  'ci-builds',
  'delivery',
  'final-lineage',
  'origin',
  'preparation',
  'release-merge',
  'release-policy',
  'release-candidates',
  'deploy',
]);

function option(name: string): string | undefined {
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

async function main(): Promise<void> {
  const mode = option('mode') ?? 'release-policy';
  if (!SUPPORTED_MODES.has(mode)) throw new Error('RELEASE_VERIFICATION_MODE_INVALID');
  const target = option('target');
  if (target && target !== LOCAL_WHISPER_RELEASE_TARGETS.alpha && target !== LOCAL_WHISPER_RELEASE_TARGETS.final) {
    throw new Error('RELEASE_VERIFICATION_TARGET_INVALID');
  }
  const workflow = await readFile(path.join(WORKSPACE_ROOT, '.github', 'workflows', 'release-builds.yml'), 'utf8');
  new ReleaseWorkflowPolicyVerifier().verify(workflow);
  process.stdout.write(`Local Whisper ${mode} policy verified${target ? ` for ${target}` : ''}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Local Whisper release policy verification failed'}\n`,
  );
  process.exitCode = 1;
});
