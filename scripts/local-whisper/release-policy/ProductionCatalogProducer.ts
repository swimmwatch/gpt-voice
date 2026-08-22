import {
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
  LOCAL_WHISPER_MODEL_FAMILIES,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperArtifactId,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperModelIdentity,
  type LocalWhisperRevisionId,
  type LocalWhisperRuntimeIdentity,
} from '@shared/localWhisper';
import {
  LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
  type LocalWhisperCatalogCudaApplicability,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogPayload,
  type LocalWhisperCatalogRuntimeEntry,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
  LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
  LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
  localWhisperUpstreamModelUrl,
} from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import { sha256Bytes } from '../packaging/fileIntegrity';
import type { ProductionRuntimePlatform, ProductionRuntimeTarget } from './ProductionRuntimeArchiveProducer';

const GIBIBYTE = 1024 ** 3;
const RELEASE_REPOSITORY = 'swimmwatch/gpt-voice';
const RELEASE_ORIGIN_ID = 'production-github-release-origin';
const RELEASE_ORIGIN = 'https://github.com';
const RELEASE_POLICY_ID = 'production-github-release-policy-v1';
const MODEL_ORIGIN_ID = 'public-hugging-face-model-origin';
const MODEL_ORIGIN = 'https://huggingface.co';
const MODEL_POLICY_ID = 'upstream-model-policy-v1';
const RELEASE_TARGET_PATTERN = /^[\dA-Za-z][\w.-]{0,127}$/u;
const SOURCE_COMMIT_PATTERN = /^[a-f\d]{40}$/u;

const APPROXIMATE_MEMORY_BYTES: Readonly<Record<string, { readonly ram: number; readonly vram: number }>> =
  Object.freeze({
    tiny: Object.freeze({ ram: 4 * GIBIBYTE, vram: 2 * GIBIBYTE }),
    base: Object.freeze({ ram: 4 * GIBIBYTE, vram: 2 * GIBIBYTE }),
    small: Object.freeze({ ram: 6 * GIBIBYTE, vram: 3 * GIBIBYTE }),
    medium: Object.freeze({ ram: 10 * GIBIBYTE, vram: 6 * GIBIBYTE }),
    'large-v3': Object.freeze({ ram: 16 * GIBIBYTE, vram: 8 * GIBIBYTE }),
    'large-v3-turbo': Object.freeze({ ram: 10 * GIBIBYTE, vram: 6 * GIBIBYTE }),
  });

const RUNTIME_CONTRACTS = Object.freeze({
  linux: Object.freeze({
    cpu: Object.freeze({
      dependencyFamily: 'glibc-2.39',
      packRevision: 'whisper-cpp-linux-x64-cpu-baseline-v1',
      computeTargets: Object.freeze(['x86-64-v2']),
    }),
    'sm_120a-real': Object.freeze({
      dependencyFamily: 'cuda-12.8.1',
      packRevision: 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
      computeTargets: Object.freeze(['sm_120a-real']),
    }),
  }),
  win32: Object.freeze({
    cpu: Object.freeze({
      dependencyFamily: 'msvc-v145-vc-runtime-14.51.36247.0',
      packRevision: 'whisper-cpp-windows-x64-cpu-v1',
      computeTargets: Object.freeze(['x86-64-sse2']),
    }),
    'sm_120a-real': Object.freeze({
      dependencyFamily: 'cuda-12.8.1',
      packRevision: 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1',
      computeTargets: Object.freeze(['sm_120a-real']),
    }),
  }),
});

export interface ProductionCatalogRuntimeSeed {
  readonly archiveFileName: string;
  readonly archiveSha256: string;
  readonly archiveSignature: string;
  readonly archiveSizeBytes: number;
  readonly buildRevision: string;
  readonly expectedFiles: LocalWhisperRuntimeIdentity['expectedFiles'];
  readonly licenseIds: readonly string[];
  readonly noticeIds: readonly string[];
  readonly platform: ProductionRuntimePlatform;
  readonly prerequisites: readonly string[];
  readonly profileDigest: string;
  readonly profileId: string;
  readonly provenanceId: string;
  readonly sbomRevision: string;
  readonly target: ProductionRuntimeTarget;
}

export interface ProductionCatalogSeed {
  readonly appRevision: string;
  readonly catalogRevision: string;
  readonly platform: ProductionRuntimePlatform;
  readonly releaseTarget: string;
  readonly runtimes: readonly ProductionCatalogRuntimeSeed[];
  readonly signingKeyId: string;
  readonly sourceCommit: string;
}

function artifactId(value: string): LocalWhisperArtifactId {
  const parsed = toLocalWhisperArtifactId(value);
  if (!parsed) throw new Error(`Invalid production catalog artifact ID: ${value}`);
  return parsed;
}

function revisionId(value: string): LocalWhisperRevisionId {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error(`Invalid production catalog revision ID: ${value}`);
  return parsed;
}

function cudaApplicability(platform: ProductionRuntimePlatform): LocalWhisperCatalogCudaApplicability {
  return Object.freeze({
    computeTarget: 'sm_120a-real',
    minimumDriverVersion: platform === 'linux' ? '570.26' : '570.65',
    minimumComputeCapability: '12.0',
    maximumComputeCapability: '12.0',
    minimumTotalVramBytes: 6 * GIBIBYTE,
    policyRevision: revisionId('rtx50-sm120a-policy-v1'),
  });
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
  if (!capacity) throw new Error('Missing Local Whisper production memory estimate');
  return Object.freeze({
    target: runtime.identity.target,
    backend: runtime.identity.backend,
    runtimePackRevision: runtime.identity.packRevision,
    model,
    estimatedPeakRamBytes: capacity.ram,
    estimatedPeakVramBytes: runtime.identity.backend === 'cpu' ? 'notApplicable' : capacity.vram,
    evidenceBasis: 'derived',
    sourceBuildRevision: runtime.identity.buildRevision,
    methodologyLabel: 'Approximate requirements; rounded release-1 capacity guidance',
  });
}

/** Produces one immutable platform catalog while keeping model bytes at their pinned upstream origin. */
export class ProductionCatalogProducer {
  public produce(seed: ProductionCatalogSeed): LocalWhisperCatalogPayload {
    const targets = new Set(seed.runtimes.map(({ target }) => target));
    if (
      seed.runtimes.length !== 2 ||
      targets.size !== 2 ||
      !targets.has('cpu') ||
      !targets.has('sm_120a-real') ||
      !RELEASE_TARGET_PATTERN.test(seed.releaseTarget) ||
      !SOURCE_COMMIT_PATTERN.test(seed.sourceCommit)
    ) {
      throw new Error('Production catalog input matrix is invalid');
    }
    const appRevision = revisionId(seed.appRevision);
    const catalogRevision = revisionId(seed.catalogRevision);
    const signingKeyId = artifactId(seed.signingKeyId);
    const releaseOriginId = artifactId(RELEASE_ORIGIN_ID);
    const releasePathPrefix = `/${RELEASE_REPOSITORY}/releases/download/${seed.releaseTarget}/`;

    const runtimes = [...seed.runtimes]
      .sort((left, right) => left.target.localeCompare(right.target, 'en'))
      .map((runtime): LocalWhisperCatalogRuntimeEntry => {
        if (runtime.platform !== seed.platform || !/^[a-f\d]{64}$/u.test(runtime.profileDigest)) {
          throw new Error('Production runtime profile identity is invalid');
        }
        const contract = RUNTIME_CONTRACTS[seed.platform][runtime.target];
        const cpu = runtime.target === 'cpu';
        return Object.freeze({
          identity: Object.freeze({
            engine: 'whisperCpp',
            platform: seed.platform,
            architecture: 'x64',
            target: cpu ? 'cpu' : 'gpu',
            backend: cpu ? 'cpu' : 'cuda',
            dependencyFamily: contract.dependencyFamily,
            upstreamRevision: revisionId('whisper-cpp-v1.9.1-f049fff'),
            buildRevision: revisionId(runtime.buildRevision),
            computeTargets: contract.computeTargets,
            protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
            packRevision: revisionId(contract.packRevision),
            catalogRevision,
            appRevision,
            signingKeyId,
            archiveSizeBytes: runtime.archiveSizeBytes,
            archiveSha256: runtime.archiveSha256,
            archiveSignature: runtime.archiveSignature,
            originId: releaseOriginId,
            expectedFiles: Object.freeze([...runtime.expectedFiles]),
            prerequisites: Object.freeze([...runtime.prerequisites]),
            provenanceId: artifactId(runtime.provenanceId),
            sbomRevision: revisionId(runtime.sbomRevision),
            noticeIds: Object.freeze(runtime.noticeIds.map(artifactId)),
          }),
          applicability: cpu ? null : cudaApplicability(seed.platform),
          recommended: true,
          qualificationStatus: 'qualified',
          licenseIds: Object.freeze(runtime.licenseIds.map(artifactId)),
          transferProfile: 'restricted-tar-gzip-v1',
          source: Object.freeze({
            repository: RELEASE_REPOSITORY,
            commit: seed.sourceCommit,
            file: runtime.archiveFileName,
            url: `${RELEASE_ORIGIN}${releasePathPrefix}${runtime.archiveFileName}`,
            redirectPolicyId: artifactId(RELEASE_POLICY_ID),
          }),
          qualificationProfileDigest: runtime.profileDigest,
          sbomId: artifactId(`production-${seed.platform}-${cpu ? 'cpu' : 'cuda'}-runtime-sbom`),
        });
      });

    const runtimeRevisions = Object.freeze(runtimes.map(({ identity }) => identity.packRevision));
    const modelProfileDigest = sha256Bytes(
      serializeCanonicalLocalWhisperCatalogJson(LOCAL_WHISPER_RELEASE_MODEL_MATRIX),
    );
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
          qualificationStatus: 'qualified' as const,
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
          qualificationProfileDigest: modelProfileDigest,
          sbomId: artifactId(`upstream-${model.family}-${model.variant}-sbom`),
        });
      }),
    );
    const redirectPolicies: NonNullable<LocalWhisperCatalogPayload['redirectPolicies']> = Object.freeze(
      [
        {
          id: artifactId(RELEASE_POLICY_ID),
          initialScheme: 'https' as const,
          initialHost: 'github.com',
          initialPort: 443,
          initialPathPrefix: releasePathPrefix,
          maxRedirects: 3,
          allowedTargets: [{ host: 'release-assets.githubusercontent.com', port: 443, pathPrefix: '/' }],
          forwardRangeHeaders: true,
          credentialForwarding: false as const,
        },
        {
          id: artifactId(MODEL_POLICY_ID),
          initialScheme: 'https' as const,
          initialHost: 'huggingface.co',
          initialPort: 443,
          initialPathPrefix: `/${LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY}/resolve/${LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT}/`,
          maxRedirects: 5,
          allowedTargets: [{ host: 'us.aws.cdn.hf.co', port: 443, pathPrefix: '/' }],
          forwardRangeHeaders: true,
          credentialForwarding: false as const,
        },
      ].sort((left, right) => left.id.localeCompare(right.id, 'en')),
    );

    return structuredClone({
      schemaVersion: LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
      purpose: 'production',
      catalogRevision,
      displayMetadata: {
        title: `Local Whisper ${seed.platform === 'linux' ? 'Linux' : 'Windows'} production catalog`,
        summary: `Signed production runtimes for ${seed.platform === 'linux' ? 'Linux' : 'Windows'} x64.`,
      },
      compatibleAppRevisions: [appRevision],
      workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      languageCatalogRevision: LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
      languages: LOCAL_WHISPER_LANGUAGE_CATALOG,
      modelFamilies: LOCAL_WHISPER_MODEL_FAMILIES,
      origins: [
        { id: releaseOriginId, origin: RELEASE_ORIGIN },
        { id: artifactId(MODEL_ORIGIN_ID), origin: MODEL_ORIGIN },
      ],
      redirectPolicies,
      runtimes,
      models,
      memoryEstimates: models.flatMap((model) => runtimes.map((runtime) => memoryEstimate(model.identity, runtime))),
      qualifiedMemoryPeaks: [],
      denylist: { runtimes: [], models: [] },
    } satisfies LocalWhisperCatalogPayload);
  }
}
