import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  sanitizerRuntimeEnvironment,
  sanitizerRuntimeOptions,
} from '../../../../scripts/local-whisper/native-build/sanitizer-runtime-policy.mjs';
import {
  threadSanitizerRuntimeEnvironment,
  threadSanitizerRuntimeOptions,
} from '../../../../scripts/local-whisper/native-build/tsan-runtime-policy.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
const hardeningModule = readFileSync(
  resolve(workspaceRoot, 'runtime', 'local-whisper', 'cmake', 'LocalWhisperHardening.cmake'),
  'utf8',
);
const nativeProjects = [
  ['common', 'LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS'],
  ['fs-guard', 'FS_GUARD_ENABLE_SANITIZERS'],
  ['launcher', 'LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS'],
  ['whisper-cpp', 'LOCAL_WHISPER_ENABLE_SANITIZERS'],
];

test('sanitizer runtime policy is non-recovering and never claims unsupported Windows UBSan', () => {
  assert.deepEqual(sanitizerRuntimeOptions('linux', true), {
    ASAN_OPTIONS: 'detect_leaks=1:halt_on_error=1:strict_string_checks=1',
    UBSAN_OPTIONS: 'halt_on_error=1:print_stacktrace=1',
  });
  assert.deepEqual(sanitizerRuntimeOptions('windows', true), { ASAN_OPTIONS: 'halt_on_error=1' });
  assert.deepEqual(sanitizerRuntimeOptions('windows', false), {});
  assert.throws(() => sanitizerRuntimeOptions('darwin', true));
  assert.deepEqual(sanitizerRuntimeEnvironment({ PATH: 'safe' }, 'windows', true), {
    ASAN_OPTIONS: 'halt_on_error=1',
    PATH: 'safe',
  });
});

test('ThreadSanitizer policy is isolated to the Linux worker graph', () => {
  assert.deepEqual(threadSanitizerRuntimeOptions('linux'), {
    TSAN_OPTIONS: 'halt_on_error=1:second_deadlock_stack=1',
  });
  assert.deepEqual(threadSanitizerRuntimeEnvironment({ PATH: 'safe' }, 'linux'), {
    PATH: 'safe',
    TSAN_OPTIONS: 'halt_on_error=1:second_deadlock_stack=1',
  });
  assert.throws(() => threadSanitizerRuntimeOptions('windows'));

  const workerTsanRunner = readFileSync(
    resolve(workspaceRoot, 'scripts', 'local-whisper', 'native-build', 'native-worker-tsan.mjs'),
    'utf8',
  );
  assert.match(workerTsanRunner, /requireVerifiedInputs\(profile\.baseToolchainProfile\)/u);
});

test('all native graphs use the shared Linux sanitizer and MSVC STL policies', () => {
  assert.match(hardeningModule, /-fno-sanitize-recover=all/u);
  assert.match(hardeningModule, /add_compile_definitions\(_GLIBCXX_ASSERTIONS\)/u);
  assert.match(hardeningModule, /\/fsanitize=address/u);
  assert.match(hardeningModule, /string\(REPLACE "\/RTC1" ""/u);
  assert.match(hardeningModule, /_ITERATOR_DEBUG_LEVEL=0/u);
  assert.match(hardeningModule, /if\(MSVC_VERSION LESS 1940\)/u);
  assert.match(hardeningModule, /_CONTAINER_DEBUG_LEVEL=0/u);
  assert.match(hardeningModule, /_MSVC_STL_HARDENING=0/u);
  assert.match(hardeningModule, /function\(local_whisper_apply_google_test_sanitizer_policy/u);
  assert.match(
    hardeningModule,
    /target_compile_options\(\$\{local_whisper_google_test_target\} PRIVATE \/fsanitize=address\)/u,
  );

  for (const [project, sanitizerOption] of nativeProjects) {
    const source = readFileSync(resolve(workspaceRoot, 'runtime', 'local-whisper', project, 'CMakeLists.txt'), 'utf8');
    assert.match(source, /Enable platform-supported sanitizers \(ASan \+ UBSan on Linux; ASan on MSVC\)/u, project);
    assert.match(source, /local_whisper_configure_msvc_stl_debug_level\(\)/u, project);
    assert.match(source, new RegExp(`local_whisper_configure_sanitizer_graph\\(${sanitizerOption}\\)`, 'u'), project);
    assert.match(
      source,
      new RegExp(`local_whisper_apply_google_test_sanitizer_policy\\(${sanitizerOption}\\)`, 'u'),
      project,
    );
  }
});

test('Windows ASan configurations are explicit in native presets, drivers, package commands, and CI', () => {
  for (const project of ['fs-guard', 'launcher']) {
    const presets = JSON.parse(
      readFileSync(resolve(workspaceRoot, 'runtime', 'local-whisper', project, 'CMakePresets.json'), 'utf8'),
    );
    const asan = presets.configurePresets.find(({ name }) => name === 'windows-asan');
    assert.ok(asan, `${project} is missing windows-asan`);
    assert.equal(asan.cacheVariables.CMAKE_BUILD_TYPE, 'Debug');
    assert.equal(
      asan.cacheVariables[
        project === 'fs-guard' ? 'FS_GUARD_ENABLE_SANITIZERS' : 'LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS'
      ],
      'ON',
    );
  }

  const packageJson = readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8');
  assert.match(packageJson, /test:local-whisper:worker-common:native/u);
  assert.match(packageJson, /test:local-whisper:fs-guard:msvc-asan/u);
  assert.match(packageJson, /test:local-whisper:launcher:msvc-asan/u);
  assert.match(packageJson, /test:local-whisper:worker-codec:msvc-asan/u);
  assert.match(packageJson, /test:local-whisper:whisper-cpp:msvc-asan/u);

  const workerDriver = readFileSync(
    resolve(workspaceRoot, 'scripts', 'local-whisper', 'native-worker-quality.mjs'),
    'utf8',
  );
  assert.match(workerDriver, /windows-x64-msvc-19\.39-asan-v1/u);
  const workflow = readFileSync(resolve(workspaceRoot, '.github', 'workflows', 'pr-checks.yml'), 'utf8');
  assert.match(workflow, /Prove non-recovering Linux sanitizer policy/u);
  assert.match(workflow, /test:local-whisper:native-sanitizer-proof -- --mode=prepared-linux-quality/u);
  assert.match(workflow, /Run Linux worker ThreadSanitizer gate/u);
  assert.match(workflow, /test:local-whisper:worker-tsan-proof/u);
  assert.match(workflow, /test:local-whisper:worker-tsan/u);
  assert.match(workflow, /Run MSVC AddressSanitizer native suites/u);
});

test('prepared Linux sanitizer proof keeps the immutable fixture and verifies both non-recovering findings', () => {
  const proof = readFileSync(
    resolve(workspaceRoot, 'scripts', 'local-whisper', 'native-build', 'test-native-sanitizer-proof.mjs'),
    'utf8',
  );
  const fixture = readFileSync(
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'fixtures', 'sanitizer-proof', 'CMakeLists.txt'),
    'utf8',
  );
  assert.match(proof, /readSanitizerFixtureIdentity/u);
  assert.match(proof, /prepared-linux-quality/u);
  assert.match(proof, /AddressSanitizer/u);
  assert.match(proof, /signed integer overflow/u);
  assert.match(proof, /libclang_rt\.asan-x86_64\.so/u);
  assert.match(proof, /libclang_rt\.ubsan_standalone-x86_64\.so/u);
  assert.match(fixture, /-fno-sanitize-recover=all/u);
});
