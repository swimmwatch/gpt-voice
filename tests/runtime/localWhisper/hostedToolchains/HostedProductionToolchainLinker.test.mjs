import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { HostedProductionToolchainLinker } from '../../../../scripts/local-whisper/native-build/link-hosted-production-toolchain.mjs';

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-hosted-production-tools-'));
  const cmake = resolve(root, 'cmake', 'bin', 'cmake');
  const ninja = resolve(root, 'ninja', 'ninja');
  const cudaRoot = resolve(root, 'cuda');
  const cudaFiles = [
    'bin/nvcc',
    'EULA.txt',
    'targets/x86_64-linux/lib/libcudart.so.12',
    'targets/x86_64-linux/lib/libcublas.so.12',
    'targets/x86_64-linux/lib/libcublasLt.so.12',
  ];
  for (const file of [cmake, ninja, ...cudaFiles.map((entry) => resolve(cudaRoot, entry))]) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'fixture\n');
  }
  return {
    cmake,
    cmakeActionOutput: dirname(cmake),
    cudaRoot,
    destinationRoot: resolve(root, 'destination'),
    ninja,
    ninjaActionOutput: dirname(ninja),
    root,
  };
}

test('links only exact action-provisioned production tool versions into a fresh task root', () => {
  const input = fixture();
  const versions = new Map([
    [input.cmake, 'cmake version 3.31.8'],
    [input.ninja, '1.12.1'],
    [resolve(input.cudaRoot, 'bin', 'nvcc'), 'Cuda compilation tools, release 12.8, V12.8.93'],
  ]);
  const linker = new HostedProductionToolchainLinker({
    platform: 'linux',
    versionReader: (path) => versions.get(path),
  });
  linker.link({ ...input, cmake: input.cmakeActionOutput, ninja: input.ninjaActionOutput, platform: 'linux' });

  assert.equal(readlinkSync(resolve(input.destinationRoot, 'cmake-3.31.8')), resolve(input.root, 'cmake'));
  assert.equal(readlinkSync(resolve(input.destinationRoot, 'ninja-1.12.1')), resolve(input.root, 'ninja'));
  assert.equal(readlinkSync(resolve(input.destinationRoot, 'cuda-12.8.1')), input.cudaRoot);
  assert.throws(
    () =>
      linker.link({
        ...input,
        cmake: input.cmakeActionOutput,
        ninja: input.ninjaActionOutput,
        platform: 'linux',
      }),
    /destination is not fresh/u,
  );
});

test('rejects a cross-platform runner and a non-exact CUDA version before linking', () => {
  const input = fixture();
  const linker = new HostedProductionToolchainLinker({ platform: 'linux', versionReader: () => 'wrong-version' });
  assert.throws(() => linker.link({ ...input, platform: 'win32' }), /does not match/u);
  assert.throws(() => linker.link({ ...input, platform: 'linux' }), /version is not exact/u);
});
