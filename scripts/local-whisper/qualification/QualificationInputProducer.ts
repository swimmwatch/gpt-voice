import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import {
  LOCAL_WHISPER_QUALIFICATION_FIXTURE_DIGEST,
  LocalWhisperQualificationGraphProducer,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';

const SPECIFICATION_REVISION = 10;
const SCHEMA_VERSION = 2;
const MODEL_REPOSITORY = 'ggerganov/whisper.cpp';
const MODEL_COMMIT = '5359861c739e955e79d9a303bcbc70fb988958b1';
const FLEURS_REPOSITORY = 'google/fleurs';
const FLEURS_COMMIT = '70bb2e84b976b7e960aa89f1c648e09c59f894dd';

export interface QualificationToolIdentity {
  readonly id: string;
  readonly version: string;
  readonly sha256: string;
}

export interface QualificationCandidateSeed {
  readonly candidateSemVer: string;
  readonly freezeTimestampUtc: string;
  readonly source: {
    readonly commit: string;
    readonly treeDigest: string;
    readonly sharedSourceManifestDigest: string;
    readonly patchLockDigest: string;
  };
  readonly modelNoticeDigest: string;
  readonly corpus: {
    readonly manifestDigest: string;
    readonly noticeDigest: string;
    readonly materializerDigest: string;
    readonly performanceFixtureDigest: string;
  };
  readonly sharedToolIdentities: readonly QualificationToolIdentity[];
}

export interface QualificationLinuxPlatformSeed {
  readonly packages: readonly Readonly<Record<string, unknown>>[];
  readonly catalog: Readonly<Record<string, unknown>>;
  readonly runtimeArtifacts: readonly Readonly<Record<string, unknown>>[];
  readonly directEngineArtifacts: readonly Readonly<Record<string, unknown>>[];
  readonly toolIdentities: readonly QualificationToolIdentity[];
  readonly qualificationServer: Readonly<Record<string, unknown>>;
  readonly platformEvidence: Readonly<Record<string, unknown>>;
  readonly predecessor: {
    readonly version: string;
    readonly fileName: string;
    readonly sha256: string;
  };
  readonly profiles: Readonly<
    Record<
      'cpu' | 'cuda',
      {
        readonly profileId: string;
        readonly osIdentity: string;
        readonly hardwareClass: string;
        readonly runtimeRevision: string;
        readonly directEngineManifestDigest: string;
        readonly toolIdentities: readonly QualificationToolIdentity[];
      }
    >
  >;
}

export interface QualificationLinuxFoundation {
  readonly candidateInput: Readonly<Record<string, unknown>>;
  readonly platformInput: Readonly<Record<string, unknown>>;
  readonly profiles: readonly Readonly<Record<string, unknown>>[];
  readonly platformGraph: Readonly<Record<string, unknown>>;
}

function digestField(document: Readonly<Record<string, unknown>>, field: string): string {
  const value = document[field];
  if (typeof value !== 'string') throw new Error(`QUALIFICATION_${field.toUpperCase()}_MISSING`);
  return value;
}

function sortedTools(values: readonly QualificationToolIdentity[]): readonly QualificationToolIdentity[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

function profileAlgorithms(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    wer: Object.freeze({
      unicodeNormalization: 'NFKC',
      apostropheMapping: 'U+2019-to-U+0027',
      caseMapping: 'locale-specific-lowercase-pinned-node-icu',
      tokenizer: 'unicode-letters-with-optional-internal-apostrophe-or-decimal-numbers-v1',
      distance: 'unit-cost-levenshtein',
      aggregation: 'total-edit-distance-over-total-reference-tokens',
    }),
    rtf: Object.freeze({
      clock: 'process.hrtime.bigint',
      audioNanoseconds: 60_000_000_000,
      fixtureCount: 5,
      warmupRuns: 1,
      aggregation: 'median',
    }),
    resourceSampling: Object.freeze({
      intervalMilliseconds: 100,
      maximumGapMilliseconds: 500,
      ramUnit: 'bytes',
      vramUnit: 'bytes',
      ownership: 'exact-start-identity-owned-process-tree',
    }),
    peakRounding: Object.freeze({ direction: 'up', quantumBytes: 67_108_864 }),
    settlement: Object.freeze({
      timeoutMilliseconds: 10_000,
      zeroSampleCount: 10,
      sampleIntervalMilliseconds: 100,
    }),
  });
}

function profileLimits(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    maximumBaseRtf: 1,
    maximumWerDeltaPercentagePoints: 1,
    ramTolerance: Object.freeze({ percentage: 5, minimumBytes: 134_217_728, rule: 'max' }),
    vramTolerance: Object.freeze({ percentage: 5, minimumBytes: 67_108_864, rule: 'max' }),
    loadUnloadCycles: 10,
    sequentialTranscriptions: 20,
    maximumIncreasingSettledPeakDeltaBytes: 67_108_864,
  });
}

/** Owns the only supported forward-order construction of shared and Linux qualification inputs. */
export class LocalWhisperQualificationInputProducer {
  private readonly graph: LocalWhisperQualificationGraphProducer;

  public constructor(validator: LocalWhisperQualificationValidator) {
    this.graph = new LocalWhisperQualificationGraphProducer(validator);
  }

  public produceCandidate(seed: QualificationCandidateSeed): Readonly<Record<string, unknown>> {
    return this.graph.freeze('candidateInput', {
      schemaVersion: SCHEMA_VERSION,
      specificationRevision: SPECIFICATION_REVISION,
      candidateSemVer: seed.candidateSemVer,
      freezeTimestampUtc: seed.freezeTimestampUtc,
      source: {
        commit: seed.source.commit,
        treeState: 'Clean',
        treeDigest: seed.source.treeDigest,
        sharedSourceManifestDigest: seed.source.sharedSourceManifestDigest,
        patchLockDigest: seed.source.patchLockDigest,
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
        repository: MODEL_REPOSITORY,
        commit: MODEL_COMMIT,
        url: `https://huggingface.co/${MODEL_REPOSITORY}/resolve/${MODEL_COMMIT}/${model.file}`,
        noticeDigest: seed.modelNoticeDigest,
      })),
      corpus: {
        repository: FLEURS_REPOSITORY,
        commit: FLEURS_COMMIT,
        manifestDigest: seed.corpus.manifestDigest,
        noticeDigest: seed.corpus.noticeDigest,
        materializerDigest: seed.corpus.materializerDigest,
        performanceFixtureDigest: seed.corpus.performanceFixtureDigest,
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
      sharedToolIdentities: sortedTools(seed.sharedToolIdentities),
    });
  }

  public produceLinuxFoundation(
    candidateInput: Readonly<Record<string, unknown>>,
    seed: QualificationLinuxPlatformSeed,
  ): QualificationLinuxFoundation {
    const candidateInputDigest = digestField(candidateInput, 'candidateInputDigest');
    const freezeTimestampUtc = candidateInput.freezeTimestampUtc;
    if (typeof freezeTimestampUtc !== 'string') throw new Error('QUALIFICATION_FREEZE_TIMESTAMP_MISSING');
    const platformInput = this.graph.freeze('platformInput', {
      schemaVersion: SCHEMA_VERSION,
      specificationRevision: SPECIFICATION_REVISION,
      candidateInputDigest,
      platform: 'linux',
      architecture: 'x64',
      packages: [...seed.packages].sort((left, right) =>
        String(left.fileName).localeCompare(String(right.fileName), 'en'),
      ),
      catalog: seed.catalog,
      runtimeArtifacts: [...seed.runtimeArtifacts].sort((left, right) =>
        String(left.backend).localeCompare(String(right.backend), 'en'),
      ),
      directEngineArtifacts: [...seed.directEngineArtifacts].sort((left, right) =>
        String(left.backend).localeCompare(String(right.backend), 'en'),
      ),
      toolIdentities: sortedTools(seed.toolIdentities),
      qualificationServer: seed.qualificationServer,
      platformEvidence: seed.platformEvidence,
      predecessor: {
        ...seed.predecessor,
        selectionRule: 'highest-stable-predecessor',
        cutoffTimestampUtc: freezeTimestampUtc,
      },
    });
    const platformInputDigest = digestField(platformInput, 'platformInputDigest');
    const corpus = candidateInput.corpus;
    if (typeof corpus !== 'object' || corpus === null || Array.isArray(corpus)) {
      throw new Error('QUALIFICATION_CORPUS_INPUT_MISSING');
    }
    const corpusManifestDigest = digestField(corpus as Readonly<Record<string, unknown>>, 'manifestDigest');
    const profiles = (['cpu', 'cuda'] as const).map((backend) => {
      const profileSeed = seed.profiles[backend];
      return this.graph.freeze('profile', {
        schemaVersion: SCHEMA_VERSION,
        specificationRevision: SPECIFICATION_REVISION,
        candidateInputDigest,
        platformInputDigest,
        profileId: profileSeed.profileId,
        platform: 'linux',
        architecture: 'x64',
        backend,
        osIdentity: profileSeed.osIdentity,
        hardwareClass: profileSeed.hardwareClass,
        runtimeRevision: profileSeed.runtimeRevision,
        modelIdentities: LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map(({ family, variant, sha256 }) => ({
          family,
          variant,
          sha256,
        })),
        corpusManifestDigest,
        directEngineManifestDigest: profileSeed.directEngineManifestDigest,
        toolIdentities: sortedTools(profileSeed.toolIdentities),
        algorithms: profileAlgorithms(),
        limits: profileLimits(),
      });
    });
    const profileDigests = profiles
      .map((profile) => digestField(profile, 'profileDigest'))
      .sort((left, right) => left.localeCompare(right, 'en'));
    const platformGraph = this.graph.freeze('platformGraph', {
      schemaVersion: SCHEMA_VERSION,
      specificationRevision: SPECIFICATION_REVISION,
      candidateInputDigest,
      platformInputDigest,
      platform: 'linux',
      architecture: 'x64',
      profileDigests,
    });
    return Object.freeze({ candidateInput, platformInput, profiles: Object.freeze(profiles), platformGraph });
  }
}
