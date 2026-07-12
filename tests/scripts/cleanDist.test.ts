import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

interface CleanDistModule {
  cleanDistDirectory: (directory?: string) => Promise<void>;
}

const projectRoot = path.resolve(__dirname, '..', '..');
const modulePath = path.join(projectRoot, 'scripts', 'clean-dist.mjs');

function isCleanDistModule(value: unknown): value is CleanDistModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).cleanDistDirectory === 'function'
  );
}

test('cleanDistDirectory removes stale nested output while keeping the output directory', async () => {
  const importedModule: unknown = await import(pathToFileURL(modulePath).href);
  assert.ok(isCleanDistModule(importedModule));
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-clean-dist-'));
  const distDirectory = path.join(rootDirectory, 'dist');
  await mkdir(path.join(distDirectory, 'assets'), { recursive: true });
  await Promise.all([
    writeFile(path.join(distDirectory, 'renderer.js'), 'stale renderer'),
    writeFile(path.join(distDirectory, 'renderer.js.map'), 'stale source map'),
    writeFile(path.join(distDirectory, 'assets', 'flag.hash.svg'), 'stale asset'),
  ]);

  await importedModule.cleanDistDirectory(distDirectory);

  assert.deepEqual(await readdir(distDirectory), []);
});
