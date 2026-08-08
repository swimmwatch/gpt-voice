import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import {
  PublicModelTransportQualification,
  writePublicModelTransportEvidence,
} from './PublicModelTransportQualification';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const qualificationRoot = path.join(workspaceRoot, '.cache', 'local-whisper', 'qualification');

async function main(): Promise<void> {
  await mkdir(qualificationRoot, { recursive: true, mode: 0o700 });
  const workRoot = await mkdtemp(path.join(qualificationRoot, 'public-model-transport-'));
  try {
    const model = LOCAL_WHISPER_RELEASE_MODEL_MATRIX[0];
    if (!model) throw new Error('Local Whisper release model matrix is empty');
    const evidence = await new PublicModelTransportQualification().run({
      model,
      workRoot,
      modelCacheRoot: path.join(qualificationRoot, 'models'),
    });
    await writePublicModelTransportEvidence(
      path.join(qualificationRoot, 'evidence', 'public-model-transport-v1.json'),
      evidence,
    );
    process.stdout.write('Local Whisper public model transport qualification passed\n');
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Public model transport qualification failed'}\n`);
  process.exitCode = 1;
});
