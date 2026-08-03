import {
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
  LOCAL_WHISPER_MODEL_FAMILIES,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperModelIdentity,
} from '@shared/localWhisper';
import {
  LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogPayload,
  type LocalWhisperCatalogTrustPolicy,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
  LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
  LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
  localWhisperUpstreamModelUrl,
} from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import { FIXTURE_CATALOG_KEY_ID, FIXTURE_CATALOG_PUBLIC_KEY_PEM, signFixtureCatalog } from './fixtureCatalogSigner';

export const QUALIFICATION_APP_REVISION = toLocalWhisperRevisionId('app-v2.4.0')!;
export const QUALIFICATION_CATALOG_REVISION = toLocalWhisperRevisionId('qualification-catalog-v2.4.0')!;
export const QUALIFICATION_RUNTIME_REVISION = toLocalWhisperRevisionId('linux-x64-cpu-v2.4.0')!;
export const QUALIFICATION_RUNTIME_ORIGIN_ID = toLocalWhisperArtifactId('qualification-runtime-origin')!;
export const QUALIFICATION_RUNTIME_ORIGIN = 'https://127.0.0.1:39443';
export const QUALIFICATION_MODEL_ORIGIN_ID = toLocalWhisperArtifactId('public-hugging-face-model-origin')!;
export const QUALIFICATION_MODEL_ORIGIN = 'https://huggingface.co';
export const QUALIFICATION_RUNTIME_POLICY_ID = toLocalWhisperArtifactId('qualification-runtime-policy')!;
export const QUALIFICATION_MODEL_POLICY_ID = toLocalWhisperArtifactId('upstream-model-policy')!;

const QUALIFICATION_PROFILE_DIGEST = 'e'.repeat(64);
const RUNTIME_SOURCE_COMMIT = 'a'.repeat(40);

function modelIdentity(
  family: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]['family'],
  variant: 'full' | 'q5_0',
) {
  return {
    engine: 'whisperCpp',
    logicalModel: family,
    sourceCheckpointRevision: toLocalWhisperRevisionId(LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT)!,
    artifactRevision: toLocalWhisperRevisionId(`whisper-cpp-${family}-${variant}-v1`)!,
    nativeFormat: 'ggml',
    variant,
  } satisfies LocalWhisperModelIdentity;
}

function modelEntry(expected: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]): LocalWhisperCatalogModelEntry {
  const identity = modelIdentity(expected.family, expected.variant);
  return {
    identity,
    originId: QUALIFICATION_MODEL_ORIGIN_ID,
    expectedFiles: [
      {
        fileId: toLocalWhisperArtifactId(`model-${expected.family}-${expected.variant}`)!,
        kind: 'data',
        mode: 0o600,
        sizeBytes: expected.sizeBytes,
        sha256: expected.sha256,
      },
    ],
    transferSizeBytes: expected.sizeBytes,
    transferSha256: expected.sha256,
    transferSignature: null,
    signingKeyId: null,
    installedSizeBytes: expected.sizeBytes,
    compatibleRuntimePackRevisions: [QUALIFICATION_RUNTIME_REVISION],
    recommended: true,
    qualificationStatus: 'qualified',
    provenanceId: toLocalWhisperArtifactId(`provenance-${expected.family}-${expected.variant}`)!,
    licenseIds: [toLocalWhisperArtifactId('mit-license')!],
    noticeIds: [toLocalWhisperArtifactId('whisper-cpp-model-notice')!],
    transferProfile: 'pinned-raw-model-v1',
    source: {
      repository: LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
      commit: LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
      file: expected.file,
      url: localWhisperUpstreamModelUrl(expected.file),
      redirectPolicyId: QUALIFICATION_MODEL_POLICY_ID,
    },
    qualificationProfileDigest: QUALIFICATION_PROFILE_DIGEST,
    sbomId: toLocalWhisperArtifactId(`sbom-${expected.family}-${expected.variant}`)!,
  };
}

function memoryEstimate(model: LocalWhisperModelIdentity, sizeBytes: number): LocalWhisperMemoryEstimateRecord {
  return {
    target: 'cpu',
    backend: 'cpu',
    runtimePackRevision: QUALIFICATION_RUNTIME_REVISION,
    model,
    estimatedPeakRamBytes: sizeBytes * 2 + 512 * 1024 ** 2,
    estimatedPeakVramBytes: 'notApplicable',
    evidenceBasis: 'derived',
    sourceBuildRevision: toLocalWhisperRevisionId('qualification-estimate-v1')!,
    methodologyLabel: 'Deterministic qualification catalog fixture estimate',
  };
}

export function createQualificationCatalogPayload(): LocalWhisperCatalogPayload {
  const models = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map(modelEntry);
  return structuredClone({
    schemaVersion: LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
    purpose: 'qualification',
    catalogRevision: QUALIFICATION_CATALOG_REVISION,
    displayMetadata: {
      title: 'Local Whisper qualification catalog',
      summary: 'Deterministic schema-v2 catalog used only for qualification contract tests.',
    },
    compatibleAppRevisions: [QUALIFICATION_APP_REVISION],
    workerProtocolVersion: 1,
    languageCatalogRevision: LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
    languages: LOCAL_WHISPER_LANGUAGE_CATALOG,
    modelFamilies: LOCAL_WHISPER_MODEL_FAMILIES,
    origins: [
      { id: QUALIFICATION_MODEL_ORIGIN_ID, origin: QUALIFICATION_MODEL_ORIGIN },
      { id: QUALIFICATION_RUNTIME_ORIGIN_ID, origin: QUALIFICATION_RUNTIME_ORIGIN },
    ],
    redirectPolicies: [
      {
        id: QUALIFICATION_RUNTIME_POLICY_ID,
        initialScheme: 'https',
        initialHost: '127.0.0.1',
        initialPort: 39443,
        initialPathPrefix: '/runtime/',
        maxRedirects: 0,
        allowedTargets: [{ host: '127.0.0.1', port: 39443, pathPrefix: '/runtime/' }],
        forwardRangeHeaders: true,
        credentialForwarding: false,
      },
      {
        id: QUALIFICATION_MODEL_POLICY_ID,
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
    runtimes: [
      {
        identity: {
          engine: 'whisperCpp',
          platform: 'linux',
          architecture: 'x64',
          target: 'cpu',
          backend: 'cpu',
          dependencyFamily: 'glibc',
          upstreamRevision: toLocalWhisperRevisionId('whisper-cpp-upstream-v1')!,
          buildRevision: toLocalWhisperRevisionId('qualification-build-v1')!,
          computeTargets: ['x86-64-v2'],
          protocolVersion: 1,
          packRevision: QUALIFICATION_RUNTIME_REVISION,
          catalogRevision: QUALIFICATION_CATALOG_REVISION,
          appRevision: QUALIFICATION_APP_REVISION,
          signingKeyId: toLocalWhisperArtifactId('qualification-artifact-key-v1')!,
          archiveSizeBytes: 80,
          archiveSha256: 'a'.repeat(64),
          archiveSignature: Buffer.from('qualification runtime signature').toString('base64'),
          originId: QUALIFICATION_RUNTIME_ORIGIN_ID,
          expectedFiles: [
            {
              fileId: toLocalWhisperArtifactId('whisper-cpp-worker')!,
              kind: 'executable',
              mode: 0o500,
              sizeBytes: 100,
              sha256: 'b'.repeat(64),
            },
          ],
          prerequisites: ['glibc-2.31'],
          provenanceId: toLocalWhisperArtifactId('qualification-runtime-provenance')!,
          sbomRevision: toLocalWhisperRevisionId('qualification-runtime-sbom-v1')!,
          noticeIds: [toLocalWhisperArtifactId('qualification-runtime-notice')!],
        },
        recommended: true,
        qualificationStatus: 'qualified',
        licenseIds: [toLocalWhisperArtifactId('mit-license')!],
        transferProfile: 'restricted-tar-gzip-v1',
        source: {
          repository: 'swimmwatch/gpt-voice',
          commit: RUNTIME_SOURCE_COMMIT,
          file: 'runtime-linux-x64-cpu.tar.gz',
          url: `${QUALIFICATION_RUNTIME_ORIGIN}/runtime/runtime-linux-x64-cpu.tar.gz`,
          redirectPolicyId: QUALIFICATION_RUNTIME_POLICY_ID,
        },
        qualificationProfileDigest: QUALIFICATION_PROFILE_DIGEST,
        sbomId: toLocalWhisperArtifactId('qualification-runtime-sbom')!,
      },
    ],
    models,
    memoryEstimates: models.map((entry) => memoryEstimate(entry.identity, entry.transferSizeBytes)),
    qualifiedMemoryPeaks: [],
    denylist: { runtimes: [], models: [] },
  } satisfies LocalWhisperCatalogPayload);
}

export function createQualificationCatalogTrustPolicy(): LocalWhisperCatalogTrustPolicy {
  return {
    purpose: 'qualification',
    publicKeys: [{ keyId: FIXTURE_CATALOG_KEY_ID, publicKeyPem: FIXTURE_CATALOG_PUBLIC_KEY_PEM }],
    origins: [
      { id: QUALIFICATION_MODEL_ORIGIN_ID, origin: QUALIFICATION_MODEL_ORIGIN },
      { id: QUALIFICATION_RUNTIME_ORIGIN_ID, origin: QUALIFICATION_RUNTIME_ORIGIN },
    ],
    appRevision: QUALIFICATION_APP_REVISION,
    workerProtocolVersion: 1,
  };
}

export function signQualificationCatalog(payload: unknown, keyId = FIXTURE_CATALOG_KEY_ID): Uint8Array {
  return signFixtureCatalog(payload, keyId);
}
