import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  toLocalWhisperArtifactId,
} from '@shared/localWhisper';
import {
  createPerformanceAttemptCatalogAuthority,
} from '@scripts/local-whisper/qualification/LinuxPerformanceAttemptApplication';
import type { PerformanceAttemptApplicationInput } from '@scripts/local-whisper/qualification/PerformanceQualificationAttemptRunner';
import type { PerformanceRuntimeArchiveEvidence } from '@scripts/local-whisper/qualification/PerformanceRuntimeArchiveInspector';

const SHA_256 = 'a'.repeat(64);

function input(): PerformanceAttemptApplicationInput {
  const model = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
    (entry) => entry.family === 'base' && entry.variant === 'full',
  );
  if (!model) throw new Error('Base/full release model is unavailable');
  return {
    request: {
      schemaVersion: 3,
      activationPurpose: 'qualification',
      sampleId: 'base-full-1-cold-01-after',
      platform: 'linux',
      backend: 'cpu',
      model: { family: model.family, variant: model.variant, sha256: model.sha256 },
      candidateWindow: 1,
      cacheState: 'cold',
      pairIndex: 1,
      runOrder: 'beforeThenAfter',
      side: 'after',
      runtimeArtifact: { absolutePath: '/private/runtime.tar.gz', sizeBytes: 1, sha256: SHA_256 },
      modelArtifact: { absolutePath: '/private/base.bin', sizeBytes: model.sizeBytes, sha256: model.sha256 },
      inputFixture: { absolutePath: '/private/input.wav', sizeBytes: 1, sha256: SHA_256 },
      requiredPhaseIds: [],
      derivedSourceReceiptDigest: SHA_256,
    },
    effectiveInstallationWindow: 1,
    artifacts: {
      runtime: { absolutePath: '/private/runtime.tar.gz', descriptor: 1, sizeBytes: 1, sha256: SHA_256 },
      model: { absolutePath: '/private/base.bin', descriptor: 2, sizeBytes: model.sizeBytes, sha256: model.sha256 },
      inputFixture: { absolutePath: '/private/input.wav', descriptor: 3, sizeBytes: 1, sha256: SHA_256 },
    },
    publishEvent: () => undefined,
  };
}

function archive(): PerformanceRuntimeArchiveEvidence {
  const workerId = toLocalWhisperArtifactId('worker');
  if (!workerId) throw new Error('Worker artifact ID is invalid');
  return {
    expectedFiles: [
      {
        fileId: workerId,
        kind: 'executable',
        mode: 0o500,
        sizeBytes: 1,
        sha256: SHA_256,
      },
    ],
    workerSha256: SHA_256,
    profileId: 'linux-x64-cpu-baseline-v1',
    runtimeBuildDigest: SHA_256,
  };
}

describe('LinuxPerformanceAttemptApplication', () => {
  it('aligns its signed qualification catalog and authority with the production worker protocol', () => {
    const authority = createPerformanceAttemptCatalogAuthority(input(), archive());
    const loaded = new LocalWhisperCatalogRepository({
      readDocument: () => authority.document,
      trustPolicy: authority.policy,
    }).load();

    if (!loaded.success) assert.fail(loaded.code);
    assert.equal(authority.policy.workerProtocolVersion, LOCAL_WHISPER_WORKER_PROTOCOL_VERSION);
    assert.equal(loaded.catalog.payload.workerProtocolVersion, LOCAL_WHISPER_WORKER_PROTOCOL_VERSION);
    assert.equal(
      loaded.catalog.payload.runtimes.every(
        ({ identity }) => identity.protocolVersion === LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      ),
      true,
    );
  });
});
