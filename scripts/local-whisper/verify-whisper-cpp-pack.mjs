import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { parseArguments, removeTaskOwnedTree, taskCacheRoot } from './whisper-cpp-build-core.mjs';
import { CUDA_PROFILE, verifyLinuxCudaPack } from './verify-whisper-cpp-device.mjs';

const CPU_PROFILE = 'linux-x64-cpu-baseline-v1';

function auditCuda() {
  const pack = verifyLinuxCudaPack();
  const auditRoot = resolve(taskCacheRoot, 'audit', CUDA_PROFILE);
  removeTaskOwnedTree(auditRoot);
  mkdirSync(auditRoot, { mode: 0o700, recursive: true });
  const relocated = resolve(auditRoot, 'relocated');
  cpSync(pack.root, relocated, { recursive: true });
  const malicious = resolve(auditRoot, 'malicious-cwd');
  mkdirSync(malicious, { mode: 0o700 });
  for (const name of ['libcudart.so.12', 'libcublas.so.12', 'libcublasLt.so.12', 'libggml-cuda.so'])
    writeFileSync(resolve(malicious, name), 'not a runtime library\n', { mode: 0o600 });
  const binary = resolve(relocated, 'bin', 'local-whisper-whisper-cpp-worker');
  chmodSync(binary, 0o500);
  const result = spawnSync('/usr/bin/unshare', ['--user', '--map-root-user', '--net', binary, '--self-test'], {
    cwd: malicious,
    env: {
      LANG: 'C',
      LC_ALL: 'C',
      PATH: `${malicious}:/usr/bin:/bin`,
      GGML_BACKEND_PATH: malicious,
      LD_LIBRARY_PATH: malicious,
    },
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.stdout, 'LOCAL_WHISPER_CPP_CPU_SELF_TEST_OK\n');
  assert.equal(result.stderr, '');
}

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = arguments_.get('profile');
  if (profileId === CUDA_PROFILE) auditCuda();
  else if (profileId === CPU_PROFILE) {
    const result = spawnSync(
      process.execPath,
      [resolve(import.meta.dirname, 'verify-whisper-cpp-cpu.mjs'), '--mode=audit', `--profile=${CPU_PROFILE}`],
      { encoding: 'utf8', shell: false },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } else throw new Error('Pack audit accepts only Task-11 Linux CPU/CUDA profiles');
  process.stdout.write(`Local Whisper pack audited: ${profileId}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp pack audit failed'}\n`);
  process.exitCode = 1;
}
