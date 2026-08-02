import { canonicalDigest, canonicalJson } from '../source-import/native-source-core.mjs';

const SANITIZER_PROFILE_ID = 'linux-x64-clang-18.1.3-asan-ubsan-v1';
const SANITIZER_EXPECTATIONS = Object.freeze([
  Object.freeze({
    target: 'local-whisper-sanitizer-clean',
    purpose: 'clean',
    exitKind: 'zero',
    markers: Object.freeze(['LOCAL_WHISPER_SANITIZER_CLEAN_OK']),
  }),
  Object.freeze({
    target: 'local-whisper-sanitizer-asan-trigger',
    purpose: 'asan-trigger',
    exitKind: 'nonzero',
    markers: Object.freeze(['AddressSanitizer', 'heap-use-after-free']),
  }),
  Object.freeze({
    target: 'local-whisper-sanitizer-ubsan-trigger',
    purpose: 'ubsan-trigger',
    exitKind: 'nonzero',
    markers: Object.freeze(['runtime error:', 'signed integer overflow']),
  }),
]);
const REQUIRED_NETWORK_PHASES = Object.freeze(['preflight', 'configure', 'build', 'relocated-clean-start']);
const FORBIDDEN_ENVIRONMENT_VARIABLES = Object.freeze(['GGML_BACKEND_PATH', 'LD_LIBRARY_PATH', 'LD_PRELOAD']);

function assertExactIds(actual, expected, label) {
  const actualIds = actual.map((item) => item.id);
  if (
    new Set(actualIds).size !== actualIds.length ||
    canonicalJson(actualIds.sort()) !== canonicalJson([...expected].sort())
  ) {
    throw new Error(`Native qualification ${label} identities are incomplete or duplicated`);
  }
}

function assertIdentityHashes(records, components, label) {
  assertExactIds(
    records,
    components.map((component) => component.role ?? component.id),
    label,
  );
  for (const component of components) {
    const id = component.role ?? component.id;
    const record = records.find((candidate) => candidate.id === id);
    if (!record || record.path !== component.path || component.sha256 === null || record.sha256 !== component.sha256) {
      throw new Error(`Native qualification ${label} identity mismatch: ${id}`);
    }
    if (component.role && !record.versionOutputSha256) {
      throw new Error(`Native qualification tool version evidence is missing: ${id}`);
    }
  }
}

function assertExecution(execution, expectation) {
  if (
    !execution ||
    execution.purpose !== expectation.purpose ||
    execution.networkNamespace !== 'user-network-isolated' ||
    (expectation.exitKind === 'zero' ? execution.exitStatus !== 0 : execution.exitStatus === 0)
  ) {
    throw new Error(`Native sanitizer execution result is invalid: ${expectation.target}`);
  }
  if (canonicalJson(execution.requiredMarkers) !== canonicalJson(expectation.markers)) {
    throw new Error(`Native sanitizer required markers changed: ${expectation.target}`);
  }
  for (const marker of expectation.markers) {
    if (!execution.observedMarkers.includes(marker)) {
      throw new Error(`Native sanitizer marker was not observed: ${marker}`);
    }
  }
}

function verifySanitizerEvidence(profile, evidence) {
  if (canonicalJson(profile.expectedBuildGraph) !== canonicalJson(SANITIZER_EXPECTATIONS.map(({ target }) => target))) {
    throw new Error('Native sanitizer build graph changed');
  }
  assertExactIds(
    evidence.executions.map((execution) => ({ id: execution.target })),
    SANITIZER_EXPECTATIONS.map(({ target }) => target),
    'sanitizer execution',
  );
  for (const expectation of SANITIZER_EXPECTATIONS) {
    assertExecution(
      evidence.executions.find((execution) => execution.target === expectation.target),
      expectation,
    );
  }
}

function verifyNetworkAndEnvironment(profile, evidence) {
  const phases = evidence.networkDenial.phases;
  const phaseNames = phases.map(({ phase }) => phase);
  if (new Set(phaseNames).size !== phaseNames.length)
    throw new Error('Native network-denial phase evidence is duplicated');
  for (const required of REQUIRED_NETWORK_PHASES) {
    const phase = phases.find((candidate) => candidate.phase === required);
    if (!phase || phase.exitStatus !== 0 || phase.networkNamespace !== 'user-network-isolated') {
      throw new Error(`Native network-denial evidence is missing: ${required}`);
    }
  }
  if (
    canonicalJson(evidence.sanitizedEnvironment.allowlistedKeys) !== canonicalJson(profile.environmentAllowlist) ||
    evidence.sanitizedEnvironment.inheritedKeys.length !== 0 ||
    evidence.sanitizedEnvironment.cwdPolicy !== 'owned-malicious-unrelated' ||
    canonicalJson([...evidence.relocation.forbiddenVariablesAbsent].sort()) !==
      canonicalJson([...FORBIDDEN_ENVIRONMENT_VARIABLES].sort()) ||
    evidence.relocation.inheritedEnvironmentKeys.length !== 0 ||
    canonicalJson(evidence.relocation.environmentAllowlist) !== canonicalJson(profile.environmentAllowlist)
  ) {
    throw new Error('Native qualification sanitized environment evidence changed');
  }
  const relocated = evidence.relocation.execution;
  if (
    relocated.purpose !== 'relocated-clean' ||
    relocated.exitStatus !== 0 ||
    relocated.networkNamespace !== 'user-network-isolated' ||
    relocated.requiredMarkers.some((marker) => !relocated.observedMarkers.includes(marker))
  ) {
    throw new Error('Native qualification relocated clean-start evidence is invalid');
  }
}

function expectedStagedIds(profile) {
  return [
    ...profile.outputs.map(({ id }) => id),
    ...profile.dynamicDependencies.filter(({ pathKind }) => pathKind === 'toolchainRootRelative').map(({ id }) => id),
    ...profile.licenses.map(({ id }) => id),
  ];
}

function verifyStagingAndClosure(profile, evidence) {
  assertExactIds(evidence.stagedFiles, expectedStagedIds(profile), 'staged file');
  if (evidence.relocation.manifestSha256 !== canonicalDigest(evidence.stagedFiles)) {
    throw new Error('Native qualification relocation manifest changed');
  }
  const stagedById = new Map(evidence.stagedFiles.map((file) => [file.id, file]));
  const closureIds = new Set();
  const observedDependencies = new Set();
  for (const record of evidence.dependencyClosure.records) {
    if (closureIds.has(record.fileId)) throw new Error('Native qualification dependency-closure record is duplicated');
    closureIds.add(record.fileId);
    const staged = stagedById.get(record.fileId);
    if (!staged || staged.relativePath !== record.relativePath || staged.sha256 !== record.sha256) {
      throw new Error(`Native qualification closure file identity changed: ${record.fileId}`);
    }
    const sonames = new Set();
    for (const dependency of record.needed) {
      if (sonames.has(dependency.soname)) {
        throw new Error(`Native qualification closure dependency is duplicated: ${dependency.soname}`);
      }
      sonames.add(dependency.soname);
      const authority = profile.dynamicDependencies.find(({ id }) => id === dependency.resolvedId);
      if (
        !authority ||
        authority.soname !== dependency.soname ||
        authority.sha256 !== dependency.sha256 ||
        (authority.pathKind === 'systemAbsolute' ? 'reviewed-system' : 'staged') !== dependency.resolutionKind
      ) {
        throw new Error(`Native qualification closure authority changed: ${dependency.soname}`);
      }
      observedDependencies.add(dependency.resolvedId);
    }
  }
  for (const output of profile.outputs) {
    if (!closureIds.has(output.id)) throw new Error(`Native qualification output closure is missing: ${output.id}`);
  }
  if (
    canonicalJson([...observedDependencies].sort()) !==
    canonicalJson(profile.dynamicDependencies.map(({ id }) => id).sort())
  ) {
    throw new Error('Native qualification observed dependency set changed');
  }
  for (const license of evidence.licenseIdentities) {
    const staged = stagedById.get(license.id);
    if (!staged || staged.sha256 !== license.sha256) {
      throw new Error(`Native qualification staged license identity changed: ${license.id}`);
    }
  }
}

export function qualificationInputDigest(profile) {
  const candidate = globalThis.structuredClone(profile);
  candidate.qualificationState = 'candidate-unqualified';
  candidate.evidenceDigest = null;
  return canonicalDigest(candidate);
}

export function verifyQualificationEvidence(profile, evidence) {
  if (
    evidence?.schemaId !== 'local-whisper-native-toolchain-evidence-v1' ||
    evidence.profileId !== profile.profileId ||
    evidence.profileInputDigest !== qualificationInputDigest(profile) ||
    !evidence.inputs ||
    !Array.isArray(evidence.toolIdentities) ||
    !Array.isArray(evidence.runtimeIdentities) ||
    !Array.isArray(evidence.licenseIdentities) ||
    !Array.isArray(evidence.generatedTargets) ||
    !Array.isArray(evidence.executions) ||
    !Array.isArray(evidence.stagedFiles) ||
    !evidence.dependencyClosure ||
    !evidence.relocation ||
    !evidence.networkDenial ||
    !evidence.sanitizedEnvironment
  ) {
    throw new Error('Native qualification evidence does not bind this exact profile input');
  }
  if (
    canonicalJson(evidence.inputs.sourceLockIds) !== canonicalJson(profile.sourceLockIds) ||
    canonicalJson(evidence.inputs.patchLockIds) !== canonicalJson(profile.patchLockIds) ||
    canonicalJson(evidence.inputs.qualificationFixture) !== canonicalJson(profile.qualificationFixture)
  ) {
    throw new Error('Native qualification source or fixture identity changed');
  }
  assertIdentityHashes(evidence.toolIdentities, profile.tools, 'tool');
  assertIdentityHashes(evidence.runtimeIdentities, profile.runtime, 'runtime');
  assertExactIds(
    evidence.licenseIdentities,
    profile.licenses.map(({ id }) => id),
    'license',
  );
  for (const license of profile.licenses.filter(({ pathKind }) => pathKind !== 'outputRelative')) {
    const identity = evidence.licenseIdentities.find(({ id }) => id === license.id);
    if (!identity || license.sha256 === null || identity.sha256 !== license.sha256) {
      throw new Error(`Native qualification license identity mismatch: ${license.id}`);
    }
  }
  if (
    evidence.configuredCacheSha256 !== canonicalDigest(profile.cmakeCache) ||
    canonicalJson(evidence.generatedTargets) !== canonicalJson(profile.expectedBuildGraph)
  ) {
    throw new Error('Native qualification cache or generated target graph changed');
  }
  verifyStagingAndClosure(profile, evidence);
  const elfInspector = profile.tools.find(({ role }) => role === 'elf-inspector');
  const networkHarness = profile.tools.find(({ role }) => role === 'network-harness');
  if (
    !elfInspector ||
    elfInspector.sha256 !== evidence.dependencyClosure.inspector.sha256 ||
    !networkHarness ||
    networkHarness.sha256 !== evidence.networkDenial.harness.sha256
  ) {
    throw new Error('Native qualification inspector or network harness identity changed');
  }
  verifyNetworkAndEnvironment(profile, evidence);
  if (profile.profileId === SANITIZER_PROFILE_ID) verifySanitizerEvidence(profile, evidence);
  return true;
}
