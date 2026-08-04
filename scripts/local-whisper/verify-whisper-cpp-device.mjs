import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { verifyToolchainContract } from './native-build/native-toolchain-core.mjs';
import { canonicalDigest, readJson, sha256 } from './source-import/native-source-core.mjs';
import { cudaStageRoot } from './stage-whisper-cpp-cuda.mjs';
import {
  buildIdentity,
  patchLockPath,
  requireProfile,
  taskCacheRoot,
  toolchainRoot,
  whisperCppRoot,
  workspaceRoot,
} from './whisper-cpp-build-core.mjs';

export const CUDA_PROFILE = 'linux-x64-cuda-12.8.1-sm120a-v1';
export const WINDOWS_CUDA_PROFILE = 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1';

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  return result.stdout;
}

function allFiles(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        assert.equal(entry.isFile(), true, `CUDA stage rejects non-files: ${path}`);
        files.push(path.slice(root.length + 1).replaceAll('\\', '/'));
      }
    }
  };
  walk(root);
  return files.sort();
}

function verifyExpectedFiles(root) {
  const expected = readJson(resolve(root, 'expected-files.json'));
  assert.equal(expected.schemaId, 'local-whisper-expected-files-v1');
  assert.equal(new Set(expected.files.map((file) => file.id)).size, expected.files.length);
  for (const file of expected.files) {
    assert.equal(file.relativePath.startsWith('/'), false);
    assert.equal(file.relativePath.split('/').includes('..'), false);
    const path = resolve(root, ...file.relativePath.split('/'));
    const metadata = statSync(path);
    assert.equal(metadata.isFile(), true, file.relativePath);
    assert.equal(metadata.size, file.sizeBytes, file.relativePath);
    assert.equal(metadata.mode & 0o777, file.mode, file.relativePath);
    assert.equal(sha256(readFileSync(path)), file.sha256, file.relativePath);
  }
  return expected;
}

function dynamicMetadata(readelf, binary) {
  const output = run(readelf, ['-d', binary]);
  const values = (tag) =>
    output.split('\n').flatMap((line) => {
      const marker = line.indexOf(`(${tag})`);
      const opening = marker < 0 ? -1 : line.indexOf('[', marker + tag.length + 2);
      const closing = opening < 0 ? -1 : line.indexOf(']', opening + 1);
      return opening < 0 || closing < 0 ? [] : [line.slice(opening + 1, closing)];
    });
  const needed = values('NEEDED');
  const rpath = values('RPATH');
  const runpath = values('RUNPATH');
  assert.ok(rpath.length <= 1 && runpath.length <= 1 && rpath.length + runpath.length <= 1);
  return {
    needed,
    pathKind: rpath.length === 1 ? 'RPATH' : runpath.length === 1 ? 'RUNPATH' : null,
    rpath: rpath[0] ?? runpath[0] ?? null,
  };
}

function cmakeCacheValue(cache, option) {
  const line = cache.split('\n').find((candidate) => candidate.startsWith(`${option}:`));
  if (line === undefined) return null;
  const separator = line.indexOf('=');
  if (separator < 0) throw new Error(`Malformed CMake cache option: ${option}`);
  return line.slice(separator + 1);
}

function verifyDependencyClosure(profile, root, manifest) {
  const readelf = profile.tools.find((tool) => tool.role === 'elf-inspector')?.path;
  assert.ok(readelf);
  const staged = new Map(
    manifest.stagedRuntimeDependencies.map((dependency) => [
      dependency.soname,
      resolve(root, 'lib', dependency.soname),
    ]),
  );
  const stagedInputs = new Map(
    profile.dynamicDependencies
      .filter((dependency) => dependency.pathKind === 'toolchainRootRelative')
      .map((dependency) => [dependency.soname, dependency]),
  );
  for (const dependency of manifest.stagedRuntimeDependencies) {
    assert.equal(dependency.sourceSha256, stagedInputs.get(dependency.soname)?.sha256);
    assert.equal(sha256(readFileSync(resolve(root, 'lib', dependency.soname))), dependency.sha256);
  }
  const system = new Set(manifest.systemRuntimeDependencies.map((dependency) => dependency.soname));
  const worker = resolve(root, manifest.executable);
  const workerMetadata = dynamicMetadata(readelf, worker);
  assert.equal(workerMetadata.rpath, '$ORIGIN:$ORIGIN/../lib');
  assert.equal(workerMetadata.pathKind, 'RPATH');
  const visited = new Set();
  const queue = [worker];
  const reachedStaged = new Set();
  while (queue.length > 0) {
    const binary = queue.shift();
    if (visited.has(binary)) continue;
    visited.add(binary);
    const metadata = dynamicMetadata(readelf, binary);
    if (binary !== worker && metadata.rpath !== null) {
      assert.equal(metadata.pathKind, 'RPATH');
      assert.equal(metadata.rpath, '$ORIGIN');
    }
    for (const soname of metadata.needed) {
      if (staged.has(soname)) {
        reachedStaged.add(soname);
        queue.push(staged.get(soname));
      } else {
        assert.equal(system.has(soname), true, `Undeclared CUDA dependency: ${soname}`);
      }
    }
  }
  assert.deepEqual([...reachedStaged].sort(), [...staged.keys()].sort());
  assert.deepEqual(manifest.runtimePathPolicy, {
    policyId: 'local-whisper-elf64-rpath-lock-v1',
    stagedValue: '$ORIGIN',
  });
}

function verifyArchitecture(binary, cachePath) {
  const cuobjdump = resolve(toolchainRoot, 'cuda-12.8.1', 'bin', 'cuobjdump');
  const cubins = run(cuobjdump, ['--list-elf', binary]).trim().split('\n');
  assert.ok(cubins.length > 0);
  assert.ok(cubins.every((line) => line.endsWith('.sm_120a.cubin')));
  assert.equal(run(cuobjdump, ['--list-ptx', binary]).trim(), '');
  const cache = readFileSync(cachePath, 'utf8');
  assert.equal(cmakeCacheValue(cache, 'CMAKE_CUDA_ARCHITECTURES'), '120a-real');
  assert.equal(cmakeCacheValue(cache, 'GGML_CUDA'), 'ON');
  for (const option of [
    'GGML_BACKEND_DL',
    'GGML_CUDA_CUB_3DOT2',
    'GGML_CUDA_NCCL',
    'GGML_HIP',
    'GGML_NATIVE',
    'GGML_OPENMP',
    'GGML_RPC',
    'GGML_VULKAN',
    'WHISPER_BUILD_EXAMPLES',
    'WHISPER_BUILD_TESTS',
    'WHISPER_CURL',
  ])
    assert.equal(cmakeCacheValue(cache, option), 'OFF');
  for (const option of ['GGML_CANN', 'GGML_METAL', 'GGML_OPENCL', 'GGML_SYCL']) {
    const configured = cmakeCacheValue(cache, option);
    if (configured !== null) assert.equal(configured, 'OFF', `${option} must remain disabled`);
  }
}

function verifyProvenance(root, manifest, expected) {
  const provenance = readJson(resolve(root, 'provenance.json'));
  const patchLock = readJson(patchLockPath);
  assert.equal(provenance.patchLockId, 'local-whisper-whisper-cpp-device-cancel-v1');
  assert.deepEqual(
    provenance.patches,
    patchLock.patches.map(({ patchId, relativePath, sha256: patchSha256 }) => ({
      patchId,
      relativePath,
      sha256: patchSha256,
    })),
  );
  assert.deepEqual(provenance.intermediateManifests, patchLock.intermediateManifests);
  assert.equal(provenance.patchedManifestSha256, patchLock.finalManifestSha256);
  assert.equal(provenance.runtimeBuildDigest, buildIdentity(CUDA_PROFILE));
  assert.deepEqual(provenance.requestedCudaArchitectures, ['120a-real']);
  assert.deepEqual(provenance.effectiveCudaArchitectures, ['120a-real']);
  assert.deepEqual(provenance.runtimePathPolicy, {
    policyId: 'local-whisper-elf64-rpath-lock-v1',
    stagedValue: '$ORIGIN',
  });
  assert.equal(provenance.modelIncluded, false);
  assert.equal(manifest.payloadManifestSha256, canonicalDigest(expected.files));
  const sbom = readJson(resolve(root, 'sbom.spdx.json'));
  assert.equal(sbom.spdxVersion, 'SPDX-2.3');
  for (const component of ['whisper.cpp', 'nlohmann/json', ...manifest.stagedRuntimeDependencies.map((d) => d.soname)])
    assert.ok(
      sbom.packages.some((entry) => entry.name === component),
      `Missing SBOM component ${component}`,
    );
  for (const dependency of manifest.stagedRuntimeDependencies)
    assert.ok(
      sbom.packages.some(
        (component) =>
          component.name === dependency.soname &&
          component.checksums?.some(
            (checksum) => checksum.algorithm === 'SHA256' && checksum.checksumValue === dependency.sha256,
          ),
      ),
      `Missing staged SBOM checksum ${dependency.soname}`,
    );
}

export function verifyLinuxCudaPack() {
  const profile = requireProfile(CUDA_PROFILE);
  verifyToolchainContract(profile, { allowCandidate: false, contractOnly: false });
  const root = cudaStageRoot(CUDA_PROFILE);
  const expected = verifyExpectedFiles(root);
  const manifest = readJson(resolve(root, 'runtime-manifest.json'));
  assert.equal(manifest.profileId, CUDA_PROFILE);
  assert.equal(manifest.runtimeBuildDigest, buildIdentity(CUDA_PROFILE));
  assert.equal(manifest.target, 'gpu');
  assert.equal(manifest.backend, 'cuda');
  assert.equal(manifest.dynamicBackendDiscovery, false);
  assert.deepEqual(manifest.gpuBackends, ['cuda']);
  assert.deepEqual(manifest.requestedCudaArchitectures, ['120a-real']);
  assert.deepEqual(manifest.effectiveCudaArchitectures, ['120a-real']);
  assert.equal(manifest.modelIncluded, false);
  assert.equal(manifest.signed, false);
  assert.equal(manifest.productionOrigin, false);
  const expectedFilesPath = resolve(root, 'expected-files.json');
  const expectedFilesMetadata = statSync(expectedFilesPath);
  assert.deepEqual(manifest.expectedFiles, {
    id: 'expected-files',
    relativePath: 'expected-files.json',
    mode: expectedFilesMetadata.mode & 0o777,
    sizeBytes: expectedFilesMetadata.size,
    sha256: sha256(readFileSync(expectedFilesPath)),
  });
  const actualPaths = allFiles(root);
  const expectedPaths = [
    ...expected.files.map((file) => file.relativePath),
    'expected-files.json',
    'runtime-manifest.json',
  ].sort();
  assert.deepEqual(actualPaths, expectedPaths);
  const binary = resolve(root, manifest.executable);
  verifyDependencyClosure(profile, root, manifest);
  verifyArchitecture(binary, resolve(taskCacheRoot, 'build', `${CUDA_PROFILE}-engine`, 'CMakeCache.txt'));
  verifyProvenance(root, manifest, expected);
  const source = readFileSync(resolve(whisperCppRoot, 'adapter', 'whisper_engine.cpp'), 'utf8');
  assert.doesNotMatch(source, /ggml_backend_load_all/u);
  assert.match(source, /local_whisper_selected_device/u);
  assert.match(source, /whisper_local_get_device_evidence/u);
  return { binary, root };
}

export function verifyWindowsCudaContract() {
  const profile = requireProfile(WINDOWS_CUDA_PROFILE);
  verifyToolchainContract(profile, { contractOnly: true });
  const authority = readFileSync(
    resolve(whisperCppRoot, 'platform', 'windows', 'device_authority_windows.cpp'),
    'utf8',
  );
  assert.match(authority, /ReadFile/u);
  assert.match(authority, /STD_INPUT_HANDLE/u);
  const cmake = readFileSync(resolve(whisperCppRoot, 'CMakeLists.txt'), 'utf8');
  assert.match(cmake, /windows-x64-cuda-12\.8\.1-sm120a-v1/u);
  const workflow = readFileSync(resolve(workspaceRoot, '.github', 'workflows', 'pr-checks.yml'), 'utf8');
  const windowsJob = workflow.slice(workflow.indexOf('native-quality-windows:'), workflow.indexOf('\n  quality:'));
  assert.match(windowsJob, /runs-on: windows-latest/u);
  assert.match(windowsJob, /windows-x64-cuda-12\.8\.1-sm120a-msvc-19\.39-v1/u);
  assert.match(windowsJob, /--contract-only/u);
  assert.doesNotMatch(windowsJob, /linux-x64-cuda-12\.8\.1-sm120a-v1/u);
}
