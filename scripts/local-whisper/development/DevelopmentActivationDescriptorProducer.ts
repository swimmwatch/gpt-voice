import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { chmod } from 'node:fs/promises';
import * as path from 'node:path';

import { LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';
import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import { LOCAL_WHISPER_DEVELOPMENT_DISPLAY_LABEL } from '@main/localWhisper/development/LocalWhisperDevelopmentActivation';

import { sha256Bytes, writeCanonicalJson } from '../packaging/fileIntegrity';
import { LocalWhisperQualificationCatalogProducer } from '../qualification/QualificationCatalogProducer';
import type { DevelopmentRuntimeAttestation } from './DevelopmentRuntimeAttestationStore';
import type { DevelopmentRuntimeInput, DevelopmentRuntimePlatform } from './DevelopmentRuntimeInputs';

export interface DevelopmentActivationDescriptorInput {
  readonly appRevision: string;
  readonly certificatePem: string;
  readonly descriptorPath: string;
  readonly platform: DevelopmentRuntimePlatform;
  readonly resourcesPath: string;
  readonly runtimeAttestation: DevelopmentRuntimeAttestation;
  readonly runtimeOrigin: string;
  readonly runtimes: readonly DevelopmentRuntimeInput[];
  readonly sourceCommit: string;
}

function hasExecutableRuntimeSet(input: DevelopmentActivationDescriptorInput): boolean {
  const backends = new Set(input.runtimes.map(({ backend }) => backend));
  const expectedBackends = ['cpu', 'cuda'] as const;
  return (
    input.runtimes.length === expectedBackends.length &&
    expectedBackends.every((backend) => backends.has(backend)) &&
    input.runtimeAttestation.runtimes.length === input.runtimes.length &&
    input.runtimes.every((runtime) =>
      input.runtimeAttestation.runtimes.some(
        (entry) => entry.backend === runtime.backend && entry.archiveSha256 === runtime.archiveSha256,
      ),
    )
  );
}

/** Generates one public-only canonical descriptor and never persists its ephemeral signing key. */
export class DevelopmentActivationDescriptorProducer {
  public async produce(input: DevelopmentActivationDescriptorInput): Promise<void> {
    if (
      !path.isAbsolute(input.descriptorPath) ||
      !path.isAbsolute(input.resourcesPath) ||
      !/^[a-f\d]{40}$/u.test(input.sourceCommit) ||
      !hasExecutableRuntimeSet(input) ||
      input.runtimes.some(({ catalog }) => catalog.platform !== input.platform || catalog.architecture !== 'x64')
    ) {
      throw new Error('Local Whisper development descriptor input invalid');
    }
    const catalogKeyPair = generateKeyPairSync('ed25519');
    const catalogPublicKeyPem = catalogKeyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const catalogKeyId = `qualification-development-catalog-${sha256Bytes(catalogPublicKeyPem).slice(0, 24)}`;
    const catalogRevision = `development-qualification-${createHash('sha256')
      .update(input.appRevision, 'utf8')
      .update(
        input.runtimes
          .map(({ archiveSha256 }) => archiveSha256)
          .sort()
          .join(''),
        'utf8',
      )
      .digest('hex')
      .slice(0, 24)}`;
    const catalog = new LocalWhisperQualificationCatalogProducer().produce({
      platform: input.platform,
      candidateSemVer: input.appRevision,
      appRevision: input.appRevision,
      catalogRevision,
      qualificationKeyId: input.runtimeAttestation.keyId,
      runtimeOriginId: 'development-runtime-origin',
      runtimeOrigin: input.runtimeOrigin,
      sourceCommit: input.sourceCommit,
      qualificationStatus: 'estimateOnly',
      executionMode: 'representativeQualification',
      runtimes: input.runtimes.map((runtime) => ({
        ...runtime.catalog,
        archiveFileName: path.basename(runtime.archivePath),
        archiveSizeBytes: runtime.archiveSizeBytes,
        archiveSha256: runtime.archiveSha256,
        archiveSignature:
          input.runtimeAttestation.runtimes.find(
            (entry) => entry.backend === runtime.backend && entry.archiveSha256 === runtime.archiveSha256,
          )?.archiveSignature ?? '',
      })),
    });
    const payloadBytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(catalog), 'utf8');
    const catalogEnvelope = Object.freeze({
      schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
      algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
      keyId: catalogKeyId,
      payloadBase64: payloadBytes.toString('base64'),
      signatureBase64: sign(null, payloadBytes, catalogKeyPair.privateKey).toString('base64'),
    });
    await writeCanonicalJson(input.descriptorPath, {
      schemaVersion: 1,
      mode: 'local-whisper-development-activation',
      purpose: 'qualification',
      appRevision: input.appRevision,
      workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      resourcesPath: input.resourcesPath,
      catalogEnvelope,
      publicKeys: [
        { keyId: catalogKeyId, publicKeyPem: catalogPublicKeyPem },
        { keyId: input.runtimeAttestation.keyId, publicKeyPem: input.runtimeAttestation.publicKeyPem },
      ],
      origins: catalog.origins,
      trustedCertificateAuthorities: [input.certificatePem],
      displayLabel: LOCAL_WHISPER_DEVELOPMENT_DISPLAY_LABEL,
    });
    await chmod(input.descriptorPath, 0o600);
  }
}
