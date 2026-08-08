import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as path from 'node:path';

import {
  LocalWhisperQualificationInputProducer,
  type QualificationCandidateSeed,
  type QualificationLinuxPlatformSeed,
} from '../../../../scripts/local-whisper/qualification/QualificationInputProducer';
import { LocalWhisperQualificationValidator } from '../../../../scripts/local-whisper/qualification/QualificationContracts';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const validator = new LocalWhisperQualificationValidator(qualificationRoot);
const producer = new LocalWhisperQualificationInputProducer(validator);
const sha = (digit: string): string => digit.repeat(64);

function candidateSeed(): QualificationCandidateSeed {
  return {
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
    sharedToolIdentities: [
      { id: 'node', version: '24.18.0', sha256: sha('9') },
      { id: 'git', version: '2.51.0', sha256: sha('a') },
    ],
  };
}

function platformSeed(): QualificationLinuxPlatformSeed {
  const runtimeArtifacts = (['cpu', 'cuda'] as const).map((backend, index) => ({
    artifactId: `runtime-${backend}`,
    revision: `runtime-${backend}-v1`,
    backend,
    transferProfile: 'restricted-tar-gzip-v1',
    sizeBytes: index + 1,
    sha256: (index + 1).toString(16).repeat(64),
    manifestDigest: (index + 3).toString(16).repeat(64),
    signatureInputDigest: (index + 5).toString(16).repeat(64),
    reproducibilityDigest: (index + 7).toString(16).repeat(64),
  }));
  const directEngineArtifacts = (['cpu', 'cuda'] as const).map((backend, index) => ({
    backend,
    binarySha256: (index + 9).toString(16).repeat(64),
    manifestDigest: (index + 11).toString(16).repeat(64),
    sourceCommit: 'b'.repeat(40),
    toolchainDigest: (index + 13).toString(16).repeat(64),
  }));
  return {
    packages: [{ format: 'AppImage', fileName: 'GPT-Voice-2.4.0.AppImage', sizeBytes: 1, sha256: sha('b') }],
    catalog: {
      purpose: 'qualification',
      payloadSchemaVersion: 2,
      revision: 'qualification-catalog-v2.4.0',
      catalogDigest: sha('c'),
      keyringDigest: sha('d'),
      temporaryKeyId: 'qualification-key-v1',
      originIds: ['huggingface-models', 'qualification-runtime'],
    },
    runtimeArtifacts,
    directEngineArtifacts,
    toolIdentities: [{ id: 'node', version: '24.18.0', sha256: sha('e') }],
    qualificationServer: {
      originId: 'qualification-runtime',
      certificateSha256: sha('f'),
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
        profileId: 'linux-x64-cpu-baseline-v1',
        osIdentity: 'fedora-42-x64',
        hardwareClass: 'reference-linux-x64',
        runtimeRevision: 'runtime-cpu-v1',
        directEngineManifestDigest: sha('b'),
        toolIdentities: [{ id: 'node', version: '24.18.0', sha256: sha('c') }],
      },
      cuda: {
        profileId: 'linux-x64-cuda-sm120a-v1',
        osIdentity: 'fedora-42-x64',
        hardwareClass: 'reference-linux-x64-cuda',
        runtimeRevision: 'runtime-cuda-v1',
        directEngineManifestDigest: sha('c'),
        toolIdentities: [{ id: 'node', version: '24.18.0', sha256: sha('d') }],
      },
    },
  };
}

describe('LocalWhisperQualificationInputProducer', () => {
  it('freezes candidate, platform, profiles, and graph strictly in forward order', () => {
    const candidate = producer.produceCandidate(candidateSeed());
    const foundation = producer.produceLinuxFoundation(candidate, platformSeed());
    assert.equal(foundation.platformInput.candidateInputDigest, candidate.candidateInputDigest);
    assert.equal(foundation.profiles.length, 2);
    assert.deepEqual(
      foundation.platformGraph.profileDigests,
      foundation.profiles.map((profile) => profile.profileDigest).sort(),
    );
    assert.equal(
      (foundation.platformInput.predecessor as Record<string, unknown>).cutoffTimestampUtc,
      '2026-08-03T12:00:00Z',
    );
  });

  it('sorts unordered identities and rejects a dirty or implicit candidate seed', () => {
    const candidate = producer.produceCandidate(candidateSeed());
    assert.deepEqual(
      (candidate.sharedToolIdentities as Array<{ id: string }>).map(({ id }) => id),
      ['git', 'node'],
    );
    assert.throws(
      () => producer.produceCandidate({ ...candidateSeed(), freezeTimestampUtc: '' }),
      /QUALIFICATION_CANDIDATEINPUT_INVALID/u,
    );
  });

  it('does not permit a Windows package or a later-graph digest in Linux input', () => {
    const candidate = producer.produceCandidate(candidateSeed());
    const seed = platformSeed();
    assert.throws(
      () =>
        producer.produceLinuxFoundation(candidate, {
          ...seed,
          packages: [{ format: 'nsis', fileName: 'GPT-Voice-2.4.0.exe', sizeBytes: 1, sha256: sha('a') }],
        }),
      /QUALIFICATION_PLATFORM_PACKAGE_INVALID/u,
    );
    assert.throws(
      () =>
        producer.produceLinuxFoundation(candidate, { ...seed, catalog: { ...seed.catalog, profileDigest: sha('a') } }),
      /QUALIFICATION_PLATFORMINPUT_INVALID/u,
    );
  });
});
