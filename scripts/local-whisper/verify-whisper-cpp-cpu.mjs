import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  cpSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import { cpuStageRoot } from './stage-whisper-cpp-cpu.mjs';
import { canonicalDigest, sha256 } from './source-import/native-source-core.mjs';
import { verifyToolchainContract } from './native-build/native-toolchain-core.mjs';
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
  whisperCppRoot,
  workspaceRoot,
} from './whisper-cpp-build-core.mjs';

const approvedModel = Object.freeze({
  path: '/home/dmitry-vasiliev/.cache/openwhispr/whisper-models/ggml-medium.bin',
  sizeBytes: 1_533_763_059,
  sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
  license: 'MIT',
  origin: 'ggerganov/whisper.cpp@5359861c739e955e79d9a303bcbc70fb988958b1',
});

function sha256File(path) {
  const descriptor = openSync(path, 'r');
  const digest = createHash('sha256');
  const buffer = Buffer.alloc(64 * 1024);
  try {
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) return digest.digest('hex');
      digest.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(descriptor);
  }
}

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
  assert.match(engine, /parameters\.use_gpu = false/u);
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
  assert.doesNotMatch(linuxJob, /windows-x64-cpu-candidate-task19-v1/u);
  runSelfTest(pack.binary);
}

function verifyWindowsContract(profileId, contractOnly) {
  assert.equal(contractOnly, true, 'Windows Task 10 verification is contract-only');
  const profile = requireProfile(profileId);
  verifyToolchainContract(profile, { allowCandidate: true, contractOnly: true });
  const authority = readFileSync(resolve(whisperCppRoot, 'platform', 'windows', 'model_authority_windows.cpp'), 'utf8');
  const channel = readFileSync(resolve(whisperCppRoot, 'platform', 'windows', 'worker_protocol_windows.cpp'), 'utf8');
  for (const marker of [
    '#include <algorithm>',
    'GetFileInformationByHandleEx',
    'GetFileSizeEx',
    'FILE_ACCESS_INFO',
    'OVERLAPPED',
    'ReadFile',
    'CloseHandle',
    'windows_worker_handle',
  ]) {
    assert.ok(authority.includes(marker), `Windows model reader contract: ${marker}`);
  }
  for (const marker of ['ReadFile', 'WriteFile', 'decode_frame', 'validate_bounded_json'])
    assert.ok(channel.includes(marker), `Windows worker protocol contract: ${marker}`);
  const workflow = readFileSync(resolve(workspaceRoot, '.github', 'workflows', 'pr-checks.yml'), 'utf8');
  const windowsJob = workflow.slice(workflow.indexOf('native-quality-windows:'), workflow.indexOf('\n  quality:'));
  assert.match(windowsJob, /runs-on: windows-latest/u);
  assert.match(windowsJob, /windows-x64-cpu-candidate-task19-v1/u);
  assert.match(windowsJob, /--contract-only/u);
  assert.doesNotMatch(windowsJob, /linux-x64-cpu-baseline-v1/u);
}

/** Reads exact byte counts from the worker's framed output stream. */
class BufferedReader {
  constructor(stream) {
    this.iterator = stream[Symbol.asyncIterator]();
    this.buffer = Buffer.alloc(0);
  }

  async exact(size) {
    while (this.buffer.length < size) {
      const next = await this.iterator.next();
      if (next.done) throw new Error('Worker output ended early');
      this.buffer = Buffer.concat([this.buffer, next.value]);
    }
    const value = this.buffer.subarray(0, size);
    this.buffer = this.buffer.subarray(size);
    return value;
  }
}

function controlFrame(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const frame = Buffer.alloc(5 + body.length);
  frame.writeUInt32BE(body.length, 0);
  frame[4] = 1;
  body.copy(frame, 5);
  return frame;
}

function audioFrame(requestId, wav) {
  const request = Buffer.from(requestId, 'utf8');
  const body = Buffer.alloc(8 + request.length + wav.length);
  body[0] = 1;
  body[1] = 1;
  body.writeUInt32BE(0, 2);
  body.writeUInt16BE(request.length, 6);
  request.copy(body, 8);
  wav.copy(body, 8 + request.length);
  const frame = Buffer.alloc(5 + body.length);
  frame.writeUInt32BE(body.length, 0);
  frame[4] = 2;
  body.copy(frame, 5);
  return frame;
}

async function readControl(reader) {
  const header = await reader.exact(5);
  assert.equal(header[4], 1);
  const body = await reader.exact(header.readUInt32BE(0));
  return JSON.parse(body.toString('utf8'));
}

function bindingBytes(operationNonce) {
  const binding = Buffer.alloc(226);
  let offset = 0;
  operationNonce.copy(binding, offset);
  offset += 16;
  binding.fill(2, offset, offset + 16);
  offset += 16;
  binding.writeBigUInt64BE(7n, offset);
  offset += 8;
  binding.fill(3, offset, offset + 32);
  offset += 32;
  binding.fill(4, offset, offset + 32);
  offset += 32;
  binding.writeBigUInt64BE(BigInt(approvedModel.sizeBytes), offset);
  offset += 8;
  Buffer.from(approvedModel.sha256, 'hex').copy(binding, offset);
  offset += 32;
  binding[offset++] = 1;
  binding[offset++] = 3;
  binding.writeBigUInt64BE(BigInt(process.pid), offset);
  offset += 8;
  binding.writeBigUInt64BE(BigInt(process.pid), offset);
  offset += 8;
  binding.fill(6, offset, offset + 32);
  offset += 32;
  binding.fill(7, offset, offset + 32);
  assert.equal(offset + 32, binding.length);
  return binding;
}

function transferBytes(binding) {
  const transfer = Buffer.alloc(244);
  Buffer.from('LWA' + 'T1\0\0\0', 'binary').copy(transfer, 0);
  binding.copy(transfer, 8);
  transfer[234] = 2;
  transfer[235] = 3;
  transfer.writeBigUInt64BE(3n, 236);
  return transfer;
}

function canonicalSilence(sampleCount = 1_600) {
  const wav = Buffer.alloc(44 + sampleCount * 2);
  for (const [offset, text] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ])
    wav.write(text, offset, 'ascii');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(32_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.writeUInt32LE(sampleCount * 2, 40);
  return wav;
}

async function waitForExit(child) {
  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function probeIntegration(binary) {
  const child = spawn(binary, ['--probe'], { stdio: ['pipe', 'pipe', 'ignore'] });
  const reader = new BufferedReader(child.stdout);
  child.stdin.write(controlFrame({ type: 'hello', protocolVersion: 1 }));
  assert.equal((await readControl(reader)).type, 'helloAck');
  child.stdin.write(
    controlFrame({
      type: 'probe',
      protocolVersion: 1,
      requestId: 'probe-cpu-task10',
      authorityId: Buffer.alloc(16, 9).toString('base64url'),
      deviceBinding: { kind: 'cpu' },
    }),
  );
  const probed = await readControl(reader);
  assert.equal(probed.type, 'probed');
  assert.deepEqual(probed.deviceBinding, { kind: 'cpu' });
  child.stdin.end();
  assert.deepEqual(await waitForExit(child), { code: 0, signal: null });
}

async function loadIntegration(binary) {
  assert.equal(approvedModel.license, 'MIT');
  assert.match(approvedModel.origin, /^ggerganov\/whisper\.cpp@/u);
  const metadata = statSync(approvedModel.path);
  assert.equal(metadata.size, approvedModel.sizeBytes);
  assert.equal(sha256File(approvedModel.path), approvedModel.sha256);
  const descriptor = openSync(approvedModel.path, 'r');
  const operationNonce = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
  const binding = bindingBytes(operationNonce);
  const child = spawn(binary, ['--load'], { stdio: ['pipe', 'pipe', 'ignore', descriptor] });
  closeSync(descriptor);
  const reader = new BufferedReader(child.stdout);
  try {
    child.stdin.write(transferBytes(binding));
    const acknowledgment = await reader.exact(284);
    assert.equal(acknowledgment.subarray(0, 8).toString('binary'), 'LWAA1\0\0\0');
    assert.deepEqual(acknowledgment.subarray(8, 234), binding);
    assert.equal(acknowledgment[234], 2);
    assert.equal(acknowledgment[235], 3);
    assert.equal(acknowledgment.readBigUInt64BE(236), 3n);
    assert.equal(acknowledgment.readBigUInt64BE(244), BigInt(child.pid));
    child.stdin.write(Buffer.from([1]));
    child.stdin.write(controlFrame({ type: 'hello', protocolVersion: 1 }));
    const hello = await readControl(reader);
    assert.equal(hello.type, 'helloAck');
    assert.equal(hello.backend, 'cpu');
    const authorityId = operationNonce.toString('base64url');
    const model = {
      engine: 'whisperCpp',
      logicalModel: 'medium',
      sourceCheckpointRevision: 'whisper-cpp-medium-fixture-5359861',
      artifactRevision: 'ggml-medium-bin-approved-task10',
      nativeFormat: 'ggml',
      variant: 'full',
    };
    const residency = {
      engine: 'whisperCpp',
      runtimePackRevision: 'whisper-cpp-linux-x64-cpu-baseline-v1',
      target: 'cpu',
      backend: 'cpu',
      deviceId: null,
      model,
      precision: null,
      resolvedCpuThreads: 2,
    };
    child.stdin.write(
      controlFrame({
        type: 'load',
        protocolVersion: 1,
        requestId: 'load-medium-task10',
        authorityId,
        deviceBinding: { kind: 'cpu' },
        residency,
      }),
    );
    const loaded = await readControl(reader);
    assert.equal(loaded.type, 'loaded');
    assert.equal(loaded.modelSha256, approvedModel.sha256);
    assert.equal(loaded.effectiveBackend, 'cpu');
    assert.equal(loaded.primaryStateOwnership, 'worker');
    child.stdin.write(controlFrame({ type: 'warmup', protocolVersion: 1, requestId: 'warm-task10' }));
    assert.equal((await readControl(reader)).type, 'warmed');
    const wav = canonicalSilence();
    child.stdin.write(
      controlFrame({
        type: 'transcribe',
        protocolVersion: 1,
        requestId: 'tx-task10',
        settingsEpoch: 9,
        audioByteLength: wav.length,
        options: {
          language: 'en',
          initialPrompt: '',
          temperatureHundredths: 0,
          strategy: 'greedy',
          candidateCount: null,
        },
      }),
    );
    child.stdin.write(audioFrame('tx-task10', wav));
    const transcript = await readControl(reader);
    assert.equal(transcript.type, 'transcript');
    assert.equal(typeof transcript.text, 'string');
    child.stdin.write(controlFrame({ type: 'unload', protocolVersion: 1, requestId: 'unload-task10' }));
    assert.equal((await readControl(reader)).type, 'unloaded');
    child.stdin.end();
    assert.deepEqual(await waitForExit(child), { code: 0, signal: null });
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
}

async function integration(profileId) {
  const pack = verifyStage(profileId);
  await probeIntegration(pack.binary);
  await loadIntegration(pack.binary);
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
  if (typeof profileId !== 'string') throw new Error('Expected --profile=<profile-id>');
  if (profileId === 'windows-x64-cpu-candidate-task19-v1') {
    if (mode !== 'verify') throw new Error('Windows contract supports verify mode only');
    verifyWindowsContract(profileId, contractOnly);
  } else if (profileId === 'linux-x64-cpu-baseline-v1') {
    if (contractOnly) throw new Error('Linux CPU verification cannot be contract-only');
    if (mode === 'verify') verifyLinux(profileId);
    else if (mode === 'integration') await integration(profileId);
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
