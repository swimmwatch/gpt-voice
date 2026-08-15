import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const runtimeRoot = resolve('runtime', 'local-whisper');
const helperPath = resolve(runtimeRoot, 'cmake', 'LocalWhisperSha256.cmake');
const projectPaths = [
  resolve(runtimeRoot, 'common', 'CMakeLists.txt'),
  resolve(runtimeRoot, 'fs-guard', 'CMakeLists.txt'),
  resolve(runtimeRoot, 'launcher', 'CMakeLists.txt'),
  resolve(runtimeRoot, 'whisper-cpp', 'CMakeLists.txt'),
];

test('SHA-256 acceleration is isolated behind one per-source CMake owner', () => {
  const helper = readFileSync(helperPath, 'utf8');
  assert.match(helper, /add_library\(\$\{accelerated_target\} OBJECT/u);
  assert.match(helper, /target_compile_options\(\$\{accelerated_target\} PRIVATE -msha\)/u);
  assert.doesNotMatch(helper, /add_compile_options|march=native|mtune=native/u);
  for (const projectPath of projectPaths) {
    const project = readFileSync(projectPath, 'utf8');
    assert.match(project, /LocalWhisperSha256\.cmake/u);
    assert.match(project, /local_whisper_add_sha256/u);
    assert.doesNotMatch(project, /src\/sha256_x86\.cpp|-msha/u);
  }
});

test('SHA-256 dispatch uses immutable local CPUID evidence without ambient overrides', () => {
  const dispatch = readFileSync(resolve(runtimeRoot, 'common', 'src', 'sha256_dispatch.cpp'), 'utf8');
  assert.match(dispatch, /__cpuidex|__cpuid_count/u);
  assert.match(dispatch, /static const bool supported/u);
  assert.match(dispatch, /static const Sha256BlockTransform transform/u);
  assert.doesNotMatch(dispatch, /getenv|PATH|process|network/u);
});

test('SHA-256 tests cover accelerated, scalar, unsupported, and concurrent-first-use paths', () => {
  const accelerated = readFileSync(resolve(runtimeRoot, 'common', 'src', 'sha256_x86.cpp'), 'utf8');
  const header = readFileSync(
    resolve(runtimeRoot, 'common', 'include', 'local_whisper', 'common', 'sha256.hpp'),
    'utf8',
  );
  const concurrency = readFileSync(
    resolve(runtimeRoot, 'common', 'tests', 'sha256_dispatch_concurrency_test.cpp'),
    'utf8',
  );
  assert.match(accelerated, /_mm_sha256rnds2_epu32/u);
  assert.match(header, /LOCAL_WHISPER_SHA256_TESTING/u);
  assert.match(header, /simulated_unsupported/u);
  assert.match(concurrency, /std::atomic/u);
  assert.match(concurrency, /std::thread/u);
});
