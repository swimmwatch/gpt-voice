import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { readJson, sha256 } from './source-import/native-source-core.mjs';
import { CUDA_PROFILE, verifyLinuxCudaPack } from './verify-whisper-cpp-device.mjs';
import {
  approvedMediumModel,
  canonicalSilence,
  deviceAuthorityBytes,
  mediumModelIdentity,
  modelBindingBytes,
  modelTransferBytes,
  sha256File,
  transcriptionOptions,
  WhisperCppWorkerProcess,
} from './whisper-cpp-integration-core.mjs';
import { parseArguments, patchLockPath, requireProfile, taskCacheRoot } from './whisper-cpp-build-core.mjs';

const CONFIGURATION_EPOCH = 11n;
const TOPOLOGY_GENERATION = 19n;
const CUDA_BACKEND_ID = 'cuda';
const ENGINE_ID = 'whisperCpp';
const LIFECYCLE_REPETITIONS = 3;
const NVIDIA_SMI = '/usr/bin/nvidia-smi';

/** Independently constructs the language-neutral device-proof SHA-256 preimage. */
class CanonicalDigest {
  constructor(domain) {
    this.chunks = [Buffer.from(domain, 'binary')];
  }

  raw(value) {
    this.chunks.push(Buffer.from(value));
    return this;
  }

  u16(value) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffff);
    const encoded = Buffer.alloc(2);
    encoded.writeUInt16BE(value);
    return this.raw(encoded);
  }

  u64(value) {
    const encoded = Buffer.alloc(8);
    encoded.writeBigUInt64BE(BigInt(value));
    return this.raw(encoded);
  }

  field(value) {
    const encoded = Buffer.from(value, 'utf8');
    assert.ok(encoded.length > 0 && encoded.length <= 256);
    return this.u16(encoded.length).raw(encoded);
  }

  finish() {
    const digest = createHash('sha256');
    for (const chunk of this.chunks) digest.update(chunk);
    return digest.digest('hex');
  }
}

function requireHexDigest(value) {
  assert.match(value, /^[a-f0-9]{64}$/u);
  return Buffer.from(value, 'hex');
}

function registryFingerprint(runtimeBuildDigest, nativeIdentity) {
  return new CanonicalDigest('LWREG1\0')
    .field(ENGINE_ID)
    .raw(requireHexDigest(runtimeBuildDigest))
    .field(CUDA_BACKEND_ID)
    .u16(1)
    .u16(0)
    .raw(Buffer.of(1))
    .field(CUDA_BACKEND_ID)
    .field(nativeIdentity)
    .finish();
}

function deviceProof(domain, input) {
  const weightBytes = BigInt(input.selectedDeviceModelWeightBytes);
  assert.equal(domain === 'probe' ? weightBytes === 0n : weightBytes > 0n, true);
  return new CanonicalDigest(domain === 'probe' ? 'LWDEV1P\0' : 'LWDEV1L\0')
    .raw(Buffer.from(input.authorityId, 'base64url'))
    .raw(Buffer.from(input.challenge, 'base64url'))
    .u64(CONFIGURATION_EPOCH)
    .u64(TOPOLOGY_GENERATION)
    .field(ENGINE_ID)
    .raw(requireHexDigest(input.runtimeBuildDigest))
    .field(CUDA_BACKEND_ID)
    .raw(requireHexDigest(input.registryFingerprint))
    .u16(0)
    .u16(input.activatedOrdinal)
    .field(input.actualNativeIdentity)
    .field(input.primaryExecutionNativeIdentity)
    .u64(weightBytes)
    .finish();
}

function canonicalCudaIdentity(nvidiaIdentity) {
  const identity = nvidiaIdentity.toLowerCase();
  assert.match(identity, /^[a-f0-9]{8}:[a-f0-9]{2}:[a-f0-9]{2}\.[0-7]$/u);
  assert.equal(identity.startsWith('0000'), true, 'Qualified CUDA identity exceeds four-domain API');
  return identity.slice(4);
}

function gpuSnapshot() {
  const result = spawnSync(
    NVIDIA_SMI,
    ['--query-gpu=index,name,pci.bus_id,memory.total,memory.used,driver_version', '--format=csv,noheader,nounits'],
    { encoding: 'utf8', shell: false },
  );
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1, 'RTX 5070 Ti Laptop evidence requires one visible CUDA GPU');
  const fields = lines[0].split(',').map((value) => value.trim());
  assert.equal(fields.length, 6);
  const [index, name, pciBusId, totalMiB, usedMiB, driverVersion] = fields;
  assert.equal(index, '0');
  assert.equal(name, 'NVIDIA GeForce RTX 5070 Ti Laptop GPU');
  const driverSuffix = driverVersion.slice('595.84'.length);
  assert.equal(driverVersion.startsWith('595.84'), true);
  assert.equal(
    driverSuffix === '' ||
      (driverSuffix.startsWith('.') &&
        [...driverSuffix.slice(1)].every((character) => character >= '0' && character <= '9')),
    true,
  );
  const memoryTotalMiB = Number(totalMiB);
  const memoryUsedMiB = Number(usedMiB);
  assert.ok(Number.isInteger(memoryTotalMiB) && memoryTotalMiB > 0);
  assert.ok(Number.isInteger(memoryUsedMiB) && memoryUsedMiB >= 0);
  return {
    driverVersion,
    memoryTotalMiB,
    memoryUsedMiB,
    name,
    nativeIdentity: canonicalCudaIdentity(pciBusId),
  };
}

function publicMemoryObservation(snapshot) {
  return {
    memoryTotalMiB: snapshot.memoryTotalMiB,
    memoryUsedMiB: snapshot.memoryUsedMiB,
  };
}

async function probeIntegration(binary, runtimeBuildDigest, device) {
  const authorityBytes = Buffer.alloc(16, 0x11);
  const authorityId = authorityBytes.toString('base64url');
  const challenge = Buffer.alloc(32, 0x21).toString('base64url');
  const fingerprint = registryFingerprint(runtimeBuildDigest, device.nativeIdentity);
  const worker = WhisperCppWorkerProcess.probe(
    binary,
    deviceAuthorityBytes(authorityBytes, CONFIGURATION_EPOCH, TOPOLOGY_GENERATION),
  );
  try {
    worker.sendControl({ type: 'hello', protocolVersion: 1 });
    const hello = await worker.readControl();
    assert.equal(hello.type, 'helloAck');
    assert.equal(hello.backend, CUDA_BACKEND_ID);
    assert.equal(hello.runtimeBuildDigest, runtimeBuildDigest);
    worker.sendControl({
      type: 'probe',
      protocolVersion: 1,
      requestId: 'probe-cuda-task11',
      authorityId,
      deviceBinding: { kind: 'gpuIndex', index: 0 },
      probeChallenge: challenge,
      registryFingerprint: fingerprint,
    });
    const probed = await worker.readControl();
    assert.equal(probed.type, 'probed');
    assert.deepEqual(probed.deviceBinding, { kind: 'gpuIndex', index: 0 });
    assert.equal(probed.activatedOrdinal, 0);
    assert.equal(probed.actualNativeIdentity, device.nativeIdentity);
    assert.equal(probed.primaryExecutionNativeIdentity, device.nativeIdentity);
    assert.equal(probed.registryFingerprint, fingerprint);
    const expectedProof = deviceProof('probe', {
      activatedOrdinal: probed.activatedOrdinal,
      actualNativeIdentity: probed.actualNativeIdentity,
      authorityId,
      challenge,
      primaryExecutionNativeIdentity: probed.primaryExecutionNativeIdentity,
      registryFingerprint: fingerprint,
      runtimeBuildDigest,
      selectedDeviceModelWeightBytes: 0n,
    });
    assert.equal(probed.probeProof, expectedProof);
    worker.closeInput();
    assert.deepEqual(await worker.waitForExit(), { code: 0, signal: null });
    return { proof: expectedProof, registryFingerprint: fingerprint };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

async function loadCycle(binary, runtimeBuildDigest, device, fingerprint, repetition) {
  const operationNonce = Buffer.alloc(16, 0x31 + repetition);
  const authorityId = operationNonce.toString('base64url');
  const challenge = Buffer.alloc(32, 0x41 + repetition).toString('base64url');
  const binding = modelBindingBytes(operationNonce);
  const worker = WhisperCppWorkerProcess.load(
    binary,
    approvedMediumModel.path,
    deviceAuthorityBytes(operationNonce, CONFIGURATION_EPOCH, TOPOLOGY_GENERATION),
  );
  try {
    worker.write(modelTransferBytes(binding));
    await worker.readModelAuthorityAcknowledgment(binding);
    worker.write(Buffer.from([1]));
    worker.sendControl({ type: 'hello', protocolVersion: 1 });
    const hello = await worker.readControl();
    assert.equal(hello.type, 'helloAck');
    assert.equal(hello.backend, CUDA_BACKEND_ID);
    assert.equal(hello.runtimeBuildDigest, runtimeBuildDigest);
    const model = mediumModelIdentity();
    const residency = {
      engine: ENGINE_ID,
      runtimePackRevision: 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
      target: 'gpu',
      backend: CUDA_BACKEND_ID,
      deviceId: 'task11-private-device-0',
      model,
      precision: null,
      resolvedCpuThreads: null,
    };
    worker.sendControl({
      type: 'load',
      protocolVersion: 1,
      requestId: `load-cuda-task11-${repetition}`,
      authorityId,
      deviceBinding: { kind: 'gpuIndex', index: 0 },
      loadChallenge: challenge,
      registryFingerprint: fingerprint,
      residency,
    });
    const loaded = await worker.readControl();
    assert.equal(
      loaded.type,
      'loaded',
      `CUDA load failed: ${JSON.stringify({ code: loaded.code, requestId: loaded.requestId, type: loaded.type })}`,
    );
    assert.equal(loaded.modelSha256, approvedMediumModel.sha256);
    assert.equal(loaded.effectiveBackend, CUDA_BACKEND_ID);
    assert.equal(loaded.effectivePrecision, null);
    assert.equal(loaded.primaryStateOwnership, 'worker');
    assert.deepEqual(loaded.model, model);
    assert.equal(loaded.activatedOrdinal, 0);
    assert.equal(loaded.actualNativeIdentity, device.nativeIdentity);
    assert.equal(loaded.primaryExecutionNativeIdentity, device.nativeIdentity);
    assert.equal(loaded.registryFingerprint, fingerprint);
    assert.ok(Number.isSafeInteger(loaded.selectedDeviceModelWeightBytes) && loaded.selectedDeviceModelWeightBytes > 0);
    const expectedProof = deviceProof('load', {
      activatedOrdinal: loaded.activatedOrdinal,
      actualNativeIdentity: loaded.actualNativeIdentity,
      authorityId,
      challenge,
      primaryExecutionNativeIdentity: loaded.primaryExecutionNativeIdentity,
      registryFingerprint: fingerprint,
      runtimeBuildDigest,
      selectedDeviceModelWeightBytes: BigInt(loaded.selectedDeviceModelWeightBytes),
    });
    assert.equal(loaded.loadProof, expectedProof);
    worker.sendControl({
      type: 'warmup',
      protocolVersion: 1,
      requestId: `warm-cuda-task11-${repetition}`,
    });
    assert.equal((await worker.readControl()).type, 'warmed');
    const afterLoad = gpuSnapshot();
    assert.equal(afterLoad.nativeIdentity, device.nativeIdentity);

    const cancellationRun = repetition === LIFECYCLE_REPETITIONS;
    const audio = canonicalSilence(cancellationRun ? 480_000 : 16_000);
    const transcriptionId = `tx-cuda-task11-${repetition}`;
    worker.sendControl({
      type: 'transcribe',
      protocolVersion: 1,
      requestId: transcriptionId,
      settingsEpoch: 9,
      audioByteLength: audio.length,
      options: transcriptionOptions(),
    });
    worker.sendAudio(transcriptionId, audio);
    if (cancellationRun) {
      worker.sendControl({
        type: 'cancel',
        protocolVersion: 1,
        requestId: `cancel-cuda-task11-${repetition}`,
        targetRequestId: transcriptionId,
      });
      const cancelled = await worker.readControl();
      assert.equal(cancelled.type, 'cancelled');
      assert.equal(cancelled.targetRequestId, transcriptionId);
    } else {
      worker.sendControl({
        type: 'warmup',
        protocolVersion: 1,
        requestId: `post-tx-warm-cuda-task11-${repetition}`,
      });
      const transcript = await worker.readControl();
      assert.equal(transcript.type, 'transcript');
      assert.equal(typeof transcript.text, 'string');
      assert.equal((await worker.readControl()).type, 'warmed');
    }
    worker.sendControl({
      type: 'unload',
      protocolVersion: 1,
      requestId: `unload-cuda-task11-${repetition}`,
    });
    assert.equal((await worker.readControl()).type, 'unloaded');
    worker.closeInput();
    assert.deepEqual(await worker.waitForExit(), { code: 0, signal: null });
    const afterExit = gpuSnapshot();
    assert.equal(afterExit.nativeIdentity, device.nativeIdentity);
    return {
      cancellationObserved: cancellationRun,
      loadProof: expectedProof,
      memoryAfterExit: publicMemoryObservation(afterExit),
      memoryAfterLoad: publicMemoryObservation(afterLoad),
      selectedDeviceModelWeightBytes: loaded.selectedDeviceModelWeightBytes,
      transcriptionObserved: !cancellationRun,
    };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

function privateIdentityDigest(identity) {
  return createHash('sha256').update(identity, 'utf8').digest('hex');
}

function writeEvidence(pack, profile, device, initialMemory, probe, repetitions) {
  const manifestPath = resolve(pack.root, 'runtime-manifest.json');
  const provenancePath = resolve(pack.root, 'provenance.json');
  const manifest = readJson(manifestPath);
  const provenance = readJson(provenancePath);
  const patchLock = readJson(patchLockPath);
  const evidence = {
    schemaId: 'local-whisper-cuda-integration-evidence-v1',
    profileId: CUDA_PROFILE,
    qualificationScope: 'exact-available-linux-laptop-only',
    hardware: {
      name: device.name,
      deviceIdentitySha256: privateIdentityDigest(device.nativeIdentity),
      driverVersion: device.driverVersion,
      initialMemory: publicMemoryObservation(initialMemory),
    },
    toolchain: {
      cudaToolkit: '12.8.1',
      cudaCompiler: profile.tools.find((tool) => tool.role === 'cuda-compiler')?.version,
      cxxCompiler: profile.tools.find((tool) => tool.role === 'cxx-compiler')?.version,
      minimumDriver: profile.minimumDriver,
      profileEvidenceDigest: profile.evidenceDigest,
      requestedCudaArchitectures: manifest.requestedCudaArchitectures,
      effectiveCudaArchitectures: manifest.effectiveCudaArchitectures,
    },
    runtime: {
      runtimeBuildDigest: manifest.runtimeBuildDigest,
      executableSha256: sha256(readFileSync(pack.binary)),
      manifestSha256: sha256(readFileSync(manifestPath)),
      provenanceSha256: sha256(readFileSync(provenancePath)),
      stagedRuntimeDependencies: manifest.stagedRuntimeDependencies,
    },
    source: {
      sourceLockId: provenance.sourceLockId,
      originalManifestSha256: provenance.originalManifestSha256,
      patchLockId: patchLock.lockId,
      patches: patchLock.patches.map(({ patchId, sha256: patchSha256 }) => ({
        patchId,
        sha256: patchSha256,
      })),
      patchedManifestSha256: patchLock.finalManifestSha256,
    },
    model: {
      artifactIncludedInPack: false,
      license: approvedMediumModel.license,
      origin: approvedMediumModel.origin,
      sha256: approvedMediumModel.sha256,
      sizeBytes: approvedMediumModel.sizeBytes,
    },
    proof: {
      independentImplementation: 'node-crypto-canonical-writer-v1',
      registryFingerprint: probe.registryFingerprint,
      probeProof: probe.proof,
      probeMatched: true,
    },
    repetitions,
  };
  const evidenceRoot = resolve(taskCacheRoot, 'evidence');
  mkdirSync(evidenceRoot, { mode: 0o700, recursive: true });
  const path = resolve(evidenceRoot, `${CUDA_PROFILE}.integration.json`);
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  return path;
}

async function integration() {
  const profile = requireProfile(CUDA_PROFILE);
  const pack = verifyLinuxCudaPack();
  assert.equal(approvedMediumModel.license, 'MIT');
  assert.match(approvedMediumModel.origin, /^ggerganov\/whisper\.cpp@/u);
  const modelMetadata = statSync(approvedMediumModel.path);
  assert.equal(modelMetadata.size, approvedMediumModel.sizeBytes);
  assert.equal(sha256File(approvedMediumModel.path), approvedMediumModel.sha256);
  const manifest = readJson(resolve(pack.root, 'runtime-manifest.json'));
  const initialMemory = gpuSnapshot();
  const probe = await probeIntegration(pack.binary, manifest.runtimeBuildDigest, initialMemory);
  const repetitions = [];
  for (let repetition = 1; repetition <= LIFECYCLE_REPETITIONS; repetition += 1) {
    repetitions.push(
      await loadCycle(pack.binary, manifest.runtimeBuildDigest, initialMemory, probe.registryFingerprint, repetition),
    );
  }
  const weightBytes = new Set(repetitions.map((entry) => entry.selectedDeviceModelWeightBytes));
  assert.equal(weightBytes.size, 1, 'Selected-device model weight evidence changed across loads');
  assert.equal(repetitions.filter((entry) => entry.transcriptionObserved).length, 2);
  assert.equal(repetitions.filter((entry) => entry.cancellationObserved).length, 1);
  return writeEvidence(pack, profile, initialMemory, initialMemory, probe, repetitions);
}

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  assert.equal(arguments_.get('profile'), CUDA_PROFILE);
  assert.equal(arguments_.size, 1, 'CUDA integration accepts only its exact profile');
  const evidencePath = await integration();
  process.stdout.write(`Local Whisper CUDA integration verified; private evidence: ${evidencePath}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'CUDA integration failed'}\n`);
  process.exitCode = 1;
}
