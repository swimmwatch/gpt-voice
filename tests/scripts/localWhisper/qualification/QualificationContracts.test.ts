import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as path from 'node:path';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
  LocalWhisperQualificationGraphProducer,
  LocalWhisperQualificationValidator,
  qualificationCanonicalJson,
  qualificationDocumentDigest,
  type DigestQualificationDocumentKind,
  type LocalWhisperQualificationPlatformBranch,
} from '../../../../scripts/local-whisper/qualification/QualificationContracts';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const DIGEST = 'a'.repeat(64);
const CANDIDATE_FREEZE_TIMESTAMP = '2026-08-03T12:00:00Z';

const validator = new LocalWhisperQualificationValidator(qualificationRoot);
const producer = new LocalWhisperQualificationGraphProducer(validator);

function digest(seed: number): string {
  return seed.toString(16).padStart(64, '0');
}

function withoutDigest(document: Readonly<Record<string, unknown>>, field: string): Record<string, unknown> {
  const copy = structuredClone(document) as Record<string, unknown>;
  delete copy[field];
  return copy;
}

function refreeze(
  kind: DigestQualificationDocumentKind,
  document: Readonly<Record<string, unknown>>,
  field: string,
): Readonly<Record<string, unknown>> {
  return producer.freeze(kind, withoutDigest(document, field));
}

function candidateInput(): Readonly<Record<string, unknown>> {
  return producer.freeze('candidateInput', {
    schemaVersion: 2,
    specificationRevision: 10,
    candidateSemVer: '2.4.0',
    freezeTimestampUtc: CANDIDATE_FREEZE_TIMESTAMP,
    source: {
      commit: 'b'.repeat(40),
      treeState: 'Clean',
      treeDigest: 'c'.repeat(64),
      sharedSourceManifestDigest: 'd'.repeat(64),
      patchLockDigest: 'e'.repeat(64),
    },
    qualificationContract: {
      catalogPayloadSchemaVersion: 2,
      trustPolicyRevision: 'qualification-trust-v2',
      runtimeTransferProfile: 'restricted-tar-gzip-v1',
      modelTransferProfile: 'pinned-raw-model-v1',
      redirectPolicyRevision: 'signed-redirect-v1',
      algorithmRevision: 'qualification-algorithms-v1',
      evidenceSchemaRevision: 'qualification-evidence-v2',
    },
    modelArtifacts: LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map((model) => ({
      family: model.family,
      variant: model.variant,
      fileName: model.file,
      sizeBytes: model.sizeBytes,
      sha256: model.sha256,
      transferProfile: 'pinned-raw-model-v1',
      repository: 'ggerganov/whisper.cpp',
      commit: '5359861c739e955e79d9a303bcbc70fb988958b1',
      url: `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/${model.file}`,
      noticeDigest: 'f'.repeat(64),
    })),
    corpus: {
      repository: 'google/fleurs',
      commit: '70bb2e84b976b7e960aa89f1c648e09c59f894dd',
      manifestDigest: '1'.repeat(64),
      noticeDigest: '2'.repeat(64),
      materializerDigest: '3'.repeat(64),
      performanceFixtureDigest: '4'.repeat(64),
      locales: ['en_us', 'ru_ru'],
    },
    platformMatrix: [
      { platform: 'linux', architecture: 'x64', backend: 'cpu' },
      { platform: 'linux', architecture: 'x64', backend: 'cuda' },
      { platform: 'win32', architecture: 'x64', backend: 'cpu' },
      { platform: 'win32', architecture: 'x64', backend: 'cuda' },
    ],
    predecessorSelection: {
      rule: 'highest-stable-predecessor',
      cutoffField: 'freezeTimestampUtc',
      stableOnly: true,
    },
    fixtureDigest: LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
    sharedToolIdentities: [{ id: 'node', version: '24.18.0', sha256: '5'.repeat(64) }],
  });
}

function platformInput(candidateInputDigest: string): Readonly<Record<string, unknown>> {
  return producer.freeze('platformInput', {
    schemaVersion: 2,
    specificationRevision: 10,
    candidateInputDigest,
    platform: 'linux',
    architecture: 'x64',
    packages: [
      {
        format: 'AppImage',
        fileName: 'GPT-Voice-2.4.0.AppImage',
        sizeBytes: 1,
        sha256: '6'.repeat(64),
      },
    ],
    catalog: {
      purpose: 'qualification',
      payloadSchemaVersion: 2,
      revision: 'qualification-catalog-v2',
      catalogDigest: '7'.repeat(64),
      keyringDigest: '8'.repeat(64),
      temporaryKeyId: 'qualification-key-v1',
      originIds: ['huggingface-models', 'qualification-runtime'],
    },
    runtimeArtifacts: ['cpu', 'cuda'].map((backend, index) => ({
      artifactId: `runtime-${backend}`,
      revision: `runtime-${backend}-v1`,
      backend,
      transferProfile: 'restricted-tar-gzip-v1',
      sizeBytes: index + 1,
      sha256: digest(10 + index),
      manifestDigest: digest(20 + index),
      signatureInputDigest: digest(30 + index),
      reproducibilityDigest: digest(40 + index),
    })),
    directEngineArtifacts: ['cpu', 'cuda'].map((backend, index) => ({
      backend,
      binarySha256: digest(50 + index),
      manifestDigest: digest(60 + index),
      sourceCommit: 'c'.repeat(40),
      toolchainDigest: digest(70 + index),
    })),
    toolIdentities: [
      { id: 'cmake', version: '3.31.8', sha256: digest(80) },
      { id: 'node', version: '24.18.0', sha256: digest(81) },
    ],
    qualificationServer: {
      originId: 'qualification-runtime',
      certificateSha256: digest(90),
      objectDigests: [digest(91), digest(92)],
    },
    platformEvidence: {
      noticesDigest: digest(93),
      sbomDigest: digest(94),
      provenanceDigest: digest(95),
    },
    predecessor: {
      version: '2.3.0',
      fileName: 'GPT-Voice-2.3.0.AppImage',
      sha256: '80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111',
      selectionRule: 'highest-stable-predecessor',
      cutoffTimestampUtc: CANDIDATE_FREEZE_TIMESTAMP,
    },
  });
}

function profile(
  backend: 'cpu' | 'cuda',
  candidateInputDigest: string,
  platformInputDigest: string,
): Readonly<Record<string, unknown>> {
  return producer.freeze('profile', {
    schemaVersion: 2,
    specificationRevision: 10,
    candidateInputDigest,
    platformInputDigest,
    profileId: `linux-x64-${backend}-v2`,
    platform: 'linux',
    architecture: 'x64',
    backend,
    osIdentity: 'fedora-42-x64',
    hardwareClass: 'reference-linux-x64',
    runtimeRevision: `runtime-${backend}-v1`,
    modelIdentities: LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map(({ family, variant, sha256 }) => ({
      family,
      variant,
      sha256,
    })),
    corpusManifestDigest: '1'.repeat(64),
    directEngineManifestDigest: backend === 'cpu' ? digest(60) : digest(61),
    toolIdentities: [{ id: 'node', version: '24.18.0', sha256: '3'.repeat(64) }],
    algorithms: {
      wer: {
        unicodeNormalization: 'NFKC',
        apostropheMapping: 'U+2019-to-U+0027',
        caseMapping: 'locale-specific-lowercase-pinned-node-icu',
        tokenizer: 'unicode-letters-with-optional-internal-apostrophe-or-decimal-numbers-v1',
        distance: 'unit-cost-levenshtein',
        aggregation: 'total-edit-distance-over-total-reference-tokens',
      },
      rtf: {
        clock: 'process.hrtime.bigint',
        audioNanoseconds: 60_000_000_000,
        fixtureCount: 5,
        warmupRuns: 1,
        aggregation: 'median',
      },
      resourceSampling: {
        intervalMilliseconds: 100,
        maximumGapMilliseconds: 500,
        ramUnit: 'bytes',
        vramUnit: 'bytes',
        ownership: 'exact-start-identity-owned-process-tree',
      },
      peakRounding: { direction: 'up', quantumBytes: 67_108_864 },
      settlement: { timeoutMilliseconds: 10_000, zeroSampleCount: 10, sampleIntervalMilliseconds: 100 },
    },
    limits: {
      maximumBaseRtf: 1,
      maximumWerDeltaPercentagePoints: 1,
      ramTolerance: { percentage: 5, minimumBytes: 134_217_728, rule: 'max' },
      vramTolerance: { percentage: 5, minimumBytes: 67_108_864, rule: 'max' },
      loadUnloadCycles: 10,
      sequentialTranscriptions: 20,
      maximumIncreasingSettledPeakDeltaBytes: 67_108_864,
    },
  });
}

function directEngineManifest(): Readonly<Record<string, unknown>> {
  return producer.freeze('directEngineManifest', {
    schemaVersion: 1,
    specificationRevision: 10,
    backend: 'cpu',
    profileId: 'linux-x64-cpu-baseline-v1',
    source: {
      repository: 'https://github.com/ggml-org/whisper.cpp.git',
      commit: 'f049fff95a089aa9969deb009cdd4892b3e74916',
      sourceManifestDigest: '1'.repeat(64),
      patchLockId: 'local-whisper-whisper-cpp-device-cancel-v1',
      patchedManifestDigest: '2'.repeat(64),
    },
    projectSourceDigest: '3'.repeat(64),
    toolchainDigest: '4'.repeat(64),
    runtimeBuildDigest: '5'.repeat(64),
    binary: { fileName: 'local-whisper-whisper-cpp-direct-engine', sizeBytes: 1, sha256: '6'.repeat(64) },
    libraries: [],
    reproducibility: {
      cleanRootCount: 2,
      networkIsolation: 'user-network-namespace',
      binaryDigestA: '6'.repeat(64),
      binaryDigestB: '6'.repeat(64),
      reproducible: true,
    },
    descriptorProtocol: {
      control: 'stdin-bounded-json-v1',
      model: 'inherited-read-only-regular-fd-3',
      wav: 'inherited-read-only-regular-fd-4',
      textOutput: 'stdout-utf8-exact',
      failure: 'stderr-bounded-json-v1',
    },
    commandMapping: {
      temperatureHundredths: 0,
      strategy: 'greedy',
      candidateCount: 1,
      promptMode: 'none',
      warmup: 'one-second-zero-pcm',
      deviceSelection: 'captured-registry-exact-ordinal',
      enginePath: 'WhisperCppEngine-direct-no-worker-ipc',
    },
  });
}

function branch(): LocalWhisperQualificationPlatformBranch {
  const candidate = candidateInput();
  const candidateDigest = String(candidate.candidateInputDigest);
  const input = platformInput(candidateDigest);
  const inputDigest = String(input.platformInputDigest);
  const profiles = [profile('cpu', candidateDigest, inputDigest), profile('cuda', candidateDigest, inputDigest)];
  const profileDigests = profiles.map((value) => String(value.profileDigest)).sort((a, b) => a.localeCompare(b, 'en'));
  const graph = producer.freeze('platformGraph', {
    schemaVersion: 2,
    specificationRevision: 10,
    candidateInputDigest: candidateDigest,
    platformInputDigest: inputDigest,
    platform: 'linux',
    architecture: 'x64',
    profileDigests,
  });
  const graphDigest = String(graph.platformGraphDigest);
  const profileByBackend = new Map(profiles.map((value) => [String(value.backend), String(value.profileDigest)]));
  const measurementSeries = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.flatMap(({ family, variant }) =>
    ['cpu', 'cuda'].map((backend) =>
      producer.freeze('measurementSeries', {
        schemaVersion: 2,
        specificationRevision: 10,
        candidateInputDigest: candidateDigest,
        platformGraphDigest: graphDigest,
        profileDigest: profileByBackend.get(backend),
        rowId: `linux-${backend}-${family}-${variant}`,
        sampleIntervalMilliseconds: 100,
        maximumGapMilliseconds: 500,
        samples: Array.from({ length: 10 }, (_unused, index) => ({
          elapsedNanoseconds: index * 100_000_000,
          ownedProcessCount: 0,
          ramBytes: 0,
          vramBytes: backend === 'cpu' ? 'notApplicable' : 0,
        })),
      }),
    ),
  );
  const seriesById = new Map(measurementSeries.map((series) => [String(series.rowId), String(series.seriesDigest)]));
  const gateNames = [
    'load',
    'warmup',
    'parity',
    'resources',
    'cancellation',
    'crashReload',
    'unload',
    'providerSwitch',
    'suspendResume',
    'appExit',
    'offlineRestart',
    'repetitions',
    'predecessor',
  ];
  let evidenceSeed = 200;
  const rows = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.flatMap(({ family, variant }) =>
    ['cpu', 'cuda'].map((backend) => {
      const id = `linux-${backend}-${family}-${variant}`;
      return {
        id,
        family,
        variant,
        backend,
        status: 'Pass',
        reasonCode: 'QUALIFIED',
        candidateInputDigest: candidateDigest,
        platformGraphDigest: graphDigest,
        profileDigest: profileByBackend.get(backend),
        evidenceDigest: digest(evidenceSeed++),
        measurementSeriesDigest: seriesById.get(id),
        measurements: {
          applicationWerPercentage: 5,
          directWerPercentage: 4.5,
          werDeltaPercentagePoints: 0.5,
          peakRamBytes: 67_108_864,
          peakVramBytes: backend === 'cpu' ? 'notApplicable' : 67_108_864,
          medianRtf: family === 'base' && variant === 'full' ? 0.5 : null,
        },
        gates: Object.fromEntries(gateNames.map((name) => [name, 'Pass'])),
      };
    }),
  );
  const result = producer.freeze('platformResult', {
    schemaVersion: 2,
    specificationRevision: 10,
    candidateInputDigest: candidateDigest,
    platformGraphDigest: graphDigest,
    platform: 'linux',
    representativeWindowsExecution: 'NotRun',
    measurementSeriesDigests: rows.map((row) => row.measurementSeriesDigest).sort((a, b) => a!.localeCompare(b!, 'en')),
    evidenceDigests: rows.map((row) => row.evidenceDigest).sort((a, b) => a.localeCompare(b, 'en')),
    rows,
  });
  const index = producer.freeze('evidenceIndex', {
    schemaVersion: 2,
    specificationRevision: 10,
    candidateInputDigest: candidateDigest,
    platformGraphDigest: graphDigest,
    platformResultDigest: result.resultDigest,
    platform: 'linux',
    fixtureDigest: LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
    entries: [
      {
        id: 'linux-result',
        platform: 'linux',
        evidenceClass: 'platform',
        sha256: result.resultDigest,
        byteLength: 1,
        sanitizedLabel: 'Linux qualification result',
      },
    ],
  });
  return {
    candidateInput: candidate,
    platformInput: input,
    profiles,
    platformGraph: graph,
    measurementSeries,
    platformResult: result,
    evidenceIndex: index,
  };
}

describe('Local Whisper qualification contracts', () => {
  it('compiles the revision-10 schema family and accepts only the truthful pre-freeze Linux state', () => {
    assert.doesNotThrow(() => validator.validateInputs());
  });

  it('produces and validates the complete forward-only Linux qualification branch', () => {
    const documents = branch();
    assert.doesNotThrow(() => validator.validatePlatformBranch(documents));
    assert.equal(Object.isFrozen(documents.candidateInput), true);
    assert.equal(Object.isFrozen(documents.profiles), false);
  });

  it('rejects the retired circular candidate shape, backward fields, and mixed branch edges', () => {
    assert.throws(
      () =>
        validator.validateDocument('candidateInput', {
          schemaVersion: 2,
          specificationRevision: 9,
          candidateDigest: DIGEST,
          profileDigests: [digest(1), digest(2)],
        }),
      /QUALIFICATION_CANDIDATEINPUT_INVALID/u,
    );
    const documents = branch();
    const platform = structuredClone(documents.platformInput) as Record<string, unknown>;
    platform.profileDigests = [digest(1), digest(2)];
    assert.throws(() => validator.validateDocument('platformInput', platform), /QUALIFICATION_PLATFORMINPUT_INVALID/u);

    const mixedPlatform = withoutDigest(
      documents.platformInput as Readonly<Record<string, unknown>>,
      'platformInputDigest',
    );
    mixedPlatform.candidateInputDigest = digest(999);
    const mixed = producer.freeze('platformInput', mixedPlatform);
    assert.throws(
      () => validator.validatePlatformBranch({ ...documents, platformInput: mixed }),
      /QUALIFICATION_MIXED_PLATFORM_BRANCH/u,
    );
  });

  it('rejects mutation, missing models, noncanonical arrays, and digest placeholders', () => {
    const candidate = candidateInput();
    const changed = structuredClone(candidate) as Record<string, unknown>;
    changed.candidateSemVer = '2.4.1';
    assert.throws(() => validator.validateDocument('candidateInput', changed), /QUALIFICATION_DIGEST_MISMATCH/u);
    const incomplete = withoutDigest(candidate, 'candidateInputDigest');
    (incomplete.modelArtifacts as unknown[]).pop();
    assert.throws(() => producer.freeze('candidateInput', incomplete), /QUALIFICATION_CANDIDATEINPUT_INVALID/u);
    const input = platformInput(String(candidate.candidateInputDigest));
    const reordered = withoutDigest(input, 'platformInputDigest');
    (reordered.runtimeArtifacts as unknown[]).reverse();
    assert.throws(() => producer.freeze('platformInput', reordered), /QUALIFICATION_PLATFORM_RUNTIME_ORDER_INVALID/u);
    assert.throws(
      () => validator.validateDocument('candidateInput', { ...candidate, candidateInputDigest: '0'.repeat(64) }),
      /QUALIFICATION_DIGEST_MISMATCH/u,
    );
  });

  it('canonicalizes object keys deterministically and rejects non-finite numbers', () => {
    assert.equal(qualificationCanonicalJson({ z: 1, a: { d: 2, b: 1 } }), '{"a":{"b":1,"d":2},"z":1}');
    assert.equal(
      qualificationDocumentDigest({ digest: DIGEST, z: 1, a: 2 }, 'digest'),
      qualificationDocumentDigest({ a: 2, z: 1, digest: digest(2) }, 'digest'),
    );
    assert.throws(() => qualificationCanonicalJson({ value: Number.POSITIVE_INFINITY }), /NONFINITE/u);
  });

  it('freezes every Section 19.2 algorithm, unit, bound, tolerance, and model identity', () => {
    const documents = branch();
    const current = documents.profiles[0] as Readonly<Record<string, unknown>>;
    const changed = withoutDigest(current, 'profileDigest');
    (changed.algorithms as Record<string, Record<string, unknown>>).resourceSampling.intervalMilliseconds = 101;
    assert.throws(() => producer.freeze('profile', changed), /QUALIFICATION_PROFILE_INVALID/u);
  });

  it('validates direct-engine source, descriptor, command, reproducibility, and revision identity', () => {
    const document = directEngineManifest();
    assert.doesNotThrow(() => validator.validateDocument('directEngineManifest', document));
    const changed = structuredClone(document) as Record<string, unknown>;
    changed.projectSourceDigest = '9'.repeat(64);
    assert.throws(() => validator.validateDocument('directEngineManifest', changed), /QUALIFICATION_DIGEST_MISMATCH/u);
  });

  it('requires exact result series/evidence sets and matching branch edges', () => {
    const documents = branch();
    const result = withoutDigest(documents.platformResult as Readonly<Record<string, unknown>>, 'resultDigest');
    const rows = result.rows as Array<Record<string, unknown>>;
    rows[0]!.platformGraphDigest = digest(400);
    assert.throws(() => producer.freeze('platformResult', result), /QUALIFICATION_MIXED_PLATFORM_BRANCH/u);

    const missing = withoutDigest(documents.platformResult as Readonly<Record<string, unknown>>, 'resultDigest');
    (missing.measurementSeriesDigests as unknown[]).pop();
    assert.throws(() => producer.freeze('platformResult', missing), /QUALIFICATION_PLATFORMRESULT_INVALID/u);
  });

  it('rejects private fields, host paths, measurement gaps, and cross-platform evidence entries', () => {
    assert.throws(
      () => validator.validateDocument('candidateInput', { ...candidateInput(), transcript: 'private' }),
      /QUALIFICATION_PRIVATE_FIELD_REJECTED/u,
    );
    const documents = branch();
    const series = withoutDigest(documents.measurementSeries[0] as Readonly<Record<string, unknown>>, 'seriesDigest');
    (series.samples as Array<Record<string, unknown>>)[9]!.elapsedNanoseconds = 2_000_000_000;
    assert.throws(() => producer.freeze('measurementSeries', series), /QUALIFICATION_MEASUREMENT_SERIES_GAP/u);

    const index = withoutDigest(documents.evidenceIndex as Readonly<Record<string, unknown>>, 'indexDigest');
    (index.entries as Array<Record<string, unknown>>)[0]!.platform = 'win32';
    assert.throws(() => producer.freeze('evidenceIndex', index), /QUALIFICATION_MIXED_PLATFORM_BRANCH/u);
  });

  it('does not permit callers to prepopulate a digest field', () => {
    assert.throws(
      () =>
        producer.freeze('candidateInput', {
          ...withoutDigest(candidateInput(), 'candidateInputDigest'),
          candidateInputDigest: DIGEST,
        }),
      /QUALIFICATION_DIGEST_FIELD_ALREADY_PRESENT/u,
    );
  });

  it('refreezes valid documents only through their own digest field', () => {
    const current = candidateInput();
    const frozen = refreeze('candidateInput', current, 'candidateInputDigest');
    assert.equal(frozen.candidateInputDigest, current.candidateInputDigest);
  });
});
