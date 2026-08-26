import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

import { PinnedModelSetMaterializer } from './PinnedModelSetMaterializer';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const qualificationRoot = path.join(workspaceRoot, '.cache', 'local-whisper', 'qualification');

async function main(): Promise<void> {
  await mkdir(qualificationRoot, { recursive: true, mode: 0o700 });
  const manifest = await new PinnedModelSetMaterializer().materialize({
    cacheRoot: path.join(qualificationRoot, 'models'),
    workRoot: path.join(qualificationRoot, 'model-downloads'),
    ...(process.env.LOCAL_WHISPER_QUALIFICATION_MODEL_IMPORT_ROOT
      ? { importRoot: process.env.LOCAL_WHISPER_QUALIFICATION_MODEL_IMPORT_ROOT }
      : {}),
  });
  process.stdout.write(
    `${JSON.stringify({ manifestDigest: manifest.manifestDigest, modelCount: manifest.models.length })}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper model materialization failed'}\n`);
  process.exitCode = 1;
});
