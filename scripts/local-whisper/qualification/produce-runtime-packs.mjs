import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import { stageCpuPack } from '../stage-whisper-cpp-cpu.mjs';
import { stageCudaPack } from '../stage-whisper-cpp-cuda.mjs';
import { buildTargets, configureBuild, requireVerifiedInputs, workspaceRoot } from '../whisper-cpp-build-core.mjs';
import { canonicalDigest, canonicalJson } from '../source-import/native-source-core.mjs';
import {
  DeterministicRuntimePackProducer,
  assertReproducibleRuntimePacks,
} from './DeterministicRuntimePackProducer.ts';

const OUTPUT_ROOT = resolve(workspaceRoot, '.cache', 'local-whisper', 'qualification', 'runtime-packs');

function profileFor(backend) {
  if (backend === 'cpu') return 'linux-x64-cpu-baseline-v1';
  if (backend === 'cuda') return 'linux-x64-cuda-12.8.1-sm120a-v1';
  throw new Error('Expected --backend=cpu or --backend=cuda');
}

function assertOwnedOutput(path) {
  const child = relative(OUTPUT_ROOT, path);
  if (child === '' || child.startsWith('..') || isAbsolute(child)) {
    throw new Error('Runtime-pack output escaped its private qualification root');
  }
}

function resetOutput(path) {
  assertOwnedOutput(path);
  rmSync(path, { force: true, recursive: true });
  mkdirSync(path, { mode: 0o700, recursive: true });
}

function buildAndStage(profileId, backend, repetition) {
  const configured = configureBuild(profileId, {
    engine: true,
    networkDenied: true,
    rootTag: `task19-runtime-${backend}-${repetition}`,
    tests: false,
  });
  buildTargets(configured, ['local-whisper-whisper-cpp-worker']);
  return backend === 'cpu'
    ? stageCpuPack(profileId, configured.buildRoot)
    : stageCudaPack(profileId, configured.buildRoot);
}

async function produce(backend) {
  const profileId = profileFor(backend);
  requireVerifiedInputs(profileId);
  const backendRoot = resolve(OUTPUT_ROOT, backend);
  resetOutput(backendRoot);
  const firstOutput = resolve(backendRoot, 'build-a');
  const secondOutput = resolve(backendRoot, 'build-b');
  const producer = new DeterministicRuntimePackProducer();

  const firstStage = buildAndStage(profileId, backend, 'a');
  const first = await producer.produce({
    stageRoot: firstStage,
    outputDirectory: firstOutput,
    profileId,
  });
  const secondStage = buildAndStage(profileId, backend, 'b');
  const second = await producer.produce({
    stageRoot: secondStage,
    outputDirectory: secondOutput,
    profileId,
  });
  await assertReproducibleRuntimePacks(first, second, firstOutput, secondOutput);
  assert.equal(first.archive.signatureInputSha256, first.archive.sha256);

  const reproducibility = {
    schemaVersion: 1,
    specificationRevision: 10,
    backend,
    profileId,
    cleanRootCount: 2,
    networkIsolation: 'user-network-namespace',
    archiveSha256: first.archive.sha256,
    packRecordDigest: canonicalDigest(first),
    reproducible: true,
  };
  const record = {
    ...reproducibility,
    reproducibilityDigest: canonicalDigest(reproducibility),
  };
  writeFileSync(resolve(backendRoot, 'runtime-reproducibility.json'), canonicalJson(record), {
    mode: 0o400,
  });
  process.stdout.write(
    `${JSON.stringify({
      backend,
      archiveSha256: first.archive.sha256,
      reproducibilityDigest: record.reproducibilityDigest,
    })}\n`,
  );
}

const backendArgument = process.argv.find((value) => value.startsWith('--backend='));
await produce(backendArgument?.slice('--backend='.length));
