import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLocalWhisperFamilyGuidance,
  hasCompleteLocalWhisperFamilyGuidance,
  isLocalWhisperMemoryEstimateRecord,
  isLocalWhisperModelIdentity,
  isLocalWhisperRuntimeIdentity,
  LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE,
  LOCAL_WHISPER_MODEL_FAMILIES,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  validateLocalWhisperMemoryEstimateMatrix,
  type LocalWhisperArtifactId,
  type LocalWhisperMemoryConfigurationIdentity,
  type LocalWhisperRevisionId,
} from '@shared/localWhisper';

function revision(value: string): LocalWhisperRevisionId {
  const result = toLocalWhisperRevisionId(value);
  assert.ok(result);
  return result;
}

function artifactId(value: string): LocalWhisperArtifactId {
  const result = toLocalWhisperArtifactId(value);
  assert.ok(result);
  return result;
}

const MODEL_IDENTITY = Object.freeze({
  engine: 'whisperCpp',
  logicalModel: 'base',
  sourceCheckpointRevision: revision('openai-whisper-base-v1'),
  artifactRevision: revision('ggml-base-v1'),
  nativeFormat: 'ggml',
  variant: 'full',
} as const);

const GPU_CONFIGURATION: LocalWhisperMemoryConfigurationIdentity = Object.freeze({
  target: 'gpu',
  backend: 'cuda',
  runtimePackRevision: revision('runtime-cuda-v1'),
  model: MODEL_IDENTITY,
});

function estimate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...GPU_CONFIGURATION,
    estimatedPeakRamBytes: 3 * 1024 ** 3,
    estimatedPeakVramBytes: 2 * 1024 ** 3,
    evidenceBasis: 'derived',
    sourceBuildRevision: revision('estimate-build-v1'),
    methodologyLabel: 'Pinned runtime representative measurement',
    ...overrides,
  };
}

describe('Local Whisper catalog contracts', () => {
  it('publishes exact approximate RAM and VRAM guidance for all six families', () => {
    assert.equal(hasCompleteLocalWhisperFamilyGuidance(), true);
    assert.deepEqual(
      LOCAL_WHISPER_MODEL_FAMILIES.map((model) => ({
        model,
        vram: LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[model].approximateVramGiB,
        ram: LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[model].approximateSystemRamGiB,
      })),
      [
        { model: 'tiny', vram: [1, 2], ram: [2, 4] },
        { model: 'base', vram: [1, 2], ram: [2, 4] },
        { model: 'small', vram: [2, 3], ram: [4, 6] },
        { model: 'medium', vram: [3, 6], ram: [6, 10] },
        { model: 'large-v3', vram: [6, 8], ram: [10, 16] },
        { model: 'large-v3-turbo', vram: [3, 6], ram: [6, 10] },
      ],
    );
    assert.equal(getLocalWhisperFamilyGuidance('large-v2'), undefined);
  });

  it('keeps engine-native model identities closed and immutable', () => {
    assert.equal(isLocalWhisperModelIdentity(MODEL_IDENTITY), true);
    assert.equal(isLocalWhisperModelIdentity({ ...MODEL_IDENTITY, nativeFormat: 'unknown-format' }), false);
    assert.equal(isLocalWhisperModelIdentity({ ...MODEL_IDENTITY, unexpectedDimension: 'legacy' }), false);
  });

  it('validates an exact selected-configuration memory matrix and rejects unsafe variants', () => {
    const valid = estimate();
    assert.equal(isLocalWhisperMemoryEstimateRecord(valid), true);
    assert.equal(validateLocalWhisperMemoryEstimateMatrix([valid], [GPU_CONFIGURATION]).valid, true);

    const invalidRecords = [
      estimate({ estimatedPeakRamBytes: -1 }),
      estimate({ estimatedPeakRamBytes: Number.MAX_SAFE_INTEGER + 1 }),
      estimate({ estimatedPeakVramBytes: 'notApplicable' }),
      estimate({ estimatedPeakRamGiB: 3 }),
      estimate({ methodologyLabel: 'private\nlabel' }),
      estimate({ unexpectedDimension: 'legacy' }),
    ];
    for (const invalid of invalidRecords) assert.equal(isLocalWhisperMemoryEstimateRecord(invalid), false);

    assert.deepEqual(validateLocalWhisperMemoryEstimateMatrix([valid, valid], [GPU_CONFIGURATION]), {
      valid: false,
      reason: 'duplicate-key',
    });
    assert.deepEqual(validateLocalWhisperMemoryEstimateMatrix([], [GPU_CONFIGURATION]), {
      valid: false,
      reason: 'missing-key',
    });
  });

  it('requires CPU estimates to mark VRAM not applicable', () => {
    const cpuConfiguration: LocalWhisperMemoryConfigurationIdentity = {
      ...GPU_CONFIGURATION,
      target: 'cpu',
      backend: 'cpu',
    };
    assert.equal(
      isLocalWhisperMemoryEstimateRecord(
        estimate({
          ...cpuConfiguration,
          estimatedPeakVramBytes: 'notApplicable',
        }),
      ),
      true,
    );
    assert.equal(
      isLocalWhisperMemoryEstimateRecord(
        estimate({
          ...cpuConfiguration,
          estimatedPeakVramBytes: 0,
        }),
      ),
      false,
    );
  });

  it('rejects runtime identities with target/backend mismatches, extra keys, or unsafe hashes', () => {
    const runtime = {
      engine: 'whisperCpp',
      platform: 'linux',
      architecture: 'x64',
      target: 'gpu',
      backend: 'cuda',
      dependencyFamily: 'cuda-13',
      upstreamRevision: revision('whisper-cpp-v1.9.1'),
      buildRevision: revision('build-v1'),
      computeTargets: ['sm_120'],
      protocolVersion: 1,
      packRevision: revision('pack-v1'),
      catalogRevision: revision('catalog-v1'),
      appRevision: revision('app-v1'),
      signingKeyId: artifactId('local-whisper-signing-key-v1'),
      archiveSizeBytes: 123,
      archiveSha256: 'a'.repeat(64),
      archiveSignature: 'signature-v1',
      originId: artifactId('fixture-origin'),
      expectedFiles: [
        {
          fileId: artifactId('worker'),
          kind: 'executable',
          mode: 0o755,
          sizeBytes: 100,
          sha256: 'b'.repeat(64),
        },
      ],
      prerequisites: ['driver>=1'],
      provenanceId: artifactId('provenance-v1'),
      sbomRevision: revision('sbom-v1'),
      noticeIds: [artifactId('notice-v1')],
    };
    assert.equal(isLocalWhisperRuntimeIdentity(runtime), true);
    assert.equal(isLocalWhisperRuntimeIdentity({ ...runtime, backend: 'cpu' }), false);
    assert.equal(isLocalWhisperRuntimeIdentity({ ...runtime, archiveSha256: 'unsafe' }), false);
    assert.equal(isLocalWhisperRuntimeIdentity({ ...runtime, url: 'https://private.example' }), false);
  });
});
