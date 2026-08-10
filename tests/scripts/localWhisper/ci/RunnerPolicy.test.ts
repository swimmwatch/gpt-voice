import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RunnerPolicyVerifier } from '@scripts/local-whisper/ci/RunnerPolicyVerifier';

const validWorkflow = `
jobs:
  native-quality:
    runs-on: \${{ matrix.runner }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: linux
            runner: \${{ vars.CI_LINUX_RUNNER }}
            toolchain: clang-\${{ vars.CI_LLVM_VERSION }}
          - platform: windows
            runner: \${{ vars.CI_WINDOWS_RUNNER }}
            toolchain: msvc-hosted
    steps:
      - run: npm run native-sanitizer-proof && npm run lint:local-whisper:worker-common
      - run: npm run test:local-whisper:fs-guard:msvc-asan && npm run verify:local-whisper:native-hardening
      - run: npm run emit:local-whisper:runner-evidence -- --runner-label=\${{ matrix.runner }} --toolchain=\${{ matrix.toolchain }} --expected-os=\${{ matrix.platform }}
  quality:
    runs-on: \${{ vars.CI_LINUX_RUNNER }}
`;

describe('Native CI runner policy', () => {
  it('accepts the configured two-platform native matrix', () => {
    new RunnerPolicyVerifier().verify(validWorkflow);
  });

  it('rejects literal, unsupported, duplicate, and incomplete runner rows', () => {
    const verifier = new RunnerPolicyVerifier();
    assert.throws(
      () => verifier.verify(validWorkflow.replace('${{ vars.CI_LINUX_RUNNER }}', 'ubuntu-24.04')),
      /configured runner/u,
    );
    assert.throws(
      () => verifier.verify(validWorkflow.replace('platform: windows', 'platform: darwin')),
      /unsupported platform/u,
    );
    assert.throws(() => verifier.verify(validWorkflow.replace('platform: windows', 'platform: linux')), /duplicates/u);
  });

  it('maps only native ownership paths to execution', () => {
    const verifier = new RunnerPolicyVerifier();
    assert.equal(verifier.ownsNativePath('runtime/local-whisper/worker/main.cpp'), true);
    assert.equal(verifier.ownsNativePath('package-lock.json'), true);
    assert.equal(verifier.ownsNativePath('docs/README.md'), false);
    assert.equal(verifier.ownsNativePath('src/main/providers/openaiProvider.ts'), false);
  });

  it('rejects missing or contradictory runner evidence', () => {
    const verifier = new RunnerPolicyVerifier();
    const evidence = {
      architecture: 'x64',
      nativeSourceManifest: { 'whisper-cpp.json': 'a'.repeat(64) },
      reportedImage: { imageOS: 'win25', imageVersion: '2026.08.1', runnerOS: 'Windows' },
      runnerLabel: 'windows-latest',
      sourceCommit: 'b'.repeat(40),
      testedDigests: ['c'.repeat(40)],
      toolchain: {
        profile: 'msvc-hosted',
        version: 'Microsoft (R) C/C++ Optimizing Compiler Version 19.51.36231 for x64',
      },
    };
    verifier.verifyEvidence(evidence);
    assert.throws(() => verifier.verifyEvidence({ ...evidence, architecture: 'arm64' }), /x64/u);
    assert.throws(
      () =>
        verifier.verifyEvidence({
          ...evidence,
          reportedImage: { imageOS: 'win25', imageVersion: '2026.08.1', runnerOS: 'Linux' },
        }),
      /host does not match/u,
    );
    assert.throws(
      () =>
        verifier.verifyEvidence({ ...evidence, toolchain: { profile: 'clang-18', version: 'clang version 18.1.3' } }),
      /toolchain does not match/u,
    );
    assert.throws(() => verifier.verifyEvidence({ ...evidence, runnerLabel: 'self-hosted' }), /unsupported label/u);
    assert.throws(() => verifier.verifyEvidence({ ...evidence, sourceCommit: 'unknown' }), /source commit/u);
  });
});
