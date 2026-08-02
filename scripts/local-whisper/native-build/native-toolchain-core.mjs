import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { canonicalDigest, canonicalJson, sha256, validateRelativePath } from '../source-import/native-source-core.mjs';
import {
  readQualificationFixtureIdentity,
  SANITIZER_FIXTURE_ID,
  WHISPER_LINK_SMOKE_FIXTURE_ID,
} from './qualification-fixture-core.mjs';
import { qualificationInputDigest, verifyQualificationEvidence } from './native-toolchain-evidence-core.mjs';

const WINDOWS_PROFILE_IDS = new Set([
  'windows-x64-cpu-candidate-task19-v1',
  'windows-x64-cuda-12.8.1-sm120a-candidate-task19-v1',
]);
const LINUX_PROFILE_IDS = new Set([
  'linux-x64-cpu-baseline-v1',
  'linux-x64-clang-18.1.3-asan-ubsan-v1',
  'linux-x64-cuda-12.8.1-sm120a-v1',
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
  const expected = profile.profileId.includes('cuda-12.8.1') ? ['GGML_CUDA'] : [];
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

function verifyWindowsToolchainContract(profile, options) {
  if (
    !options.contractOnly ||
    profile.target.os !== 'windows' ||
    profile.qualificationState !== 'pendingWindowsFinalTask'
  ) {
    throw new Error('Windows native profile is contract-only until Task 19');
  }
  if (profile.evidenceDigest !== null || profile.tools.some((tool) => tool.sha256 !== null)) {
    throw new Error('Windows candidate must not claim representative qualification evidence');
  }
  if (canonicalJson(profile.environmentAllowlist) !== canonicalJson(WINDOWS_ENVIRONMENT_ALLOWLIST)) {
    throw new Error('Windows native profile environment allowlist changed');
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

function toolVersion(path, expected) {
  const result = spawnSync(path, ['--version'], {
    cwd: '/',
    encoding: 'utf8',
    env: { LANG: 'C', LC_ALL: 'C' },
    maxBuffer: 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0) throw new Error(`Native tool version probe failed: ${path}`);
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (!output.includes(expected)) throw new Error(`Native tool version mismatch: ${path}`);
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
  const versionOutputSha256 = executeVersion ? toolVersion(path, component.version) : null;
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
  verifyToolchainContract(profile, { allowCandidate: true, contractOnly: false });
  const captured = globalThis.structuredClone(profile);
  for (const tool of captured.tools) {
    const path = componentPath(tool, toolchainRoot);
    if (!existsSync(path)) throw new Error(`Native tool acquisition is incomplete: ${path}`);
    toolVersion(path, tool.version);
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
