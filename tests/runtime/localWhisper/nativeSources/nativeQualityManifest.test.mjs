import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import {
  assertPlatformCompilationCoverage,
  createNativeQualityCoverageReport,
  createNativeQualityManifest,
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

test('Linux quality compiles the Linux-only qualification test and MSVC analysis suppresses only the reviewed dependency false positive', () => {
  assert.match(WHISPER_CPP_CORE_VERIFIER, /tests: true/u);
  assert.match(
    WHISPER_CPP_CORE_VERIFIER,
    /buildTargets\(engine, \['local_whisper_whisper_cpp_qualification_tests'\]\)/u,
  );
  assert.match(WHISPER_CPP_CORE_VERIFIER, /runTests\(engine, 'direct-engine'\)/u);
  assert.match(NLOHMANN_JSON_WRAPPER, /#pragma warning\(disable : 6294\)/u);
  assert.match(NLOHMANN_JSON_WRAPPER, /#include <nlohmann\/json\.hpp>/u);
});
