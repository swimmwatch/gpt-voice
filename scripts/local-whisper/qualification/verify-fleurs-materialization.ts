import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { readCanonicalJson, sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const materializer = path.join(__dirname, 'fleurs_materializer.py');
const sourceRoot = path.join(workspaceRoot, '.cache', 'local-whisper', 'qualification', 'fleurs', 'source');
const selectionPath = path.join(
  workspaceRoot,
  'docs',
  'specs',
  'local-whisper',
  'qualification',
  'fleurs-selection-v1.json',
);

async function treeIdentity(root: string, prefix = ''): Promise<readonly { path: string; sha256: string }[]> {
  const result: { path: string; sha256: string }[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      throw new Error('Unsafe generated FLEURS entry');
    }
    if (entry.isDirectory()) result.push(...(await treeIdentity(entryPath, relativePath)));
    else result.push({ path: relativePath, sha256: await sha256File(entryPath) });
  }
  return result.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

function runMaterializer(output: string, selection: string): SpawnSyncReturns<string> {
  return spawnSync(
    'python3',
    [
      materializer,
      '--mode=materialize',
      `--source-root=${sourceRoot}`,
      `--selection=${selection}`,
      `--output=${output}`,
    ],
    { cwd: workspaceRoot, encoding: 'utf8', shell: false },
  );
}

async function assertMutationRejected(
  root: string,
  selection: unknown,
  name: string,
  mutate: (value: Record<string, unknown>) => void,
): Promise<void> {
  const mutated = structuredClone(selection) as Record<string, unknown>;
  mutate(mutated);
  const mutationPath = path.join(root, `${name}.json`);
  await writeCanonicalJson(mutationPath, mutated);
  const result = runMaterializer(path.join(root, `${name}-output`), mutationPath);
  if (result.status === 0) throw new Error(`FLEURS materializer accepted ${name} mutation`);
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-fleurs-verification-'));
  try {
    const left = path.join(root, 'left');
    const right = path.join(root, 'right');
    for (const output of [left, right]) {
      const result = runMaterializer(output, selectionPath);
      if (result.status !== 0) throw new Error(result.stderr || 'FLEURS materialization failed');
    }
    const [leftTree, rightTree] = await Promise.all([treeIdentity(left), treeIdentity(right)]);
    if (JSON.stringify(leftTree) !== JSON.stringify(rightTree)) {
      throw new Error('Independent FLEURS materializations differ');
    }
    const manifest = await readCanonicalJson(path.join(left, 'corpus-manifest.json'));
    const manifestText = serializeCanonicalLocalWhisperCatalogJson(manifest);
    if (
      /speaker|gender|localPath|sourcePath|\/home\/|\\Users\\/iu.test(manifestText) ||
      leftTree.filter(({ path: filePath }) => filePath.startsWith('clips/')).length < 20 ||
      leftTree.filter(({ path: filePath }) => filePath.startsWith('performance/')).length !== 5
    ) {
      throw new Error('FLEURS evidence privacy or completeness validation failed');
    }

    const selection = JSON.parse(await readFile(selectionPath, 'utf8')) as unknown;
    await assertMutationRejected(root, selection, 'source', (value) => {
      const sources = value.sources as { locales: { en_us: { tsv: { sha256: string } } } };
      sources.locales.en_us.tsv.sha256 = '0'.repeat(64);
    });
    await assertMutationRejected(root, selection, 'license', (value) => {
      (value.license as { id: string }).id = 'UNKNOWN';
    });
    await assertMutationRejected(root, selection, 'tool', (value) => {
      value.materializerId = 'unreviewed-materializer';
    });
    await assertMutationRejected(root, selection, 'conversion', (value) => {
      const locales = value.locales as { en_us: { clips: { canonicalWavSha256: string }[] } };
      locales.en_us.clips[0]!.canonicalWavSha256 = '0'.repeat(64);
    });
    await assertMutationRejected(root, selection, 'private-field', (value) => {
      value.sourcePath = '/home/private/audio.wav';
    });
    const corpus = manifest as { corpusManifestDigest?: unknown };
    if (typeof corpus.corpusManifestDigest !== 'string') throw new Error('FLEURS corpus digest is missing');
    process.stdout.write(
      `${JSON.stringify({ corpusManifestDigest: corpus.corpusManifestDigest, treeFiles: leftTree.length })}\n`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'FLEURS verification failed'}\n`);
  process.exitCode = 1;
});
