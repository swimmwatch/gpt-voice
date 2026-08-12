import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  canonicalDigest,
  readJson,
  sha256,
  validateRelativePath,
  verifyMaterializedSource,
} from '../source-import/native-source-core.mjs';
import { verifyElfDependencyClosure } from './elf-dependency-core.mjs';
import { resolveNativeBuildJobs } from './native-build-parallelism.mjs';
import { qualificationInputDigest } from './native-toolchain-evidence-core.mjs';
import { readQualificationFixtureIdentity } from './qualification-fixture-core.mjs';
import { sanitizerRuntimeOptions } from './sanitizer-runtime-policy.mjs';
import { readVerifiedRegularFileSync } from '../secure-file-reader.mjs';
import {
  auditGeneratedBuildGraph,
  resolveProfileComponent,
  resolveProfileTool,
  verifyProfileQualificationFixture,
  verifyToolchainInputs,
} from './native-toolchain-core.mjs';

const SANITIZER_PROFILE_ID = 'linux-x64-clang-18.1.3-asan-ubsan-v1';
const FORBIDDEN_RELOCATION_VARIABLES = Object.freeze(['LD_LIBRARY_PATH', 'LD_PRELOAD', 'GGML_BACKEND_PATH']);
const NETWORK_NAMESPACE = 'user-network-isolated';

function runNetworkIsolated(harness, command, arguments_, options) {
  const result = spawnSync(harness, ['-Urn', '--', command, ...arguments_], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.environment,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status === null) {
    throw new Error(`Network-isolated command could not execute: ${command}`);
  }
  return Object.freeze({
    commandSha256: canonicalDigest({ command, arguments: arguments_, cwd: options.cwd }),
    exitStatus: result.status,
    signal: result.signal,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  });
}

function requireSuccessful(result, label) {
  if (result.exitStatus !== 0) {
    throw new Error(`${label} failed in the network-denied namespace (exit ${result.exitStatus})`);
  }
  return result;
}

function phaseEvidence(phase, result) {
  return Object.freeze({
    phase,
    commandSha256: result.commandSha256,
    exitStatus: 0,
    networkNamespace: NETWORK_NAMESPACE,
  });
}

function sanitizedEnvironment(profile, toolInputs) {
  const directories = new Set(['/usr/bin', '/bin']);
  for (const tool of toolInputs.tools.values()) directories.add(dirname(tool.path));
  const values = {
    LANG: 'C',
    LC_ALL: 'C',
    PATH: [...directories].join(':'),
    ...sanitizerRuntimeOptions(profile.target.os, profile.profileId === SANITIZER_PROFILE_ID),
  };
  const environment = Object.fromEntries(profile.environmentAllowlist.map((key) => [key, values[key]]));
  if (Object.values(environment).some((value) => typeof value !== 'string')) {
    throw new Error('Native profile environment allowlist contains an unsupported key');
  }
  return Object.freeze(environment);
}

function proveNetworkDenied(profile, toolchainRoot, toolInputs, environment, maliciousCwd) {
  const harness = resolveProfileTool(profile, toolchainRoot, 'network-harness');
  const python = resolveProfileTool(profile, toolchainRoot, 'network-probe-runtime');
  const script = [
    'import socket',
    's=socket.socket()',
    's.settimeout(0.25)',
    'try:',
    ' s.connect(("1.1.1.1",443))',
    'except OSError:',
    ' raise SystemExit(0)',
    'raise SystemExit(1)',
  ].join('\n');
  const result = requireSuccessful(
    runNetworkIsolated(harness, python, ['-I', '-S', '-c', script], { cwd: maliciousCwd, environment }),
    'Native network-denial preflight',
  );
  return Object.freeze({
    phase: phaseEvidence('preflight', result),
    harness: toolInputs.tools.get('network-harness'),
  });
}

function sourceLockPath(workspaceRoot, lockId) {
  return resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks', `${lockId}.json`);
}

function verifiedSourceRoots(workspaceRoot, profile, sourceStoreRoot) {
  const sourceRoots = new Map();
  for (const lockId of profile.sourceLockIds) {
    const lock = readJson(sourceLockPath(workspaceRoot, lockId));
    sourceRoots.set(lockId, verifyMaterializedSource(sourceStoreRoot, lock));
  }
  return sourceRoots;
}

function resolvedCmakeCache(profile, sourceRoots, toolchainRoot) {
  return Object.fromEntries(
    Object.entries(profile.cmakeCache).map(([key, value]) => {
      if (value.startsWith('toolchainRoot:')) {
        return [key, resolve(toolchainRoot, ...value.slice('toolchainRoot:'.length).split('/'))];
      }
      if (value.startsWith('sourceLock:')) {
        const lockId = value.slice('sourceLock:'.length);
        const sourceRoot = sourceRoots.get(lockId);
        if (!sourceRoot) throw new Error(`Native build source lock was not materialized: ${lockId}`);
        return [key, sourceRoot];
      }
      return [key, value];
    }),
  );
}

function assertExpectedTargets(buildRoot, profile) {
  const graphText = readFileSync(resolve(buildRoot, 'build.ninja'), 'utf8');
  const graphLines = graphText.split(/\r?\n/u);
  for (const target of profile.expectedBuildGraph) {
    if (!graphLines.some((line) => line.startsWith(`build ${target}:`))) {
      throw new Error(`Expected native build target is absent: ${target}`);
    }
  }
}

function configureAndBuild(workspaceRoot, profile, sourceStoreRoot, toolchainRoot, toolInputs) {
  const cmake = resolveProfileTool(profile, toolchainRoot, 'cmake');
  const ninja = resolveProfileTool(profile, toolchainRoot, 'ninja');
  const harness = resolveProfileTool(profile, toolchainRoot, 'network-harness');
  const sourceRoots = verifiedSourceRoots(workspaceRoot, profile, sourceStoreRoot);
  const fixture = readQualificationFixtureIdentity(workspaceRoot, profile.qualificationFixture.fixtureId);
  const cache = resolvedCmakeCache(profile, sourceRoots, toolchainRoot);
  const buildParent = resolve(workspaceRoot, '.cache', 'local-whisper', 'native-builds');
  mkdirSync(buildParent, { mode: 0o700, recursive: true });
  const buildRoot = mkdtempSync(resolve(buildParent, `${profile.profileId}-`));
  const maliciousCwd = resolve(buildRoot, 'malicious-cwd');
  mkdirSync(maliciousCwd, { mode: 0o700 });
  writeFileSync(resolve(maliciousCwd, 'libggml-backend.so'), 'not a backend\n', { flag: 'wx', mode: 0o600 });
  const environment = sanitizedEnvironment(profile, toolInputs);
  const preflight = proveNetworkDenied(profile, toolchainRoot, toolInputs, environment, maliciousCwd);
  const arguments_ = ['-S', fixture.root, '-B', buildRoot, '-G', 'Ninja', `-DCMAKE_MAKE_PROGRAM=${ninja}`];
  for (const [role, key] of [
    ['c-compiler', 'CMAKE_C_COMPILER'],
    ['cxx-compiler', 'CMAKE_CXX_COMPILER'],
    ['cuda-compiler', 'CMAKE_CUDA_COMPILER'],
  ]) {
    if (profile.tools.some((tool) => tool.role === role)) {
      arguments_.push(`-D${key}=${resolveProfileTool(profile, toolchainRoot, role)}`);
    }
  }
  for (const [key, value] of Object.entries(cache).sort(([left], [right]) => left.localeCompare(right))) {
    arguments_.push(`-D${key}=${value}`);
  }
  const configured = requireSuccessful(
    runNetworkIsolated(harness, cmake, arguments_, { cwd: maliciousCwd, environment }),
    'Native disconnected configure',
  );
  const graph = auditGeneratedBuildGraph(buildRoot, { ...profile, cmakeCache: cache });
  assertExpectedTargets(buildRoot, profile);
  const built = requireSuccessful(
    runNetworkIsolated(
      harness,
      cmake,
      [
        '--build',
        buildRoot,
        '--target',
        ...profile.expectedBuildGraph,
        '--parallel',
        String(resolveNativeBuildJobs({ backend: profile.profileId.includes('cuda') ? 'cuda' : 'cpu' })),
      ],
      { cwd: maliciousCwd, environment },
    ),
    'Native disconnected build',
  );
  return Object.freeze({
    buildRoot,
    environment,
    fixture,
    graph,
    maliciousCwd,
    network: Object.freeze([preflight.phase, phaseEvidence('configure', configured), phaseEvidence('build', built)]),
  });
}

function copyWithIdentity(source, destination, id, relativePath) {
  validateRelativePath(relativePath);
  const canonicalSource = realpathSync(source);
  const { bytes: sourceBytes, stat: sourceStat } = readVerifiedRegularFileSync(canonicalSource);
  if (!sourceStat.isFile()) throw new Error(`Native staged source is not a regular file: ${id}`);
  mkdirSync(dirname(destination), { mode: 0o700, recursive: true });
  copyFileSync(canonicalSource, destination);
  const mode = sourceStat.mode & 0o111 ? '100755' : '100644';
  chmodSync(destination, mode === '100755' ? 0o755 : 0o644);
  const sourceSha256 = sha256(sourceBytes);
  if (sha256(readVerifiedRegularFileSync(destination).bytes) !== sourceSha256) {
    throw new Error(`Native staged file identity changed: ${id}`);
  }
  return Object.freeze({ id, relativePath, sha256: sourceSha256, mode });
}

function stageBuild(profile, buildRoot, toolchainRoot) {
  const stagingRoot = resolve(buildRoot, 'project-stage');
  mkdirSync(stagingRoot, { mode: 0o700 });
  const files = [];
  for (const output of profile.outputs) {
    files.push(
      copyWithIdentity(
        resolveProfileComponent(output, toolchainRoot, buildRoot),
        resolveProfileComponent(output, toolchainRoot, stagingRoot),
        output.id,
        output.path,
      ),
    );
  }
  for (const dependency of profile.dynamicDependencies.filter(({ pathKind }) => pathKind === 'toolchainRootRelative')) {
    const relativePath = `lib/${dependency.soname}`;
    files.push(
      copyWithIdentity(
        resolveProfileComponent(dependency, toolchainRoot),
        resolve(stagingRoot, relativePath),
        dependency.id,
        relativePath,
      ),
    );
  }
  for (const license of profile.licenses) {
    const source = resolveProfileComponent(license, toolchainRoot, buildRoot);
    const relativePath = `licenses/${license.id}.LICENSE`;
    files.push(copyWithIdentity(source, resolve(stagingRoot, relativePath), license.id, relativePath));
  }
  if (new Set(files.map(({ id }) => id)).size !== files.length) {
    throw new Error('Native staging manifest contains duplicate file identities');
  }
  return Object.freeze({ files: Object.freeze(files), stagingRoot: realpathSync(stagingRoot) });
}

function dependencyClosure(profile, staged, toolInputs) {
  const entrypoints = profile.outputs.map((output) => ({
    id: output.id,
    relativePath: output.path,
    sha256: staged.files.find(({ id }) => id === output.id).sha256,
  }));
  const stagedLibraries = profile.dynamicDependencies
    .filter(({ pathKind }) => pathKind === 'toolchainRootRelative')
    .map((component) => ({
      id: component.id,
      soname: component.soname,
      relativePath: `lib/${component.soname}`,
      sha256: component.sha256,
    }));
  const reviewedSystemLibraries = profile.dynamicDependencies
    .filter(({ pathKind }) => pathKind === 'systemAbsolute')
    .map((component) => ({
      id: component.id,
      soname: component.soname,
      path: component.path,
      sha256: component.sha256,
    }));
  const closure = verifyElfDependencyClosure({
    inspector: toolInputs.tools.get('elf-inspector'),
    stagingRoot: staged.stagingRoot,
    entrypoints,
    stagedLibraries,
    reviewedSystemLibraries,
    environment: {},
  });
  const observedDependencies = new Set(
    closure.records.flatMap(({ needed }) => needed.map(({ resolvedId }) => resolvedId)),
  );
  for (const dependency of profile.dynamicDependencies) {
    if (!observedDependencies.has(dependency.id)) {
      throw new Error(`Declared native dynamic dependency was not observed: ${dependency.id}`);
    }
  }
  return closure;
}

function executionRecord(target, purpose, result, markers, expectedExit) {
  const combined = `${result.stdout}\n${result.stderr}`;
  const observedMarkers = markers.filter((marker) => combined.includes(marker));
  if (
    observedMarkers.length !== markers.length ||
    (expectedExit === 'zero' ? result.exitStatus !== 0 : result.exitStatus === 0)
  ) {
    throw new Error(`Native qualification execution did not prove ${purpose}: ${target}`);
  }
  return Object.freeze({
    target,
    purpose,
    exitStatus: result.exitStatus,
    signal: result.signal,
    stdoutSha256: sha256(Buffer.from(result.stdout, 'utf8')),
    stderrSha256: sha256(Buffer.from(result.stderr, 'utf8')),
    requiredMarkers: Object.freeze([...markers]),
    observedMarkers: Object.freeze(observedMarkers),
    networkNamespace: NETWORK_NAMESPACE,
  });
}

function executeStaged(profile, staged, configured, toolchainRoot) {
  const harness = resolveProfileTool(profile, toolchainRoot, 'network-harness');
  const expectations =
    profile.profileId === SANITIZER_PROFILE_ID
      ? [
          ['local-whisper-sanitizer-clean', 'sanitizer-clean', 'clean', ['LOCAL_WHISPER_SANITIZER_CLEAN_OK'], 'zero'],
          [
            'local-whisper-sanitizer-asan-trigger',
            'sanitizer-asan-trigger',
            'asan-trigger',
            ['AddressSanitizer', 'heap-use-after-free'],
            'nonzero',
          ],
          [
            'local-whisper-sanitizer-ubsan-trigger',
            'sanitizer-ubsan-trigger',
            'ubsan-trigger',
            ['runtime error:', 'signed integer overflow'],
            'nonzero',
          ],
        ]
      : [['local-whisper-build-smoke', 'build-smoke', 'build-smoke', ['LOCAL_WHISPER_BUILD_SMOKE_OK'], 'zero']];
  const executions = expectations.map(([target, outputId, purpose, markers, expectedExit]) => {
    const output = profile.outputs.find(({ id }) => id === outputId);
    const result = runNetworkIsolated(harness, resolve(staged.stagingRoot, ...output.path.split('/')), [], {
      cwd: configured.maliciousCwd,
      environment: configured.environment,
    });
    return executionRecord(target, purpose, result, markers, expectedExit);
  });
  return Object.freeze(executions);
}

function relocateStage(profile, staged, configured, toolchainRoot, toolInputs) {
  const relocatedRoot = resolve(configured.buildRoot, 'relocated-stage');
  mkdirSync(relocatedRoot, { mode: 0o700 });
  const relocatedFiles = staged.files.map((file) =>
    copyWithIdentity(
      resolve(staged.stagingRoot, ...file.relativePath.split('/')),
      resolve(relocatedRoot, ...file.relativePath.split('/')),
      file.id,
      file.relativePath,
    ),
  );
  if (canonicalDigest(relocatedFiles) !== canonicalDigest(staged.files)) {
    throw new Error('Native relocation manifest identity changed');
  }
  const maliciousCwd = resolve(configured.buildRoot, 'malicious-relocation-cwd');
  mkdirSync(maliciousCwd, { mode: 0o700 });
  writeFileSync(resolve(maliciousCwd, 'libggml-backend.so'), 'not a backend\n', { flag: 'wx', mode: 0o600 });
  for (const dependency of profile.dynamicDependencies.filter(({ pathKind }) => pathKind === 'toolchainRootRelative')) {
    writeFileSync(resolve(maliciousCwd, dependency.soname), 'malicious\n', { flag: 'wx', mode: 0o600 });
  }
  const relocated = Object.freeze({ files: Object.freeze(relocatedFiles), stagingRoot: realpathSync(relocatedRoot) });
  dependencyClosure(profile, relocated, toolInputs);
  const cleanOutput = profile.profileId === SANITIZER_PROFILE_ID ? 'sanitizer-clean' : 'build-smoke';
  const cleanMarker =
    profile.profileId === SANITIZER_PROFILE_ID ? 'LOCAL_WHISPER_SANITIZER_CLEAN_OK' : 'LOCAL_WHISPER_BUILD_SMOKE_OK';
  const output = profile.outputs.find(({ id }) => id === cleanOutput);
  const harness = resolveProfileTool(profile, toolchainRoot, 'network-harness');
  const result = runNetworkIsolated(harness, resolve(relocated.stagingRoot, ...output.path.split('/')), [], {
    cwd: maliciousCwd,
    environment: configured.environment,
  });
  return Object.freeze({
    execution: executionRecord(output.path.split('/').at(-1), 'relocated-clean', result, [cleanMarker], 'zero'),
    maliciousCwdIdentity: canonicalDigest({ path: realpathSync(maliciousCwd), marker: 'malicious-unrelated-cwd' }),
    manifestSha256: canonicalDigest(relocatedFiles),
    rootIdentity: sha256(Buffer.from(realpathSync(relocatedRoot), 'utf8')),
    networkPhase: phaseEvidence('relocated-clean-start', result),
  });
}

function identityRecords(components, records, useRole = false) {
  return components.map((component) => {
    const id = useRole ? component.role : component.id;
    const identity = records.get(id);
    if (!identity) throw new Error(`Native qualification input identity is missing: ${id}`);
    return Object.freeze({
      id,
      path: component.path,
      sha256: identity.sha256,
      ...(useRole ? { versionOutputSha256: identity.versionOutputSha256 } : {}),
    });
  });
}

export function auditDisconnectedBuild(workspaceRoot, profile, sourceStoreRoot, toolchainRoot) {
  const toolInputs = verifyToolchainInputs(profile, toolchainRoot, { allowCandidate: true });
  verifyProfileQualificationFixture(profile, workspaceRoot);
  const configured = configureAndBuild(workspaceRoot, profile, sourceStoreRoot, toolchainRoot, toolInputs);
  const staged = stageBuild(profile, configured.buildRoot, toolchainRoot);
  const closure = dependencyClosure(profile, staged, toolInputs);
  const executions = executeStaged(profile, staged, configured, toolchainRoot);
  const executionPhase = Object.freeze({
    phase: 'fixture-execution',
    commandSha256: canonicalDigest(executions),
    exitStatus: 0,
    networkNamespace: NETWORK_NAMESPACE,
  });
  const relocation = relocateStage(profile, staged, configured, toolchainRoot, toolInputs);
  const licenseIdentities = profile.licenses.map((license) => {
    const stagedLicense = staged.files.find(({ id }) => id === license.id);
    return Object.freeze({
      id: license.id,
      path: stagedLicense.relativePath,
      sha256: stagedLicense.sha256,
    });
  });
  return Object.freeze({
    $schema: '../schema/native-toolchain-evidence.schema.json',
    schemaId: 'local-whisper-native-toolchain-evidence-v1',
    profileId: profile.profileId,
    profileInputDigest: qualificationInputDigest(profile),
    inputs: Object.freeze({
      sourceLockIds: Object.freeze([...profile.sourceLockIds]),
      patchLockIds: Object.freeze([...profile.patchLockIds]),
      qualificationFixture: Object.freeze({
        fixtureId: configured.fixture.fixtureId,
        manifestSha256: configured.fixture.manifestSha256,
      }),
    }),
    toolIdentities: Object.freeze(identityRecords(profile.tools, toolInputs.tools, true)),
    runtimeIdentities: Object.freeze(identityRecords(profile.runtime, toolInputs.runtime)),
    licenseIdentities: Object.freeze(licenseIdentities),
    configuredCacheSha256: canonicalDigest(profile.cmakeCache),
    effectiveCacheSha256: configured.graph.cacheSha256,
    generatedBuildGraphSha256: configured.graph.graphSha256,
    generatedTargets: Object.freeze([...profile.expectedBuildGraph]),
    executions,
    stagedFiles: staged.files,
    dependencyClosure: closure,
    relocation: Object.freeze({
      rootIdentity: relocation.rootIdentity,
      manifestSha256: relocation.manifestSha256,
      maliciousCwdIdentity: relocation.maliciousCwdIdentity,
      environmentAllowlist: Object.freeze([...profile.environmentAllowlist]),
      inheritedEnvironmentKeys: Object.freeze([]),
      forbiddenVariablesAbsent: FORBIDDEN_RELOCATION_VARIABLES,
      execution: relocation.execution,
    }),
    networkDenial: Object.freeze({
      harness: Object.freeze({
        path: toolInputs.tools.get('network-harness').path,
        sha256: toolInputs.tools.get('network-harness').sha256,
      }),
      phases: Object.freeze([...configured.network, executionPhase, relocation.networkPhase]),
    }),
    sanitizedEnvironment: Object.freeze({
      allowlistedKeys: Object.freeze([...profile.environmentAllowlist]),
      inheritedKeys: Object.freeze([]),
      environmentSha256: canonicalDigest(configured.environment),
      cwdPolicy: 'owned-malicious-unrelated',
    }),
  });
}
