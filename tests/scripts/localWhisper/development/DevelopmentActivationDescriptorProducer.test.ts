import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT,
  LocalWhisperDevelopmentActivationLoader,
  openLocalWhisperActivationFile,
} from '@main/localWhisper/development/LocalWhisperDevelopmentActivation';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import { DevelopmentActivationDescriptorProducer } from '@scripts/local-whisper/development/DevelopmentActivationDescriptorProducer';
import { DevelopmentRuntimeAttestationStore } from '@scripts/local-whisper/development/DevelopmentRuntimeAttestationStore';
import type { DevelopmentRuntimeInput } from '@scripts/local-whisper/development/DevelopmentRuntimeInputs';
import { EphemeralQualificationTlsIdentityFactory } from '@scripts/local-whisper/qualification/EphemeralQualificationTlsIdentity';

function runtime(
  backend: 'cpu' | 'cuda',
  index: number,
  platform: 'linux' | 'win32' = process.platform === 'win32' ? 'win32' : 'linux',
): DevelopmentRuntimeInput {
  return Object.freeze({
    backend,
    archivePath: `/tmp/development-${backend}.tar.gz`,
    archiveSizeBytes: 100 + index,
    archiveSha256: String(index + 1).repeat(64),
    catalog: Object.freeze({
      backend,
      platform,
      architecture: 'x64',
      buildRevision: String(index + 5).repeat(64),
      packRevision:
        platform === 'win32'
          ? backend === 'cpu'
            ? 'whisper-cpp-windows-x64-cpu-v1'
            : 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1'
          : backend === 'cpu'
            ? 'whisper-cpp-linux-x64-cpu-baseline-v1'
            : 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
      expectedFiles: Object.freeze([
        Object.freeze({
          fileId: toLocalWhisperArtifactId(`development-${backend}-worker`)!,
          kind: 'executable' as const,
          mode: 0o500,
          sizeBytes: 10 + index,
          sha256: String(index + 3).repeat(64),
        }),
      ]),
      prerequisites: Object.freeze(backend === 'cpu' ? ['glibc-2.39'] : ['cuda-runtime-12.8.1']),
      provenanceId: `development-${backend}-provenance`,
      sbomRevision: `development-${backend}-sbom-v1`,
      noticeIds: Object.freeze([`development-${backend}-notice`]),
      licenseIds: Object.freeze(['mit-license']),
    }),
  });
}

describe('DevelopmentActivationDescriptorProducer', () => {
  it('persists an exact CPU-only runtime attestation for Windows execution', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-producer-'));
    try {
      const runtimes = [runtime('cpu', 0, 'win32')];
      const attestations = new DevelopmentRuntimeAttestationStore();
      const attestationPath = path.join(root, 'runtime-attestation.json');
      const runtimeAttestation = await attestations.load(attestationPath, runtimes);
      assert.deepEqual(
        runtimeAttestation.runtimes.map(({ backend }) => backend),
        ['cpu'],
      );
      assert.deepEqual(await attestations.load(attestationPath, runtimes), runtimeAttestation);
      await assert.rejects(
        () => attestations.load(attestationPath, [runtime('cuda', 1)]),
        /attestation input invalid/u,
      );
      const producer = new DevelopmentActivationDescriptorProducer();
      const input = {
        appRevision: '2.4.0',
        certificatePem: 'public-certificate',
        descriptorPath: path.join(root, 'windows-activation.json'),
        platform: 'win32' as const,
        resourcesPath: path.join(root, 'resources'),
        runtimeAttestation,
        runtimeOrigin: 'https://127.0.0.1:39443',
        runtimes,
        sourceCommit: 'a'.repeat(40),
      };
      await producer.produce(input);
      await assert.rejects(
        () => producer.produce({ ...input, runtimes: [...runtimes, runtime('cuda', 1, 'win32')] }),
        /descriptor input invalid/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('produces a strict public descriptor for the host executable runtimes and all six exact models', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-producer-'));
    const tls = await new EphemeralQualificationTlsIdentityFactory().create(path.join(root, 'trust'));
    try {
      const descriptorPath = path.join(root, 'activation.json');
      const platform = process.platform === 'win32' ? 'win32' : 'linux';
      const runtimes = platform === 'win32' ? [runtime('cpu', 0)] : [runtime('cpu', 0), runtime('cuda', 1)];
      const attestations = new DevelopmentRuntimeAttestationStore();
      const runtimeAttestation = await attestations.load(path.join(root, 'runtime-attestation.json'), runtimes);
      assert.deepEqual(
        await attestations.load(path.join(root, 'runtime-attestation.json'), runtimes),
        runtimeAttestation,
      );
      assert.doesNotMatch(await readFile(path.join(root, 'runtime-attestation.json'), 'utf8'), /PRIVATE KEY/u);
      await new DevelopmentActivationDescriptorProducer().produce({
        appRevision: '2.4.0',
        certificatePem: tls.certificatePem,
        descriptorPath,
        platform,
        resourcesPath: path.join(root, 'resources'),
        runtimeAttestation,
        runtimeOrigin: 'https://127.0.0.1:39443',
        runtimes,
        sourceCommit: 'a'.repeat(40),
      });
      const activation = await new LocalWhisperDevelopmentActivationLoader({
        appRevision: '2.4.0',
        arguments: [`${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}${descriptorPath}`],
        authenticateCatalog: (document, trustPolicy) =>
          new LocalWhisperCatalogRepository({
            readDocument: () => document,
            trustPolicy,
          }).load().success,
        isPackaged: false,
        openFile: openLocalWhisperActivationFile,
        platform: process.platform,
        userId: process.platform === 'linux' ? process.getuid?.() : undefined,
      }).load();
      assert.equal(activation.status, 'active');
      if (activation.status !== 'active' || !activation.catalogInput.trustPolicy) return;
      const loaded = new LocalWhisperCatalogRepository({
        readDocument: () => activation.catalogInput.document,
        trustPolicy: activation.catalogInput.trustPolicy,
      }).load();
      assert.equal(loaded.success, true);
      if (!loaded.success) return;
      assert.notEqual(loaded.catalog.signingKeyId, runtimeAttestation.keyId);
      assert.equal(
        loaded.catalog.payload.runtimes.every(({ identity }) => identity.signingKeyId === runtimeAttestation.keyId),
        true,
      );
      assert.deepEqual(
        loaded.catalog.payload.runtimes.map(({ identity, qualificationStatus }) => ({
          backend: identity.backend,
          buildRevision: identity.buildRevision,
          qualificationStatus,
        })),
        runtimes.map(({ backend, catalog }) => ({
          backend,
          buildRevision: catalog.buildRevision,
          qualificationStatus: 'estimateOnly',
        })),
      );
      assert.deepEqual(
        loaded.catalog.payload.models.map(({ identity, transferSizeBytes, transferSha256, source }) => ({
          family: identity.logicalModel,
          variant: identity.variant,
          transferSizeBytes,
          transferSha256,
          file: source?.file,
        })),
        LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map(({ family, variant, sizeBytes, sha256, file }) => ({
          family,
          variant,
          transferSizeBytes: sizeBytes,
          transferSha256: sha256,
          file,
        })),
      );
    } finally {
      await tls.destroy();
      await rm(root, { recursive: true, force: true });
    }
  });
});
