import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { generateLocalePages } from '../../../src/landing-page/build/generate-locales';

export async function createGeneratedEnglishPage(temporaryDirectoryPrefix: string): Promise<string> {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), temporaryDirectoryPrefix));
  await writeFile(
    path.join(outputDirectory, 'index.html'),
    '<!doctype html><html lang="en"><head><title>Placeholder</title><script type="module" src="/gpt-voice/assets/index.js"></script></head><body><div id="root"></div><script nomodule id="vite-legacy-entry" src="/gpt-voice/assets/index-legacy.js"></script></body></html>',
  );
  await generateLocalePages({ outputDirectory });

  return outputDirectory;
}
