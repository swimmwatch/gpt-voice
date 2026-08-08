import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  copyFileSync,
  mkdirSync,
  openSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import { canonicalCatalogJson, canonicalDigest, readJson } from '../source-import/native-source-core.mjs';
import {
  buildIdentity,
  buildTargets,
  configureBuild,
  patchLockPath,
  requireProfile,
  requireVerifiedInputs,
  runTests,
  sourceLockPath,
  toolchainRoot,
  whisperCppRoot,
  workspaceRoot,
} from '../whisper-cpp-build-core.mjs';

const OUTPUT_ROOT = resolve(workspaceRoot, '.cache', 'local-whisper', 'qualification', 'direct-engine');
const BINARY_NAME = 'local-whisper-whisper-cpp-direct-engine';
const PROJECT_SOURCE_FILES = Object.freeze([
  'CMakeLists.txt',
  'adapter/whisper_engine.cpp',
  'include/local_whisper/whisper_cpp/engine.hpp',
  'include/local_whisper/whisper_cpp/qualification_protocol.hpp',
  'qualification/direct_engine_main.cpp',
  'qualification/qualification_protocol.cpp',
]);

function assertOwnedOutput(path) {
  const child = relative(OUTPUT_ROOT, path);
  if (child === '' || child.startsWith('..') || isAbsolute(child)) {
    throw new Error('Direct-engine output escaped its private qualification root');
  }
}

function removeOwnedOutput(path) {
  assertOwnedOutput(path);
  rmSync(path, { force: true, recursive: true });
}

function fileSha256(path) {
  const digest = createHash('sha256');
  const descriptor = openSync(path, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) return digest.digest('hex');
      digest.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(descriptor);
  }
}

function sourceDigest() {
  return canonicalDigest(
    PROJECT_SOURCE_FILES.map((path) => ({ path, sha256: fileSha256(resolve(whisperCppRoot, path)) })),
  );
}

function profileFor(backend) {
  if (backend === 'cpu') return 'linux-x64-cpu-baseline-v1';
  if (backend === 'cuda') return 'linux-x64-cuda-12.8.1-sm120a-v1';
  throw new Error('Expected --backend=cpu or --backend=cuda');
}

function buildOnce(profileId, backend, repetition) {
  const configured = configureBuild(profileId, {
    directEngine: true,
    engine: false,
    networkDenied: true,
    rootTag: `task19-${backend}-${repetition}`,
    tests: repetition === 'a',
  });
  const targets = [BINARY_NAME];
  if (repetition === 'a') targets.push('local_whisper_whisper_cpp_qualification_tests');
  buildTargets(configured, targets);
  if (repetition === 'a') runTests(configured, 'direct-engine');
  return resolve(configured.buildRoot, 'qualification-bin', BINARY_NAME);
}

function stageLibraries(profile, outputRoot) {
  const libraries = [];
  for (const dependency of profile.dynamicDependencies) {
    if (dependency.pathKind !== 'toolchainRootRelative') continue;
    const source = resolve(toolchainRoot, ...dependency.path.split('/'));
    const destination = resolve(outputRoot, 'lib', dependency.soname);
    mkdirSync(resolve(outputRoot, 'lib'), { mode: 0o700, recursive: true });
    copyFileSync(source, destination);
    chmodSync(destination, 0o400);
    const sha256 = fileSha256(destination);
    assert.equal(sha256, dependency.sha256, `Direct-engine dependency changed: ${dependency.id}`);
    libraries.push({
      id: dependency.id,
      fileName: dependency.soname,
      sizeBytes: statSync(destination).size,
      sha256,
    });
  }
  return libraries.sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

function withDigest(document) {
  return {
    ...document,
    manifestDigest: createHash('sha256').update(canonicalCatalogJson(document)).digest('hex'),
  };
}

function produce(backend) {
  const profileId = profileFor(backend);
  requireVerifiedInputs(profileId);
  const profile = requireProfile(profileId);
  const first = buildOnce(profileId, backend, 'a');
  const second = buildOnce(profileId, backend, 'b');
  const firstDigest = fileSha256(first);
  const secondDigest = fileSha256(second);
  assert.equal(firstDigest, secondDigest, `Direct-engine ${backend} binary is not reproducible`);
  assert.equal(statSync(first).size, statSync(second).size, 'Direct-engine binary size changed');

  const outputRoot = resolve(OUTPUT_ROOT, backend);
  removeOwnedOutput(outputRoot);
  mkdirSync(resolve(outputRoot, 'bin'), { mode: 0o700, recursive: true });
  const stagedBinary = resolve(outputRoot, 'bin', BINARY_NAME);
  copyFileSync(first, stagedBinary);
  chmodSync(stagedBinary, 0o500);

  const sourceLock = readJson(sourceLockPath);
  const patchLock = readJson(patchLockPath);
  const document = withDigest({
    schemaVersion: 1,
    specificationRevision: 10,
    backend,
    profileId,
    source: {
      repository: sourceLock.repository,
      commit: sourceLock.commit,
      sourceManifestDigest: sourceLock.materialization.manifestSha256,
      patchLockId: patchLock.lockId,
      patchedManifestDigest: patchLock.finalManifestSha256,
    },
    projectSourceDigest: sourceDigest(),
    toolchainDigest: profile.evidenceDigest,
    runtimeBuildDigest: buildIdentity(profileId),
    binary: {
      fileName: BINARY_NAME,
      sizeBytes: statSync(stagedBinary).size,
      sha256: firstDigest,
    },
    libraries: stageLibraries(profile, outputRoot),
    reproducibility: {
      cleanRootCount: 2,
      networkIsolation: 'user-network-namespace',
      binaryDigestA: firstDigest,
      binaryDigestB: secondDigest,
      reproducible: true,
    },
    descriptorProtocol: {
      control: 'stdin-bounded-json-v1',
      model: 'inherited-read-only-regular-fd-3',
      wav: 'inherited-read-only-regular-fd-4',
      textOutput: 'stdout-utf8-exact',
      failure: 'stderr-bounded-json-v1',
    },
    commandMapping: {
      temperatureHundredths: 0,
      strategy: 'greedy',
      candidateCount: 1,
      promptMode: 'none',
      warmup: 'one-second-zero-pcm',
      deviceSelection: 'captured-registry-exact-ordinal',
      enginePath: 'WhisperCppEngine-direct-no-worker-ipc',
    },
  });
  writeFileSync(resolve(outputRoot, 'direct-engine-manifest.json'), canonicalCatalogJson(document), {
    mode: 0o400,
  });
  process.stdout.write(
    `${JSON.stringify({ backend, binarySha256: firstDigest, manifestDigest: document.manifestDigest })}\n`,
  );
}

const backendArgument = process.argv.find((value) => value.startsWith('--backend='));
produce(backendArgument?.slice('--backend='.length));
