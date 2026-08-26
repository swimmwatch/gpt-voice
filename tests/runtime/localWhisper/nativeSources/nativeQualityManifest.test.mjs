import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import {
  assertPlatformCompilationCoverage,
  createFocusedGccQualityCoverageReport,
  createNativeQualityCoverageReport,
  createNativeQualityManifest,
  manifestEntriesForFocusedGcc,
  manifestEntriesForPlatform,
} from '../../../../scripts/local-whisper/native-build/native-quality-manifest.mjs';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const WHISPER_CPP_CORE_VERIFIER = readFileSync(
  resolve(WORKSPACE_ROOT, 'scripts', 'local-whisper', 'verify-whisper-cpp-core.mjs'),
  'utf8',
);
const NLOHMANN_JSON_WRAPPER = readFileSync(
  resolve(
    WORKSPACE_ROOT,
    'runtime',
    'local-whisper',
    'common',
    'include',
    'local_whisper',
    'common',
    'nlohmann_json.hpp',
  ),
  'utf8',
);
const NATIVE_HARDENING = readFileSync(
  resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'cmake', 'LocalWhisperHardening.cmake'),
  'utf8',
);
const MSVC_ANALYSIS_DRIVERS = [
  'native-fs-guard-quality.mjs',
  'native-launcher-quality.mjs',
  'native-worker-quality.mjs',
  'whisper-cpp-build-core.mjs',
].map((fileName) => readFileSync(resolve(WORKSPACE_ROOT, 'scripts', 'local-whisper', fileName), 'utf8'));
const NATIVE_PRESET_QUALITY_DRIVERS = ['native-fs-guard-quality.mjs', 'native-launcher-quality.mjs'].map((fileName) =>
  readFileSync(resolve(WORKSPACE_ROOT, 'scripts', 'local-whisper', fileName), 'utf8'),
);
const NATIVE_TEST_CMAKE_FILES = [
  'common/CMakeLists.txt',
  'fs-guard/CMakeLists.txt',
  'launcher/CMakeLists.txt',
  'whisper-cpp/CMakeLists.txt',
].map((relativePath) => readFileSync(resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', relativePath), 'utf8'));

test('native quality manifest covers every owned project and separates host-specific sources', () => {
  const manifest = createNativeQualityManifest(WORKSPACE_ROOT);
  assert.deepEqual(
    new Set(manifest.map((entry) => entry.project)),
    new Set(['common', 'fs-guard', 'launcher', 'worker']),
  );
  assert.ok(manifestEntriesForPlatform(manifest, 'linux', { translationUnitsOnly: true }).length > 0);
  assert.ok(manifestEntriesForPlatform(manifest, 'windows', { translationUnitsOnly: true }).length > 0);
  assert.ok(!manifestEntriesForPlatform(manifest, 'linux').some((entry) => entry.path.includes('/platform/windows/')));
  assert.ok(!manifestEntriesForPlatform(manifest, 'windows').some((entry) => entry.path.includes('/platform/linux/')));
  const fuzzEntries = manifest.filter((entry) => entry.path.includes('/fuzz/'));
  assert.ok(fuzzEntries.length > 0);
  assert.ok(fuzzEntries.every((entry) => entry.platforms.length === 1 && entry.platforms[0] === 'linux'));
  assert.ok(!manifestEntriesForPlatform(manifest, 'windows').some((entry) => entry.path.includes('/fuzz/')));
  assert.deepEqual(
    manifest.find((entry) => entry.path.endsWith('/whisper-cpp/tests/qualification_protocol_test.cpp'))?.platforms,
    ['linux'],
  );
  assert.deepEqual(
    manifest.find((entry) => entry.path.endsWith('/launcher/tests/unit/poll_direction_test.cpp'))?.platforms,
    ['linux'],
  );
  assert.deepEqual(
    manifest.find((entry) => entry.path.endsWith('/whisper-cpp/tests/worker_protocol_posix_test.cpp'))?.platforms,
    ['linux'],
  );
  assert.deepEqual(
    manifest.find((entry) => entry.path.endsWith('/whisper-cpp/tests/worker_tsan_race_proof.cpp'))?.platforms,
    ['linux'],
  );
  for (const sourcePath of [
    '/whisper-cpp/core/model_file_validator_linux.cpp',
    '/whisper-cpp/tests/model_file_validator_test.cpp',
  ]) {
    assert.deepEqual(manifest.find((entry) => entry.path.endsWith(sourcePath))?.platforms, ['linux']);
    assert.ok(!manifestEntriesForPlatform(manifest, 'windows').some((entry) => entry.path.endsWith(sourcePath)));
  }
  assert.deepEqual(
    manifest.find((entry) => entry.path.endsWith('/whisper-cpp/tests/worker_protocol_windows_test.cpp'))?.platforms,
    ['windows'],
  );
  const windowsValidatorTest = '/whisper-cpp/tests/model_file_validator_windows_test.cpp';
  assert.deepEqual(manifest.find((entry) => entry.path.endsWith(windowsValidatorTest))?.platforms, ['windows']);
  assert.ok(!manifestEntriesForPlatform(manifest, 'linux').some((entry) => entry.path.endsWith(windowsValidatorTest)));
});

test('native quality compilation coverage rejects a missing or host-inapplicable translation unit', () => {
  const manifest = createNativeQualityManifest(WORKSPACE_ROOT);
  const linuxSources = manifestEntriesForPlatform(manifest, 'linux', { translationUnitsOnly: true }).map(
    (entry) => entry.path,
  );
  assert.throws(() => assertPlatformCompilationCoverage(manifest, 'linux', linuxSources.slice(1)), /missing/u);
  const windowsOnly = manifestEntriesForPlatform(manifest, 'windows', { translationUnitsOnly: true }).find(
    (entry) => !entry.platforms.includes('linux'),
  );
  assert.ok(windowsOnly);
  assert.throws(
    () => assertPlatformCompilationCoverage(manifest, 'linux', [...linuxSources, windowsOnly.path]),
    /host-inapplicable/u,
  );
});

test('native logger source and tests are included in every Linux and Windows native quality graph', () => {
  const manifest = createNativeQualityManifest(WORKSPACE_ROOT);
  for (const platform of ['linux', 'windows']) {
    assert.ok(
      manifestEntriesForPlatform(manifest, platform, { translationUnitsOnly: true }).some((entry) =>
        entry.path.endsWith('/common/src/native_logger.cpp'),
      ),
    );
  }
  for (const cmakeFile of NATIVE_TEST_CMAKE_FILES) {
    assert.match(cmakeFile, /native_logger\.cpp/u);
  }
  assert.match(NATIVE_TEST_CMAKE_FILES[0], /tests\/native_logger_test\.cpp/u);
});

test('native quality reports reject over-claims and expose only relative source identifiers', () => {
  const manifest = createNativeQualityManifest(WORKSPACE_ROOT);
  assert.throws(
    () =>
      createNativeQualityCoverageReport({
        compilerProfile: 'clang-18.1.3',
        evidence: ['compile', 'contract-inspection', 'execute', 'unreviewed'],
        manifest,
        platform: 'linux',
      }),
    /unsupported evidence/u,
  );
  const report = createNativeQualityCoverageReport({
    compilerProfile: 'clang-18.1.3',
    evidence: ['analyze', 'compile', 'contract-inspection', 'execute', 'sanitize'],
    manifest,
    platform: 'linux',
  });
  assert.ok(report.sourceSet.every((path) => !path.startsWith('/') && !path.includes('\\')));
});

test('focused GCC quality reports only the compiled Linux guard, launcher, and shared dependency sources', () => {
  const manifest = createNativeQualityManifest(WORKSPACE_ROOT);
  const compiledPaths = manifestEntriesForFocusedGcc(manifest).map((entry) => entry.path);
  assert.deepEqual(
    compiledPaths.filter((sourcePath) => sourcePath.startsWith('runtime/local-whisper/common/src/')),
    [
      'runtime/local-whisper/common/src/authority_bootstrap.cpp',
      'runtime/local-whisper/common/src/linux_process_identity.cpp',
      'runtime/local-whisper/common/src/model_authority.cpp',
      'runtime/local-whisper/common/src/native_logger.cpp',
      'runtime/local-whisper/common/src/sha256.cpp',
      'runtime/local-whisper/common/src/sha256_dispatch.cpp',
      'runtime/local-whisper/common/src/sha256_x86.cpp',
    ],
  );
  const report = createFocusedGccQualityCoverageReport({
    compilerProfile: 'linux-x64-cpu-baseline-v1',
    compiledPaths,
    evidence: ['execute', 'compile'],
    manifest,
  });
  assert.equal(report.schemaId, 'local-whisper-focused-gcc-quality-coverage-v1');
  assert.deepEqual(report.evidenceKinds, ['compile', 'execute']);
  assert.deepEqual(report.projects, ['fs-guard', 'launcher']);
  assert.ok(report.sourceSet.every((path) => !path.includes('/whisper-cpp/')));
  assert.throws(
    () =>
      createFocusedGccQualityCoverageReport({
        compilerProfile: 'linux-x64-cpu-baseline-v1',
        compiledPaths: compiledPaths.slice(1),
        evidence: ['compile', 'execute'],
        manifest,
      }),
    /missing required translation units/u,
  );
  assert.throws(
    () =>
      createFocusedGccQualityCoverageReport({
        compilerProfile: 'linux-x64-cpu-baseline-v1',
        compiledPaths: [...compiledPaths, 'runtime/local-whisper/common/src/frame_codec.cpp'],
        evidence: ['compile', 'execute'],
        manifest,
      }),
    /unexpected translation units/u,
  );
});

test('Linux quality compiles every configured engine target and MSVC analysis suppresses reviewed dependency false positives', () => {
  assert.match(WHISPER_CPP_CORE_VERIFIER, /tests: true/u);
  assert.match(
    WHISPER_CPP_CORE_VERIFIER,
    /const LINUX_QUALITY_ENGINE_TARGETS = Object\.freeze\(\[\s*'local_whisper_whisper_cpp_qualification_tests',\s*'local-whisper-whisper-cpp-direct-engine',\s*'local-whisper-whisper-cpp-worker',\s*\]\)/u,
  );
  assert.match(WHISPER_CPP_CORE_VERIFIER, /preparedLinuxQuality && suite === 'core'/u);
  assert.match(
    NATIVE_TEST_CMAKE_FILES[3],
    /add_library\(local_whisper_whisper_cpp_adapter STATIC adapter\/whisper_engine\.cpp\)/u,
  );
  assert.match(NATIVE_TEST_CMAKE_FILES[3], /add_executable\(local-whisper-whisper-cpp-worker core\/main\.cpp\)/u);
  assert.match(
    NATIVE_TEST_CMAKE_FILES[3],
    /add_executable\(local-whisper-whisper-cpp-direct-engine\s+qualification\/direct_engine_main\.cpp\)/u,
  );
  assert.match(WHISPER_CPP_CORE_VERIFIER, /runTests\(engine, 'direct-engine'\)/u);
  assert.match(NLOHMANN_JSON_WRAPPER, /#pragma warning\(disable : 6294\)/u);
  assert.match(NLOHMANN_JSON_WRAPPER, /#include <nlohmann\/json\.hpp>/u);
  assert.match(NATIVE_HARDENING, /\/analyze:external-/u);
});

test('MSVC analysis is applied only through project-target hardening', () => {
  assert.match(
    NATIVE_HARDENING,
    /option\(LOCAL_WHISPER_MSVC_ANALYZE "Run MSVC \/analyze for project-owned translation units" OFF\)/u,
  );
  assert.match(
    NATIVE_HARDENING,
    /if\(LOCAL_WHISPER_MSVC_ANALYZE\)\s+# GoogleTest is a reviewed external dependency\.[\s\S]+?target_compile_options\(\$\{target\} PRIVATE \/analyze \/analyze:external-[^)]*\)/u,
  );
  assert.match(
    NATIVE_HARDENING,
    /target_compile_options\(\$\{target\} PRIVATE \/analyze \/analyze:external- \/external:W0 \/analyze:autolog-\)/u,
  );
  assert.match(NATIVE_TEST_CMAKE_FILES[0], /SYSTEM PRIVATE "\$\{LOCAL_WHISPER_NLOHMANN_SOURCE\}\/single_include"/u);
  assert.match(
    NATIVE_TEST_CMAKE_FILES[3],
    /SYSTEM (?:PRIVATE|PUBLIC) "\$\{LOCAL_WHISPER_NLOHMANN_SOURCE\}\/single_include"/u,
  );
  assert.match(
    NATIVE_HARDENING,
    /function\(local_whisper_apply_test_compile_hardening target sanitizer_option\)[\s\S]+?target_compile_options\(\$\{target\} PRIVATE \/wd6326\)/u,
  );
  for (const cmakeFile of NATIVE_TEST_CMAKE_FILES) {
    assert.match(cmakeFile, /local_whisper_apply_test_compile_hardening/u);
    assert.doesNotMatch(cmakeFile, /local_whisper_apply_compile_hardening\([^)]*tests/u);
  }
  for (const driver of MSVC_ANALYSIS_DRIVERS) {
    assert.match(driver, /-DLOCAL_WHISPER_MSVC_ANALYZE=ON/u);
    assert.doesNotMatch(driver, /CMAKE_CXX_FLAGS=\/analyze/u);
  }
});

test('MSVC sanitizer graph removes incompatible Debug runtime checks and incremental linking', () => {
  assert.match(
    NATIVE_HARDENING,
    /string\(REPLACE "\/RTC1" "" local_whisper_debug_flags "\$\{CMAKE_\$\{local_whisper_language\}_FLAGS_DEBUG\}"\)/u,
  );
  for (const linkerFlags of [
    'CMAKE_EXE_LINKER_FLAGS_DEBUG',
    'CMAKE_MODULE_LINKER_FLAGS_DEBUG',
    'CMAKE_SHARED_LINKER_FLAGS_DEBUG',
  ]) {
    assert.match(NATIVE_HARDENING, new RegExp(linkerFlags, 'u'));
  }
  assert.match(NATIVE_HARDENING, /string\(REPLACE "\/INCREMENTAL" "" local_whisper_debug_linker_flags/u);
});

test('Windows preset native quality refreshes CMake caches before changing compiler profiles', () => {
  for (const driver of NATIVE_PRESET_QUALITY_DRIVERS) {
    assert.match(driver, /const refreshConfigure = linuxGcc \|\| process\.platform === 'win32';/u);
    assert.match(driver, /\.\.\.\(refreshConfigure \? \['--fresh'\] : \[\]\)/u);
  }
});
