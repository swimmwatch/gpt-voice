import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const WORKFLOW_PATH = '.github/workflows/pr-checks.yml';
const MSVC_ACTION_PATH = '.github/actions/initialize-msvc-environment/action.yml';
const WORKER_QUALITY_PATH = 'scripts/local-whisper/native-worker-quality.mjs';
const LINUX_JOB_MARKER = '  native-quality-linux:';
const WINDOWS_JOB_MARKER = '  native-quality-windows:';
const LINUX_COMPATIBILITY_JOB_MARKER = '  native-quality-linux-compatibility:';
const WINDOWS_COMPATIBILITY_JOB_MARKER = '  native-quality-windows-compatibility:';
const QUALITY_JOB_MARKER = '  quality:';
const WINDOWS_PACKAGE_SMOKE_JOB_MARKER = '  package-smoke-windows:';
const MSVC_ACTION_REFERENCE = 'uses: ./.github/actions/initialize-msvc-environment';

function jobSource(workflow: string, startMarker: string, endMarker: string): string {
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} missing`);
  assert.notEqual(end, -1, `${endMarker} missing`);
  assert.ok(end > start, `${startMarker} ordering`);
  return workflow.slice(start, end);
}

test('Local Whisper keeps native CI checks on their owning runners and initializes Windows packaging', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  const msvcAction = readFileSync(MSVC_ACTION_PATH, 'utf8');
  const workerQuality = readFileSync(WORKER_QUALITY_PATH, 'utf8');
  const linuxJob = jobSource(workflow, LINUX_JOB_MARKER, WINDOWS_JOB_MARKER);
  const windowsJob = jobSource(workflow, WINDOWS_JOB_MARKER, LINUX_COMPATIBILITY_JOB_MARKER);
  const linuxCompatibilityJob = jobSource(workflow, LINUX_COMPATIBILITY_JOB_MARKER, WINDOWS_COMPATIBILITY_JOB_MARKER);
  const windowsCompatibilityJob = jobSource(workflow, WINDOWS_COMPATIBILITY_JOB_MARKER, QUALITY_JOB_MARKER);
  const windowsPackageSmokeJob = workflow.slice(workflow.indexOf(WINDOWS_PACKAGE_SMOKE_JOB_MARKER));

  assert.match(linuxJob, /runs-on: ubuntu-24\.04/u);
  assert.match(linuxJob, /LOCAL_WHISPER_PREPARED_LINUX_QUALITY: 'true'/u);
  assert.match(linuxJob, /--platform=linux/u);
  assert.match(linuxJob, /Build and verify Linux Whisper\.cpp CPU pack/u);
  assert.match(linuxJob, /build:local-whisper:fs-guard/u);
  assert.match(linuxJob, /build:local-whisper:launcher/u);
  assert.match(linuxJob, /verify:local-whisper:native-hardening -- --platform=linux/u);
  assert.doesNotMatch(linuxJob, /--platform=windows|MSVC|Job Object/u);

  assert.match(windowsJob, /runs-on: windows-2025/u);
  assert.match(windowsJob, /LOCAL_WHISPER_PREPARED_WINDOWS_QUALITY: 'true'/u);
  assert.match(windowsJob, /repository: google\/googletest/u);
  assert.match(windowsJob, /Initialize MSVC developer environment/u);
  assert.match(windowsJob, /uses: \.\/\.github\/actions\/initialize-msvc-environment/u);
  assert.match(msvcAction, /vcvarsall\.bat/u);
  assert.match(msvcAction, /\$env:PATH = \$values\['PATH'\]/u);
  assert.match(msvcAction, /Get-Command cmake\.exe/u);
  assert.match(msvcAction, /Get-Command ctest\.exe/u);
  assert.match(msvcAction, /Get-Command cl\.exe/u);
  assert.match(msvcAction, /Get-Command ninja\.exe/u);
  assert.match(windowsJob, /Run MSVC native unit and integration tests/u);
  assert.match(windowsJob, /Run MSVC launcher unit and Job Object integration tests/u);
  assert.match(windowsJob, /Run MSVC common SHA-256 and frame codec tests/u);
  assert.match(windowsJob, /Run Windows AMD Vulkan static contract/u);
  assert.match(windowsJob, /--profile=vulkan-windows-x64/u);
  assert.match(windowsJob, /--platform=windows --contract-only/u);
  assert.match(windowsJob, /whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19\.39-v1 --contract-only/u);
  assert.match(windowsJob, /Build and verify hardened Windows production binaries/u);
  assert.match(windowsJob, /build:local-whisper:fs-guard/u);
  assert.match(windowsJob, /build:local-whisper:launcher/u);
  assert.match(windowsJob, /build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19\.39-v1/u);
  assert.match(windowsJob, /verify:local-whisper:native-hardening -- --platform=windows/u);
  assert.match(
    windowsJob,
    /whisper-cpp-cuda -- --profile=windows-x64-cuda-12\.8\.1-sm120a-msvc-19\.39-v1 --contract-only/u,
  );
  assert.doesNotMatch(windowsJob, /if:\s*\$\{\{\s*false\s*\}\}/u);
  assert.doesNotMatch(windowsJob, /--platform=linux/u);
  assert.match(linuxCompatibilityJob, /runs-on: ubuntu-22\.04/u);
  assert.match(linuxCompatibilityJob, /LOCAL_WHISPER_PREPARED_LINUX_COMPATIBILITY: 'true'/u);
  assert.match(linuxCompatibilityJob, /LOCAL_WHISPER_COMPATIBILITY_C_COMPILER: \/usr\/bin\/clang-18/u);
  assert.match(linuxCompatibilityJob, /LOCAL_WHISPER_COMPATIBILITY_CXX_COMPILER: \/usr\/bin\/clang\+\+-18/u);
  assert.match(linuxCompatibilityJob, /test:local-whisper:fs-guard:native/u);
  assert.match(linuxCompatibilityJob, /test:local-whisper:launcher:native/u);
  assert.match(linuxCompatibilityJob, /test:local-whisper:worker-codec/u);
  assert.match(linuxCompatibilityJob, /emit:local-whisper:runner-evidence/u);
  assert.doesNotMatch(linuxCompatibilityJob, /native-sanitizer-proof|lint:local-whisper|native-hardening/u);
  assert.match(
    workerQuality,
    /const isLinuxCompatibility = process\.env\.LOCAL_WHISPER_PREPARED_LINUX_COMPATIBILITY === 'true';/u,
  );
  assert.match(
    workerQuality,
    /id: 'linux-x64-clang-18\.1\.3-compatibility-v1',\n {4}linker: null,\n {4}sanitizers: false,/u,
  );
  assert.match(windowsCompatibilityJob, /runs-on: windows-2022/u);
  assert.match(windowsCompatibilityJob, /LOCAL_WHISPER_PREPARED_WINDOWS_COMPATIBILITY: 'true'/u);
  assert.match(windowsCompatibilityJob, /uses: \.\/\.github\/actions\/initialize-msvc-environment/u);
  assert.match(windowsCompatibilityJob, /required-compiler-version: '19\.39'/u);
  assert.match(windowsCompatibilityJob, /test:local-whisper:fs-guard:native/u);
  assert.match(windowsCompatibilityJob, /test:local-whisper:launcher:native/u);
  assert.match(windowsCompatibilityJob, /test:local-whisper:worker-codec/u);
  assert.match(windowsCompatibilityJob, /emit:local-whisper:runner-evidence/u);
  assert.doesNotMatch(windowsCompatibilityJob, /msvc-asan|native-hardening|amd-packs/u);

  assert.notEqual(windowsPackageSmokeJob, '');
  assert.match(windowsPackageSmokeJob, /uses: \.\/\.github\/actions\/initialize-msvc-environment/u);
  assert.ok(
    windowsPackageSmokeJob.indexOf(MSVC_ACTION_REFERENCE) <
      windowsPackageSmokeJob.indexOf('Prepare disabled Local Whisper package resources'),
  );
});
