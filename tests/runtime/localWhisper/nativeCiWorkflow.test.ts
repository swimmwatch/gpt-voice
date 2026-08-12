import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const WORKFLOW_PATH = '.github/workflows/pr-checks.yml';
const MSVC_ACTION_PATH = '.github/actions/initialize-msvc-environment/action.yml';

test('Local Whisper keeps native CI checks on configured platform matrix rows', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  const msvcAction = readFileSync(MSVC_ACTION_PATH, 'utf8');

  assert.match(workflow, /native-quality:\n {4}name: Local Whisper Native Quality \(\$\{\{ matrix\.checkName \}\}\)/u);
  assert.match(workflow, /runs-on: \$\{\{ matrix\.runner \}\}/u);
  assert.match(workflow, /fail-fast: false/u);
  assert.match(workflow, /platform: linux\n {12}runner: \$\{\{ vars\.CI_LINUX_RUNNER \}\}/u);
  assert.match(workflow, /platform: windows\n {12}runner: \$\{\{ vars\.CI_WINDOWS_RUNNER \}\}/u);
  assert.match(
    workflow,
    /platform: windows\n {12}runner: \$\{\{ vars\.CI_WINDOWS_RUNNER \}\}\n {12}timeoutMinutes: 60/u,
  );
  assert.match(workflow, /toolchain: clang-\$\{\{ vars\.CI_LLVM_VERSION \}\}/u);
  assert.match(workflow, /toolchain: msvc-hosted/u);

  assert.match(workflow, /Install and configure Linux native toolchain/u);
  assert.match(workflow, /if: matrix\.platform == 'linux'/u);
  assert.match(workflow, /verify:local-whisper:native-hardening -- --platform=linux/u);
  assert.match(workflow, /Initialize MSVC developer environment/u);
  assert.match(workflow, /if: matrix\.platform == 'windows'/u);
  assert.match(workflow, /uses: \.\/\.github\/actions\/initialize-msvc-environment/u);
  assert.match(msvcAction, /vcvarsall\.bat/u);
  assert.match(msvcAction, /\$env:PATH = \$values\['PATH'\]/u);
  assert.match(msvcAction, /Get-Command cmake\.exe/u);
  assert.match(msvcAction, /Get-Command ctest\.exe/u);
  assert.match(msvcAction, /Get-Command cl\.exe/u);
  assert.match(msvcAction, /Get-Command ninja\.exe/u);
  assert.match(workflow, /msvc-asan/u);
  assert.match(workflow, /whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19\.39-v1/u);
  assert.match(workflow, /whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19\.39-v1 --skip-runtime-pack/u);
  assert.match(workflow, /whisper-cpp-cuda -- --profile=windows-x64-cuda-12\.8\.1-sm120a-msvc-19\.39-v1/u);
  assert.match(workflow, /verify:local-whisper:amd-packs -- --profile=vulkan-windows-x64/u);
  assert.match(workflow, /--expected-os=\$\{\{ matrix\.platform \}\}/u);
  assert.doesNotMatch(
    workflow,
    /ubuntu-22\.04|ubuntu-26\.04|windows-2022|native-quality-(linux|windows)-compatibility/u,
  );
});

test('Local Whisper runs bounded parser fuzzing only on the prepared Linux native row', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(
    workflow,
    /- name: Run bounded Linux parser fuzzing\n {8}if: matrix\.platform == 'linux'\n {8}run: \|\n {10}npm run test:local-whisper:native-fuzz\n {10}npm run test:local-whisper:native-fuzz-proof/u,
  );
  assert.doesNotMatch(workflow, /if: matrix\.platform == 'windows'\n {8}run: [\s\S]*?native-fuzz/u);
});

test('Local Whisper runs the separate worker ThreadSanitizer proof and concurrency matrix only on Linux', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  const start = workflow.indexOf('- name: Run Linux worker ThreadSanitizer gate');
  const end = workflow.indexOf('\n      - name:', start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const step = workflow.slice(start, end);

  assert.match(step, /if: matrix\.platform == 'linux'/u);
  assert.match(step, /env:\n          LD_PRELOAD: ''/u);
  assert.match(step, /npm run test:local-whisper:worker-tsan-proof/u);
  assert.match(step, /npm run test:local-whisper:worker-tsan\n/u);
  assert.doesNotMatch(step, /windows/u);
  assert.match(workflow, /--evidence=contract-inspection,compile,execute,analyze,sanitize,tsan,binary-inspection/u);
});

test('package smoke keeps Linux and Windows commands inside one platform matrix', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /package-smoke:\n {4}name: Package Smoke \(\$\{\{ matrix\.checkName \}\}\)/u);
  assert.match(workflow, /checkName: Fedora Linux\n {12}platform: linux/u);
  assert.match(workflow, /checkName: Windows\n {12}platform: windows/u);
  assert.match(workflow, /Smoke package application in Fedora/u);
  assert.match(workflow, /Build and smoke Windows package/u);
  assert.match(workflow, /CI_FEDORA_RELEASE_IMAGE/u);
  assert.match(workflow, /CI_ARCHITECTURE/u);
});

test('native analysis and CodeQL use real host builds without platform over-claims', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  const codeqlConfig = readFileSync('.github/codeql-config.yml', 'utf8');
  const windowsBuildDrivers = [
    'scripts/local-whisper/native-fs-guard-quality.mjs',
    'scripts/local-whisper/native-launcher-quality.mjs',
    'scripts/local-whisper/native-worker-quality.mjs',
    'scripts/local-whisper/whisper-cpp-build-core.mjs',
  ].map((path) => readFileSync(path, 'utf8'));
  const analyzerConfigurations = [
    'runtime/local-whisper/common/.clang-tidy',
    'runtime/local-whisper/fs-guard/.clang-tidy',
    'runtime/local-whisper/launcher/.clang-tidy',
    'runtime/local-whisper/whisper-cpp/.clang-tidy',
  ].map((path) => readFileSync(path, 'utf8'));
  const nativeHardening = readFileSync('runtime/local-whisper/cmake/LocalWhisperHardening.cmake', 'utf8');

  assert.match(workflow, /security-events: write/u);
  assert.match(workflow, /github\/codeql-action\/init@[a-f0-9]{40}\s+# v4\.37\.6/u);
  assert.match(workflow, /github\/codeql-action\/analyze@[a-f0-9]{40}\s+# v4\.37\.6/u);
  assert.match(workflow, /languages: c-cpp/u);
  assert.match(workflow, /languages: javascript-typescript/u);
  assert.match(workflow, /build-mode: manual/u);
  assert.equal((workflow.match(/queries: security-and-quality/gu) ?? []).length, 2);
  assert.match(workflow, /LOCAL_WHISPER_MSVC_ANALYZE: 'true'/u);
  assert.match(workflow, /Run MSVC \/analyze native suites/u);
  assert.match(workflow, /Prove Linux analyzer rejects bad sources/u);
  assert.match(
    workflow,
    /Prove non-recovering Linux sanitizer policy\n {8}if: matrix\.platform == 'linux'\n {8}env:\n {10}LD_PRELOAD: ''/u,
  );
  assert.match(workflow, /emit:local-whisper:native-quality-coverage/u);
  assert.match(workflow, /schedule:\n {4}- cron: '17 3 \* \* 1'/u);
  assert.match(workflow, /- \.github\/codeql-config\.yml/u);
  assert.match(workflow, /- scripts\/\*\*/u);
  assert.match(workflow, /- src\/renderer\/\*\*/u);
  assert.match(codeqlConfig, /src\/main/u);
  assert.match(codeqlConfig, /src\/renderer/u);
  assert.match(codeqlConfig, /src\/shared/u);
  assert.match(codeqlConfig, /scripts/u);
  assert.match(nativeHardening, /LOCAL_WHISPER_MSVC_ANALYZE/u);
  assert.match(nativeHardening, /target_compile_options\(\$\{target\} PRIVATE \/analyze \/analyze:external-\)/u);
  assert.ok(windowsBuildDrivers.every((driver) => driver.includes('LOCAL_WHISPER_MSVC_ANALYZE=ON')));
  assert.ok(windowsBuildDrivers.every((driver) => !driver.includes('CMAKE_CXX_FLAGS=/analyze')));
  assert.ok(analyzerConfigurations.every((configuration) => configuration.includes('clang-analyzer-*')));
});
