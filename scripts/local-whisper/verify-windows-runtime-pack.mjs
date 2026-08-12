import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import process from 'node:process';

import { canonicalDigest, readJson, sha256 } from './source-import/native-source-core.mjs';
import { readVerifiedRegularFileSync } from './secure-file-reader.mjs';
import { removeTaskOwnedTree, taskCacheRoot } from './whisper-cpp-build-core.mjs';

export const WINDOWS_CPU_PROFILE = 'windows-x64-cpu-msvc-19.39-v1';
export const WINDOWS_CUDA_PROFILE = 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1';

function allFiles(root, current = root) {
  const result = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) result.push(...allFiles(root, path));
    else if (entry.isFile()) result.push(relative(root, path).replaceAll('\\', '/'));
    else throw new Error('Windows runtime stage contains a link or unsupported file type');
  }
  return result.sort();
}

export function auditWindows(profileId) {
  if (process.platform !== 'win32') throw new Error('Windows runtime audit requires native Windows');
  if (profileId !== WINDOWS_CPU_PROFILE && profileId !== WINDOWS_CUDA_PROFILE) {
    throw new Error('Windows runtime audit received an unsupported profile');
  }
  const backend = profileId === WINDOWS_CUDA_PROFILE ? 'cuda' : 'cpu';
  const root = resolve(taskCacheRoot, 'stage', profileId);
  const expected = readJson(resolve(root, 'expected-files.json'));
  const manifest = readJson(resolve(root, 'runtime-manifest.json'));
  assert.equal(expected.schemaId, 'local-whisper-expected-files-v1');
  assert.equal(manifest.profileId, profileId);
  assert.equal(manifest.platform, 'win32');
  assert.equal(manifest.architecture, 'x64');
  assert.equal(manifest.backend, backend);
  assert.equal(manifest.payloadManifestSha256, canonicalDigest(expected.files));
  const expectedPaths = [
    ...expected.files.map((file) => file.relativePath),
    'expected-files.json',
    'runtime-manifest.json',
  ].sort();
  assert.deepEqual(allFiles(root), expectedPaths);
  for (const file of expected.files) {
    const path = resolve(root, ...file.relativePath.split('/'));
    const { bytes, stat: metadata } = readVerifiedRegularFileSync(path);
    assert.equal(metadata.isFile(), true);
    assert.equal(file.mode, 0);
    assert.equal(metadata.size, file.sizeBytes);
    assert.equal(sha256(bytes), file.sha256);
  }
  const dlls = allFiles(resolve(root, 'bin'))
    .filter((path) => path.toLowerCase().endsWith('.dll'))
    .map((path) => path.toLowerCase());
  const expectedDlls =
    backend === 'cuda'
      ? [
          'cublas64_12.dll',
          'cublaslt64_12.dll',
          'cudart64_12.dll',
          'msvcp140.dll',
          'vcruntime140.dll',
          'vcruntime140_1.dll',
        ]
      : ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'];
  assert.deepEqual(dlls.sort(), expectedDlls.sort());

  const auditRoot = resolve(taskCacheRoot, 'audit', profileId);
  removeTaskOwnedTree(auditRoot);
  const relocated = resolve(auditRoot, 'relocated');
  const malicious = resolve(auditRoot, 'malicious-cwd');
  mkdirSync(auditRoot, { mode: 0o700, recursive: true });
  cpSync(root, relocated, { recursive: true });
  mkdirSync(malicious, { mode: 0o700 });
  for (const name of expectedDlls) writeFileSync(resolve(malicious, name), 'not a runtime library\n', { mode: 0o600 });
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !process.env.TEMP || !process.env.WINDIR)
    throw new Error('Windows clean-start environment is absent');
  const binary = resolve(relocated, manifest.executable);
  const result = spawnSync(binary, ['--self-test'], {
    cwd: malicious,
    env: {
      GGML_BACKEND_PATH: malicious,
      PATH: `${malicious};${resolve(systemRoot, 'System32')}`,
      SystemRoot: systemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP ?? process.env.TEMP,
      WINDIR: process.env.WINDIR,
    },
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.stdout.replaceAll('\r\n', '\n'), 'LOCAL_WHISPER_CPP_CPU_SELF_TEST_OK\n');
  assert.equal(result.stderr, '');
  return { binary, manifest, root };
}
