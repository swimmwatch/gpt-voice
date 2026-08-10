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
  assert.match(workflow, /whisper-cpp-cuda -- --profile=windows-x64-cuda-12\.8\.1-sm120a-msvc-19\.39-v1/u);
  assert.match(workflow, /verify:local-whisper:amd-packs -- --profile=vulkan-windows-x64/u);
  assert.match(workflow, /--expected-os=\$\{\{ matrix\.platform \}\}/u);
  assert.doesNotMatch(
    workflow,
    /ubuntu-22\.04|ubuntu-26\.04|windows-2022|native-quality-(linux|windows)-compatibility/u,
  );
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
