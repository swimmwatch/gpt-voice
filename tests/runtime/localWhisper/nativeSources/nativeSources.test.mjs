import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import process from 'node:process';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  canonicalLoaderLimitToolSourceBytes,
  validateDerivationInputs,
} from '../../../../scripts/local-whisper/native-build/loader-limit-core.mjs';
import { resolveNativeBuildToolPaths } from '../../../../scripts/local-whisper/native-build/native-build-tool-paths.mjs';
import { resolveWindowsMsvcBuildEnvironment } from '../../../../scripts/local-whisper/native-build/windows-msvc-build-environment.mjs';
import { parseDumpbinDependencies } from '../../../../scripts/local-whisper/native-build/windows-pe-dependency-core.mjs';
import {
  qualifyToolchainProfile,
  verifyToolchainContract,
} from '../../../../scripts/local-whisper/native-build/native-toolchain-core.mjs';
import {
  platformBuildCmakeArguments,
  resolvePreparedLinuxQualityTools,
  resolvePreparedWindowsQualityTools,
} from '../../../../scripts/local-whisper/whisper-cpp-build-core.mjs';
import {
  approveSourceCandidate,
  buildIndexManifest,
  canonicalCatalogJson,
  canonicalDigest,
  canonicalJson,
  readJson,
  sha256,
  validateRelativePath,
  validateSafeSymlinkTarget,
  verifySourceLock,
} from '../../../../scripts/local-whisper/source-import/native-source-core.mjs';
import { applyPatchLock, verifyPatchLock } from '../../../../scripts/local-whisper/source-import/native-patch-core.mjs';
import {
  canonicalImporterSourceBytes,
  importerImplementationDigest,
} from '../../../../scripts/local-whisper/source-import/importer-identity.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
const sourceRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources');
const toolchainRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains');

test('native source importer identity is invariant across checkout line endings', () => {
  assert.deepEqual(
    canonicalImporterSourceBytes(Buffer.from('first\r\nsecond\n', 'utf8')),
    Buffer.from('first\nsecond\n', 'utf8'),
  );
  for (const lockId of ['nlohmann-json-v3.12.0-subset', 'googletest-v1.17.0-52eb810', 'whisper-cpp-v1.9.1-f049fff']) {
    const lock = readJson(resolve(sourceRoot, 'locks', `${lockId}.json`));
    assert.equal(lock.importer.implementationSha256, importerImplementationDigest());
  }
});

test('loader-limit derivation tool identity is invariant across checkout line endings', () => {
  assert.deepEqual(
    canonicalLoaderLimitToolSourceBytes(Buffer.from('first\r\nsecond\n', 'utf8')),
    Buffer.from('first\nsecond\n', 'utf8'),
  );
});

test('native patch locks retain exact LF bytes in CRLF checkouts', () => {
  const patchRelativePath = 'runtime/local-whisper/whisper-cpp/patches/core/0001-exact-loader-reads.patch';
  assert.equal(git(workspaceRoot, ['check-attr', 'eol', '--', patchRelativePath]), `${patchRelativePath}: eol: lf\n`);

  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'local-whisper-patch-eol-'));
  const authorRoot = resolve(fixtureRoot, 'author');
  const checkoutRoot = resolve(fixtureRoot, 'checkout');
  mkdirSync(authorRoot);
  createRepository(authorRoot);
  const patchBytes = readFileSync(resolve(workspaceRoot, patchRelativePath));
  mkdirSync(resolve(authorRoot, 'patches'));
  writeFileSync(resolve(authorRoot, '.gitattributes'), 'patches/** text eol=lf\n');
  writeFileSync(resolve(authorRoot, 'patches', 'identity.patch'), patchBytes);
  git(authorRoot, ['add', '--', '.gitattributes', 'patches/identity.patch']);
  git(authorRoot, ['commit', '--quiet', '-m', 'add exact patch fixture']);
  git(authorRoot, ['-c', 'core.autocrlf=true', 'clone', '--quiet', authorRoot, checkoutRoot]);

  assert.deepEqual(readFileSync(resolve(checkoutRoot, 'patches', 'identity.patch')), patchBytes);
});

function git(repository, arguments_) {
  const result = spawnSync('git', arguments_, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
}

function createRepository(root, value = 'old\n') {
  mkdirSync(resolve(root, 'src'), { recursive: true });
  writeFileSync(resolve(root, 'src', 'value.txt'), value);
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['add', '--', 'src/value.txt']);
  git(root, ['commit', '--quiet', '-m', 'fixture']);
}

function nlohmannLock() {
  const manifest = [
    {
      path: 'LICENSE.MIT',
      entryType: 'regular',
      mode: '100644',
      gitObjectId: 'a1dacc8dbbd907c4b622ff1f08e279c27465dcbc',
      sizeBytes: 1076,
      sha256: '46a65cffd1ea955132d95a8dd921640714a8d6b537d2e4e482d31145ae95b603',
      symlinkTarget: null,
    },
    {
      path: 'single_include/nlohmann/json.hpp',
      entryType: 'regular',
      mode: '100644',
      gitObjectId: '82d69f7c5d044c9887c96b90c97f5639083ecd14',
      sizeBytes: 953436,
      sha256: 'aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63',
      symlinkTarget: null,
    },
  ];
  const manifestSha256 = canonicalDigest(manifest);
  return {
    $schema: '../schema/native-source-lock.schema.json',
    schemaId: 'local-whisper-native-source-lock-v1',
    lockId: 'nlohmann-json-v3.12.0-subset',
    repository: 'https://github.com/nlohmann/json.git',
    commit: '55f93686c01528224f448c19128836e7df245f72',
    gitTree: '1eb780542e829bf1615828ed0d5f407497bbce7b',
    signature: {
      reviewResult: 'reviewed-unverifiable',
      signerKeyFingerprint: null,
      evidenceUrl: 'https://github.com/nlohmann/json/commit/55f93686c01528224f448c19128836e7df245f72',
    },
    importer: {
      schemaId: 'local-whisper-native-importer-v1',
      implementationSha256: 'a'.repeat(64),
      imageIdentity: 'fixture',
      gitVersion: 'git version fixture',
      nodeVersion: 'v24.0.0',
    },
    materialization: {
      kind: 'explicitSubset',
      rootPrefix: '',
      manifestSha256,
      pathCount: 2,
      expandedRegularBytes: 954512,
      expandedRegularBytesCeiling: 954512,
      executableModeCount: 0,
      allowedEntryTypes: ['regular'],
      excludedTreeProvenance: {
        completeTree: '1eb780542e829bf1615828ed0d5f407497bbce7b',
        includedPaths: ['LICENSE.MIT', 'single_include/nlohmann/json.hpp'],
      },
    },
    manifest,
    transportObject: null,
    license: {
      path: 'LICENSE.MIT',
      gitBlob: 'a1dacc8dbbd907c4b622ff1f08e279c27465dcbc',
      sizeBytes: 1076,
      sha256: '46a65cffd1ea955132d95a8dd921640714a8d6b537d2e4e482d31145ae95b603',
      provenance: 'https://github.com/nlohmann/json.git@55f93686c01528224f448c19128836e7df245f72:LICENSE.MIT',
      sbomComponent: 'nlohmann-json-v3.12.0',
    },
    recursiveInputs: { gitlinks: [], lfsPointers: [] },
    provenance: {
      reviewStatus: 'approved',
      reviewedAt: '2026-08-02T00:00:00.000Z',
      reviewedBy: 'fixture-reviewer',
      sourceEvidence: ['fixture'],
    },
    contentStore: {
      algorithm: 'sha256',
      identity: manifestSha256,
      relativeDestination: `sha256/${manifestSha256}`,
    },
  };
}

function compileSchema(path, formats = undefined) {
  const ajv = new Ajv2020({ allErrors: true, formats, strict: true });
  return ajv.compile(JSON.parse(readFileSync(path, 'utf8')));
}

test('native source schemas accept the canonical subset lock and reject mutations', () => {
  const validate = compileSchema(resolve(sourceRoot, 'schema', 'native-source-lock.schema.json'), {
    'date-time': true,
  });
  const lock = nlohmannLock();
  assert.equal(validate(lock), true, JSON.stringify(validate.errors));
  assert.equal(verifySourceLock(lock), true);

  for (const mutate of [
    (candidate) => {
      candidate.commit = '0'.repeat(40);
    },
    (candidate) => {
      candidate.gitTree = '0'.repeat(40);
    },
    (candidate) => {
      candidate.manifest[0].path = '../LICENSE.MIT';
    },
    (candidate) => {
      candidate.manifest[0].mode = '100755';
    },
    (candidate) => {
      candidate.license.sha256 = '0'.repeat(64);
    },
    (candidate) => {
      candidate.materialization.manifestSha256 = '0'.repeat(64);
    },
  ]) {
    const changed = globalThis.structuredClone(lock);
    mutate(changed);
    assert.throws(() => verifySourceLock(changed));
  }
});

test('path and link policy rejects traversal, platform aliases, controls, and escapes', () => {
  for (const path of [
    '../escape',
    'dir/../escape',
    '/absolute',
    'C:/drive',
    '//server/share',
    'dir\\file',
    'dir/NUL.txt',
    'dir/trailing. ',
    'dir/control\u0001',
  ]) {
    assert.throws(() => validateRelativePath(path));
  }
  assert.equal(validateRelativePath('safe/path.txt'), 'safe/path.txt');
  assert.equal(validateSafeSymlinkTarget('safe/link', '../target.txt'), '../target.txt');
  assert.throws(() => validateSafeSymlinkTarget('safe/link', '../../escape'));
});

test('two clean synthetic Git indexes have the same canonical content identity', () => {
  const first = mkdtempSync(resolve(tmpdir(), 'local-whisper-source-a-'));
  const second = mkdtempSync(resolve(tmpdir(), 'local-whisper-source-b-'));
  createRepository(first);
  createRepository(second);
  const firstManifest = buildIndexManifest(first);
  const secondManifest = buildIndexManifest(second);
  assert.equal(firstManifest.manifestSha256, secondManifest.manifestSha256);
  assert.equal(canonicalJson(firstManifest.entries), canonicalJson(secondManifest.entries));
});

test('plain-Node catalog JSON matches the strict Local Whisper canonical bytes', () => {
  assert.equal(
    canonicalCatalogJson({
      schemaVersion: 1,
      patchLockId: 'lock',
      patchedManifestDigest: 'digest',
      array: [{ z: 1 }],
    }),
    '{"array":[{"z":1}],"patchedManifestDigest":"digest","patchLockId":"lock","schemaVersion":1}',
  );
  for (const invalid of [1.5, -0, Number.NaN, '\ud800', { missing: undefined }]) {
    assert.throws(() => canonicalCatalogJson(invalid), /Invalid catalog value/u);
  }
});

test('source candidate approval binds the exact reviewed digest', () => {
  const proposedLock = nlohmannLock();
  proposedLock.provenance.reviewedAt = '1970-01-01T00:00:00.000Z';
  proposedLock.provenance.reviewedBy = 'PENDING_MANUAL_REVIEW';
  const candidate = {
    schemaId: 'local-whisper-native-source-candidate-v1',
    lockId: proposedLock.lockId,
    candidateDigest: canonicalDigest(proposedLock),
    reviewRequired: true,
    proposedLock,
  };
  const review = {
    schemaId: 'local-whisper-native-source-review-v1',
    candidateDigest: candidate.candidateDigest,
    disposition: 'approved',
    reviewedAt: '2026-08-02T00:00:00.000Z',
    reviewedBy: 'fixture-reviewer',
    sourceEvidence: ['fixture'],
    signature: globalThis.structuredClone(nlohmannLock().signature),
  };
  assert.equal(approveSourceCandidate(candidate, review).provenance.reviewedBy, 'fixture-reviewer');
  assert.throws(() => approveSourceCandidate(candidate, { ...review, candidateDigest: '0'.repeat(64) }));
});

test('ordered patch lock applies exactly and rejects identity and touched-path changes', () => {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'local-whisper-patch-'));
  const authorRoot = resolve(fixtureRoot, 'author');
  const applyRoot = resolve(fixtureRoot, 'apply');
  const patchRoot = resolve(fixtureRoot, 'patches');
  mkdirSync(authorRoot);
  mkdirSync(applyRoot);
  mkdirSync(patchRoot);
  createRepository(authorRoot);
  createRepository(applyRoot);
  const original = buildIndexManifest(applyRoot);
  writeFileSync(resolve(authorRoot, 'src', 'value.txt'), 'new\n');
  const patchBytes = Buffer.from(git(authorRoot, ['diff', '--binary', '--', 'src/value.txt']), 'utf8');
  writeFileSync(resolve(patchRoot, 'change.patch'), patchBytes);
  git(authorRoot, ['add', '--', 'src/value.txt']);
  const finalManifest = buildIndexManifest(authorRoot);
  const lock = {
    schemaId: 'local-whisper-native-patch-lock-v1',
    lockId: 'fixture-patches-v1',
    sourceLockId: 'fixture-source-v1',
    originalManifestSha256: original.manifestSha256,
    patches: [
      {
        patchId: 'change-value-v1',
        relativePath: 'change.patch',
        sizeBytes: patchBytes.byteLength,
        sha256: sha256(patchBytes),
        allowedTouchedPaths: ['src/value.txt'],
      },
    ],
    application: {
      stripLevel: 1,
      command: 'git apply --index --whitespace=error-all -p1',
      allowFuzz: false,
      allowThreeWay: false,
      allowOffsets: false,
    },
    expectedRejectCount: 0,
    finalManifestSha256: finalManifest.manifestSha256,
    reviewStatus: 'mechanism-only',
  };
  assert.equal(verifyPatchLock(lock, patchRoot), true);
  assert.equal(applyPatchLock(applyRoot, patchRoot, lock).manifestSha256, finalManifest.manifestSha256);
  const changed = globalThis.structuredClone(lock);
  changed.patches[0].allowedTouchedPaths = ['other.txt'];
  assert.throws(() => verifyPatchLock(changed, patchRoot));
});

test('loader-limit derivation inputs reject every authority mutation', () => {
  const inputs = readJson(resolve(sourceRoot, 'limits', 'whisper-cpp-loader-limit-inputs-v1.json'));
  assert.equal(validateDerivationInputs(inputs), true);
  for (const mutate of [
    (candidate) => candidate.families.reverse(),
    (candidate) => candidate.variants.push('q8_0'),
    (candidate) => {
      candidate.tensorTypes[0] = 'F64';
    },
    (candidate) => {
      candidate.limits.tensorCount += 1;
    },
    (candidate) => {
      candidate.families[0].nAudioState += 1;
    },
  ]) {
    const changed = globalThis.structuredClone(inputs);
    mutate(changed);
    assert.throws(() => validateDerivationInputs(changed));
  }
});

test('toolchain schemas preserve Linux candidates and Windows qualification-only contracts', () => {
  const validate = compileSchema(resolve(toolchainRoot, 'schema', 'native-toolchain-lock.schema.json'));
  const profilesRoot = resolve(toolchainRoot, 'profiles');
  for (const profileId of [
    'linux-x64-cpu-baseline-v1',
    'linux-x64-clang-18.1.3-asan-ubsan-v1',
    'linux-x64-cuda-12.8.1-sm120a-v1',
  ]) {
    const profile = readJson(resolve(profilesRoot, `${profileId}.json`));
    assert.equal(validate(profile), true, `${profileId}: ${JSON.stringify(validate.errors)}`);
    assert.equal(verifyToolchainContract(profile, { allowCandidate: true, contractOnly: false }), true);
  }
  for (const profileId of ['windows-x64-cpu-msvc-19.39-v1', 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1']) {
    const profile = readJson(resolve(profilesRoot, `${profileId}.json`));
    assert.equal(validate(profile), true, `${profileId}: ${JSON.stringify(validate.errors)}`);
    assert.equal(verifyToolchainContract(profile, { contractOnly: true }), true);
    assert.throws(() => verifyToolchainContract(profile, { contractOnly: false }));
  }
});

test('Windows CUDA environment derives the exact Visual Studio instance from the verified host compiler', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-windows-environment-'));
  const toolchain = resolve(root, 'toolchains');
  const msvcRoot = resolve(toolchain, 'msvc-14.39');
  const sdkRoot = resolve(toolchain, 'windows-sdk-10.0.26100.0');
  const cudaRoot = resolve(toolchain, 'cuda-12.8.1');
  const vsInstallRoot = resolve(root, 'Microsoft Visual Studio', '2022', 'BuildTools');
  const vcInstallRoot = resolve(vsInstallRoot, 'VC');
  const msvcInstallationRoot = resolve(vcInstallRoot, 'Tools', 'MSVC', '14.39.33519');
  const cudaHostCompiler = resolve(msvcInstallationRoot, 'bin', 'Hostx64', 'x64', 'cl.exe');
  const systemRoot = resolve(root, 'Windows');
  for (const directory of [
    resolve(msvcRoot, 'include'),
    resolve(msvcRoot, 'lib', 'x64'),
    resolve(sdkRoot, 'bin', '10.0.26100.0', 'x64'),
    resolve(sdkRoot, 'Include', '10.0.26100.0', 'um'),
    resolve(sdkRoot, 'Lib', '10.0.26100.0', 'um', 'x64'),
    resolve(cudaRoot, 'bin'),
    resolve(vcInstallRoot, 'Auxiliary', 'Build'),
    resolve(systemRoot, 'System32'),
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(resolve(vcInstallRoot, 'Auxiliary', 'Build', 'vcvarsall.bat'), '@exit /b 0\r\n');

  const environment = resolveWindowsMsvcBuildEnvironment({
    environment: {
      SystemRoot: systemRoot,
      TEMP: resolve(root, 'temp'),
      TMP: resolve(root, 'temp'),
      WINDIR: systemRoot,
    },
    includeCuda: true,
    toolchainRoot: toolchain,
    tools: {
      cmake: resolve(toolchain, 'cmake-3.31.8', 'bin', 'cmake.exe'),
      compiler: resolve(msvcRoot, 'bin', 'Hostx64', 'x64', 'cl.exe'),
      cudaHostCompiler,
      ninja: resolve(toolchain, 'ninja-1.12.1', 'ninja.exe'),
    },
  });

  assert.equal(environment.Platform, 'x64');
  assert.equal(environment.PROCESSOR_ARCHITECTURE, 'AMD64');
  assert.equal(environment.VCToolsVersion, '14.39.33519');
  assert.equal(environment.VCToolsInstallDir, `${msvcInstallationRoot}${sep}`);
  assert.equal(environment.VCINSTALLDIR, `${vcInstallRoot}${sep}`);
  assert.equal(environment.VSINSTALLDIR, `${vsInstallRoot}${sep}`);
  assert.equal(environment.VSCMD_ARG_HOST_ARCH, 'x64');
  assert.equal(environment.VSCMD_ARG_TGT_ARCH, 'x64');
});

test('Windows native checks use a prepared developer environment without a cached toolchain', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-windows-developer-environment-'));
  const includeDirectory = resolve(root, 'include');
  const libraryDirectory = resolve(root, 'lib');
  const libraryPathDirectory = resolve(root, 'libpath');
  const systemRoot = resolve(root, 'Windows');
  for (const directory of [includeDirectory, libraryDirectory, libraryPathDirectory, systemRoot]) {
    mkdirSync(directory, { recursive: true });
  }

  const environment = resolveWindowsMsvcBuildEnvironment({
    environment: {
      INCLUDE: includeDirectory,
      LIB: libraryDirectory,
      LIBPATH: libraryPathDirectory,
      PATH: resolve(root, 'bin'),
      SystemRoot: systemRoot,
      TEMP: resolve(root, 'temp'),
      TMP: resolve(root, 'temp'),
      WINDIR: systemRoot,
    },
    includeCuda: false,
    toolchainRoot: resolve(root, 'unavailable-toolchain'),
    tools: { cmake: 'cmake.exe', compiler: 'cl.exe', ninja: 'ninja.exe' },
  });

  assert.equal(environment.INCLUDE, includeDirectory);
  assert.equal(environment.LIB, libraryDirectory);
  assert.equal(environment.LIBPATH, libraryPathDirectory);
  assert.equal(environment.PATH, resolve(root, 'bin'));
});

test('Windows native tool paths honor explicit developer-environment commands', () => {
  assert.deepEqual(
    resolveNativeBuildToolPaths({
      environment: {
        CMAKE_COMMAND: 'C:\\tools\\cmake.exe',
        CTEST_COMMAND: 'C:\\tools\\ctest.exe',
        CXX: 'C:\\tools\\cl.exe',
        NINJA_COMMAND: 'C:\\tools\\ninja.exe',
      },
      platform: 'win32',
      workspaceRoot: '/workspace',
    }),
    {
      cmake: 'C:\\tools\\cmake.exe',
      ctest: 'C:\\tools\\ctest.exe',
      compiler: 'C:\\tools\\cl.exe',
      ninja: 'C:\\tools\\ninja.exe',
    },
  );
});

test('Windows Whisper.cpp quality uses only explicit prepared developer tools', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-windows-quality-tools-'));
  const paths = Object.fromEntries(
    ['cmake.exe', 'ctest.exe', 'cl.exe', 'ninja.exe'].map((name) => {
      const path = resolve(root, name);
      writeFileSync(path, 'fixture\n');
      return [name, path];
    }),
  );
  assert.deepEqual(
    resolvePreparedWindowsQualityTools({
      CMAKE_COMMAND: paths['cmake.exe'],
      CTEST_COMMAND: paths['ctest.exe'],
      CXX: paths['cl.exe'],
      NINJA_COMMAND: paths['ninja.exe'],
    }),
    {
      cmake: paths['cmake.exe'],
      ctest: paths['ctest.exe'],
      cCompiler: paths['cl.exe'],
      cxxCompiler: paths['cl.exe'],
      ninja: paths['ninja.exe'],
      cudaCompiler: null,
      cudaHostCompiler: null,
      inputs: null,
      linker: null,
    },
  );
  assert.throws(() => resolvePreparedWindowsQualityTools({}));
});

test('Windows production worker builds disable optional ccache in the sanitized MSVC environment', () => {
  assert.deepEqual(platformBuildCmakeArguments({ target: { os: 'windows' } }), ['-DGGML_CCACHE=OFF']);
  assert.deepEqual(platformBuildCmakeArguments({ target: { os: 'linux' } }), []);
});

test('Linux Whisper.cpp quality selects explicit prepared tools for each compiler profile', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-linux-quality-tools-'));
  const paths = Object.fromEntries(
    ['cmake', 'ctest', 'ninja', 'gcc', 'g++', 'ld.bfd', 'clang', 'clang++', 'ld.lld'].map((name) => {
      const path = resolve(root, name);
      writeFileSync(path, 'fixture\n');
      return [name, path];
    }),
  );
  const environment = {
    CMAKE_COMMAND: paths.cmake,
    CTEST_COMMAND: paths.ctest,
    LOCAL_WHISPER_CLANG_C_COMPILER: paths.clang,
    LOCAL_WHISPER_CLANG_CXX_COMPILER: paths['clang++'],
    LOCAL_WHISPER_CLANG_LINKER: paths['ld.lld'],
    LOCAL_WHISPER_COMPATIBILITY_C_COMPILER: paths.clang,
    LOCAL_WHISPER_COMPATIBILITY_CXX_COMPILER: paths['clang++'],
    LOCAL_WHISPER_COMPATIBILITY_LINKER: paths['ld.bfd'],
    LOCAL_WHISPER_GCC_C_COMPILER: paths.gcc,
    LOCAL_WHISPER_GCC_CXX_COMPILER: paths['g++'],
    LOCAL_WHISPER_GCC_LINKER: paths['ld.bfd'],
    NINJA_COMMAND: paths.ninja,
  };
  const gccProfile = { profileId: 'linux-x64-cpu-baseline-v1', target: { os: 'linux' } };
  const clangProfile = { profileId: 'linux-x64-clang-18.1.3-asan-ubsan-v1', target: { os: 'linux' } };
  assert.deepEqual(resolvePreparedLinuxQualityTools(gccProfile, environment), {
    ctest: paths.ctest,
    cCompiler: paths.gcc,
    cmake: paths.cmake,
    cxxCompiler: paths['g++'],
    linker: paths['ld.bfd'],
    ninja: paths.ninja,
    cudaCompiler: null,
    cudaHostCompiler: null,
    inputs: null,
  });
  assert.deepEqual(resolvePreparedLinuxQualityTools(clangProfile, environment), {
    ctest: paths.ctest,
    cCompiler: paths.clang,
    cmake: paths.cmake,
    cxxCompiler: paths['clang++'],
    linker: paths['ld.lld'],
    ninja: paths.ninja,
    cudaCompiler: null,
    cudaHostCompiler: null,
    inputs: null,
  });
  assert.deepEqual(
    resolvePreparedLinuxQualityTools(gccProfile, {
      ...environment,
      LOCAL_WHISPER_PREPARED_LINUX_COMPATIBILITY: 'true',
    }),
    {
      ctest: paths.ctest,
      cCompiler: paths.clang,
      cmake: paths.cmake,
      cxxCompiler: paths['clang++'],
      linker: paths['ld.bfd'],
      ninja: paths.ninja,
      cudaCompiler: null,
      cudaHostCompiler: null,
      inputs: null,
    },
  );
  assert.throws(() => resolvePreparedLinuxQualityTools(gccProfile, {}));
});

test('Windows PE dependency parser is case-preserving, closed, and rejects duplicate imports', () => {
  assert.deepEqual(
    parseDumpbinDependencies(
      `\n  Image has the following dependencies:\n\n    KERNEL32.dll\n    MSVCP140.dll\n\n  Summary\n`,
    ),
    ['KERNEL32.dll', 'MSVCP140.dll'],
  );
  assert.throws(() => parseDumpbinDependencies('KERNEL32.dll\r\nkernel32.DLL\r\n'));
  assert.throws(() => parseDumpbinDependencies('no imports'));
});

test('CUDA profile rejects native, virtual, bare, and silently changed architectures', () => {
  const profile = readJson(resolve(toolchainRoot, 'profiles', 'linux-x64-cuda-12.8.1-sm120a-v1.json'));
  for (const architecture of ['native', '120', '120-virtual', '89']) {
    const changed = globalThis.structuredClone(profile);
    changed.cmakeCache.CMAKE_CUDA_ARCHITECTURES = architecture;
    assert.throws(() => verifyToolchainContract(changed, { allowCandidate: true, contractOnly: false }));
  }
});

test('qualification rejects legacy boolean-only evidence', () => {
  const profile = readJson(resolve(toolchainRoot, 'profiles', 'linux-x64-cpu-baseline-v1.json'));
  const evidence = {
    schemaId: 'local-whisper-native-toolchain-evidence-v1',
    profileId: profile.profileId,
    profileInputDigest: canonicalDigest(profile),
    networkDeniedFromFirstConfigure: true,
    maliciousEnvironmentIgnored: true,
    relocationVerified: true,
    cleanStartVerified: true,
  };
  assert.throws(() => qualifyToolchainProfile(profile, evidence));
  assert.throws(() => qualifyToolchainProfile(profile, { ...evidence, profileInputDigest: '0'.repeat(64) }));
});
