import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RunnerPolicyVerifier } from '@scripts/local-whisper/ci/RunnerPolicyVerifier';

const validWorkflow = `
jobs:
  native-linux-core:
    runs-on: \${{ vars.CI_LINUX_RUNNER }}
    timeout-minutes: 60
    permissions:
      contents: read
      security-events: write
    env:
      TOOLCHAIN: clang-\${{ vars.CI_LLVM_VERSION }}
    steps:
      - run: npm run native-sanitizer-proof && npm run worker-tsan && npm run native-fuzz
      - run: npm run emit:local-whisper:runner-evidence -- --runner-label=\${{ vars.CI_LINUX_RUNNER }} --toolchain=$TOOLCHAIN
  native-linux-shards:
    runs-on: \${{ matrix.runner }}
    timeout-minutes: \${{ matrix.timeoutMinutes }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - checkName: Static Analysis
            lane: static-analysis
            runner: \${{ vars.CI_LINUX_RUNNER }}
            timeoutMinutes: 20
          - checkName: GCC and Package
            lane: gcc-package
            runner: \${{ vars.CI_LINUX_RUNNER }}
            timeoutMinutes: 30
    steps:
      - run: npm run lint:local-whisper && npm run native-analysis
      - run: npm run fs-guard:gcc && npm run native-hardening
  native-quality-linux:
    name: Local Whisper Native Quality (Linux)
    if: \${{ always() }}
    needs:
      - native-linux-core
      - native-linux-shards
    runs-on: \${{ vars.CI_LINUX_RUNNER }}
    env:
      CORE_RESULT: \${{ needs.native-linux-core.result }}
      SHARDS_RESULT: \${{ needs.native-linux-shards.result }}
    steps:
      - run: test "$CORE_RESULT" = success && test "$SHARDS_RESULT" = success
  native-windows-core:
    runs-on: \${{ vars.CI_WINDOWS_RUNNER }}
    timeout-minutes: 60
    permissions:
      contents: read
      security-events: write
    env:
      TOOLCHAIN: windows-x64-msvc-19.51-v1
    steps:
      - run: npm run native-hardening
      - run: npm run emit:local-whisper:runner-evidence -- --runner-label=\${{ vars.CI_WINDOWS_RUNNER }} --toolchain=$TOOLCHAIN
      - uses: github/codeql-action/init@0123456789012345678901234567890123456789
        with:
          languages: c-cpp
  native-windows-shards:
    runs-on: \${{ matrix.runner }}
    timeout-minutes: \${{ matrix.timeoutMinutes }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - checkName: MSVC Analyze
            lane: analyze
            runner: \${{ vars.CI_WINDOWS_RUNNER }}
            timeoutMinutes: 30
          - checkName: MSVC AddressSanitizer
            lane: asan
            runner: \${{ vars.CI_WINDOWS_RUNNER }}
            timeoutMinutes: 30
    steps:
      - run: npm run LOCAL_WHISPER_MSVC_ANALYZE
      - run: npm run test:local-whisper:fs-guard:msvc-asan
  native-quality-windows:
    name: Local Whisper Native Quality (Windows)
    if: \${{ always() }}
    needs:
      - native-windows-core
      - native-windows-shards
    runs-on: \${{ vars.CI_WINDOWS_RUNNER }}
    env:
      CORE_RESULT: \${{ needs.native-windows-core.result }}
      SHARDS_RESULT: \${{ needs.native-windows-shards.result }}
    steps:
      - run: test "$CORE_RESULT" = success && test "$SHARDS_RESULT" = success
`;

describe('Native CI runner policy', () => {
  it('accepts the configured parallel native lanes and aggregate gates', () => {
    new RunnerPolicyVerifier().verify(validWorkflow);
  });

  it('rejects literal runners and unsupported or duplicate lanes', () => {
    const verifier = new RunnerPolicyVerifier();
    assert.throws(
      () => verifier.verify(validWorkflow.replace('${{ vars.CI_LINUX_RUNNER }}', 'ubuntu-24.04')),
      /configured runner/u,
    );
    assert.throws(() => verifier.verify(validWorkflow.replace('lane: asan', 'lane: darwin')), /exact approved lanes/u);
    assert.throws(() => verifier.verify(validWorkflow.replace('lane: asan', 'lane: analyze')), /exact approved lanes/u);
  });

  it('rejects accidental lane dependencies and changed matrix metadata', () => {
    const verifier = new RunnerPolicyVerifier();
    assert.throws(
      () =>
        verifier.verify(validWorkflow.replace('  native-linux-core:\n', '  native-linux-core:\n    needs: quality\n')),
      /start independently/u,
    );
    assert.throws(
      () => verifier.verify(validWorkflow.replace('timeoutMinutes: 20', 'timeoutMinutes: 60')),
      /metadata must remain parameterized and exact/u,
    );
    assert.throws(
      () => verifier.verify(validWorkflow.replace('checkName: MSVC Analyze', 'checkName: Analyze')),
      /metadata must remain parameterized and exact/u,
    );
  });

  it('rejects aggregate gates that can accept a non-success dependency result', () => {
    const verifier = new RunnerPolicyVerifier();
    assert.throws(
      () => verifier.verify(validWorkflow.replace('test "$CORE_RESULT" = success', 'test -n "$CORE_RESULT"')),
      /fail closed/u,
    );
    assert.throws(
      () => verifier.verify(validWorkflow.replace('      - native-windows-shards\n', '')),
      /require every windows native lane/u,
    );
  });

  it('rejects configured runner values outside the approved pair', () => {
    const verifier = new RunnerPolicyVerifier();
    assert.throws(
      () => verifier.verify(validWorkflow, { linux: 'ubuntu-26.04', windows: 'windows-2025' }),
      /Configured linux runner/u,
    );
    assert.throws(
      () => verifier.verify(validWorkflow, { linux: 'ubuntu-24.04', windows: 'windows-latest' }),
      /Configured windows runner/u,
    );
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
      runnerLabel: 'windows-2025',
      sourceCommit: 'b'.repeat(40),
      testedDigests: ['c'.repeat(40)],
      toolchain: {
        profile: 'windows-x64-msvc-19.51-v1',
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
    assert.throws(() => verifier.verifyEvidence({ ...evidence, runnerLabel: 'windows-latest' }), /unsupported label/u);
    assert.throws(() => verifier.verifyEvidence({ ...evidence, sourceCommit: 'unknown' }), /source commit/u);
  });
});
