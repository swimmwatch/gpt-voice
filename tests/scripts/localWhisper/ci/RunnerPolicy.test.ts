import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RunnerPolicyVerifier } from '@scripts/local-whisper/ci/RunnerPolicyVerifier';

const validWorkflow = `
jobs:
  native-quality-linux:
    runs-on: ubuntu-24.04
    steps:
      - run: npm run native-sanitizer-proof && npm run lint:local-whisper:worker-common
      - run: npm run emit:local-whisper:runner-evidence -- --runner-label=ubuntu-24.04 --toolchain=clang-18
  native-quality-windows:
    runs-on: windows-latest
    steps:
      - run: npm run test:local-whisper:fs-guard:msvc-asan && npm run verify:local-whisper:native-hardening
      - run: npm run emit:local-whisper:runner-evidence -- --runner-label=windows-latest --toolchain=msvc-19.39
`;

describe('Native CI runner policy', () => {
  it('accepts the fixed primary native runner allocation', () => {
    new RunnerPolicyVerifier().verify(validWorkflow);
  });

  it('rejects mutable, unsupported, swapped, and missing runner legs', () => {
    const verifier = new RunnerPolicyVerifier();
    assert.throws(() => verifier.verify(validWorkflow.replace('ubuntu-24.04', 'ubuntu-latest')), /unsupported runner/u);
    assert.throws(
      () => verifier.verify(validWorkflow.replace('windows-latest', 'windows-2025')),
      /unsupported runner/u,
    );
    assert.throws(
      () => verifier.verify(validWorkflow.replace('  native-quality-linux:', '  missing-linux:')),
      /native-quality-linux/u,
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
      runnerLabel: 'windows-latest',
      sourceCommit: 'b'.repeat(40),
      testedDigests: ['c'.repeat(40)],
      toolchain: { profile: 'msvc-19.39' },
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
      () => verifier.verifyEvidence({ ...evidence, toolchain: { profile: 'clang-18' } }),
      /toolchain does not match/u,
    );
    assert.throws(() => verifier.verifyEvidence({ ...evidence, sourceCommit: 'unknown' }), /source commit/u);
  });
});
