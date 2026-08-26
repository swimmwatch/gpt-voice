import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
const profilePath = resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'tsan-worker-profile.json');
const schemaPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'toolchains',
  'schema',
  'worker-tsan-profile.schema.json',
);
const runnerPath = resolve(workspaceRoot, 'scripts', 'local-whisper', 'native-build', 'native-worker-tsan.mjs');
const cmakePath = resolve(workspaceRoot, 'runtime', 'local-whisper', 'whisper-cpp', 'CMakeLists.txt');
const hardeningPath = resolve(workspaceRoot, 'runtime', 'local-whisper', 'cmake', 'LocalWhisperHardening.cmake');
const proofPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'whisper-cpp',
  'tests',
  'worker_tsan_race_proof.cpp',
);

test('worker TSan profile pins the Linux-only isolated instrumentation and full concurrency matrix', () => {
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(profile), true, JSON.stringify(validate.errors));
  assert.equal(profile.cmakeCache.LOCAL_WHISPER_ENABLE_SANITIZERS, 'OFF');
  assert.equal(profile.cmakeCache.LOCAL_WHISPER_ENABLE_THREAD_SANITIZER, 'ON');
  assert.deepEqual(profile.suite.requiredTests, [
    'Sha256Dispatch.ConcurrentFirstUse',
    'WorkerApplication.ControlClosureStopsAndJoinsBlockedInference',
    'WorkerApplication.CooperativeCancellationEmitsNoTranscriptOrLateSuccess',
    'WorkerApplication.ImmediateAndDelayedInferenceFailuresEmitTypedFailureWithoutAnotherControlFrame',
    'WorkerApplication.InvalidCancellationStopsAndJoinsBlockedInference',
    'WorkerApplication.RejectsDuplicateWarmupAfterOneSuccessfulTransition',
    'WorkerApplication.RejectsInconsistentResidencyThreadIdentityBeforeModelLoad',
    'WorkerApplication.RejectsMalformedAudioBeforeInference',
    'WorkerApplication.RejectsMalformedSettingsBeforeReadingAudioOrInference',
    'WorkerApplication.RejectsTranscriptionBeforeExplicitWarmup',
    'WorkerApplication.ReleasesMaximumWavStorageBeforeInferenceAndPcmBeforeNextRequest',
    'WorkerApplication.ReleasesWavStorageWhenPcmConversionFailsBeforeCleanRetry',
    'WorkerApplication.ReplacesMalformedCommittedTranscriptTextAndKeepsWorkerWarmed',
    'WorkerApplication.RunsLoadWarmupTranscriptionUnloadAndShutdownStateMachine',
    'WorkerApplication.TranscriptCommitBeforeCancellationEmitsTranscriptAndCancelTooLate',
    'WorkerApplication.WarmupFailureUnloadsAndReturnsTypedFailureBeforeCleanRetry',
  ]);
});

test('worker TSan configuration fails closed for mixed sanitizers and the proof has a deterministic race', () => {
  const cmake = readFileSync(cmakePath, 'utf8');
  const hardening = readFileSync(hardeningPath, 'utf8');
  const proof = readFileSync(proofPath, 'utf8');

  assert.match(cmake, /LOCAL_WHISPER_ENABLE_THREAD_SANITIZER/u);
  assert.match(cmake, /ThreadSanitizer must not be combined with the ASan\/UBSan graph/u);
  assert.match(cmake, /local_whisper_worker_tsan_race_proof/u);
  assert.match(hardening, /-fsanitize=thread/u);
  assert.match(proof, /intentionally_racy_counter/u);
  assert.match(proof, /std::thread first/u);
  assert.match(proof, /std::thread second/u);
});

test('worker TSan runner bounds and sanitizes every proof and suite outcome', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /killSignal: 'SIGKILL'/u);
  assert.match(runner, /MAXIMUM_REPORT_BYTES/u);
  assert.match(runner, /Worker TSan report exceeded its bound/u);
  assert.match(runner, /Worker TSan synthetic race unexpectedly passed/u);
  assert.match(runner, /Worker TSan synthetic race report is missing or malformed/u);
  assert.match(runner, /Worker TSan concurrency matrix does not match its profile/u);
  assert.match(runner, /local_whisper_sha256_dispatch_concurrency_test/u);
  assert.match(runner, /Worker TSan finding:/u);
  assert.match(runner, /Worker TSan profile mixes incompatible instrumentation/u);
  assert.match(runner, /quiet: true/u);
  assert.doesNotMatch(runner, /console\.(?:log|error)/u);
});
