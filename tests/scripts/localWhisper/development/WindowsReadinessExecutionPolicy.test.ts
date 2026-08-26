import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const workspaceRoot = resolve(__dirname, '..', '..', '..', '..');
const readiness = readFileSync(resolve(workspaceRoot, 'scripts/local-whisper/verify-windows-readiness.ts'), 'utf8');
const applicationSmoke = readFileSync(
  resolve(workspaceRoot, 'scripts/local-whisper/development/verify-windows-application-smoke.ts'),
  'utf8',
);
const filesystemVerification = readFileSync(
  resolve(workspaceRoot, 'scripts/local-whisper/verify-filesystem.ts'),
  'utf8',
);
const windowsRuntimeIntegration = readFileSync(
  resolve(workspaceRoot, 'scripts/local-whisper/verify-whisper-cpp-windows-integration.ts'),
  'utf8',
);
const runtimePackAudit = readFileSync(
  resolve(workspaceRoot, 'scripts/local-whisper/verify-whisper-cpp-pack.mjs'),
  'utf8',
);
const windowsUnpackedVerification = readFileSync(
  resolve(workspaceRoot, 'scripts/local-whisper/packaging/verify-windows-unpacked.mjs'),
  'utf8',
);
const runtimePackProduction = readFileSync(
  resolve(workspaceRoot, 'scripts/local-whisper/qualification/produce-runtime-packs.mjs'),
  'utf8',
);
const cudaRuntimePackStaging = readFileSync(
  resolve(workspaceRoot, 'scripts/local-whisper/stage-whisper-cpp-cuda.mjs'),
  'utf8',
);

test('Windows readiness executes MSVC 19.51 CPU and real MSVC 19.39 CUDA evidence', () => {
  assert.match(readiness, /windows-x64-cpu-msvc-19\.51-v1[\s\S]+?--contract-only/u);
  assert.match(readiness, /windows-x64-cuda-12\.8\.1-sm120a-msvc-19\.39-v1[\s\S]+?--contract-only/u);
  assert.match(readiness, /produce:local-whisper:windows-runtime-pack:cpu/u);
  assert.match(readiness, /test:local-whisper:whisper-cpp-cpu-integration/u);
  assert.match(readiness, /build:local-whisper:whisper-cpp-cuda/u);
  assert.match(readiness, /produce:local-whisper:windows-runtime-pack:cuda/u);
  assert.match(readiness, /test:local-whisper:whisper-cpp-cuda-integration/u);
  assert.match(readiness, /test:local-whisper:windows-application-smoke/u);
  assert.match(applicationSmoke, /CUDA_RUNTIME_REVISION/u);
  assert.match(applicationSmoke, /selectCuda\(first\)/u);
  assert.match(applicationSmoke, /exercise\(first, 'cuda', true\)/u);
  assert.match(applicationSmoke, /NvidiaSmiHostInventory/u);
  assert.match(applicationSmoke, /every\(\(\{ backend \}\) => backend === 'cuda'\)/u);
  assert.match(applicationSmoke, /CUDA_SESSION_LAUNCH_MODES = \['probe', 'fullLoad'\]/u);
  assert.doesNotMatch(applicationSmoke, /CUDA_SESSION_LAUNCH_MODES = \['registry'/u);
  assert.match(applicationSmoke, /Packet 20 CUDA launch mode missing:\$\{launchMode\}/u);
  assert.match(applicationSmoke, /NODE_ENV: 'production'/u);
  assert.match(applicationSmoke, /NativeRuntimeLogArchiveExtractor/u);
  assert.match(applicationSmoke, /DiagnosticsArchiveFormatAdapter/u);
  assert.match(applicationSmoke, /NativeRuntimeLogArchiveReader/u);
  assert.match(applicationSmoke, /diagnosticsArchiveSha256/u);
  assert.match(applicationSmoke, /PRIVACY_CANARIES/u);
  assert.match(applicationSmoke, /snapshot\.runtime\.activity/u);
  assert.match(applicationSmoke, /requestCancelled/u);
  assert.doesNotMatch(applicationSmoke, /waitForEvents\('whisperWorker', \['inferenceStarted'\]\)/u);
});

test('Windows executable smoke owns the required guard restart and cancellation races', () => {
  assert.match(filesystemVerification, /verifyOversizedGuardRestart/u);
  assert.match(filesystemVerification, /MAX_GUARD_LINE_BYTES \+ 1/u);
  assert.match(windowsRuntimeIntegration, /cancel-first-target-windows/u);
  assert.match(windowsRuntimeIntegration, /transcript-first-target-windows/u);
  assert.match(windowsRuntimeIntegration, /cancelTooLate/u);
  assert.match(windowsRuntimeIntegration, /reuse-after-races-windows/u);
  assert.match(runtimePackAudit, /\[WINDOWS_CPU_PROFILE, WINDOWS_CUDA_PROFILE\]/u);
  assert.match(windowsUnpackedVerification, /System32', 'WindowsPowerShell', 'v1\.0'/u);
  assert.match(windowsUnpackedVerification, /\['SystemRoot', 'WINDIR', 'TEMP', 'TMP'\]/u);
  assert.doesNotMatch(windowsUnpackedVerification, /env: \{ \.\.\.process\.env/u);
  assert.match(runtimePackProduction, /p20w-/u);
  assert.match(
    runtimePackProduction,
    /stageCudaPack\(profileId, configured\.buildRoot, configured\.profile, configured\.tools\)/u,
  );
  assert.match(cudaRuntimePackStaging, /tools: executionTools/u);
  assert.doesNotMatch(runtimePackProduction, /task24-windows/u);
});
