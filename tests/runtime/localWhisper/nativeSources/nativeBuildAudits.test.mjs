import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { verifyElfDependencyClosure } from '../../../../scripts/local-whisper/native-build/elf-dependency-core.mjs';
import {
  qualificationInputDigest,
  verifyQualificationEvidence,
} from '../../../../scripts/local-whisper/native-build/native-toolchain-evidence-core.mjs';
import { readSanitizerFixtureIdentity } from '../../../../scripts/local-whisper/native-build/qualification-fixture-core.mjs';
import {
  auditGeneratedBuildGraph,
  captureToolchainInputLock,
  qualifyToolchainProfile,
  resolveProfileTool,
} from '../../../../scripts/local-whisper/native-build/native-toolchain-core.mjs';
import {
  assertPinnedWhisperCppPerformanceSources,
  assertWhisperCppPerformanceProfile,
  assertWhisperCppPerformanceProfileText,
  PERFORMANCE_OPTION_INVENTORY_DIGEST,
  PERFORMANCE_PROFILE_IDS,
} from '../../../../scripts/local-whisper/native-build/whisper-cpp-performance-options.mjs';
import {
  canonicalDigest,
  readJson,
  sha256,
  verifyMaterializedSource,
} from '../../../../scripts/local-whisper/source-import/native-source-core.mjs';
import { getSourceDefinition } from '../../../../scripts/local-whisper/source-import/source-definitions.mjs';
import { runNetworkIsolatedSelfTest } from '../../../../scripts/local-whisper/verify-whisper-cpp-cpu.mjs';
import { buildIdentity } from '../../../../scripts/local-whisper/whisper-cpp-build-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
const toolchainRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains');
const dependencyFixtureRoot = resolve(toolchainRoot, 'fixtures', 'dependency-closure');
const performanceProfilesRoot = resolve(toolchainRoot, 'profiles');
const whisperCppSourceLockPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'sources',
  'locks',
  'whisper-cpp-v1.9.1-f049fff.json',
);
const EMPTY_SHA256 = sha256(Buffer.alloc(0));
const RUNNER_EVIDENCE_EMITTER = resolve(
  workspaceRoot,
  'scripts',
  'local-whisper',
  'native-build',
  'emit-runner-evidence.mjs',
);
const WINDOWS_NETWORK_DENIED_RUNNER = resolve(
  workspaceRoot,
  'scripts',
  'local-whisper',
  'native-build',
  'windows-network-denied-runner.mjs',
);

function performanceProfile(profileId) {
  return readJson(resolve(performanceProfilesRoot, `${profileId}.json`));
}

function syntheticCmakeCache(profile, overrides = {}) {
  const omitted = new Set(overrides.omitted ?? []);
  const lines = Object.entries(profile.cmakeCache)
    .filter(([name, value]) => !omitted.has(name) && !value.startsWith('toolchainRoot:'))
    .map(([name, value]) => `${name}:STRING=${overrides.values?.[name] ?? value}`);
  lines.push(...(overrides.extra ?? []));
  return `${lines.join('\n')}\n`;
}

test('pinned whisper.cpp performance options are source-consumed and profile-exact', () => {
  const sourceLock = readJson(whisperCppSourceLockPath);
  const sourceRoot = verifyMaterializedSource(
    resolve(workspaceRoot, '.cache', 'local-whisper', 'native-sources'),
    sourceLock,
  );
  const sourceFiles = sourceLock.manifest
    .filter(({ path }) => path.endsWith('CMakeLists.txt') || path.endsWith('.cmake'))
    .map(({ path, sha256: sourceSha256 }) => ({
      path,
      sha256: sourceSha256,
      text: readFileSync(resolve(sourceRoot, ...path.split('/')), 'utf8'),
    }));
  assert.equal(assertPinnedWhisperCppPerformanceSources(sourceLock, sourceFiles), PERFORMANCE_OPTION_INVENTORY_DIGEST);
  for (const profileId of PERFORMANCE_PROFILE_IDS) {
    assertWhisperCppPerformanceProfileText(readFileSync(resolve(performanceProfilesRoot, `${profileId}.json`), 'utf8'));
  }
});

test('performance option audits reject missing, duplicated, unknown, ignored, and drifted values', () => {
  const profile = performanceProfile('windows-x64-cpu-msvc-19.51-v1');
  const missing = globalThis.structuredClone(profile);
  delete missing.cmakeCache.GGML_AVX2;
  assert.throws(() => assertWhisperCppPerformanceProfile(missing), /option missing/u);

  const unknown = globalThis.structuredClone(profile);
  unknown.cmakeCache.GGML_FUTURE_SWITCH = 'OFF';
  assert.throws(() => assertWhisperCppPerformanceProfile(unknown), /option unknown/u);

  const drifted = globalThis.structuredClone(profile);
  drifted.cmakeCache.GGML_AVX2 = 'ON';
  assert.throws(() => assertWhisperCppPerformanceProfile(drifted), /option drifted/u);
  assert.notEqual(buildIdentity(profile.profileId, profile), buildIdentity(profile.profileId, drifted));

  const profileText = readFileSync(resolve(performanceProfilesRoot, `${profile.profileId}.json`), 'utf8');
  const duplicatedText = profileText.replace('"GGML_AVX2": "OFF",', '"GGML_AVX2": "OFF",\n    "GGML_AVX2": "OFF",');
  assert.throws(() => assertWhisperCppPerformanceProfileText(duplicatedText), /option duplicated/u);

  const buildRoot = mkdtempSync(resolve(tmpdir(), 'local-whisper-performance-cache-'));
  try {
    writeFileSync(resolve(buildRoot, 'build.ninja'), '# profile option audit fixture\n');
    writeFileSync(resolve(buildRoot, 'CMakeCache.txt'), syntheticCmakeCache(profile));
    auditGeneratedBuildGraph(buildRoot, profile);

    writeFileSync(resolve(buildRoot, 'CMakeCache.txt'), syntheticCmakeCache(profile, { omitted: ['GGML_AVX2'] }));
    assert.throws(() => auditGeneratedBuildGraph(buildRoot, profile), /GGML_AVX2: missing/u);

    writeFileSync(resolve(buildRoot, 'CMakeCache.txt'), syntheticCmakeCache(profile, { values: { GGML_AVX2: 'ON' } }));
    assert.throws(() => auditGeneratedBuildGraph(buildRoot, profile), /changed GGML_AVX2/u);

    writeFileSync(
      resolve(buildRoot, 'CMakeCache.txt'),
      syntheticCmakeCache(profile, { extra: ['GGML_AVX2:BOOL=OFF'] }),
    );
    assert.throws(() => auditGeneratedBuildGraph(buildRoot, profile), /Duplicate effective CMake cache option/u);

    writeFileSync(
      resolve(buildRoot, 'CMakeCache.txt'),
      syntheticCmakeCache(profile, { extra: ['GGML_FUTURE_SWITCH:BOOL=ON'] }),
    );
    assert.throws(() => auditGeneratedBuildGraph(buildRoot, profile), /Unknown enabled GGML/u);
  } finally {
    rmSync(buildRoot, { force: true, recursive: true });
  }
});

function hasElevatedWindowsToken() {
  if (process.platform !== 'win32') return false;
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
    ],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  return result.status === 0 && result.stdout.trim() === 'True';
}

test(
  'Windows Firewall runner resolves PowerShell without ambient PATH lookup',
  { skip: process.platform !== 'win32' },
  () => {
    const result = run(process.execPath, [WINDOWS_NETWORK_DENIED_RUNNER, '--assert-powershell-resolved'], {
      allowFailure: true,
      cwd: workspaceRoot,
      env: {
        PATH: '',
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        WINDIR: process.env.WINDIR,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'LOCAL_WHISPER_POWERSHELL_RESOLVED');
  },
);

test(
  'Windows Firewall cleanup succeeds when setup created no packet-owned rules',
  { skip: !hasElevatedWindowsToken() },
  () => {
    const result = run(process.execPath, [WINDOWS_NETWORK_DENIED_RUNNER, '--assert-cleanup-idempotent'], {
      allowFailure: true,
      cwd: workspaceRoot,
      env: process.env,
    });
    assert.equal(result.status, 0, result.stderr);
  },
);

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? '/',
    encoding: 'utf8',
    env: options.env ?? { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
  });
  if (result.error || (options.allowFailure !== true && result.status !== 0)) {
    throw new Error(`${command} failed: ${result.stderr ?? result.error?.message ?? ''}`);
  }
  return result;
}

test('runner evidence emitter creates its missing output directory', { skip: process.platform !== 'linux' }, () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-runner-evidence-'));
  const compiler = resolve(root, 'clang-18');
  const output = resolve(root, 'evidence', 'runner.json');
  try {
    writeFileSync(compiler, "#!/bin/sh\nprintf 'clang version 18.1.3\\n'\n", { mode: 0o700 });
    const result = run(
      process.execPath,
      [
        RUNNER_EVIDENCE_EMITTER,
        '--runner-label=ubuntu-24.04',
        '--toolchain=clang-18',
        '--expected-os=linux',
        `--compiler=${compiler}`,
        `--output=${output}`,
        `--tested-digests=${'a'.repeat(40)}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          GITHUB_SHA: 'b'.repeat(40),
          ImageOS: 'ubuntu24',
          ImageVersion: 'test-image',
          PATH: process.env.PATH,
          RUNNER_ARCH: 'X64',
          RUNNER_OS: 'Linux',
        },
      },
    );
    assert.equal(result.status, 0);
    const evidence = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(evidence.runnerLabel, 'ubuntu-24.04');
    assert.equal(evidence.toolchain.profile, 'clang-18');
    assert.match(evidence.toolchain.version, /clang version 18\./u);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test(
  'runner evidence accepts a hosted MSVC banner despite its no-input exit status',
  { skip: process.platform !== 'linux' },
  () => {
    const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-runner-evidence-msvc-'));
    const compiler = resolve(root, 'cl');
    const output = resolve(root, 'evidence', 'runner.json');
    try {
      writeFileSync(
        compiler,
        "#!/bin/sh\nprintf 'Microsoft (R) C/C++ Optimizing Compiler Version 19.51.36231 for x64\\n'\nexit 2\n",
        { mode: 0o700 },
      );
      const result = run(
        process.execPath,
        [
          RUNNER_EVIDENCE_EMITTER,
          '--runner-label=windows-2025',
          '--toolchain=windows-x64-msvc-19.51-v1',
          '--expected-os=windows',
          `--compiler=${compiler}`,
          `--output=${output}`,
          `--tested-digests=${'a'.repeat(40)}`,
        ],
        {
          cwd: workspaceRoot,
          env: {
            GITHUB_SHA: 'b'.repeat(40),
            ImageOS: 'win25',
            ImageVersion: 'test-image',
            PATH: process.env.PATH,
            RUNNER_ARCH: 'X64',
            RUNNER_OS: 'Windows',
          },
        },
      );
      assert.equal(result.status, 0);
      const evidence = JSON.parse(readFileSync(output, 'utf8'));
      assert.equal(evidence.runnerLabel, 'windows-2025');
      assert.equal(evidence.toolchain.profile, 'windows-x64-msvc-19.51-v1');
      assert.match(evidence.toolchain.version, /Version 19\.51\./u);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  },
);

test('runner evidence rejects mutable Windows runner aliases', { skip: process.platform !== 'linux' }, () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-runner-evidence-alias-'));
  try {
    const result = run(
      process.execPath,
      [
        RUNNER_EVIDENCE_EMITTER,
        '--runner-label=windows-latest',
        '--toolchain=windows-x64-msvc-19.51-v1',
        '--expected-os=windows',
        '--compiler=cl',
        `--output=${resolve(root, 'runner.json')}`,
      ],
      {
        allowFailure: true,
        cwd: workspaceRoot,
        env: {
          GITHUB_SHA: 'b'.repeat(40),
          ImageOS: 'win25',
          ImageVersion: 'test-image',
          PATH: process.env.PATH,
          RUNNER_ARCH: 'X64',
          RUNNER_OS: 'Windows',
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported runner label/u);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

function identity(path) {
  return Object.freeze({ path: realpathSync(path), sha256: sha256(readFileSync(realpathSync(path))) });
}

function compileClosureFixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-elf-closure-'));
  const stagingRoot = resolve(root, 'stage');
  const binary = resolve(stagingRoot, 'bin', 'clean-start');
  const library = resolve(stagingRoot, 'lib', 'liblocal_whisper_fixture.so.1');
  mkdirSync(dirname(binary), { mode: 0o700, recursive: true });
  mkdirSync(dirname(library), { mode: 0o700, recursive: true });
  run('/usr/bin/gcc', [
    '-std=c11',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-fPIC',
    '-shared',
    '-Wl,-soname,liblocal_whisper_fixture.so.1',
    resolve(dependencyFixtureRoot, 'fixture_library.c'),
    '-o',
    library,
  ]);
  run('/usr/bin/gcc', [
    '-std=c11',
    '-Wall',
    '-Wextra',
    '-Werror',
    resolve(dependencyFixtureRoot, 'clean_start.c'),
    `-L${dirname(library)}`,
    '-Wl,-rpath,$ORIGIN/../lib',
    '-Wl,--no-as-needed',
    '-l:liblocal_whisper_fixture.so.1',
    '-o',
    binary,
  ]);
  return Object.freeze({ binary, library, root, stagingRoot });
}

function closureInputs(fixture, stagingRoot = fixture.stagingRoot) {
  return {
    inspector: identity('/usr/bin/readelf'),
    stagingRoot,
    entrypoints: [
      {
        id: 'clean-start',
        relativePath: 'bin/clean-start',
        sha256: sha256(readFileSync(resolve(stagingRoot, 'bin', 'clean-start'))),
      },
    ],
    stagedLibraries: [
      {
        id: 'fixture-library',
        soname: 'liblocal_whisper_fixture.so.1',
        relativePath: 'lib/liblocal_whisper_fixture.so.1',
        sha256: sha256(readFileSync(resolve(stagingRoot, 'lib', 'liblocal_whisper_fixture.so.1'))),
      },
    ],
    reviewedSystemLibraries: [
      {
        id: 'glibc',
        soname: 'libc.so.6',
        ...identity('/usr/lib/x86_64-linux-gnu/libc.so.6'),
      },
    ],
    environment: { LANG: 'C', LC_ALL: 'C' },
  };
}

function qualifiedCandidateProfile() {
  const profile = readJson(resolve(toolchainRoot, 'profiles', 'linux-x64-clang-18.1.3-asan-ubsan-v1.json'));
  profile.qualificationState = 'candidate-unqualified';
  profile.evidenceDigest = null;
  for (const component of [...profile.tools, ...profile.runtime, ...profile.licenses]) {
    component.sha256 = sha256(Buffer.from(`${component.role ?? component.id}:${component.path}`, 'utf8'));
  }
  profile.tools.find(({ role }) => role === 'elf-inspector').sha256 = identity('/usr/bin/readelf').sha256;
  profile.tools.find(({ role }) => role === 'network-harness').sha256 = identity('/usr/bin/unshare').sha256;
  for (const dependency of profile.dynamicDependencies) {
    dependency.sha256 = profile.runtime.find(({ id }) => id === dependency.id).sha256;
  }
  return profile;
}

function execution(target, purpose, exitStatus, markers) {
  return {
    target,
    purpose,
    exitStatus,
    signal: null,
    stdoutSha256: EMPTY_SHA256,
    stderrSha256: EMPTY_SHA256,
    requiredMarkers: [...markers],
    observedMarkers: [...markers],
    networkNamespace: 'user-network-isolated',
  };
}

function completeEvidence(profile) {
  const phases = ['preflight', 'configure', 'build', 'relocated-clean-start'].map((phase) => ({
    phase,
    commandSha256: sha256(Buffer.from(phase, 'utf8')),
    exitStatus: 0,
    networkNamespace: 'user-network-isolated',
  }));
  const stagedFiles = [
    ...profile.outputs.map((output) => ({
      id: output.id,
      relativePath: output.path,
      sha256: sha256(Buffer.from(output.id, 'utf8')),
      mode: '100755',
    })),
    ...profile.dynamicDependencies
      .filter(({ pathKind }) => pathKind === 'toolchainRootRelative')
      .map((component) => ({
        id: component.id,
        relativePath: `lib/${component.soname}`,
        sha256: component.sha256,
        mode: '100644',
      })),
    ...profile.licenses.map((component) => ({
      id: component.id,
      relativePath: `licenses/${component.id}.LICENSE`,
      sha256: component.sha256,
      mode: '100644',
    })),
  ];
  const closureRecords = profile.outputs.map((output, index) => ({
    fileId: output.id,
    relativePath: output.path,
    sha256: stagedFiles.find(({ id }) => id === output.id).sha256,
    needed:
      index === 0
        ? profile.dynamicDependencies.map((component) => ({
            soname: component.soname,
            resolutionKind: component.pathKind === 'systemAbsolute' ? 'reviewed-system' : 'staged',
            resolvedId: component.id,
            sha256: component.sha256,
          }))
        : [],
  }));
  return {
    $schema: '../schema/native-toolchain-evidence.schema.json',
    schemaId: 'local-whisper-native-toolchain-evidence-v1',
    profileId: profile.profileId,
    profileInputDigest: qualificationInputDigest(profile),
    inputs: {
      sourceLockIds: [...profile.sourceLockIds],
      patchLockIds: [...profile.patchLockIds],
      qualificationFixture: globalThis.structuredClone(profile.qualificationFixture),
    },
    toolIdentities: profile.tools.map((tool) => ({
      id: tool.role,
      path: tool.path,
      sha256: tool.sha256,
      versionOutputSha256: sha256(Buffer.from(tool.version, 'utf8')),
    })),
    runtimeIdentities: profile.runtime.map((component) => ({
      id: component.id,
      path: component.path,
      sha256: component.sha256,
    })),
    licenseIdentities: profile.licenses.map((component) => ({
      id: component.id,
      path: component.path,
      sha256: component.sha256,
    })),
    configuredCacheSha256: canonicalDigest(profile.cmakeCache),
    effectiveCacheSha256: sha256(Buffer.from('effective-cache', 'utf8')),
    generatedBuildGraphSha256: sha256(Buffer.from('generated-graph', 'utf8')),
    generatedTargets: [...profile.expectedBuildGraph],
    executions: [
      execution('local-whisper-sanitizer-clean', 'clean', 0, ['LOCAL_WHISPER_SANITIZER_CLEAN_OK']),
      execution('local-whisper-sanitizer-asan-trigger', 'asan-trigger', 1, ['AddressSanitizer', 'heap-use-after-free']),
      execution('local-whisper-sanitizer-ubsan-trigger', 'ubsan-trigger', 1, [
        'runtime error:',
        'signed integer overflow',
      ]),
    ],
    stagedFiles,
    dependencyClosure: {
      inspector: identity('/usr/bin/readelf'),
      records: closureRecords,
    },
    relocation: {
      rootIdentity: sha256(Buffer.from('relocation-root', 'utf8')),
      manifestSha256: canonicalDigest(stagedFiles),
      maliciousCwdIdentity: sha256(Buffer.from('malicious-cwd', 'utf8')),
      environmentAllowlist: [...profile.environmentAllowlist],
      inheritedEnvironmentKeys: [],
      forbiddenVariablesAbsent: ['LD_LIBRARY_PATH', 'LD_PRELOAD', 'GGML_BACKEND_PATH'],
      execution: execution('local-whisper-sanitizer-clean', 'relocated-clean', 0, ['LOCAL_WHISPER_SANITIZER_CLEAN_OK']),
    },
    networkDenial: { harness: identity('/usr/bin/unshare'), phases },
    sanitizedEnvironment: {
      allowlistedKeys: [...profile.environmentAllowlist],
      inheritedKeys: [],
      environmentSha256: canonicalDigest({ LANG: 'C', LC_ALL: 'C' }),
      cwdPolicy: 'owned-malicious-unrelated',
    },
  };
}

test('GoogleTest source definition pins the reviewed complete tree and license', () => {
  const definition = getSourceDefinition('googletest-v1.17.0-52eb810');
  assert.equal(definition.commit, '52eb8108c5bdec04579160ae17225d66034bd723');
  assert.equal(definition.gitTree, 'ad23b2ceac4a6eef2278c48545b62ffc1f0c134a');
  assert.equal(definition.expectedPathCount, 250);
  assert.equal(definition.expectedRegularBytes, 4_095_045);
  assert.equal(definition.expectedExecutableCount, 24);
  assert.equal(definition.licenseGitBlob, '1941a11f8ce94389160b458927a29ba217542818');
  assert.equal(definition.licenseSha256, '9702de7e4117a8e2b20dafab11ffda58c198aede066406496bef670d40a22138');
});

test('sanitizer fixture identity is complete, immutable, and bound by the Clang profile', () => {
  const identity = readSanitizerFixtureIdentity(workspaceRoot);
  const profile = readJson(resolve(toolchainRoot, 'profiles', 'linux-x64-clang-18.1.3-asan-ubsan-v1.json'));
  assert.deepEqual(profile.sourceLockIds, []);
  assert.deepEqual(profile.patchLockIds, []);
  assert.equal(profile.qualificationFixture.fixtureId, identity.fixtureId);
  assert.equal(profile.qualificationFixture.manifestSha256, identity.manifestSha256);
  assert.deepEqual(profile.expectedBuildGraph, [
    'local-whisper-sanitizer-clean',
    'local-whisper-sanitizer-asan-trigger',
    'local-whisper-sanitizer-ubsan-trigger',
  ]);
});

test(
  'tool capture preserves reviewed multi-call invocation paths while hashing canonical bytes',
  { skip: process.platform !== 'linux' },
  () => {
    const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-multicall-tool-'));
    const driver = resolve(root, 'canonical-driver');
    const invocation = resolve(root, 'reviewed-invocation');
    writeFileSync(
      driver,
      '#!/bin/sh\ncase "$0" in\n  *reviewed-invocation) printf "reviewed-mode\\n" ;;\n  *) exit 9 ;;\nesac\n',
      { mode: 0o700 },
    );
    symlinkSync(driver, invocation);

    const profile = readJson(resolve(toolchainRoot, 'profiles', 'linux-x64-clang-18.1.3-asan-ubsan-v1.json'));
    profile.qualificationState = 'candidate-unqualified';
    profile.evidenceDigest = null;
    for (const tool of profile.tools) {
      tool.pathKind = 'systemAbsolute';
      tool.path = invocation;
      tool.version = 'reviewed-mode';
      tool.sha256 = null;
    }
    for (const component of [...profile.runtime, ...profile.licenses]) {
      if (component.pathKind === 'outputRelative') continue;
      component.pathKind = 'systemAbsolute';
      component.path = driver;
      component.sha256 = null;
    }
    for (const dependency of profile.dynamicDependencies) {
      const runtime = profile.runtime.find(({ id }) => id === dependency.id);
      dependency.pathKind = runtime.pathKind;
      dependency.path = runtime.path;
      dependency.sha256 = null;
    }

    const captured = captureToolchainInputLock(profile, root);
    const expectedSha256 = sha256(readFileSync(driver));
    assert.equal(resolveProfileTool(captured, root, 'linker'), invocation);
    assert.equal(
      captured.tools.every(({ sha256: toolSha256 }) => toolSha256 === expectedSha256),
      true,
    );
  },
);

test(
  'strict qualification evidence rejects boolean-only and missing executable facts',
  { skip: process.platform !== 'linux' },
  () => {
    const profile = qualifiedCandidateProfile();
    const evidence = completeEvidence(profile);
    const schema = readJson(resolve(toolchainRoot, 'schema', 'native-toolchain-evidence.schema.json'));
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    assert.equal(validate(evidence), true, JSON.stringify(validate.errors));
    assert.equal(verifyQualificationEvidence(profile, evidence), true);
    assert.equal(qualifyToolchainProfile(profile, evidence).qualificationState, 'qualified');

    const booleanOnly = { ...evidence, cleanStartVerified: true };
    assert.equal(validate(booleanOnly), false);
    const missingTrigger = globalThis.structuredClone(evidence);
    missingTrigger.executions.pop();
    assert.throws(() => verifyQualificationEvidence(profile, missingTrigger));
    const successfulTrigger = globalThis.structuredClone(evidence);
    successfulTrigger.executions[1].exitStatus = 0;
    assert.throws(() => verifyQualificationEvidence(profile, successfulTrigger));
    const changedProfile = globalThis.structuredClone(profile);
    changedProfile.cmakeCache.CMAKE_CXX_STANDARD = '23';
    assert.throws(() => verifyQualificationEvidence(changedProfile, evidence));
    const leakedToolPath = globalThis.structuredClone(evidence);
    leakedToolPath.toolIdentities[0].path = '/private/build-root/tool';
    assert.throws(() => verifyQualificationEvidence(profile, leakedToolPath));
  },
);

test(
  'readelf closure accepts only staged or reviewed identities and ignores a malicious CWD',
  { skip: process.platform !== 'linux' },
  () => {
    const implementation = readFileSync(
      resolve(workspaceRoot, 'scripts', 'local-whisper', 'native-build', 'elf-dependency-core.mjs'),
      'utf8',
    );
    assert.doesNotMatch(implementation, /\bldd\b/u);
    const fixture = compileClosureFixture();
    const maliciousCwd = resolve(fixture.root, 'malicious-cwd');
    mkdirSync(maliciousCwd, { mode: 0o700 });
    writeFileSync(resolve(maliciousCwd, 'liblocal_whisper_fixture.so.1'), 'malicious\n', { mode: 0o600 });
    const closure = verifyElfDependencyClosure(closureInputs(fixture));
    assert.deepEqual(
      closure.records.map(({ fileId }) => fileId),
      ['clean-start', 'fixture-library'],
    );
    assert.equal(
      closure.records[0].needed.find(({ soname }) => soname === 'liblocal_whisper_fixture.so.1').resolutionKind,
      'staged',
    );
    assert.throws(() =>
      verifyElfDependencyClosure({
        ...closureInputs(fixture),
        environment: { LANG: 'C', LD_LIBRARY_PATH: maliciousCwd },
      }),
    );
  },
);

test('readelf closure fails when a required staged library is missing', { skip: process.platform !== 'linux' }, () => {
  const fixture = compileClosureFixture();
  const inputs = closureInputs(fixture);
  const absent = `${fixture.library}.absent`;
  renameSync(fixture.library, absent);
  assert.throws(() => verifyElfDependencyClosure(inputs));
  renameSync(absent, fixture.library);
});

test(
  'relocated synthetic stage starts network-denied with an empty inherited environment',
  { skip: process.platform !== 'linux' },
  () => {
    const fixture = compileClosureFixture();
    const relocatedRoot = resolve(fixture.root, 'relocated');
    const maliciousCwd = resolve(fixture.root, 'malicious-relocation-cwd');
    mkdirSync(resolve(relocatedRoot, 'bin'), { mode: 0o700, recursive: true });
    mkdirSync(resolve(relocatedRoot, 'lib'), { mode: 0o700, recursive: true });
    mkdirSync(maliciousCwd, { mode: 0o700 });
    copyFileSync(fixture.binary, resolve(relocatedRoot, 'bin', 'clean-start'));
    copyFileSync(fixture.library, resolve(relocatedRoot, 'lib', 'liblocal_whisper_fixture.so.1'));
    chmodSync(resolve(relocatedRoot, 'bin', 'clean-start'), 0o755);
    writeFileSync(resolve(maliciousCwd, 'liblocal_whisper_fixture.so.1'), 'malicious\n', { mode: 0o600 });
    const relocatedFixture = {
      ...fixture,
      stagingRoot: relocatedRoot,
    };
    assert.equal(verifyElfDependencyClosure(closureInputs(relocatedFixture, relocatedRoot)).records.length, 2);
    const result = run('/usr/bin/unshare', ['-Urn', '--', resolve(relocatedRoot, 'bin', 'clean-start')], {
      cwd: maliciousCwd,
      env: { LANG: 'C', LC_ALL: 'C' },
      allowFailure: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /LOCAL_WHISPER_RELOCATED_CLEAN_OK/u);
  },
);

test('GitHub-hosted namespace mapping fallback retains a real isolated network namespace', () => {
  const calls = [];
  const environment = {
    LANG: 'C',
    LC_ALL: 'C',
    PATH: '/malicious:/usr/bin:/bin',
    GGML_BACKEND_PATH: '/malicious',
    LD_LIBRARY_PATH: '/malicious',
  };
  const result = runNetworkIsolatedSelfTest(
    '/usr/bin/unshare',
    '/fixture/worker',
    '/fixture/malicious-cwd',
    environment,
    (command, arguments_, options) => {
      calls.push({ arguments_, command, options });
      return calls.length === 1
        ? {
            status: 1,
            stderr: 'unshare: write failed /proc/self/uid_map: Operation not permitted',
          }
        : { status: 0, stderr: '', stdout: 'LOCAL_WHISPER_CPP_CPU_SELF_TEST_OK\n' };
    },
    { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' },
  );

  assert.equal(result.status, 0);
  assert.deepEqual(calls, [
    {
      command: '/usr/bin/unshare',
      arguments_: ['--user', '--map-root-user', '--net', '/fixture/worker', '--self-test'],
      options: { cwd: '/fixture/malicious-cwd', encoding: 'utf8', env: environment, shell: false },
    },
    {
      command: '/usr/bin/sudo',
      arguments_: [
        '-n',
        '--',
        '/usr/bin/env',
        'LANG=C',
        'LC_ALL=C',
        'PATH=/malicious:/usr/bin:/bin',
        'GGML_BACKEND_PATH=/malicious',
        'LD_LIBRARY_PATH=/malicious',
        '/usr/bin/unshare',
        '--net',
        '/fixture/worker',
        '--self-test',
      ],
      options: { cwd: '/fixture/malicious-cwd', encoding: 'utf8', env: environment, shell: false },
    },
  ]);
});
