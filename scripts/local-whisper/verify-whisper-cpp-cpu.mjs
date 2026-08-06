import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import { cpuStageRoot } from './stage-whisper-cpp-cpu.mjs';
import { canonicalDigest, sha256 } from './source-import/native-source-core.mjs';
import { captureToolchainInputLock, verifyToolchainContract } from './native-build/native-toolchain-core.mjs';
import { auditWindows } from './verify-windows-runtime-pack.mjs';
import {
  approvedMediumModel,
  captureWorkerRegistry,
  canonicalSilence,
  mediumModelIdentity,
  modelBindingBytes,
  modelTransferBytes,
  sha256File,
  transcriptionOptions,
  WhisperCppWorkerProcess,
} from './whisper-cpp-integration-core.mjs';
import {
  buildIdentity,
  limitTablePath,
  nlohmannSourceLockPath,
  parseArguments,
  patchLockPath,
  removeTaskOwnedTree,
  requireProfile,
  sourceLockPath,
  taskCacheRoot,
  toolchainRoot,
  whisperCppRoot,
  workspaceRoot,
} from './whisper-cpp-build-core.mjs';

function assertTaskOwned(path) {
  const child = relative(taskCacheRoot, path);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child))
    throw new Error('Whisper.cpp verification path escaped private task root');
}

function allFiles(root) {
  const result = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else result.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return result.sort();
}

function verifyStage(profileId) {
  const root = cpuStageRoot(profileId);
  const expectedPaths = [
    'THIRD_PARTY_NOTICES.md',
    'bin/local-whisper-whisper-cpp-worker',
    'expected-files.json',
    'licenses/nlohmann-json.LICENSE.MIT',
    'licenses/whisper-cpp.LICENSE',
    'provenance.json',
    'runtime-manifest.json',
    'sbom.spdx.json',
  ];
  assert.deepEqual(allFiles(root), expectedPaths);
  const expected = JSON.parse(readFileSync(resolve(root, 'expected-files.json'), 'utf8'));
  assert.equal(expected.schemaId, 'local-whisper-expected-files-v1');
  const payloadPaths = expectedPaths.filter(
    (path) => path !== 'expected-files.json' && path !== 'runtime-manifest.json',
  );
  assert.deepEqual(expected.files.map((file) => file.relativePath).sort(), payloadPaths);
  assert.equal(new Set(expected.files.map((file) => file.id)).size, expected.files.length);
  for (const file of expected.files) {
    assert.equal(file.relativePath.startsWith('/'), false);
    assert.equal(file.relativePath.split('/').includes('..'), false);
    const path = resolve(root, ...file.relativePath.split('/'));
    const metadata = statSync(path);
    assert.equal(metadata.isFile(), true, file.relativePath);
    assert.equal(metadata.size, file.sizeBytes, file.relativePath);
    assert.equal(metadata.mode & 0o777, file.mode, file.relativePath);
    assert.equal(sha256(readFileSync(path)), file.sha256, file.relativePath);
  }
  const manifestPath = resolve(root, 'runtime-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.profileId, profileId);
  assert.equal(manifest.runtimeBuildDigest, buildIdentity());
  assert.equal(manifest.dynamicBackendDiscovery, false);
  const profile = requireProfile(profileId);
  assert.deepEqual(
    manifest.systemRuntimeDependencies,
    profile.dynamicDependencies.map((dependency) => ({
      id: dependency.id,
      soname: dependency.soname,
      sha256: dependency.sha256,
    })),
  );
  assert.deepEqual(manifest.gpuBackends, []);
  assert.equal(manifest.modelIncluded, false);
  assert.equal(manifest.signed, false);
  assert.equal(manifest.productionOrigin, false);
  const expectedEvidence = manifest.expectedFiles;
  assert.equal(sha256(readFileSync(resolve(root, expectedEvidence.relativePath))), expectedEvidence.sha256);
  assert.equal(manifest.payloadManifestSha256, canonicalDigest(expected.files));
  const provenance = JSON.parse(readFileSync(resolve(root, 'provenance.json'), 'utf8'));
  const patchLock = JSON.parse(readFileSync(patchLockPath, 'utf8'));
  const sourceLock = JSON.parse(readFileSync(sourceLockPath, 'utf8'));
  const nlohmannLock = JSON.parse(readFileSync(nlohmannSourceLockPath, 'utf8'));
  const loaderLimits = JSON.parse(readFileSync(limitTablePath, 'utf8'));
  assert.equal(provenance.runtimeBuildDigest, buildIdentity());
  assert.equal(provenance.modelIncluded, false);
  assert.equal(provenance.sourceLockId, patchLock.sourceLockId);
  assert.equal(provenance.originalManifestSha256, patchLock.originalManifestSha256);
  assert.equal(provenance.patchLockId, patchLock.lockId);
  assert.equal(provenance.patchSha256, patchLock.patches[0].sha256);
  assert.equal(provenance.patchedManifestSha256, patchLock.finalManifestSha256);
  assert.equal(provenance.nlohmannSourceLockId, nlohmannLock.lockId);
  assert.equal(provenance.nlohmannSourceManifestSha256, nlohmannLock.materialization.manifestSha256);
  assert.equal(provenance.loaderLimitTableId, loaderLimits.tableId);
  assert.equal(provenance.loaderLimitTableSha256, loaderLimits.tableSha256);
  assert.deepEqual(provenance.systemRuntimeDependencies, manifest.systemRuntimeDependencies);
  assert.equal(sha256(readFileSync(resolve(root, 'licenses', 'whisper-cpp.LICENSE'))), sourceLock.license.sha256);
  assert.equal(
    sha256(readFileSync(resolve(root, 'licenses', 'nlohmann-json.LICENSE.MIT'))),
    nlohmannLock.license.sha256,
  );
  const sbom = JSON.parse(readFileSync(resolve(root, 'sbom.spdx.json'), 'utf8'));
  assert.equal(sbom.spdxVersion, 'SPDX-2.3');
  assert.ok(sbom.packages.some((component) => component.name === 'whisper.cpp'));
  assert.ok(sbom.packages.some((component) => component.name === 'nlohmann/json'));
  for (const dependency of manifest.systemRuntimeDependencies)
    assert.ok(sbom.packages.some((component) => component.name === dependency.soname));
  const notices = readFileSync(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.match(notices, /whisper\.cpp v1\.9\.1/u);
  assert.match(notices, /nlohmann\/json v3\.12\.0/u);
  return {
    root,
    binary: resolve(root, manifest.executable),
  };
}

function runSelfTest(binary, options = {}) {
  const result = spawnSync(binary, ['--self-test'], {
    cwd: options.cwd ?? '/',
    env: options.env ?? { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /LOCAL_WHISPER_CPP_CPU_SELF_TEST_OK/u);
  assert.equal(result.stderr, '');
}

function verifyDependencies(profile, binary) {
  const readelf = profile.tools.find((tool) => tool.role === 'elf-inspector')?.path;
  assert.ok(readelf);
  const result = spawnSync(readelf, ['-d', binary], { encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /\((?:RPATH|RUNPATH)\)/u);
  const needed = result.stdout
    .split('\n')
    .flatMap((line) => {
      const marker = line.indexOf('(NEEDED)');
      const openingBracket = marker === -1 ? -1 : line.indexOf('[', marker + 8);
      const closingBracket = openingBracket === -1 ? -1 : line.indexOf(']', openingBracket + 1);
      return openingBracket === -1 || closingBracket === -1 ? [] : [line.slice(openingBracket + 1, closingBracket)];
    })
    .sort();
  const expected = profile.dynamicDependencies.map((dependency) => dependency.soname).sort();
  assert.deepEqual(needed, expected);
  assert.ok(needed.every((name) => !/cuda|hip|vulkan|opencl/iu.test(name)));
}

function verifyLinux(profileId) {
  const profile = requireProfile(profileId);
  verifyToolchainContract(profile, { allowCandidate: false, contractOnly: false });
  const pack = verifyStage(profileId);
  verifyDependencies(profile, pack.binary);
  const requiredDisabledOptions = [
    'GGML_ACCELERATE',
    'GGML_BACKEND_DL',
    'GGML_BLAS',
    'GGML_CANN',
    'GGML_CUDA',
    'GGML_HIP',
    'GGML_METAL',
    'GGML_OPENCL',
    'GGML_OPENMP',
    'GGML_RPC',
    'GGML_SYCL',
    'GGML_VULKAN',
    'GGML_NATIVE',
    'WHISPER_BUILD_EXAMPLES',
    'WHISPER_BUILD_TESTS',
    'WHISPER_CURL',
  ];
  for (const option of requiredDisabledOptions) {
    assert.equal(profile.cmakeCache[option], 'OFF', `${option} must remain disabled`);
  }
  assert.equal(profile.cmakeCache.GGML_CPU, 'ON');
  assert.equal(profile.cmakeCache.GGML_STATIC, 'ON');
  const engine = readFileSync(resolve(whisperCppRoot, 'adapter', 'whisper_engine.cpp'), 'utf8');
  assert.doesNotMatch(engine, /ggml_backend_load_all/u);
  assert.match(engine, /parameters\.use_gpu = kGpuWorker/u);
  assert.match(engine, /parameters\.vad_model_path = nullptr/u);
  const main = readFileSync(resolve(whisperCppRoot, 'core', 'main.cpp'), 'utf8');
  const application = readFileSync(resolve(whisperCppRoot, 'core', 'worker_application.cpp'), 'utf8');
  const linuxAuthority = readFileSync(resolve(whisperCppRoot, 'core', 'model_authority_linux.cpp'), 'utf8');
  for (const source of [main, application, linuxAuthority]) {
    assert.doesNotMatch(source, /\b(?:CreateFileA|CreateFileW|fopen|freopen|getenv|ifstream|std::filesystem)\b/u);
  }
  assert.doesNotMatch(application, /modelPath|model_path/u);
  const provisioner = readFileSync(
    resolve(workspaceRoot, 'scripts', 'local-whisper', 'provision-native-test-sources.mjs'),
    'utf8',
  );
  assert.match(provisioner, /whisper-cpp-v1\.9\.1-f049fff/u);
  const workflow = readFileSync(resolve(workspaceRoot, '.github', 'workflows', 'pr-checks.yml'), 'utf8');
  const linuxJob = workflow.slice(
    workflow.indexOf('  native-quality-linux:'),
    workflow.indexOf('  native-quality-windows:'),
  );
  assert.match(linuxJob, /runs-on: ubuntu-24\.04/u);
  assert.match(linuxJob, /test:local-whisper:whisper-cpp-core/u);
  assert.match(linuxJob, /test:local-whisper:whisper-cpp-loader/u);
  assert.match(linuxJob, /build:local-whisper:whisper-cpp-cpu/u);
  assert.match(linuxJob, /audit:local-whisper:whisper-cpp-pack/u);
  assert.doesNotMatch(linuxJob, /windows-x64-cpu-msvc-19\.39-v1/u);
  const manifest = JSON.parse(readFileSync(resolve(pack.root, 'runtime-manifest.json'), 'utf8'));
  const registry = captureWorkerRegistry(pack.binary, {
    backendId: 'cpu',
    runtimeBuildDigest: manifest.runtimeBuildDigest,
  });
  assert.deepEqual(registry.entries, []);
  runSelfTest(pack.binary);
}

function verifyWindowsPack(profileId) {
  const profile = captureToolchainInputLock(requireProfile(profileId), toolchainRoot);
  verifyToolchainContract(profile, { allowCandidate: true, contractOnly: false });
  const authority = readFileSync(resolve(whisperCppRoot, 'platform', 'windows', 'model_authority_windows.cpp'), 'utf8');
  const channel = readFileSync(resolve(whisperCppRoot, 'platform', 'windows', 'worker_protocol_windows.cpp'), 'utf8');
  for (const marker of [
    '#include <algorithm>',
    'GetFileInformationByHandleEx',
    'GetFileSizeEx',
    'OVERLAPPED',
    'ReadFile',
    'CloseHandle',
    'windows_worker_handle',
  ]) {
    assert.ok(authority.includes(marker), `Windows model reader contract: ${marker}`);
  }
  for (const marker of ['ReadFile', 'WriteFile', 'decode_frame', 'validate_bounded_json'])
    assert.ok(channel.includes(marker), `Windows worker protocol contract: ${marker}`);
  auditWindows(profileId);
}

async function probeIntegration(binary) {
  const worker = WhisperCppWorkerProcess.probe(binary);
  worker.sendControl({ type: 'hello', protocolVersion: 1 });
  assert.equal((await worker.readControl()).type, 'helloAck');
  worker.sendControl({
    type: 'probe',
    protocolVersion: 1,
    requestId: 'probe-cpu-task11',
    authorityId: Buffer.alloc(16, 9).toString('base64url'),
    deviceBinding: { kind: 'cpu' },
  });
  const probed = await worker.readControl();
  assert.equal(probed.type, 'probed');
  assert.deepEqual(probed.deviceBinding, { kind: 'cpu' });
  for (const field of [
    'activatedOrdinal',
    'actualNativeIdentity',
    'primaryExecutionNativeIdentity',
    'registryFingerprint',
    'probeProof',
  ])
    assert.equal(Object.hasOwn(probed, field), false, `CPU probe leaked ${field}`);
  worker.closeInput();
  assert.deepEqual(await worker.waitForExit(), { code: 0, signal: null });
}

async function loadIntegration(binary, includeCancellation) {
  assert.equal(approvedMediumModel.license, 'MIT');
  assert.match(approvedMediumModel.origin, /^ggerganov\/whisper\.cpp@/u);
  const metadata = statSync(approvedMediumModel.path);
  assert.equal(metadata.size, approvedMediumModel.sizeBytes);
  assert.equal(sha256File(approvedMediumModel.path), approvedMediumModel.sha256);
  const operationNonce = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
  const binding = modelBindingBytes(operationNonce);
  const worker = WhisperCppWorkerProcess.load(binary, approvedMediumModel.path);
  try {
    worker.write(modelTransferBytes(binding));
    await worker.readModelAuthorityAcknowledgment(binding);
    worker.write(Buffer.from([1]));
    worker.sendControl({ type: 'hello', protocolVersion: 1 });
    const hello = await worker.readControl();
    assert.equal(hello.type, 'helloAck');
    assert.equal(hello.backend, 'cpu');
    const authorityId = operationNonce.toString('base64url');
    const model = mediumModelIdentity();
    const residency = {
      engine: 'whisperCpp',
      runtimePackRevision: 'whisper-cpp-linux-x64-cpu-baseline-v1',
      target: 'cpu',
      backend: 'cpu',
      deviceId: null,
      model,
      resolvedCpuThreads: 2,
    };
    worker.sendControl({
      type: 'load',
      protocolVersion: 1,
      requestId: 'load-medium-task11',
      authorityId,
      deviceBinding: { kind: 'cpu' },
      residency,
    });
    const loaded = await worker.readControl();
    assert.equal(loaded.type, 'loaded');
    assert.equal(loaded.modelSha256, approvedMediumModel.sha256);
    assert.equal(loaded.effectiveBackend, 'cpu');
    assert.equal(loaded.primaryStateOwnership, 'worker');
    worker.sendControl({ type: 'warmup', protocolVersion: 1, requestId: 'warm-task11' });
    assert.equal((await worker.readControl()).type, 'warmed');
    const wav = canonicalSilence();
    worker.sendControl({
      type: 'transcribe',
      protocolVersion: 1,
      requestId: 'tx-task11',
      settingsEpoch: 9,
      audioByteLength: wav.length,
      options: transcriptionOptions(),
    });
    worker.sendAudio('tx-task11', wav);
    worker.sendControl({
      type: 'warmup',
      protocolVersion: 1,
      requestId: 'post-tx-warm-task11',
    });
    const transcript = await worker.readControl();
    assert.equal(transcript.type, 'transcript');
    assert.equal(typeof transcript.text, 'string');
    assert.equal((await worker.readControl()).type, 'warmed');
    if (includeCancellation) {
      const cancellationAudio = canonicalSilence(480_000);
      worker.sendControl({
        type: 'transcribe',
        protocolVersion: 1,
        requestId: 'tx-cancel-task11',
        settingsEpoch: 9,
        audioByteLength: cancellationAudio.length,
        options: transcriptionOptions(),
      });
      worker.sendAudio('tx-cancel-task11', cancellationAudio);
      worker.sendControl({
        type: 'cancel',
        protocolVersion: 1,
        requestId: 'cancel-task11',
        targetRequestId: 'tx-cancel-task11',
      });
      const cancelled = await worker.readControl();
      assert.equal(cancelled.type, 'cancelled');
      assert.equal(cancelled.targetRequestId, 'tx-cancel-task11');
    }
    worker.sendControl({ type: 'unload', protocolVersion: 1, requestId: 'unload-task11' });
    assert.equal((await worker.readControl()).type, 'unloaded');
    worker.sendControl({ type: 'shutdown', protocolVersion: 1, requestId: 'shutdown-task11' });
    assert.equal((await worker.readControl()).type, 'shutdownAck');
    worker.closeInput();
    assert.deepEqual(await worker.waitForExit(), { code: 0, signal: null });
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

async function integration(profileId, includeCancellation) {
  const pack = verifyStage(profileId);
  await probeIntegration(pack.binary);
  await loadIntegration(pack.binary, includeCancellation);
}

function audit(profileId) {
  const profile = requireProfile(profileId);
  const pack = verifyStage(profileId);
  const auditRoot = resolve(taskCacheRoot, 'audit', profileId);
  assertTaskOwned(auditRoot);
  removeTaskOwnedTree(auditRoot);
  mkdirSync(auditRoot, { mode: 0o700, recursive: true });
  const relocated = resolve(auditRoot, 'relocated');
  cpSync(pack.root, relocated, { recursive: true });
  const malicious = resolve(auditRoot, 'malicious-cwd');
  mkdirSync(malicious, { mode: 0o700 });
  writeFileSync(resolve(malicious, 'libggml-backend.so'), 'not a backend\n', { mode: 0o600 });
  const binary = resolve(relocated, 'bin', 'local-whisper-whisper-cpp-worker');
  chmodSync(binary, 0o500);
  verifyDependencies(profile, binary);
  const harness = profile.tools.find((tool) => tool.role === 'network-harness')?.path;
  assert.ok(harness);
  const environment = {
    LANG: 'C',
    LC_ALL: 'C',
    PATH: `${malicious}:/usr/bin:/bin`,
    GGML_BACKEND_PATH: malicious,
    LD_LIBRARY_PATH: malicious,
  };
  const result = spawnSync(harness, ['--user', '--map-root-user', '--net', binary, '--self-test'], {
    cwd: malicious,
    env: environment,
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /LOCAL_WHISPER_CPP_CPU_SELF_TEST_OK/u);
  assert.equal(result.stderr, '');
  assert.deepEqual(allFiles(relocated), allFiles(pack.root));
}

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const mode = arguments_.get('mode');
  const profileId = arguments_.get('profile');
  const contractOnly = arguments_.has('contract-only');
  const includeCancellation = arguments_.has('include-cancellation');
  if (typeof profileId !== 'string') throw new Error('Expected --profile=<profile-id>');
  if (profileId === 'windows-x64-cpu-msvc-19.39-v1') {
    if (contractOnly) throw new Error('Task 24 Windows verification requires the materialized runtime pack');
    if (includeCancellation) throw new Error('Windows CPU cancellation is owned by the native integration suite');
    if (mode !== 'verify') throw new Error('Windows CPU verification supports verify mode only');
    verifyWindowsPack(profileId);
  } else if (profileId === 'linux-x64-cpu-baseline-v1') {
    if (contractOnly) throw new Error('Linux CPU verification cannot be contract-only');
    if (includeCancellation && mode !== 'integration')
      throw new Error('Cancellation flag is valid only for CPU integration');
    if (mode === 'verify') verifyLinux(profileId);
    else if (mode === 'integration') await integration(profileId, includeCancellation);
    else if (mode === 'audit') audit(profileId);
    else throw new Error('Expected --mode=verify, integration, or audit');
  } else {
    throw new Error('Unknown Whisper.cpp CPU profile');
  }
  process.stdout.write(`Local Whisper CPU ${mode} verified for ${profileId}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CPU verification failed'}\n`);
  process.exitCode = 1;
}
