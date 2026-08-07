import {
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
  LOCAL_WHISPER_MODEL_FAMILIES,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperModelIdentity,
  type LocalWhisperRevisionId,
  type LocalWhisperRuntimeIdentity,
} from '@shared/localWhisper';
import {
  LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogPayload,
  type LocalWhisperCatalogRuntimeEntry,
  type LocalWhisperCatalogCudaApplicability,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
  LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
  LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
  localWhisperUpstreamModelUrl,
} from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

const GIBIBYTE = 1024 ** 3;
const MODEL_ORIGIN_ID = 'public-hugging-face-model-origin';
const MODEL_ORIGIN = 'https://huggingface.co';
const MODEL_POLICY_ID = 'upstream-model-policy-v1';
const RUNTIME_POLICY_ID = 'qualification-runtime-policy-v1';

export type QualificationCatalogPlatform = 'linux' | 'win32';

const RUNTIME_CONTRACTS = Object.freeze({
  linux: Object.freeze({
    cpu: Object.freeze({
      packRevision: 'whisper-cpp-linux-x64-cpu-baseline-v1',
      dependencyFamily: 'glibc',
      computeTargets: Object.freeze(['x86-64-v2']),
    }),
    cuda: Object.freeze({
      packRevision: 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
      dependencyFamily: 'cuda-12.8.1',
      computeTargets: Object.freeze(['sm_120a-real']),
    }),
  }),
  win32: Object.freeze({
    cpu: Object.freeze({
      packRevision: 'whisper-cpp-windows-x64-cpu-v1',
      dependencyFamily: 'msvc-v143-vc-runtime-14.51.36247.0',
      computeTargets: Object.freeze(['x86-64-sse2']),
    }),
    cuda: Object.freeze({
      packRevision: 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1',
      dependencyFamily: 'cuda-12.8.1',
      computeTargets: Object.freeze(['sm_120a-real']),
    }),
  }),
});

const APPROXIMATE_MEMORY_BYTES: Readonly<Record<string, { readonly ram: number; readonly vram: number }>> =
  Object.freeze({
    tiny: Object.freeze({ ram: 4 * GIBIBYTE, vram: 2 * GIBIBYTE }),
    base: Object.freeze({ ram: 4 * GIBIBYTE, vram: 2 * GIBIBYTE }),
    small: Object.freeze({ ram: 6 * GIBIBYTE, vram: 3 * GIBIBYTE }),
    medium: Object.freeze({ ram: 10 * GIBIBYTE, vram: 6 * GIBIBYTE }),
    'large-v3': Object.freeze({ ram: 16 * GIBIBYTE, vram: 8 * GIBIBYTE }),
    'large-v3-turbo': Object.freeze({ ram: 10 * GIBIBYTE, vram: 6 * GIBIBYTE }),
  });

function cudaApplicability(platform: QualificationCatalogPlatform): LocalWhisperCatalogCudaApplicability {
  return Object.freeze({
    computeTarget: 'sm_120a-real',
    minimumDriverVersion: platform === 'linux' ? '570.26' : '570.65',
    minimumComputeCapability: '12.0',
    maximumComputeCapability: '12.0',
    minimumTotalVramBytes: 6 * 1024 ** 3,
    policyRevision: revisionId('rtx50-sm120a-policy-v1'),
  });
}

export interface QualificationRuntimeCatalogSeed {
  readonly backend: 'cpu' | 'cuda';
  readonly platform: QualificationCatalogPlatform;
  readonly architecture: 'x64';
  readonly archiveFileName: string;
  readonly archiveSizeBytes: number;
  readonly archiveSha256: string;
  readonly archiveSignature: string;
  readonly buildRevision: string;
  readonly packRevision: string;
  readonly expectedFiles: LocalWhisperRuntimeIdentity['expectedFiles'];
  readonly prerequisites: readonly string[];
  readonly provenanceId: string;
  readonly sbomRevision: string;
  readonly noticeIds: readonly string[];
  readonly licenseIds: readonly string[];
}

export interface QualificationCatalogSeed {
  readonly platform: QualificationCatalogPlatform;
  readonly candidateSemVer: string;
  readonly appRevision?: string;
  readonly catalogRevision: string;
  readonly qualificationKeyId: string;
  readonly runtimeOriginId: string;
  readonly runtimeOrigin: string;
  readonly sourceCommit: string;
  readonly runtimes: readonly QualificationRuntimeCatalogSeed[];
  readonly qualificationStatus?: 'estimateOnly' | 'planned';
}

function artifactId(value: string) {
  const parsed = toLocalWhisperArtifactId(value);
  if (!parsed) throw new Error(`Invalid qualification artifact ID: ${value}`);
  return parsed;
}

function revisionId(value: string): LocalWhisperRevisionId {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error(`Invalid qualification revision ID: ${value}`);
  return parsed;
}

function modelIdentity(
  family: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]['family'],
  variant: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]['variant'],
): LocalWhisperModelIdentity {
  return Object.freeze({
    engine: 'whisperCpp',
    logicalModel: family,
    sourceCheckpointRevision: revisionId(LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT),
    artifactRevision: revisionId(`whisper-cpp-${family}-${variant}-v1`),
    nativeFormat: 'ggml',
    variant,
  });
}

function memoryEstimate(
  model: LocalWhisperModelIdentity,
  runtime: LocalWhisperCatalogRuntimeEntry,
): LocalWhisperMemoryEstimateRecord {
  const capacity = APPROXIMATE_MEMORY_BYTES[model.logicalModel];
  if (!capacity) throw new Error('Missing Local Whisper qualification memory estimate');
  const cpu = runtime.identity.backend === 'cpu';
  return Object.freeze({
    target: runtime.identity.target,
    backend: runtime.identity.backend,
    runtimePackRevision: runtime.identity.packRevision,
    model,
    estimatedPeakRamBytes: capacity.ram,
    estimatedPeakVramBytes: cpu ? 'notApplicable' : capacity.vram,
    evidenceBasis: 'derived',
    sourceBuildRevision: runtime.identity.buildRevision,
    methodologyLabel: 'Approximate requirements; rounded release-1 capacity guidance',
  });
}

/** Produces the closed qualification-purpose catalog payload without owning private signing material. */
export class LocalWhisperQualificationCatalogProducer {
  public produce(seed: QualificationCatalogSeed): LocalWhisperCatalogPayload {
    if (seed.runtimes.length !== 2 || new Set(seed.runtimes.map(({ backend }) => backend)).size !== 2) {
      throw new Error('Qualification catalog requires one CPU and one CUDA runtime');
    }
    const appRevision = revisionId(seed.appRevision ?? `app-v${seed.candidateSemVer}`);
    const catalogRevision = revisionId(seed.catalogRevision);
    const signingKeyId = artifactId(seed.qualificationKeyId);
    const runtimeOriginId = artifactId(seed.runtimeOriginId);
    const runtimeOrigin = new URL(seed.runtimeOrigin);
    if (
      runtimeOrigin.protocol !== 'https:' ||
      runtimeOrigin.hostname !== '127.0.0.1' ||
      runtimeOrigin.pathname !== '/' ||
      runtimeOrigin.search !== '' ||
      runtimeOrigin.hash !== '' ||
      runtimeOrigin.port === ''
    ) {
      throw new Error('Qualification runtime origin must be an exact loopback HTTPS origin');
    }
    const runtimes = [...seed.runtimes]
      .sort((left, right) => left.backend.localeCompare(right.backend, 'en'))
      .map((runtime): LocalWhisperCatalogRuntimeEntry => {
        const cpu = runtime.backend === 'cpu';
        const contract = RUNTIME_CONTRACTS[seed.platform][runtime.backend];
        if (
          runtime.platform !== seed.platform ||
          runtime.architecture !== 'x64' ||
          runtime.packRevision !== contract.packRevision
        ) {
          throw new Error('Qualification catalog runtime platform contract invalid');
        }
        const identity: LocalWhisperRuntimeIdentity = Object.freeze({
          engine: 'whisperCpp',
          platform: seed.platform,
          architecture: 'x64',
          target: cpu ? 'cpu' : 'gpu',
          backend: runtime.backend,
          dependencyFamily: contract.dependencyFamily,
          upstreamRevision: revisionId('whisper-cpp-v1.9.1-f049fff'),
          buildRevision: revisionId(runtime.buildRevision),
          computeTargets: contract.computeTargets,
          protocolVersion: 1,
          packRevision: revisionId(runtime.packRevision),
          catalogRevision,
          appRevision,
          signingKeyId,
          archiveSizeBytes: runtime.archiveSizeBytes,
          archiveSha256: runtime.archiveSha256,
          archiveSignature: runtime.archiveSignature,
          originId: runtimeOriginId,
          expectedFiles: Object.freeze([...runtime.expectedFiles]),
          prerequisites: Object.freeze([...runtime.prerequisites]),
          provenanceId: artifactId(runtime.provenanceId),
          sbomRevision: revisionId(runtime.sbomRevision),
          noticeIds: Object.freeze(runtime.noticeIds.map(artifactId)),
        });
        return Object.freeze({
          identity,
          applicability: cpu ? null : cudaApplicability(seed.platform),
          recommended: true,
          qualificationStatus: seed.qualificationStatus ?? 'planned',
          licenseIds: Object.freeze(runtime.licenseIds.map(artifactId)),
          transferProfile: 'restricted-tar-gzip-v1',
          source: Object.freeze({
            repository: 'swimmwatch/gpt-voice',
            commit: seed.sourceCommit,
            file: runtime.archiveFileName,
            url: `${seed.runtimeOrigin}/runtime/${runtime.archiveFileName}`,
            redirectPolicyId: artifactId(RUNTIME_POLICY_ID),
          }),
          sbomId: artifactId(`qualification-${runtime.backend}-runtime-sbom`),
        });
      });
    const runtimeRevisions = Object.freeze(runtimes.map(({ identity }) => identity.packRevision));
    const models: readonly LocalWhisperCatalogModelEntry[] = Object.freeze(
      LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map((model) => {
        const identity = modelIdentity(model.family, model.variant);
        return Object.freeze({
          identity,
          originId: artifactId(MODEL_ORIGIN_ID),
          expectedFiles: Object.freeze([
            Object.freeze({
              fileId: artifactId(`model-${model.family}-${model.variant}`),
              kind: 'data' as const,
              mode: 0o600,
              sizeBytes: model.sizeBytes,
              sha256: model.sha256,
            }),
          ]),
          transferSizeBytes: model.sizeBytes,
          transferSha256: model.sha256,
          transferSignature: null,
          signingKeyId: null,
          installedSizeBytes: model.sizeBytes,
          compatibleRuntimePackRevisions: runtimeRevisions,
          recommended: model.family === 'base',
          qualificationStatus: seed.qualificationStatus ?? ('planned' as const),
          provenanceId: artifactId(`upstream-${model.family}-${model.variant}-provenance`),
          licenseIds: Object.freeze([artifactId('mit-license')]),
          noticeIds: Object.freeze([artifactId('whisper-cpp-model-notice')]),
          transferProfile: 'pinned-raw-model-v1' as const,
          source: Object.freeze({
            repository: LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
            commit: LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
            file: model.file,
            url: localWhisperUpstreamModelUrl(model.file),
            redirectPolicyId: artifactId(MODEL_POLICY_ID),
          }),
          sbomId: artifactId(`upstream-${model.family}-${model.variant}-sbom`),
        });
      }),
    );
    return structuredClone({
      schemaVersion: LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
      purpose: 'qualification',
      catalogRevision,
      displayMetadata: {
        title: `Local Whisper ${seed.platform === 'linux' ? 'Linux' : 'Windows'} qualification catalog`,
        summary:
          seed.platform === 'linux'
            ? 'Single-use catalog for the frozen Linux qualification branch.'
            : 'Single-use catalog for Windows development readiness.',
      },
      compatibleAppRevisions: [appRevision],
      workerProtocolVersion: 1,
      languageCatalogRevision: LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
      languages: LOCAL_WHISPER_LANGUAGE_CATALOG,
      modelFamilies: LOCAL_WHISPER_MODEL_FAMILIES,
      origins: [
        { id: artifactId(MODEL_ORIGIN_ID), origin: MODEL_ORIGIN },
        { id: runtimeOriginId, origin: seed.runtimeOrigin },
      ],
      redirectPolicies: [
        {
          id: artifactId(RUNTIME_POLICY_ID),
          initialScheme: 'https',
          initialHost: '127.0.0.1',
          initialPort: Number(runtimeOrigin.port),
          initialPathPrefix: '/runtime/',
          maxRedirects: 0,
          allowedTargets: [{ host: '127.0.0.1', port: Number(runtimeOrigin.port), pathPrefix: '/runtime/' }],
          forwardRangeHeaders: true,
          credentialForwarding: false,
        },
        {
          id: artifactId(MODEL_POLICY_ID),
          initialScheme: 'https',
          initialHost: 'huggingface.co',
          initialPort: 443,
          initialPathPrefix: `/${LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY}/resolve/${LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT}/`,
          maxRedirects: 5,
          allowedTargets: [{ host: 'us.aws.cdn.hf.co', port: 443, pathPrefix: '/' }],
          forwardRangeHeaders: true,
          credentialForwarding: false,
        },
      ],
      runtimes,
      models,
      memoryEstimates: models.flatMap((model) => runtimes.map((runtime) => memoryEstimate(model.identity, runtime))),
      qualifiedMemoryPeaks: [],
      denylist: { runtimes: [], models: [] },
    } satisfies LocalWhisperCatalogPayload);
  }
}
