import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

import { resolveClangTidy } from '../native-quality-tools.mjs';

const FIXTURES = Object.freeze([
  'common-use-after-free.cpp',
  'fs-guard-use-after-free.cpp',
  'launcher-use-after-free.cpp',
  'worker-use-after-free.cpp',
]);

try {
  if (process.platform !== 'linux') throw new Error('Native analyzer proof is supported on Linux only');
  if (process.argv.length !== 2) throw new Error('Native analyzer proof does not accept arguments');
  const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');
  const clangRoot = resolve(
    workspaceRoot,
    '.cache',
    'local-whisper',
    'toolchains',
    'clang-18.1.3',
    'usr',
    'lib',
    'llvm-18',
    'bin',
  );
  const clangTidy = resolveClangTidy(workspaceRoot, clangRoot);
  if (!existsSync(clangTidy)) throw new Error(`Native analyzer is unavailable: ${clangTidy}`);
  for (const fixture of FIXTURES) {
    const path = resolve(workspaceRoot, 'tests', 'fixtures', 'local-whisper', 'native-analysis', fixture);
    const result = spawnSync(
      clangTidy,
      [path, '--checks=-*,clang-analyzer-*', '--warnings-as-errors=*', '--', '-std=c++20'],
      { cwd: workspaceRoot, shell: false, stdio: 'inherit' },
    );
    if (result.status === 0) throw new Error(`Native analyzer accepted the bad fixture: ${fixture}`);
  }
  process.stdout.write('Native analyzer negative proofs passed\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native analyzer proof failed'}\n`);
  process.exitCode = 1;
}
