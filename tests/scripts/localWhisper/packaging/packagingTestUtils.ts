import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { LocalWhisperHelperInputs } from '@scripts/local-whisper/packaging/PackageStager';

export const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

export async function createSyntheticHelpers(root: string, platform: 'linux' | 'win32' = 'linux') {
  const helperRoot = path.join(root, 'helpers');
  await mkdir(helperRoot, { mode: 0o700, recursive: true });
  const extension = platform === 'win32' ? '.exe' : '';
  const filesystemGuard = path.join(helperRoot, `fs-guard${extension}`);
  const launcher = path.join(helperRoot, `local-whisper-launcher${extension}`);
  await Promise.all([
    writeFile(filesystemGuard, `synthetic ${platform} filesystem guard helper\n`, { mode: 0o500 }),
    writeFile(launcher, `synthetic ${platform} launcher helper\n`, { mode: 0o500 }),
  ]);
  return {
    filesystemGuard,
    launcher,
    license: path.join(WORKSPACE_ROOT, 'LICENSE'),
  } satisfies LocalWhisperHelperInputs;
}
