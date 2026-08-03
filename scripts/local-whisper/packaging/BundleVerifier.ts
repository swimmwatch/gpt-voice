import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { toLocalWhisperArtifactId, toLocalWhisperRevisionId } from '@shared/localWhisper';

import {
  LOCAL_WHISPER_FIXTURE_KEY_PREFIX,
  LOCAL_WHISPER_FIXTURE_ORIGIN_SUFFIX,
  LOCAL_WHISPER_QUALIFICATION_KEY_PREFIX,
  hasExactKeys,
  isLogicalId,
  isRecord,
  isSha256,
  parseBundleManifest,
  parseKeyringDocument,
  parsePackManifest,
  parseProductionApproval,
  type LocalWhisperBundleManifest,
  type LocalWhisperKeyringDocument,
  type LocalWhisperPackManifest,
} from './contracts';
import { assertManifestFilesEqual, inspectFlatDirectory, readCanonicalJson, sha256Bytes } from './fileIntegrity';

const REQUIRED_BUNDLE_FILES = [
  'catalog.json',
  'catalog.sha256',
  'keyring.json',
  'licenses.json',
  'model-pack.manifest.json',
  'notices.json',
  'provenance.json',
  'runtime-pack.manifest.json',
  'sbom.spdx.json',
] as const;
const PRIVATE_MATERIAL_PATTERN = /BEGIN (?:ENCRYPTED )?PRIVATE KEY|private[-_.]?key/iu;
const SYNTHETIC_BYTES_MARKER = 'LOCAL_WHISPER_SYNTHETIC_NON_INFERENCE_';

/** Preserves Task 17 fixture bytes while binding qualification/production signatures to SHA-256 input. */
export function localWhisperPackSignatureInput(
  purpose: 'fixture' | 'qualification' | 'production',
  bytes: Uint8Array,
): Buffer {
  return purpose === 'fixture' ? Buffer.from(bytes) : createHash('sha256').update(bytes).digest();
}

export interface LocalWhisperVerifiedBundle {
  readonly directory: string;
  readonly manifest: LocalWhisperBundleManifest;
  readonly manifestSha256: string;
  readonly keyring: LocalWhisperKeyringDocument;
  readonly runtimePack: LocalWhisperPackManifest;
  readonly modelPack: LocalWhisperPackManifest;
}

function artifactId(value: string) {
  const parsed = toLocalWhisperArtifactId(value);
  if (!parsed) throw new Error('Invalid Local Whisper artifact identity');
  return parsed;
}

function revisionId(value: string) {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid Local Whisper revision identity');
  return parsed;
}

function findPublicKey(keyring: LocalWhisperKeyringDocument, keyId: string): string {
  const entry = keyring.publicKeys.find((candidate) => candidate.keyId === keyId);
  if (!entry) throw new Error('Local Whisper signing key is not in the app-owned keyring');
  const key = createPublicKey(entry.publicKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Local Whisper signing key must be Ed25519');
  return entry.publicKeyPem;
}

function validateEvidenceDocument(
  value: unknown,
  purpose: 'fixture' | 'qualification' | 'production',
  kind: string,
): void {
  if (!isRecord(value)) throw new Error(`Invalid Local Whisper ${kind} evidence`);
  if (kind === 'sbom') {
    const keys = ['spdxVersion', 'dataLicense', 'SPDXID', 'name', 'documentNamespace', 'packages'];
    if (
      !hasExactKeys(value, keys) ||
      value.spdxVersion !== 'SPDX-2.3' ||
      value.dataLicense !== 'CC0-1.0' ||
      value.SPDXID !== 'SPDXRef-DOCUMENT' ||
      typeof value.name !== 'string' ||
      typeof value.documentNamespace !== 'string' ||
      !Array.isArray(value.packages) ||
      value.packages.length === 0
    ) {
      throw new Error('Invalid Local Whisper SPDX SBOM');
    }
    return;
  }
  const collectionKey = kind === 'licenses' ? 'components' : kind === 'notices' ? 'notices' : 'records';
  if (
    !hasExactKeys(value, ['schemaVersion', 'purpose', collectionKey]) ||
    value.schemaVersion !== 1 ||
    value.purpose !== purpose ||
    !Array.isArray(value[collectionKey]) ||
    value[collectionKey].length === 0
  ) {
    throw new Error(`Invalid Local Whisper ${kind} evidence`);
  }
}

async function verifyPackSignature(
  directory: string,
  pack: LocalWhisperPackManifest,
  publicKeyPem: string,
): Promise<void> {
  if (pack.expectedFiles.length !== 1) throw new Error('Local Whisper fixture/pack envelope must own one archive');
  const expected = pack.expectedFiles[0];
  const bytes = await readFile(path.join(directory, expected.path));
  const signatureInput = localWhisperPackSignatureInput(pack.purpose, bytes);
  if (
    bytes.byteLength !== pack.sizeBytes ||
    bytes.byteLength !== expected.sizeBytes ||
    sha256Bytes(bytes) !== pack.sha256 ||
    pack.sha256 !== expected.sha256 ||
    !verify(null, signatureInput, createPublicKey(publicKeyPem), Buffer.from(pack.signatureBase64, 'base64'))
  ) {
    throw new Error(`Local Whisper ${pack.artifactKind} pack signature or identity mismatch`);
  }
}

async function verifyCatalog(
  directory: string,
  manifest: LocalWhisperBundleManifest,
  keyring: LocalWhisperKeyringDocument,
): Promise<void> {
  const document = await readFile(path.join(directory, 'catalog.json'));
  const loaded = new LocalWhisperCatalogRepository({
    readDocument: () => document,
    trustPolicy: {
      purpose: manifest.purpose,
      publicKeys: keyring.publicKeys.map((entry) => ({
        keyId: artifactId(entry.keyId),
        publicKeyPem: entry.publicKeyPem,
      })),
      origins: keyring.origins.map((entry) => ({ id: artifactId(entry.id), origin: entry.origin })),
      appRevision: revisionId(keyring.appRevision),
      workerProtocolVersion: keyring.workerProtocolVersion,
    },
  }).load();
  if (!loaded.success) throw new Error(`Local Whisper catalog rejected: ${loaded.code}`);
  if (loaded.catalog.signingKeyId !== manifest.keyId || loaded.catalog.payload.purpose !== manifest.purpose) {
    throw new Error('Local Whisper catalog purpose or key mismatch');
  }
}

function assertFixtureBoundary(bundle: LocalWhisperVerifiedBundle, fileText: string): void {
  if (
    bundle.manifest.purpose !== 'fixture' ||
    !bundle.manifest.keyId.startsWith(LOCAL_WHISPER_FIXTURE_KEY_PREFIX) ||
    bundle.keyring.origins.some((entry) => !entry.origin.endsWith(LOCAL_WHISPER_FIXTURE_ORIGIN_SUFFIX)) ||
    bundle.runtimePack.redistributionReview !== 'fixture-only' ||
    bundle.modelPack.redistributionReview !== 'fixture-only' ||
    PRIVATE_MATERIAL_PATTERN.test(fileText)
  ) {
    throw new Error('Local Whisper fixture trust boundary violation');
  }
}

function assertProductionBoundary(bundle: LocalWhisperVerifiedBundle, fileText: string): void {
  if (
    bundle.manifest.purpose !== 'production' ||
    bundle.manifest.synthetic ||
    bundle.manifest.keyId.startsWith(LOCAL_WHISPER_FIXTURE_KEY_PREFIX) ||
    bundle.keyring.origins.some((entry) => entry.origin.endsWith(LOCAL_WHISPER_FIXTURE_ORIGIN_SUFFIX)) ||
    bundle.manifest.files.some((file) => /fixture|synthetic/iu.test(file.path)) ||
    bundle.runtimePack.redistributionReview !== 'approved' ||
    bundle.modelPack.redistributionReview !== 'approved' ||
    fileText.includes(SYNTHETIC_BYTES_MARKER) ||
    PRIVATE_MATERIAL_PATTERN.test(fileText)
  ) {
    throw new Error('Local Whisper production trust boundary violation');
  }
}

function isQualificationOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return origin === 'https://huggingface.co' || (parsed.hostname === '127.0.0.1' && parsed.port !== '');
  } catch {
    return false;
  }
}

function assertQualificationBoundary(bundle: LocalWhisperVerifiedBundle, fileText: string): void {
  if (
    bundle.manifest.purpose !== 'qualification' ||
    bundle.manifest.synthetic ||
    !bundle.manifest.keyId.startsWith(LOCAL_WHISPER_QUALIFICATION_KEY_PREFIX) ||
    bundle.keyring.publicKeys.some((entry) => !entry.keyId.startsWith(LOCAL_WHISPER_QUALIFICATION_KEY_PREFIX)) ||
    bundle.keyring.origins.length < 2 ||
    bundle.keyring.origins.some((entry) => !isQualificationOrigin(entry.origin)) ||
    bundle.runtimePack.redistributionReview !== 'pending' ||
    bundle.modelPack.redistributionReview !== 'pending' ||
    PRIVATE_MATERIAL_PATTERN.test(fileText)
  ) {
    throw new Error('Local Whisper qualification trust boundary violation');
  }
}

/** Verifies the immutable signed bundle before any package staging or release collection. */
export class BundleVerifier {
  public async verify(
    bundleDirectory: string,
    expected: {
      readonly purpose: 'fixture' | 'qualification' | 'production';
      readonly manifestSha256?: string;
    },
  ): Promise<LocalWhisperVerifiedBundle> {
    const directory = path.resolve(bundleDirectory);
    if (expected.purpose !== 'fixture' && !expected.manifestSha256) {
      throw new Error(`${expected.purpose} Local Whisper bundle requires an externally frozen digest`);
    }
    const manifestValue = await readCanonicalJson(path.join(directory, 'bundle-manifest.json'));
    const manifest = parseBundleManifest(manifestValue);
    const manifestSha256 = sha256Bytes(JSON.stringify(manifestValue));
    if (manifest.purpose !== expected.purpose) throw new Error('Local Whisper bundle purpose mismatch');
    if (expected.manifestSha256 && manifestSha256 !== expected.manifestSha256) {
      throw new Error('Local Whisper bundle declared digest mismatch');
    }

    const actualFiles = await inspectFlatDirectory(directory, ['bundle-manifest.json']);
    assertManifestFilesEqual(manifest.files, actualFiles);
    const actualPaths = new Set(actualFiles.map((file) => file.path));
    if (actualPaths.has('catalog.sig')) throw new Error('Detached Local Whisper catalog signatures are forbidden');
    for (const requiredPath of REQUIRED_BUNDLE_FILES) {
      if (!actualPaths.has(requiredPath)) throw new Error(`Missing Local Whisper bundle file: ${requiredPath}`);
    }
    if (manifest.purpose === 'qualification' && !actualPaths.has('runtime-cuda-pack.manifest.json')) {
      throw new Error('Missing Local Whisper qualification CUDA runtime manifest');
    }
    if (manifest.purpose === 'production' && !actualPaths.has('production-approval.json')) {
      throw new Error('Missing Local Whisper production approval');
    }

    const catalogSha256 = sha256Bytes(await readFile(path.join(directory, 'catalog.json')));
    const catalogDigestText = await readFile(path.join(directory, 'catalog.sha256'), 'utf8');
    if (catalogSha256 !== manifest.catalogSha256 || catalogDigestText !== `${catalogSha256}\n`) {
      throw new Error('Local Whisper catalog staging digest mismatch');
    }
    const keyring = parseKeyringDocument(await readCanonicalJson(path.join(directory, 'keyring.json')));
    if (keyring.purpose !== manifest.purpose) throw new Error('Local Whisper keyring purpose mismatch');
    const publicKeyPem = findPublicKey(keyring, manifest.keyId);
    const runtimePack = parsePackManifest(await readCanonicalJson(path.join(directory, 'runtime-pack.manifest.json')));
    const modelPack = parsePackManifest(await readCanonicalJson(path.join(directory, 'model-pack.manifest.json')));
    const qualificationCudaPack =
      manifest.purpose === 'qualification'
        ? parsePackManifest(await readCanonicalJson(path.join(directory, 'runtime-cuda-pack.manifest.json')))
        : null;
    if (
      runtimePack.artifactKind !== 'runtime' ||
      modelPack.artifactKind !== 'model' ||
      runtimePack.purpose !== manifest.purpose ||
      modelPack.purpose !== manifest.purpose ||
      runtimePack.signingKeyId !== manifest.keyId ||
      modelPack.signingKeyId !== manifest.keyId
    ) {
      throw new Error('Local Whisper pack purpose, kind, or key mismatch');
    }
    if (
      qualificationCudaPack &&
      (qualificationCudaPack.purpose !== 'qualification' ||
        qualificationCudaPack.artifactKind !== 'runtime' ||
        qualificationCudaPack.backend !== 'cuda' ||
        qualificationCudaPack.signingKeyId !== manifest.keyId ||
        runtimePack.backend !== 'cpu')
    ) {
      throw new Error('Local Whisper qualification runtime matrix mismatch');
    }

    await Promise.all([
      verifyCatalog(directory, manifest, keyring),
      verifyPackSignature(directory, runtimePack, publicKeyPem),
      ...(qualificationCudaPack ? [verifyPackSignature(directory, qualificationCudaPack, publicKeyPem)] : []),
      verifyPackSignature(directory, modelPack, publicKeyPem),
      ...[
        ['licenses.json', 'licenses'],
        ['notices.json', 'notices'],
        ['provenance.json', 'provenance'],
        ['sbom.spdx.json', 'sbom'],
      ].map(async ([fileName, kind]) => {
        validateEvidenceDocument(await readCanonicalJson(path.join(directory, fileName)), manifest.purpose, kind);
      }),
    ]);

    const bundle = Object.freeze({ directory, manifest, manifestSha256, keyring, runtimePack, modelPack });
    const boundedTextFiles = await Promise.all(
      actualFiles
        .filter((file) => file.sizeBytes <= 4 * 1024 * 1024)
        .map((file) => readFile(path.join(directory, file.path), 'utf8')),
    );
    const fileText = boundedTextFiles.join('\n');
    if (expected.purpose === 'fixture') assertFixtureBoundary(bundle, fileText);
    else if (expected.purpose === 'qualification') assertQualificationBoundary(bundle, fileText);
    else assertProductionBoundary(bundle, fileText);
    return bundle;
  }

  public async verifyProductionApproval(bundle: LocalWhisperVerifiedBundle): Promise<void> {
    const approval = parseProductionApproval(
      await readCanonicalJson(path.join(bundle.directory, 'production-approval.json')),
    );
    if (
      approval.frozenCatalogSha256 !== bundle.manifest.catalogSha256 ||
      !approval.approvedSigningKeyIds.includes(bundle.manifest.keyId) ||
      bundle.keyring.origins.some((origin) => !approval.approvedOriginIds.includes(origin.id)) ||
      [bundle.runtimePack, bundle.modelPack].some(
        (pack) =>
          !approval.approvedSourceLockIds.includes(pack.source.lockId) ||
          !approval.approvedToolchainProfileIds.includes(pack.build.toolchain) ||
          !approval.approvedPackDefinitionIds.includes(pack.build.packDefinitionId),
      ) ||
      !isLogicalId(approval.approvalId) ||
      !isSha256(approval.frozenCatalogSha256)
    ) {
      throw new Error('Local Whisper production approval does not match frozen inputs');
    }
  }
}
