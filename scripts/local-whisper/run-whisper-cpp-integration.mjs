import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, '..', '..');

function parseBackend(arguments_) {
  const backendArgument = arguments_.find((value) => value.startsWith('--backend='));
  const backend = backendArgument?.slice('--backend='.length);
  if ((backend !== 'cpu' && backend !== 'cuda') || arguments_.length !== 1) {
    throw new Error('Expected exactly --backend=cpu or --backend=cuda');
  }
  return backend;
}

function integrationArguments(backend) {
  if (process.platform === 'win32') {
    return [
      '--import',
      'tsx',
      'scripts/local-whisper/verify-whisper-cpp-windows-integration.ts',
      `--backend=${backend}`,
    ];
  }
  if (process.platform === 'linux' && backend === 'cpu') {
    return [
      'scripts/local-whisper/verify-whisper-cpp-cpu.mjs',
      '--mode=integration',
      '--profile=linux-x64-cpu-baseline-v1',
    ];
  }
  if (process.platform === 'linux' && backend === 'cuda') {
    return [
      'scripts/local-whisper/verify-whisper-cpp-cuda-integration.mjs',
      '--profile=linux-x64-cuda-12.8.1-sm120a-v1',
    ];
  }
  throw new Error(`Whisper.cpp ${backend} integration is unavailable on ${process.platform}`);
}

try {
  const backend = parseBackend(process.argv.slice(2));
  const result = spawnSync(process.execPath, integrationArguments(backend), {
    cwd: WORKSPACE_ROOT,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp integration failed'}\n`);
  process.exitCode = 1;
}
