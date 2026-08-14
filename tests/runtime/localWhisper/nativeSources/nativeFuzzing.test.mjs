import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import test from 'node:test';

import {
  NATIVE_FUZZ_MUTATION_SECONDS,
  NATIVE_FUZZ_RSS_LIMIT_MB,
  NATIVE_FUZZ_TARGETS,
  resolveNativeFuzzJobs,
} from '../../../../scripts/local-whisper/native-build/native-fuzz-runner.mjs';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const FIXTURE_ROOT = resolve(WORKSPACE_ROOT, 'tests', 'fixtures', 'local-whisper');
const FUZZ_RUNNER = readFileSync(
  resolve(WORKSPACE_ROOT, 'scripts', 'local-whisper', 'native-build', 'native-fuzz-runner.mjs'),
  'utf8',
);
const FUZZ_HELPER = readFileSync(
  resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'cmake', 'LocalWhisperFuzzing.cmake'),
  'utf8',
);
const COMMON_CMAKE = readFileSync(
  resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'common', 'CMakeLists.txt'),
  'utf8',
);
const FS_GUARD_CMAKE = readFileSync(
  resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'fs-guard', 'CMakeLists.txt'),
  'utf8',
);
const LAUNCHER_CMAKE = readFileSync(
  resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'launcher', 'CMakeLists.txt'),
  'utf8',
);

test('bounded native fuzzing defines exactly the seven approved Linux parser targets', () => {
  assert.deepEqual(
    NATIVE_FUZZ_TARGETS.map((target) => target.id),
    [
      'frame-codec',
      'bounded-json',
      'canonical-wav',
      'model-authority',
      'device-proof',
      'fs-guard-request',
      'launcher-request',
    ],
  );
  assert.equal(NATIVE_FUZZ_MUTATION_SECONDS, 60);
  assert.equal(NATIVE_FUZZ_RSS_LIMIT_MB, 2_048);
});

test('bounded native fuzzing stages only committed synthetic corpus roots', () => {
  for (const target of NATIVE_FUZZ_TARGETS) {
    assert.match(target.seed, /^[\x20-\x7e\t]+$/u);
    for (const directory of target.corpusDirectories) {
      const root = resolve(FIXTURE_ROOT, directory);
      assert.ok(root.startsWith(`${FIXTURE_ROOT}${sep}`));
      assert.ok(existsSync(root), `${target.id} corpus directory is absent`);
      assert.ok(readdirSync(root).length > 0, `${target.id} corpus directory is empty`);
    }
  }
  assert.match(FUZZ_RUNNER, /exact-limit\.bin/u);
  assert.match(FUZZ_RUNNER, /one-over-limit\.bin/u);
  assert.match(FUZZ_RUNNER, /writeCanonicalWav/u);
});

test('fuzz CMake targets require Linux Clang and non-recovering sanitizer hardening', () => {
  assert.match(FUZZ_HELPER, /CMAKE_SYSTEM_NAME STREQUAL "Linux"/u);
  assert.match(FUZZ_HELPER, /CMAKE_CXX_COMPILER_ID STREQUAL "Clang"/u);
  assert.match(FUZZ_HELPER, /require non-recovering ASan and UBSan/u);
  assert.match(FUZZ_HELPER, /local_whisper_apply_compile_hardening/u);
  assert.match(FUZZ_HELPER, /-fsanitize=fuzzer/u);
  assert.match(COMMON_CMAKE, /LOCAL_WHISPER_COMMON_ENABLE_FUZZING/u);
  assert.match(COMMON_CMAKE, /fuzz\/\$\{local_whisper_common_fuzz_target\}_fuzz\.cpp/u);
  for (const target of ['frame_codec', 'bounded_json', 'canonical_wav', 'model_authority', 'device_proof']) {
    assert.match(COMMON_CMAKE, new RegExp(`\\b${target}\\b`, 'u'));
  }
  assert.match(COMMON_CMAKE, /local_whisper_common_fuzz_proof/u);
  assert.match(FS_GUARD_CMAKE, /FS_GUARD_ENABLE_FUZZING/u);
  assert.match(FS_GUARD_CMAKE, /fuzz\/request_fuzz\.cpp/u);
  assert.match(LAUNCHER_CMAKE, /LOCAL_WHISPER_LAUNCHER_ENABLE_FUZZING/u);
  assert.match(LAUNCHER_CMAKE, /fuzz\/launch_request_fuzz\.cpp/u);
});

test('fuzz orchestration derives input ceilings from native contracts and suppresses raw reports', () => {
  assert.match(FUZZ_RUNNER, /contractExecutable/u);
  assert.match(FUZZ_RUNNER, /-max_total_time=\$\{FUZZ_MUTATION_SECONDS\}/u);
  assert.match(FUZZ_RUNNER, /-rss_limit_mb=\$\{FUZZ_RSS_LIMIT_MB\}/u);
  assert.match(FUZZ_RUNNER, /-max_len=\$\{inputLimit\}/u);
  assert.match(FUZZ_RUNNER, /stdio = 'ignore'/u);
  assert.doesNotMatch(FUZZ_RUNNER, /process\.stderr\.write\(result/u);
  assert.doesNotMatch(FUZZ_RUNNER, /platform\/windows|Windows backend|overlong-line-reader/u);
});

test('fuzz target execution parallelism respects each target RSS ceiling', () => {
  const gibibyte = 1024 ** 3;
  assert.equal(resolveNativeFuzzJobs({ availableCores: 8, freeMemoryBytes: 10 * gibibyte }), 4);
  assert.equal(resolveNativeFuzzJobs({ availableCores: 8, freeMemoryBytes: 2 * gibibyte }), 1);
  assert.throws(() => resolveNativeFuzzJobs({ availableCores: 0, freeMemoryBytes: 10 * gibibyte }));
});
