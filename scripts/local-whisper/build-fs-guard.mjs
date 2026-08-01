import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const sourcePath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'fs-guard',
  process.platform === 'win32' ? 'windows_main.cpp' : 'main.cpp',
);
const outputPath = resolve(
  workspaceRoot,
  '.cache',
  'local-whisper',
  'fs-guard',
  process.platform === 'win32' ? 'fs-guard.exe' : 'fs-guard',
);

mkdirSync(dirname(outputPath), { mode: 0o700, recursive: true });

const invocation =
  process.platform === 'win32'
    ? {
        command: 'cl.exe',
        arguments: [
          '/nologo',
          '/std:c++20',
          '/EHsc',
          '/W4',
          '/WX',
          `/Fe:${outputPath}`,
          sourcePath,
          'advapi32.lib',
          'bcrypt.lib',
        ],
      }
    : {
        command: process.env.CXX || 'c++',
        arguments: [
          '-std=c++20',
          '-O2',
          '-Wall',
          '-Wextra',
          '-Werror',
          '-fstack-protector-strong',
          '-D_FORTIFY_SOURCE=2',
          sourcePath,
          '-o',
          outputPath,
        ],
      };

const result = spawnSync(invocation.command, invocation.arguments, {
  cwd: workspaceRoot,
  encoding: 'utf8',
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || 'Local Whisper fs-guard build failed\n');
  process.exit(result.status ?? 1);
}

process.stdout.write(`${outputPath}\n`);
