import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

import { resolveProfileTool, verifyToolchainContract } from '../native-build/native-toolchain-core.mjs';
import { readJson, validateRelativePath } from '../source-import/native-source-core.mjs';
import { amdPatchLockPath, patchRoot, preparePatchedSource, workspaceRoot } from '../whisper-cpp-build-core.mjs';
import { verifyPatchLock } from '../source-import/native-patch-core.mjs';

export { workspaceRoot };

export const amdContractRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'whisper-cpp', 'amd');
const toolchainProfileRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles');
const toolchainSchemaPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'toolchains',
  'schema',
  'native-toolchain-lock.schema.json',
);
const hipSchemaPath = resolve(amdContractRoot, 'schemas', 'hip-pre-signing-row.schema.json');
const taskCacheRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'amd-packs');
const exactProfileIds = Object.freeze([
  'windows-x64-amd-vulkan-preview-candidate-task19-v1',
  'linux-x64-amd-vulkan-preview-contract-v1',
  'linux-x64-amd-hip-no-approved-row-v1',
]);

/** Typed, sanitized AMD contract failure used by deterministic fixtures. */
export class AmdContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AmdContractError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new AmdContractError(code, message);
}

function compileSchema(path) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(readJson(path));
}

function listJsonFixtures(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => readJson(resolve(directory, entry.name)));
}

function compareVersion(left, right) {
  const parse = (value) => value.split('.').map((part) => Number.parseInt(part, 10));
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function uniqueValues(items, field) {
  return new Set(items.map((item) => item[field])).size === items.length;
}

function setAtPath(target, path, value) {
  const parts = path.split('.');
  let owner = target;
  for (const part of parts.slice(0, -1)) {
    if (owner[part] === undefined || owner[part] === null || typeof owner[part] !== 'object') {
      throw new Error(`Fixture mutation path is invalid: ${path}`);
    }
    owner = owner[part];
  }
  owner[parts.at(-1)] = value;
}

function expectedFailure(action, expectedCode, fixtureId) {
  try {
    action();
  } catch (error) {
    if (error instanceof AmdContractError && error.code === expectedCode) return true;
    throw error;
  }
  throw new Error(`AMD fixture unexpectedly passed: ${fixtureId}`);
}

export function validatePreviewProfiles() {
  const contract = readJson(resolve(amdContractRoot, 'preview-profiles.json'));
  if (
    contract.schemaId !== 'local-whisper-amd-preview-profiles-v1' ||
    contract.supportTier !== 'preview-untested' ||
    contract.hardwareEvidence !== false ||
    contract.profiles.length !== 3
  ) {
    throw new Error('AMD Preview product matrix changed');
  }
  const profileIds = contract.profiles.map((profile) => profile.toolchainProfileId);
  if (JSON.stringify(profileIds) !== JSON.stringify(exactProfileIds)) {
    throw new Error('AMD Preview profile set is not exact');
  }
  if (
    contract.profiles.some(
      (profile) => profile.engine !== 'whisperCpp' || profile.vendor !== 'amd' || profile.architecture !== 'x64',
    ) ||
    JSON.stringify(contract.excluded) !== JSON.stringify(['windows-hip', 'directml', 'windows-ml', 'macos'])
  ) {
    throw new Error('AMD Preview matrix exposed an unsupported engine or backend');
  }
  return contract;
}

export function validateContractToolchain(profileId) {
  if (!exactProfileIds.includes(profileId)) throw new Error(`Unknown AMD contract profile: ${profileId}`);
  const profile = readJson(resolve(toolchainProfileRoot, `${profileId}.json`));
  const validate = compileSchema(toolchainSchemaPath);
  if (!validate(profile)) throw new Error(`AMD toolchain schema failed: ${JSON.stringify(validate.errors)}`);
  verifyToolchainContract(profile, { contractOnly: true });
  return profile;
}

export function validateVulkanObservation(observation) {
  if (observation.pciVendorId !== '0x1002' || !observation.physicalDevice || observation.softwareImplementation) {
    fail('DEVICE_NOT_ALLOWLISTED', 'Vulkan adapter is not an allowlisted physical AMD device');
  }
  if (
    observation.generatedShaderTarget !== '1.3' ||
    compareVersion(observation.apiVersion, observation.generatedShaderTarget) < 0 ||
    !observation.storageBuffer16BitAccess ||
    !observation.requiredExtensionsAvailable
  ) {
    fail('DEVICE_FEATURE_MISSING', 'Vulkan API, generated target, feature, or extension is missing');
  }
  if (!observation.manifestOwnedLoader) {
    fail('RUNTIME_PREREQUISITE_MISSING', 'Vulkan loader is not manifest-owned');
  }
  if (!observation.driverCompatible) fail('DRIVER_INCOMPATIBLE', 'Vulkan driver is incompatible');
  if (!observation.backendInitialized) fail('BACKEND_INIT_FAILED', 'Vulkan backend activation failed');
  if (!observation.allocationSucceeded || !observation.dispatchSucceeded) {
    fail('ALLOCATION_FAILED', 'Vulkan allocation or dispatch failed');
  }
  return true;
}

export function runVulkanFixtures() {
  const fixtures = listJsonFixtures(resolve(amdContractRoot, 'fixtures', 'vulkan'));
  for (const fixture of fixtures) {
    if (fixture.expectedCode === null) validateVulkanObservation(fixture.observation);
    else {
      expectedFailure(() => validateVulkanObservation(fixture.observation), fixture.expectedCode, fixture.fixtureId);
    }
  }
  return fixtures.length;
}

export function syntheticHipCandidateRow() {
  const digest = 'a'.repeat(64);
  return {
    schemaId: 'local-whisper-amd-hip-pre-signing-row-v1',
    recordId: 'synthetic-test-only-row',
    catalogRow: { id: 'synthetic-test-only-row', revision: 1 },
    source: {
      sourceLockId: 'whisper-cpp-v1.9.1-f049fff',
      patchLockId: 'local-whisper-whisper-cpp-amd-preview-v1',
      patchedManifestSha256: '85e3a5687b75b6524b50681a0efe9293381c43accec9b91882deed610daed21f',
      runtimeBuildDigest: digest,
    },
    platform: {
      distributionId: 'ubuntu',
      pointVersion: '24.04.1',
      architecture: 'x86_64',
      kernelAbi: '6.8.0-40-generic',
      amdgpuDriverAbi: '6.8.0',
      amdgpuDriverVersion: '6.8.0.40',
      matrixSnapshotId: 'synthetic-matrix-v1',
    },
    rocm: {
      release: '6.1.2',
      hipCompilerVersion: '6.1.2',
      packages: [
        { name: 'hip-runtime-amd', version: '6.1.2' },
        { name: 'hipblas', version: '6.1.2' },
        { name: 'rocblas', version: '4.1.2' },
      ],
      sonames: [{ name: 'libamdhip64.so.6', version: '6.1.2', buildId: digest, source: 'bundled' }],
    },
    device: {
      vendorId: '1002',
      pciDeviceId: '744c',
      amdgpuTarget: 'gfx1100',
      gfx: 'gfx1100',
      pcieAtomicsRequired: true,
    },
    permissions: { kfdPath: '/dev/kfd', renderNodeIdentity: 'renderD128', requiredAccess: 'read-write' },
    pack: {
      expectedFiles: ['bin/worker', 'lib/libamdhip64.so.6'],
      dependencyClosure: ['lib/libamdhip64.so.6'],
      relocationPolicy: 'manifest-owned-origin-only',
      notices: ['notices/THIRD-PARTY-NOTICES.txt'],
      licenses: ['licenses/whisper-cpp.LICENSE'],
      sbomSha256: digest,
      provenanceSha256: digest,
      buildOptionsSha256: digest,
      redistributionReview: 'approved',
    },
    compatibility: {
      protocolVersion: 1,
      appVersion: '1.4.0',
      modelFamilies: ['whisper'],
      deviceProofCapabilities: ['activation', 'allocation', 'model-weight-owner', 'primary-state'],
    },
    approval: { status: 'approved', reviewId: 'synthetic-test-only', reviewedAt: '2026-01-01T00:00:00Z' },
  };
}

export function validateHipPreSigningRow(row) {
  const validate = compileSchema(hipSchemaPath);
  if (!validate(row)) {
    const dependencyFailure = validate.errors?.some((error) => error.instancePath.startsWith('/rocm/sonames'));
    fail(
      dependencyFailure ? 'RUNTIME_PREREQUISITE_MISSING' : 'DEVICE_NOT_ALLOWLISTED',
      'HIP row is incomplete, range-valued, or not exact',
    );
  }
  if (
    row.recordId !== row.catalogRow.id ||
    row.source.sourceLockId !== 'whisper-cpp-v1.9.1-f049fff' ||
    row.source.patchLockId !== 'local-whisper-whisper-cpp-amd-preview-v1' ||
    row.source.patchedManifestSha256 !== '85e3a5687b75b6524b50681a0efe9293381c43accec9b91882deed610daed21f'
  ) {
    fail('DEVICE_NOT_ALLOWLISTED', 'HIP catalog row and Task 12 source identities do not intersect');
  }
  if (row.device.amdgpuTarget !== row.device.gfx) {
    fail('DEVICE_NOT_ALLOWLISTED', 'HIP PCI and gfx intersection changed');
  }
  if (!uniqueValues(row.rocm.packages, 'name')) {
    fail('DEVICE_NOT_ALLOWLISTED', 'HIP package versions are duplicated or mixed');
  }
  if (!uniqueValues(row.rocm.sonames, 'name')) {
    fail('RUNTIME_PREREQUISITE_MISSING', 'HIP SONAME closure is duplicated or mixed');
  }
  const sonameFiles = new Set(row.rocm.sonames.map((component) => `lib/${component.name}`));
  if ([...sonameFiles].some((path) => !row.pack.dependencyClosure.includes(path))) {
    fail('RUNTIME_PREREQUISITE_MISSING', 'HIP SONAME is absent from the dependency closure');
  }
  return true;
}

export function validateHipRuntimeObservation(observation) {
  if (!observation.approvedExactRow || !observation.exactPciGfxIntersection) {
    fail('DEVICE_NOT_ALLOWLISTED', 'HIP runtime has no approved exact row');
  }
  if (!observation.exactDependencyClosure || !observation.manifestOwnedLoader) {
    fail('RUNTIME_PREREQUISITE_MISSING', 'HIP dependency closure is incomplete');
  }
  if (observation.pcieAtomicsRequired && !observation.pcieAtomicsAvailable) {
    fail('DEVICE_FEATURE_MISSING', 'HIP PCIe atomics are unavailable');
  }
  if (!observation.kfdAccessible || !observation.renderNodeAccessible) {
    fail('GPU_PERMISSION_DENIED', 'HIP device-node access is unavailable');
  }
  return true;
}

function syntheticHipRuntimeObservation() {
  return {
    approvedExactRow: true,
    exactPciGfxIntersection: true,
    exactDependencyClosure: true,
    manifestOwnedLoader: true,
    pcieAtomicsRequired: true,
    pcieAtomicsAvailable: true,
    kfdAccessible: true,
    renderNodeAccessible: true,
  };
}

export function runHipNegativeFixtures() {
  const fixtures = listJsonFixtures(resolve(amdContractRoot, 'fixtures', 'hip'));
  for (const fixture of fixtures) {
    const value = fixture.stage === 'runtime' ? syntheticHipRuntimeObservation() : syntheticHipCandidateRow();
    for (const mutation of fixture.mutations) setAtPath(value, mutation.path, mutation.value);
    expectedFailure(
      () => (fixture.stage === 'runtime' ? validateHipRuntimeObservation(value) : validateHipPreSigningRow(value)),
      fixture.expectedCode,
      fixture.fixtureId,
    );
  }
  return fixtures.length;
}

export function validatePackFixture(fixture) {
  const expected = [...fixture.expectedFiles].sort();
  const staged = [...fixture.stagedFiles].sort();
  for (const path of [...expected, ...staged]) validateRelativePath(path);
  if (JSON.stringify(expected) !== JSON.stringify(staged)) {
    fail('RUNTIME_PREREQUISITE_MISSING', 'AMD staged file set is not manifest-exact');
  }
  if (
    staged.some((path) => /(?:^|\/)(?:include|models?|sdk|src|build)(?:\/|$)/u.test(path)) ||
    fixture.loaderPolicy !== 'manifest-owned-origin-only' ||
    fixture.networkAccess !== false
  ) {
    fail('RUNTIME_PREREQUISITE_MISSING', 'AMD staging contains excluded or ambient content');
  }
  for (const dependency of fixture.dynamicDependencies) {
    if (
      typeof dependency.resolvedPath !== 'string' ||
      isAbsolute(dependency.resolvedPath) ||
      !staged.includes(dependency.resolvedPath)
    ) {
      fail('RUNTIME_PREREQUISITE_MISSING', 'AMD dependency closure escaped the manifest');
    }
  }
  return true;
}

export function runPackFixtures() {
  const fixtures = listJsonFixtures(resolve(amdContractRoot, 'fixtures', 'packs'));
  for (const fixture of fixtures) {
    if (fixture.expectedCode === null) validatePackFixture(fixture);
    else expectedFailure(() => validatePackFixture(fixture), fixture.expectedCode, fixture.fixtureId);
  }
  return fixtures.length;
}

function assertTaskCachePath(path) {
  const child = relative(taskCacheRoot, path);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child)) {
    throw new Error('AMD synthetic staging path escaped its private cache root');
  }
}

function resetTaskCachePath(path) {
  assertTaskCachePath(path);
  rmSync(path, { force: true, recursive: true });
  mkdirSync(path, { mode: 0o700, recursive: true });
}

function verifyHipConfigureDenied() {
  const buildRoot = resolve(taskCacheRoot, 'hip-no-approved-row', `configure-denied-${process.pid}`);
  resetTaskCachePath(buildRoot);
  const baselineProfile = readJson(resolve(toolchainProfileRoot, 'linux-x64-cpu-baseline-v1.json'));
  const cmakeCommand =
    process.env.CMAKE_COMMAND ??
    resolveProfileTool(baselineProfile, resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'), 'cmake');
  const result = spawnSync(
    cmakeCommand,
    [
      '-S',
      resolve(workspaceRoot, 'runtime', 'local-whisper', 'whisper-cpp'),
      '-B',
      buildRoot,
      '-DLOCAL_WHISPER_BACKEND_ID=hip',
    ],
    {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH ?? '/usr/bin:/bin' },
      shell: false,
    },
  );
  const diagnostics = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  rmSync(buildRoot, { force: true, recursive: true });
  if (
    result.error ||
    result.status === 0 ||
    !diagnostics.includes('Linux HIP is unavailable because no exact pre-signing row is approved')
  ) {
    throw new Error('HIP configure did not fail closed at the no-approved-row gate');
  }
}

export function stageAndRelocateSyntheticVulkanPack() {
  const fixture = readJson(resolve(amdContractRoot, 'fixtures', 'packs', 'valid-vulkan-contract.json'));
  validatePackFixture(fixture);
  const stagingRoot = resolve(taskCacheRoot, 'vulkan-contract-linux', 'staging');
  const relocatedRoot = resolve(taskCacheRoot, 'vulkan-contract-linux', 'relocated');
  resetTaskCachePath(stagingRoot);
  for (const path of fixture.stagedFiles) {
    const output = resolve(stagingRoot, ...path.split('/'));
    mkdirSync(resolve(output, '..'), { mode: 0o700, recursive: true });
    writeFileSync(output, `synthetic Task 12 contract fixture: ${path}\n`, { mode: 0o600 });
  }
  writeFileSync(resolve(stagingRoot, 'manifest', 'expected-files.json'), `${JSON.stringify(fixture.stagedFiles)}\n`, {
    mode: 0o600,
  });
  resetTaskCachePath(relocatedRoot);
  cpSync(stagingRoot, relocatedRoot, { recursive: true });
  for (const path of fixture.expectedFiles) {
    if (!existsSync(resolve(relocatedRoot, ...path.split('/')))) {
      throw new Error(`Relocated synthetic AMD pack is missing ${path}`);
    }
  }
  return relocatedRoot;
}

export function verifyCleanStartRoot(root) {
  const expectedPath = resolve(root, 'manifest', 'expected-files.json');
  const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
  if (
    !Array.isArray(expected) ||
    expected.some((path) => {
      validateRelativePath(path);
      return !existsSync(resolve(root, ...path.split('/')));
    })
  ) {
    throw new Error('Synthetic AMD clean-start fixture is incomplete');
  }
  if (process.env.LOCAL_WHISPER_NETWORK !== 'denied') {
    throw new Error('Synthetic AMD clean-start contract requires a network-denied environment');
  }
  return true;
}

export function verifyVulkanContract() {
  validatePreviewProfiles();
  validateContractToolchain('linux-x64-amd-vulkan-preview-contract-v1');
  const manifest = readJson(resolve(amdContractRoot, 'vulkan-preview-manifest.json'));
  if (
    manifest.supportTier !== 'preview-untested' ||
    manifest.hardwareEvidence !== false ||
    manifest.buildInputs.generatedShaderTarget !== 'vulkan1.3' ||
    manifest.runtime.minimumApi !== 'vulkan1.3' ||
    manifest.buildPolicy.selectedAcceleratorCount !== 1 ||
    manifest.buildPolicy.selectedBackend !== 'vulkan'
  ) {
    throw new Error('Vulkan Preview manifest changed its fail-closed contract');
  }
  const patchLock = readJson(amdPatchLockPath);
  verifyPatchLock(patchLock, patchRoot);
  const patchedSource = preparePatchedSource('linux-x64-amd-vulkan-preview-contract-v1');
  const shaderGenerator = readFileSync(
    resolve(patchedSource, 'ggml', 'src', 'ggml-vulkan', 'vulkan-shaders', 'vulkan-shaders-gen.cpp'),
    'utf8',
  );
  if (
    !shaderGenerator.includes('const std::string target_env = "--target-env=vulkan1.3";') ||
    shaderGenerator.includes('--target-env=vulkan1.2')
  ) {
    throw new Error('Vulkan generated-shader target is not exactly Vulkan 1.3');
  }
  runVulkanFixtures();
  runPackFixtures();
  return stageAndRelocateSyntheticVulkanPack();
}

export function verifyHipNoApprovedRow() {
  validatePreviewProfiles();
  validateContractToolchain('linux-x64-amd-hip-no-approved-row-v1');
  compileSchema(hipSchemaPath);
  const availability = readJson(resolve(amdContractRoot, 'hip', 'unavailable-no-approved-row.json'));
  if (
    availability.status !== 'unavailable-no-approved-row' ||
    availability.reasonCode !== 'DEVICE_NOT_ALLOWLISTED' ||
    availability.approvedRowIds.length !== 0 ||
    availability.configureAllowed ||
    availability.stageAllowed ||
    availability.catalogAllowed ||
    availability.downloadAllowed ||
    availability.loadAllowed ||
    availability.fallbackBackend !== null ||
    availability.hardwareEvidence !== false
  ) {
    throw new Error('HIP no-approved-row gate changed');
  }
  const checkedInHipFiles = readdirSync(resolve(amdContractRoot, 'hip')).filter((name) => name.endsWith('.json'));
  if (JSON.stringify(checkedInHipFiles) !== JSON.stringify(['unavailable-no-approved-row.json'])) {
    throw new Error('A physical HIP row exists without Task 12 authority');
  }
  verifyHipConfigureDenied();
  runHipNegativeFixtures();
  return true;
}
