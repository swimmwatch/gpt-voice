import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { sign } from 'node:crypto';

import {
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
  LOCAL_WHISPER_MODEL_FAMILIES,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperMemoryConfigurationIdentity,
} from '@shared/localWhisper';
import { serializeCanonicalLocalWhisperCatalogJson } from '@main/localWhisper/catalog/LocalWhisperCatalogVerifier';
import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
  type LocalWhisperCatalogPayload,
  type LocalWhisperCatalogTrustPolicy,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';

export const FIXTURE_CATALOG_KEY_ID = toLocalWhisperArtifactId('fixture-catalog-key-v1')!;
export const FIXTURE_CATALOG_ORIGIN_ID = toLocalWhisperArtifactId('fixture-origin')!;
export const FIXTURE_CATALOG_ORIGIN = 'https://local-whisper-fixtures.invalid';
export const FIXTURE_APP_REVISION = toLocalWhisperRevisionId('fixture-app-v1')!;
export const FIXTURE_CATALOG_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA5VYa+iFYh+rFU+L/Xf9at9pT/NytWZXrtBPKh/I3zbA=
-----END PUBLIC KEY-----
`;

const PRIVATE_KEY_PATH = path.join(__dirname, 'fixture-private-key.txt');
const CATALOG_REVISION = toLocalWhisperRevisionId('fixture-catalog-v1')!;
const RUNTIME_REVISION = toLocalWhisperRevisionId('whisper-cpp-cpu-pack-v1')!;
const MODEL_REVISION = toLocalWhisperRevisionId('base-ggml-v1')!;
const MODEL_SOURCE_REVISION = toLocalWhisperRevisionId('openai-whisper-base-v1')!;
const CONFIGURATION: LocalWhisperMemoryConfigurationIdentity = {
  target: 'cpu',
  backend: 'cpu',
  runtimePackRevision: RUNTIME_REVISION,
  model: {
    engine: 'whisperCpp',
    logicalModel: 'base',
    sourceCheckpointRevision: MODEL_SOURCE_REVISION,
    artifactRevision: MODEL_REVISION,
    nativeFormat: 'ggml',
    variant: 'full',
  },
  precision: null,
};

export function createFixtureCatalogPayload(): LocalWhisperCatalogPayload {
  return structuredClone({
    schemaVersion: LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
    catalogRevision: CATALOG_REVISION,
    compatibleAppRevisions: [FIXTURE_APP_REVISION],
    workerProtocolVersion: 1,
    languageCatalogRevision: LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
    languages: LOCAL_WHISPER_LANGUAGE_CATALOG,
    modelFamilies: LOCAL_WHISPER_MODEL_FAMILIES,
    origins: [{ id: FIXTURE_CATALOG_ORIGIN_ID, origin: FIXTURE_CATALOG_ORIGIN }],
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
          buildRevision: toLocalWhisperRevisionId('whisper-cpp-build-v1')!,
          computeTargets: ['x86-64-v2'],
          protocolVersion: 1,
          packRevision: RUNTIME_REVISION,
          catalogRevision: CATALOG_REVISION,
          appRevision: FIXTURE_APP_REVISION,
          signingKeyId: toLocalWhisperArtifactId('fixture-artifact-key-v1')!,
          archiveSizeBytes: 80,
          archiveSha256: 'a'.repeat(64),
          archiveSignature: Buffer.from('fixture archive signature').toString('base64'),
          originId: FIXTURE_CATALOG_ORIGIN_ID,
          expectedFiles: [
            {
              fileId: toLocalWhisperArtifactId('whisper-cpp-worker')!,
              kind: 'executable',
              mode: 0o755,
              sizeBytes: 100,
              sha256: 'b'.repeat(64),
            },
          ],
          prerequisites: ['glibc-2.31'],
          provenanceId: toLocalWhisperArtifactId('whisper-cpp-provenance-v1')!,
          sbomRevision: toLocalWhisperRevisionId('whisper-cpp-sbom-v1')!,
          noticeIds: [toLocalWhisperArtifactId('whisper-cpp-notice-v1')!],
        },
        recommended: true,
        qualificationStatus: 'qualified',
        licenseIds: [toLocalWhisperArtifactId('mit-license')!],
      },
    ],
    models: [
      {
        identity: CONFIGURATION.model,
        originId: FIXTURE_CATALOG_ORIGIN_ID,
        expectedFiles: [
          {
            fileId: toLocalWhisperArtifactId('base-model-data')!,
            kind: 'data',
            mode: 0o600,
            sizeBytes: 200,
            sha256: 'c'.repeat(64),
          },
        ],
        transferSizeBytes: 150,
        transferSha256: 'd'.repeat(64),
        installedSizeBytes: 200,
        compatibleRuntimePackRevisions: [RUNTIME_REVISION],
        recommended: true,
        qualificationStatus: 'qualified',
        provenanceId: toLocalWhisperArtifactId('base-model-provenance-v1')!,
        licenseIds: [toLocalWhisperArtifactId('mit-license')!],
        noticeIds: [toLocalWhisperArtifactId('base-model-notice-v1')!],
      },
    ],
    memoryEstimates: [
      {
        ...CONFIGURATION,
        estimatedPeakRamBytes: 2_000_000_000,
        estimatedPeakVramBytes: 'notApplicable',
        evidenceBasis: 'derived',
        sourceBuildRevision: toLocalWhisperRevisionId('estimate-build-v1')!,
        methodologyLabel: 'Deterministic fixture estimate',
      },
    ],
    qualifiedMemoryPeaks: [
      {
        ...CONFIGURATION,
        measuredPeakRamBytes: 1_900_000_000,
        measuredPeakVramBytes: 'notApplicable',
        qualificationProfileId: toLocalWhisperArtifactId('fixture-qualified-profile')!,
        capabilityFingerprint: 'fixture-capability-fingerprint',
      },
    ],
    denylist: { runtimes: [], models: [] },
  } satisfies LocalWhisperCatalogPayload);
}

export function createFixtureCatalogTrustPolicy(): LocalWhisperCatalogTrustPolicy {
  return {
    publicKeys: [{ keyId: FIXTURE_CATALOG_KEY_ID, publicKeyPem: FIXTURE_CATALOG_PUBLIC_KEY_PEM }],
    origins: [{ id: FIXTURE_CATALOG_ORIGIN_ID, origin: FIXTURE_CATALOG_ORIGIN }],
    appRevision: FIXTURE_APP_REVISION,
    workerProtocolVersion: 1,
  };
}

export function signFixtureCatalog(payload: unknown, keyId = FIXTURE_CATALOG_KEY_ID): Uint8Array {
  const payloadBytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(payload), 'utf8');
  const privateKey = readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const signature = sign(null, payloadBytes, privateKey);
  return Buffer.from(
    JSON.stringify({
      schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
      algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
      keyId,
      payloadBase64: payloadBytes.toString('base64'),
      signatureBase64: signature.toString('base64'),
    }),
    'utf8',
  );
}
