import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as path from 'node:path';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { LocalWhisperQualificationValidator } from '../../../../scripts/local-whisper/qualification/QualificationContracts';
import { LocalWhisperQualificationInputProducer } from '../../../../scripts/local-whisper/qualification/QualificationInputProducer';
import {
  LocalWhisperQualificationResultProducer,
  type QualificationLinuxRowEvidence,
} from '../../../../scripts/local-whisper/qualification/QualificationResultProducer';

const validator = new LocalWhisperQualificationValidator(path.resolve('docs/specs/local-whisper/qualification'));
const sha = (digit: string): string => digit.repeat(64);

function foundation() {
  const producer = new LocalWhisperQualificationInputProducer(validator);
  const candidate = producer.produceCandidate({
    candidateSemVer: '2.4.0',
    freezeTimestampUtc: '2026-08-03T12:00:00Z',
    source: {
      commit: 'a'.repeat(40),
      treeDigest: sha('1'),
      sharedSourceManifestDigest: sha('2'),
      patchLockDigest: sha('3'),
    },
    modelNoticeDigest: sha('4'),
    corpus: {
      manifestDigest: sha('5'),
      noticeDigest: sha('6'),
      materializerDigest: sha('7'),
      performanceFixtureDigest: sha('8'),
    },
    sharedToolIdentities: [{ id: 'node', version: '24.18.0', sha256: sha('9') }],
  });
  return producer.produceLinuxFoundation(candidate, {
    packages: [{ format: 'AppImage', fileName: 'GPT-Voice-2.4.0.AppImage', sizeBytes: 1, sha256: sha('a') }],
    catalog: {
      purpose: 'qualification',
      payloadSchemaVersion: 2,
      revision: 'qualification-catalog-v2.4.0',
      catalogDigest: sha('b'),
      keyringDigest: sha('c'),
      temporaryKeyId: 'qualification-key-v1',
      originIds: ['huggingface-models', 'qualification-runtime'],
    },
    runtimeArtifacts: (['cpu', 'cuda'] as const).map((backend, index) => ({
      artifactId: `runtime-${backend}`,
      revision: `runtime-${backend}-v1`,
      backend,
      transferProfile: 'restricted-tar-gzip-v1',
      sizeBytes: index + 1,
      sha256: index === 0 ? sha('1') : sha('2'),
      manifestDigest: index === 0 ? sha('3') : sha('4'),
      signatureInputDigest: index === 0 ? sha('5') : sha('6'),
      reproducibilityDigest: index === 0 ? sha('7') : sha('8'),
    })),
    directEngineArtifacts: (['cpu', 'cuda'] as const).map((backend, index) => ({
      backend,
      binarySha256: index === 0 ? sha('1') : sha('2'),
      manifestDigest: index === 0 ? sha('3') : sha('4'),
      sourceCommit: 'b'.repeat(40),
      toolchainDigest: index === 0 ? sha('5') : sha('6'),
    })),
    toolIdentities: [{ id: 'node', version: '24.18.0', sha256: sha('d') }],
    qualificationServer: {
      originId: 'qualification-runtime',
      certificateSha256: sha('e'),
      objectDigests: [sha('1'), sha('2')],
    },
    platformEvidence: { noticesDigest: sha('3'), sbomDigest: sha('4'), provenanceDigest: sha('5') },
    predecessor: {
      version: '2.3.0',
      fileName: 'GPT-Voice-2.3.0.AppImage',
      sha256: '80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111',
    },
    profiles: {
      cpu: {
        profileId: 'linux-x64-cpu-v1',
        osIdentity: 'fedora-42-x64',
        hardwareClass: 'linux-reference-cpu',
        runtimeRevision: 'runtime-cpu-v1',
        directEngineManifestDigest: sha('3'),
        toolIdentities: [{ id: 'node', version: '24.18.0', sha256: sha('6') }],
      },
      cuda: {
        profileId: 'linux-x64-cuda-v1',
        osIdentity: 'fedora-42-x64',
        hardwareClass: 'linux-reference-cuda',
        runtimeRevision: 'runtime-cuda-v1',
        directEngineManifestDigest: sha('4'),
        toolIdentities: [{ id: 'node', version: '24.18.0', sha256: sha('7') }],
      },
    },
  });
}

const gates = Object.freeze({
  load: 'Pass',
  warmup: 'Pass',
  parity: 'Pass',
  resources: 'Pass',
  cancellation: 'Pass',
  crashReload: 'Pass',
  unload: 'Pass',
  providerSwitch: 'Pass',
  suspendResume: 'Pass',
  appExit: 'Pass',
  offlineRestart: 'Pass',
  repetitions: 'Pass',
  predecessor: 'Pass',
} as const);

function rows(): QualificationLinuxRowEvidence[] {
  return LOCAL_WHISPER_RELEASE_MODEL_MATRIX.flatMap(({ family, variant }) =>
    (['cpu', 'cuda'] as const).map((backend) => ({
      family,
      variant,
      backend,
      status: 'Pass' as const,
      reasonCode: 'QUALIFIED',
      applicationWerPercentage: 5,
      directWerPercentage: 4.5,
      peakRamBytes: 1,
      peakVramBytes: backend === 'cpu' ? ('notApplicable' as const) : 1,
      medianRtf: family === 'base' ? 0.5 : null,
      gates,
      resourceSamples: Array.from({ length: 10 }, (_unused, index) => ({
        elapsedNanoseconds: index * 100_000_000,
        ownedProcessCount: 0,
        ramBytes: 0,
        vramBytes: backend === 'cpu' ? ('notApplicable' as const) : 0,
      })),
    })),
  );
}

describe('LocalWhisperQualificationResultProducer', () => {
  it('seals the complete Linux result and evidence index after the platform graph', () => {
    const result = new LocalWhisperQualificationResultProducer(validator).produce(foundation(), rows());
    assert.match(result.resultDigest, /^[a-f0-9]{64}$/u);
    assert.match(result.evidenceIndexDigest, /^[a-f0-9]{64}$/u);
    assert.equal(result.branch.measurementSeries.length, 12);
  });

  it('rejects incomplete order and a false Pass before freeze', () => {
    const producer = new LocalWhisperQualificationResultProducer(validator);
    assert.throws(() => producer.produce(foundation(), rows().slice(1)), /MATRIX_INVALID/u);
    const invalid = rows();
    invalid[0] = { ...invalid[0]!, gates: { ...gates, load: 'Fail' } };
    assert.throws(() => producer.produce(foundation(), invalid), /QUALIFICATION_PASS_GATE_INCOMPLETE/u);
  });
});
