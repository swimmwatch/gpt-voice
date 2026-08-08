import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { chmod, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { serializeCanonicalLocalWhisperCatalogJson, toLocalWhisperArtifactId } from '@shared/localWhisper';

import { sha256Bytes, writeCanonicalJson } from '../packaging/fileIntegrity';
import type { DevelopmentRuntimeInput } from './DevelopmentRuntimeInputs';

export const DEVELOPMENT_RUNTIME_ATTESTATION_FILE_NAME = 'runtime-attestation.json';

const ATTESTATION_KIND = 'local-whisper-development-runtime-attestation';
const ATTESTATION_SCHEMA_VERSION = 1;
const RUNTIME_BACKENDS = Object.freeze(['cpu', 'cuda'] as const);

export interface DevelopmentRuntimeAttestationEntry {
  readonly backend: 'cpu' | 'cuda';
  readonly archiveSha256: string;
  readonly archiveSignature: string;
}

export interface DevelopmentRuntimeAttestation {
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly runtimes: readonly DevelopmentRuntimeAttestationEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function isCanonicalSignature(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    return Buffer.from(value, 'base64').toString('base64') === value;
  } catch {
    return false;
  }
}

function expectedKeyId(publicKeyPem: string): string {
  return `qualification-development-${sha256Bytes(publicKeyPem).slice(0, 24)}`;
}

function freezeAttestation(input: DevelopmentRuntimeAttestation): DevelopmentRuntimeAttestation {
  return Object.freeze({
    keyId: input.keyId,
    publicKeyPem: input.publicKeyPem,
    runtimes: Object.freeze(input.runtimes.map((entry) => Object.freeze({ ...entry }))),
  });
}

function parseAttestation(
  value: unknown,
  runtimes: readonly DevelopmentRuntimeInput[],
): DevelopmentRuntimeAttestation | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['schemaVersion', 'kind', 'keyId', 'publicKeyPem', 'runtimes']) ||
    value.schemaVersion !== ATTESTATION_SCHEMA_VERSION ||
    value.kind !== ATTESTATION_KIND ||
    typeof value.keyId !== 'string' ||
    !toLocalWhisperArtifactId(value.keyId) ||
    typeof value.publicKeyPem !== 'string' ||
    value.publicKeyPem.includes('PRIVATE KEY') ||
    value.keyId !== expectedKeyId(value.publicKeyPem) ||
    !Array.isArray(value.runtimes) ||
    value.runtimes.length !== RUNTIME_BACKENDS.length
  ) {
    return null;
  }
  const runtimeCandidates: readonly unknown[] = value.runtimes;
  const entries: DevelopmentRuntimeAttestationEntry[] = [];
  for (const backend of RUNTIME_BACKENDS) {
    const expectedRuntime = runtimes.find((runtime) => runtime.backend === backend);
    const candidate = runtimeCandidates.find((runtime) => isRecord(runtime) && runtime.backend === backend);
    if (
      !expectedRuntime ||
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ['backend', 'archiveSha256', 'archiveSignature']) ||
      candidate.archiveSha256 !== expectedRuntime.archiveSha256 ||
      !isCanonicalSignature(candidate.archiveSignature)
    ) {
      return null;
    }
    try {
      if (
        !verify(
          null,
          Buffer.from(expectedRuntime.archiveSha256, 'hex'),
          value.publicKeyPem,
          Buffer.from(candidate.archiveSignature, 'base64'),
        )
      ) {
        return null;
      }
    } catch {
      return null;
    }
    entries.push(
      Object.freeze({
        backend,
        archiveSha256: expectedRuntime.archiveSha256,
        archiveSignature: candidate.archiveSignature,
      }),
    );
  }
  return freezeAttestation({ keyId: value.keyId, publicKeyPem: value.publicKeyPem, runtimes: entries });
}

/** Persists only public runtime attestations so immutable packs retain identity across development sessions. */
export class DevelopmentRuntimeAttestationStore {
  public async load(
    filePath: string,
    runtimes: readonly DevelopmentRuntimeInput[],
  ): Promise<DevelopmentRuntimeAttestation> {
    const normalizedPath = path.normalize(filePath);
    if (
      !path.isAbsolute(filePath) ||
      normalizedPath === path.parse(normalizedPath).root ||
      runtimes.length !== RUNTIME_BACKENDS.length ||
      new Set(runtimes.map(({ backend }) => backend)).size !== RUNTIME_BACKENDS.length ||
      runtimes.some(({ archiveSha256 }) => !/^[a-f\d]{64}$/u.test(archiveSha256))
    ) {
      throw new Error('Local Whisper development runtime attestation input invalid');
    }
    try {
      const document = await readFile(normalizedPath, 'utf8');
      const parsed = JSON.parse(document) as unknown;
      if (serializeCanonicalLocalWhisperCatalogJson(parsed) === document) {
        const attestation = parseAttestation(parsed, runtimes);
        if (attestation) return attestation;
      }
    } catch {
      // Missing or invalid public metadata is replaced from the exact current runtime inputs.
    }

    const keyPair = generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const attestation = freezeAttestation({
      keyId: expectedKeyId(publicKeyPem),
      publicKeyPem,
      runtimes: RUNTIME_BACKENDS.map((backend) => {
        const runtime = runtimes.find((candidate) => candidate.backend === backend);
        if (!runtime) throw new Error('Local Whisper development runtime attestation input invalid');
        return Object.freeze({
          backend,
          archiveSha256: runtime.archiveSha256,
          archiveSignature: sign(null, Buffer.from(runtime.archiveSha256, 'hex'), keyPair.privateKey).toString(
            'base64',
          ),
        });
      }),
    });
    await writeCanonicalJson(normalizedPath, {
      schemaVersion: ATTESTATION_SCHEMA_VERSION,
      kind: ATTESTATION_KIND,
      ...attestation,
    });
    await chmod(normalizedPath, 0o600);
    return attestation;
  }
}
