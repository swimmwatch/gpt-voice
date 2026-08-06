import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import process from 'node:process';

import { canonicalDigest, canonicalJson, sha256, validateRelativePath } from '../source-import/native-source-core.mjs';
import {
  readQualificationFixtureIdentity,
  SANITIZER_FIXTURE_ID,
  WHISPER_LINK_SMOKE_FIXTURE_ID,
} from './qualification-fixture-core.mjs';
import { qualificationInputDigest, verifyQualificationEvidence } from './native-toolchain-evidence-core.mjs';

const WINDOWS_PROFILE_IDS = new Set([
  'windows-x64-cpu-msvc-19.39-v1',
  'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1',
  'windows-x64-amd-vulkan-preview-msvc-19.39-v1',
]);
const LINUX_PROFILE_IDS = new Set([
  'linux-x64-cpu-baseline-v1',
  'linux-x64-clang-18.1.3-asan-ubsan-v1',
  'linux-x64-cuda-12.8.1-sm120a-v1',
  'linux-x64-amd-vulkan-preview-contract-v1',
  'linux-x64-amd-hip-no-approved-row-v1',
]);
const AMD_CONTRACT_PROFILE_IDS = new Set([
  'windows-x64-amd-vulkan-preview-msvc-19.39-v1',
  'linux-x64-amd-vulkan-preview-contract-v1',
  'linux-x64-amd-hip-no-approved-row-v1',
]);
const REQUIRED_WHISPER_CACHE = Object.freeze({
  FETCHCONTENT_FULLY_DISCONNECTED: 'ON',
  GGML_BACKEND_DL: 'OFF',
  GGML_CPU_KLEIDIAI: 'OFF',
  GGML_NATIVE: 'OFF',
  GGML_OPENMP: 'OFF',
  GGML_RPC: 'OFF',
  WHISPER_BUILD_EXAMPLES: 'OFF',
  WHISPER_BUILD_TESTS: 'OFF',
  WHISPER_CURL: 'OFF',
});
const WINDOWS_ENVIRONMENT_ALLOWLIST = Object.freeze(['SystemRoot', 'TEMP', 'TMP', 'WINDIR']);
const LINUX_ENVIRONMENT_ALLOWLIST = Object.freeze(['LANG', 'LC_ALL', 'PATH']);
const CLANG_ENVIRONMENT_ALLOWLIST = Object.freeze(['ASAN_OPTIONS', 'LANG', 'LC_ALL', 'PATH', 'UBSAN_OPTIONS']);
const NETWORK_COMMAND_PATTERN =
  /(?:^|[\s/])(?:curl|wget|git\s+(?:clone|fetch)|pip|npm|npx|FetchContent|ExternalProject)(?:[\s"']|$)/iu;

function componentPath(component, toolchainRoot, outputRoot = null) {
  if (component.pathKind === 'systemAbsolute') {
    if (!isAbsolute(component.path))
      throw new Error(`Toolchain system path is not absolute: ${component.id ?? component.role}`);
    return component.path;
  }
  validateRelativePath(component.path);
  if (component.pathKind === 'toolchainRootRelative') return resolve(toolchainRoot, ...component.path.split('/'));
  if (component.pathKind === 'outputRelative' && outputRoot) return resolve(outputRoot, ...component.path.split('/'));
  throw new Error(`Toolchain component path cannot be resolved: ${component.id ?? component.role}`);
}

function assertUnique(items, key, label) {
  const values = items.map((item) => item[key]);
  if (new Set(values).size !== values.length) throw new Error(`Duplicate native toolchain ${label}`);
}

function assertWhisperCache(profile) {
  if (profile.profileId.includes('clang-18.1.3')) return;
  for (const [key, value] of Object.entries(REQUIRED_WHISPER_CACHE)) {
    if (profile.cmakeCache[key] !== value) throw new Error(`Native toolchain cache must set ${key}=${value}`);
  }
  const enabledBackends = Object.entries(profile.cmakeCache)
    .filter(
      ([key, value]) => /^GGML_(?:BLAS|CANN|CUDA|HIP|METAL|MUSA|OPENCL|SYCL|VULKAN|ZDNN)$/u.test(key) && value === 'ON',
    )
    .map(([key]) => key);
  const expected = profile.profileId.includes('cuda-12.8.1')
    ? ['GGML_CUDA']
    : profile.profileId.includes('amd-vulkan')
      ? ['GGML_VULKAN']
      : profile.profileId.includes('amd-hip')
        ? ['GGML_HIP']
        : [];
  if (canonicalJson(enabledBackends.sort()) !== canonicalJson(expected)) {
    throw new Error('Native toolchain accelerator backend set is not exact');
  }
  if (Object.values(profile.cmakeCache).includes('native'))
    throw new Error('Native architecture detection is prohibited');
  if (profile.profileId.includes('cuda-12.8.1')) {
    if (
      profile.cmakeCache.CMAKE_CUDA_ARCHITECTURES !== '120a-real' ||
      profile.cmakeCache.CMAKE_CUDA_RUNTIME_LIBRARY !== 'Shared' ||
      canonicalJson(profile.architectureTargets) !== canonicalJson(['120a-real'])
    ) {
      throw new Error('CUDA profile must preserve requested/effective 120a-real and shared runtime');
    }
  }
}

function verifyAmdContract(profile, options) {
  if (!options.contractOnly || !AMD_CONTRACT_PROFILE_IDS.has(profile.profileId)) {
    throw new Error('AMD Preview toolchains are contract-only until their manual gates pass');
  }
  if (profile.evidenceDigest !== null || profile.qualificationFixture !== null) {
    throw new Error('AMD Preview contract must not claim qualification evidence');
  }
  const expectedOs = profile.profileId.startsWith('windows-') ? 'windows' : 'linux';
  if (
    profile.target.os !== expectedOs ||
    canonicalJson(profile.sourceLockIds) !== canonicalJson(['whisper-cpp-v1.9.1-f049fff'])
  ) {
    throw new Error('AMD Preview target or source lock changed');
  }
  if (
    [...profile.tools, ...profile.runtime, ...profile.outputs, ...profile.licenses].some(
      (component) => component.sha256 !== null,
    )
  ) {
    throw new Error('AMD Preview contract must not contain acquired or qualified identities');
  }
  if (profile.patchLockIds.length !== 1 || profile.patchLockIds[0] !== 'local-whisper-whisper-cpp-amd-preview-v1') {
    throw new Error('AMD Preview contract must use the exact Task 12 patch series');
  }
  if (profile.profileId.includes('hip-no-approved-row')) {
    if (
      profile.qualificationState !== 'candidate-unqualified' ||
      profile.architectureTargets.length !== 1 ||
      profile.architectureTargets[0] !== 'unavailable-no-approved-row' ||
      profile.runtime.length !== 0 ||
      profile.dynamicDependencies.length !== 0
    ) {
      throw new Error('HIP contract must remain unavailable without one approved exact row');
    }
  } else if (
    canonicalJson(profile.architectureTargets) !== canonicalJson(['vulkan-1.3-spirv-1.6']) ||
    profile.qualificationState !==
      (profile.target.os === 'windows' ? 'pending-windows-qualification' : 'candidate-unqualified')
  ) {
    throw new Error('AMD Vulkan contract qualification state changed');
  }
  for (const dependency of profile.dynamicDependencies) {
    const runtime = profile.runtime.find(({ id }) => id === dependency.id);
    if (
      !runtime ||
      runtime.pathKind !== dependency.pathKind ||
      runtime.path !== dependency.path ||
      runtime.sha256 !== dependency.sha256
    ) {
      throw new Error(`AMD Preview dependency has no matching runtime identity: ${dependency.id}`);
    }
  }
  const expectedEnvironment =
    profile.target.os === 'windows' ? WINDOWS_ENVIRONMENT_ALLOWLIST : LINUX_ENVIRONMENT_ALLOWLIST;
  if (canonicalJson(profile.environmentAllowlist) !== canonicalJson(expectedEnvironment)) {
    throw new Error('AMD Preview environment allowlist changed');
  }
  return true;
}

function verifyWindowsToolchainContract(profile, options) {
  if (profile.target.os !== 'windows') throw new Error('Windows native profile target mismatch');
  const inputs = [
    ...profile.tools,
    ...profile.runtime,
    ...profile.licenses.filter(({ pathKind }) => pathKind !== 'outputRelative'),
  ];
  if (options.contractOnly) {
    if (
      profile.qualificationState !== 'pending-windows-qualification' ||
      profile.evidenceDigest !== null ||
      inputs.some(({ sha256: identity }) => identity !== null)
    ) {
      throw new Error('Windows static contract must remain pending and contain no acquired identities');
    }
  } else if (
    !options.allowCandidate ||
    profile.qualificationState !== 'candidate-unqualified' ||
    profile.evidenceDigest !== null ||
    inputs.some(({ sha256: identity }) => !/^[a-f0-9]{64}$/u.test(identity ?? ''))
  ) {
    throw new Error('Windows native inputs must be a hashed Task 24 candidate until Task 21 qualification');
  }
  if (canonicalJson(profile.environmentAllowlist) !== canonicalJson(WINDOWS_ENVIRONMENT_ALLOWLIST)) {
    throw new Error('Windows native profile environment allowlist changed');
  }
  if (profile.profileId.includes('-cpu-') || profile.profileId.includes('-cuda-')) {
    if (
      profile.target.abi !== 'msvc-v143-14.39-vc-runtime-14.51.36247.0-windows-sdk-10.0.26100.0' ||
      canonicalJson(profile.sourceLockIds) !== canonicalJson(['whisper-cpp-v1.9.1-f049fff']) ||
      profile.qualificationFixture !== null ||
      canonicalJson(profile.sbomComponents).includes('crt-14.39') ||
      [...profile.runtime, ...profile.dynamicDependencies].some(({ id }) => id.includes('crt-14.39'))
    ) {
      throw new Error('Windows MSVC 14.39 and VC Runtime 14.51.36247.0 identities are not separated');
    }
    for (const dependency of profile.dynamicDependencies) {
      const runtime = profile.runtime.find(({ id }) => id === dependency.id);
      if (
        !runtime ||
        runtime.pathKind !== dependency.pathKind ||
        runtime.path !== dependency.path ||
        runtime.sha256 !== dependency.sha256
      ) {
        throw new Error(`Windows dynamic dependency has no matching runtime identity: ${dependency.id}`);
      }
    }
  }
  return true;
}

function verifyLinuxDependencyAuthority(profile) {
  for (const role of ['elf-inspector', 'network-harness', 'network-probe-runtime']) {
    if (!profile.tools.some((tool) => tool.role === role)) {
      throw new Error(`Linux native profile is missing qualification tool: ${role}`);
    }
  }
  for (const dependency of profile.dynamicDependencies) {
    const runtime = profile.runtime.find(({ id }) => id === dependency.id);
    if (
      !runtime ||
      !dependency.soname ||
      runtime.pathKind !== dependency.pathKind ||
      runtime.path !== dependency.path ||
      runtime.sha256 !== dependency.sha256
    ) {
      throw new Error(`Native dynamic dependency has no matching runtime identity: ${dependency.id}`);
    }
  }
}

function verifyLinuxQualificationSource(profile) {
  if (profile.profileId.includes('clang-18.1.3')) {
    if (
      profile.sourceLockIds.length !== 0 ||
      profile.patchLockIds.length !== 0 ||
      profile.qualificationFixture?.fixtureId !== SANITIZER_FIXTURE_ID ||
      canonicalJson(profile.expectedBuildGraph) !==
        canonicalJson([
          'local-whisper-sanitizer-clean',
          'local-whisper-sanitizer-asan-trigger',
          'local-whisper-sanitizer-ubsan-trigger',
        ])
    ) {
      throw new Error('Clang qualification must use only the immutable sanitizer fixture');
    }
    return;
  }
  if (
    canonicalJson(profile.sourceLockIds) !== canonicalJson(['whisper-cpp-v1.9.1-f049fff']) ||
    profile.qualificationFixture?.fixtureId !== WHISPER_LINK_SMOKE_FIXTURE_ID
  ) {
    throw new Error('Whisper.cpp profile source input changed');
  }
}

function verifyLinuxQualificationState(profile, options) {
  if (!options.allowCandidate && profile.qualificationState !== 'qualified') {
    throw new Error(`Linux native profile is not qualified: ${profile.profileId}`);
  }
  if (profile.qualificationState === 'qualified' && !/^[a-f0-9]{64}$/u.test(profile.evidenceDigest ?? '')) {
    throw new Error('Qualified native profile has no evidence digest');
  }
  if (
    profile.qualificationState === 'qualified' &&
    [
      ...profile.tools,
      ...profile.runtime,
      ...profile.licenses.filter(({ pathKind }) => pathKind !== 'outputRelative'),
    ].some(({ sha256: identity }) => identity === null)
  ) {
    throw new Error('Qualified native profile has an unhashed input identity');
  }
}

export function verifyToolchainContract(profile, options = {}) {
  if (profile?.schemaId !== 'local-whisper-native-toolchain-lock-v1') {
    throw new Error('Invalid native toolchain lock header');
  }
  if (!LINUX_PROFILE_IDS.has(profile.profileId) && !WINDOWS_PROFILE_IDS.has(profile.profileId)) {
    throw new Error('Unknown native toolchain profile');
  }
  assertUnique(profile.tools, 'role', 'tool role');
  assertUnique(profile.runtime, 'id', 'runtime component');
  assertUnique(profile.outputs, 'id', 'output');
  assertUnique(profile.dynamicDependencies, 'id', 'dynamic dependency');
  assertUnique(profile.licenses, 'id', 'license');
  assertWhisperCache(profile);
  if (AMD_CONTRACT_PROFILE_IDS.has(profile.profileId)) return verifyAmdContract(profile, options);
  if (WINDOWS_PROFILE_IDS.has(profile.profileId)) {
    return verifyWindowsToolchainContract(profile, options);
  }
  if (options.contractOnly) throw new Error('Linux native profile cannot use contract-only verification');
  if (profile.target.os !== 'linux') throw new Error('Linux native profile target mismatch');
  verifyLinuxDependencyAuthority(profile);
  const expectedEnvironment = profile.profileId.includes('clang-18.1.3')
    ? CLANG_ENVIRONMENT_ALLOWLIST
    : LINUX_ENVIRONMENT_ALLOWLIST;
  if (canonicalJson(profile.environmentAllowlist) !== canonicalJson(expectedEnvironment)) {
    throw new Error('Linux native profile environment allowlist changed');
  }
  verifyLinuxQualificationSource(profile);
  verifyLinuxQualificationState(profile, options);
  return true;
}

export function verifyProfileQualificationFixture(profile, workspaceRoot) {
  const identity = readQualificationFixtureIdentity(workspaceRoot, profile.qualificationFixture.fixtureId);
  if (
    profile.qualificationFixture.fixtureId !== identity.fixtureId ||
    profile.qualificationFixture.manifestSha256 !== identity.manifestSha256
  ) {
    throw new Error('Native sanitizer qualification fixture identity changed');
  }
  return true;
}

function runToolVersion(path, arguments_, environment, acceptedStatuses = [0]) {
  const result = spawnSync(path, arguments_, {
    cwd: dirname(path),
    encoding: 'utf8',
    env: environment,
    maxBuffer: 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  if (result.error || !acceptedStatuses.includes(result.status)) {
    throw new Error(`Native tool version probe failed: ${path}`);
  }
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function probeMsvcCompiler(path, expected, environment) {
  const versionOutput = runToolVersion(path, ['/?'], environment);
  const banner = expected.replace(' (_MSC_VER=1939)', '');
  if (!versionOutput.includes(banner)) throw new Error(`Native tool version mismatch: ${path}`);
  const root = mkdtempSync(resolve(tmpdir(), 'local-whisper-msvc-version-'));
  try {
    const source = resolve(root, 'msc-ver.c');
    writeFileSync(
      source,
      '#if !defined(_MSC_VER) || _MSC_VER != 1939\n#error unexpected _MSC_VER\n#endif\nLOCAL_WHISPER_MSC_VER=_MSC_VER\n',
      'utf8',
    );
    const probeOutput = runToolVersion(path, ['/nologo', '/EP', '/TC', source], environment);
    if (!probeOutput.includes('LOCAL_WHISPER_MSC_VER=1939')) {
      throw new Error(`Native MSVC _MSC_VER probe failed: ${path}`);
    }
    return `${versionOutput}\n${probeOutput}`;
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function toolVersion(path, component) {
  const windowsEnvironment = {
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    VSLANG: '1033',
    WINDIR: process.env.WINDIR,
  };
  const linuxEnvironment = { LANG: 'C', LC_ALL: 'C' };
  const environment = process.platform === 'win32' ? windowsEnvironment : linuxEnvironment;
  let output;
  if (process.platform === 'win32' && ['c-compiler', 'cxx-compiler'].includes(component.role)) {
    output = probeMsvcCompiler(path, component.version, environment);
  } else {
    const arguments_ =
      process.platform === 'win32' && ['archiver', 'linker', 'pe-inspector'].includes(component.role)
        ? ['/?']
        : ['--version'];
    output = runToolVersion(
      path,
      arguments_,
      environment,
      process.platform === 'win32' && ['archiver', 'linker', 'pe-inspector'].includes(component.role) ? [0, 1100] : [0],
    );
    if (!output.includes(component.version)) throw new Error(`Native tool version mismatch: ${path}`);
  }
  return sha256(Buffer.from(output, 'utf8'));
}

function verifyIdentity(component, toolchainRoot, outputRoot, executeVersion = false) {
  const path = componentPath(component, toolchainRoot, outputRoot);
  if (!existsSync(path)) throw new Error(`Native toolchain component is missing: ${path}`);
  const canonicalPath = realpathSync(path);
  const actualSha256 = sha256(readFileSync(canonicalPath));
  if (component.sha256 !== actualSha256) throw new Error(`Native toolchain component hash mismatch: ${path}`);
  // Some multi-call tool drivers select their mode from argv[0]. Execute the
  // reviewed path (which may be a pinned symlink such as ld.lld) while hashing
  // the canonical target bytes.
  const versionOutputSha256 = executeVersion ? toolVersion(path, component) : null;
  return Object.freeze({ path: canonicalPath, sha256: actualSha256, versionOutputSha256 });
}

export function verifyToolchainInputs(profile, toolchainRoot, options = {}) {
  verifyToolchainContract(profile, { allowCandidate: options.allowCandidate, contractOnly: false });
  const tools = new Map();
  const runtime = new Map();
  const licenses = new Map();
  for (const tool of profile.tools) {
    tools.set(tool.role, verifyIdentity(tool, toolchainRoot, null, true));
  }
  for (const component of profile.runtime) {
    if (component.pathKind !== 'outputRelative') {
      runtime.set(component.id, verifyIdentity(component, toolchainRoot, null, false));
    }
  }
  for (const component of profile.licenses) {
    if (component.pathKind !== 'outputRelative') {
      licenses.set(component.id, verifyIdentity(component, toolchainRoot, null, false));
    }
  }
  return Object.freeze({ licenses, runtime, tools });
}

export function captureToolchainInputLock(profile, toolchainRoot) {
  verifyToolchainContract(profile, {
    allowCandidate: profile.target.os !== 'windows',
    contractOnly: profile.target.os === 'windows',
  });
  const captured = globalThis.structuredClone(profile);
  for (const tool of captured.tools) {
    const path = componentPath(tool, toolchainRoot);
    if (!existsSync(path)) throw new Error(`Native tool acquisition is incomplete: ${path}`);
    toolVersion(path, tool);
    tool.sha256 = sha256(readFileSync(realpathSync(path)));
  }
  for (const component of [...captured.runtime, ...captured.licenses]) {
    if (component.pathKind === 'outputRelative') continue;
    const path = componentPath(component, toolchainRoot);
    if (!existsSync(path)) throw new Error(`Native toolchain input is incomplete: ${path}`);
    component.sha256 = sha256(readFileSync(realpathSync(path)));
  }
  for (const dependency of captured.dynamicDependencies) {
    dependency.sha256 = captured.runtime.find(({ id }) => id === dependency.id).sha256;
  }
  captured.qualificationState = 'candidate-unqualified';
  captured.evidenceDigest = null;
  return Object.freeze(captured);
}

export function qualifyToolchainProfile(profile, evidence) {
  verifyToolchainContract(profile, { allowCandidate: true, contractOnly: false });
  if (profile.qualificationState !== 'candidate-unqualified') {
    throw new Error('Native toolchain evidence does not qualify this exact profile');
  }
  verifyQualificationEvidence(profile, evidence);
  const qualified = globalThis.structuredClone(profile);
  qualified.qualificationState = 'qualified';
  qualified.evidenceDigest = canonicalDigest(evidence);
  return Object.freeze(qualified);
}

export { qualificationInputDigest, verifyQualificationEvidence };

export function resolveProfileTool(profile, toolchainRoot, role) {
  const tool = profile.tools.find((candidate) => candidate.role === role);
  if (!tool) throw new Error(`Native toolchain role is absent: ${role}`);
  // Preserve the reviewed invocation path because multi-call drivers such as
  // clang++ and ld.lld derive their behavior from argv[0]. Input verification
  // separately hashes the canonical target bytes.
  return componentPath(tool, toolchainRoot);
}

export function resolveProfileComponent(component, toolchainRoot, outputRoot = null) {
  return componentPath(component, toolchainRoot, outputRoot);
}

export function auditGeneratedBuildGraph(buildRoot, profile) {
  const cachePath = resolve(buildRoot, 'CMakeCache.txt');
  const graphPath = resolve(buildRoot, 'build.ninja');
  const cacheText = readFileSync(cachePath, 'utf8');
  const graphText = readFileSync(graphPath, 'utf8');
  const effectiveCache = new Map();
  for (const line of cacheText.split(/\r?\n/u)) {
    const match = /^([^#/:][^:]*):[^=]+=(.*)$/u.exec(line);
    if (match) effectiveCache.set(match[1], match[2]);
  }
  for (const [key, configured] of Object.entries(profile.cmakeCache)) {
    const expected = configured.startsWith('toolchainRoot:') ? null : configured;
    if (expected !== null && effectiveCache.get(key) !== expected) {
      throw new Error(`Effective CMake cache changed ${key}: ${effectiveCache.get(key) ?? 'missing'}`);
    }
  }
  for (const [key, value] of effectiveCache) {
    if (/^GGML_[A-Z0-9_]+$/u.test(key) && /^(?:ON|TRUE|YES|1)$/iu.test(value)) {
      if (profile.cmakeCache[key] !== 'ON') throw new Error(`Unknown enabled GGML backend/option: ${key}`);
    }
  }
  if (NETWORK_COMMAND_PATTERN.test(graphText))
    throw new Error('Generated build graph contains a network-capable command');
  if (graphText.includes('GGML_BACKEND_PATH') || graphText.includes('GGML_BACKEND_DL=ON')) {
    throw new Error('Generated build graph permits ambient backend discovery');
  }
  return Object.freeze({
    cacheSha256: sha256(Buffer.from(cacheText, 'utf8')),
    graphSha256: sha256(Buffer.from(graphText, 'utf8')),
  });
}
