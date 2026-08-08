import { X509Certificate } from 'node:crypto';
import { constants as fileConstants, promises as fileSystemPromises } from 'node:fs';
import * as path from 'node:path';
import { TextDecoder } from 'node:util';

import {
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
} from '@shared/localWhisper';

import type {
  LocalWhisperCatalogAllowlistedOrigin,
  LocalWhisperCatalogPublicKey,
  LocalWhisperCatalogTrustPolicy,
} from '../catalog/LocalWhisperCatalogTypes';
import type { LocalWhisperProductionCatalogInput } from '../composition/createProductionLocalWhisperEnvironment';

export const LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT = '--local-whisper-development-activation=' as const;
export const LOCAL_WHISPER_DEVELOPMENT_DISPLAY_LABEL = 'Development qualification artifacts' as const;

const ACTIVATION_MODE = 'local-whisper-development-activation';
const ACTIVATION_SCHEMA_VERSION = 1;
const MAX_ACTIVATION_DOCUMENT_BYTES = 4 * 1024 * 1024;
const ACTIVATION_KEYS = Object.freeze([
  'schemaVersion',
  'mode',
  'purpose',
  'appRevision',
  'workerProtocolVersion',
  'resourcesPath',
  'catalogEnvelope',
  'publicKeys',
  'origins',
  'trustedCertificateAuthorities',
  'displayLabel',
]);

interface ActivationFileHandle {
  readonly stat: () => Promise<{
    readonly size: number;
    readonly mode: number;
    readonly uid: number;
    readonly isFile: () => boolean;
  }>;
  readonly readFile: () => Promise<Buffer>;
  readonly close: () => Promise<void>;
}

export interface LocalWhisperDevelopmentActivationDependencies {
  readonly appRevision: string;
  readonly arguments: readonly string[];
  readonly authenticateCatalog: (document: Uint8Array, trustPolicy: LocalWhisperCatalogTrustPolicy) => boolean;
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly userId: number | undefined;
  readonly openFile: (filePath: string, flags: number) => Promise<ActivationFileHandle>;
}

export type LocalWhisperDevelopmentActivationResult =
  | { readonly status: 'absent' }
  | { readonly status: 'unavailable' }
  | {
      readonly status: 'active';
      readonly resourcesPath: string;
      readonly trustedCertificateAuthorities: readonly string[];
      readonly catalogInput: LocalWhisperProductionCatalogInput;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function isActivationLikeArgument(value: string): boolean {
  return /^--local-whisper\S*activation/iu.test(value);
}

function safeAbsoluteNonRoot(value: unknown): string | null {
  if (typeof value !== 'string' || value.includes('\0') || !path.isAbsolute(value)) return null;
  const normalized = path.normalize(value);
  return normalized === path.parse(normalized).root ? null : normalized;
}

function parsePublicKeys(value: unknown): readonly LocalWhisperCatalogPublicKey[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const keys: LocalWhisperCatalogPublicKey[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ['keyId', 'publicKeyPem'])) return null;
    const keyId = toLocalWhisperArtifactId(candidate.keyId);
    if (!keyId || !keyId.startsWith('qualification-') || typeof candidate.publicKeyPem !== 'string') return null;
    keys.push(Object.freeze({ keyId, publicKeyPem: candidate.publicKeyPem }));
  }
  return new Set(keys.map(({ keyId }) => keyId)).size === keys.length ? Object.freeze(keys) : null;
}

function isExactHttpsOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === '/' &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function parseOrigins(value: unknown): readonly LocalWhisperCatalogAllowlistedOrigin[] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const origins: LocalWhisperCatalogAllowlistedOrigin[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ['id', 'origin'])) return null;
    const id = toLocalWhisperArtifactId(candidate.id);
    if (!id || typeof candidate.origin !== 'string' || !isExactHttpsOrigin(candidate.origin)) return null;
    origins.push(Object.freeze({ id, origin: candidate.origin }));
  }
  if (new Set(origins.map(({ id }) => id)).size !== origins.length) return null;
  const publicModelOrigin = origins.filter(({ origin }) => origin === 'https://huggingface.co');
  const runtimeOrigins = origins.filter(({ origin }) => {
    const url = new URL(origin);
    return url.hostname === '127.0.0.1' && url.port !== '';
  });
  return publicModelOrigin.length === 1 && runtimeOrigins.length === 1 ? Object.freeze(origins) : null;
}

function parseCertificateAuthorities(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string')) return null;
  const authorities: string[] = [];
  try {
    for (const pem of value as readonly string[]) {
      if (pem.includes('PRIVATE KEY')) return null;
      const certificate = new X509Certificate(pem);
      if (!certificate.ca || certificate.checkIP('127.0.0.1') !== '127.0.0.1') return null;
      authorities.push(pem);
    }
  } catch {
    return null;
  }
  return Object.freeze(authorities);
}

async function readActivationDocument(
  dependencies: LocalWhisperDevelopmentActivationDependencies,
  descriptorPath: string,
): Promise<string | null> {
  let handle: ActivationFileHandle | null = null;
  try {
    handle = await dependencies.openFile(descriptorPath, fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      !Number.isSafeInteger(metadata.size) ||
      metadata.size <= 0 ||
      metadata.size > MAX_ACTIVATION_DOCUMENT_BYTES ||
      (dependencies.platform === 'linux' && (metadata.mode & 0o077) !== 0) ||
      (dependencies.platform === 'linux' && dependencies.userId !== undefined && metadata.uid !== dependencies.userId)
    ) {
      return null;
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength !== metadata.size) return null;
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Loads one explicit, private, canonical qualification activation and authenticates its catalog before composition. */
export class LocalWhisperDevelopmentActivationLoader {
  public constructor(private readonly dependencies: LocalWhisperDevelopmentActivationDependencies) {}

  /** Returns only an authenticated activation or a fail-closed startup state. */
  public async load(): Promise<LocalWhisperDevelopmentActivationResult> {
    const activationLike = this.dependencies.arguments.filter(isActivationLikeArgument);
    const exact = this.dependencies.arguments.filter((argument) =>
      argument.startsWith(LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT),
    );
    if (activationLike.length === 0) return Object.freeze({ status: 'absent' });
    if (
      this.dependencies.isPackaged ||
      (this.dependencies.platform !== 'linux' && this.dependencies.platform !== 'win32') ||
      activationLike.length !== 1 ||
      exact.length !== 1 ||
      activationLike[0] !== exact[0]
    ) {
      return Object.freeze({ status: 'unavailable' });
    }
    const descriptorPath = safeAbsoluteNonRoot(exact[0].slice(LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT.length));
    if (!descriptorPath) return Object.freeze({ status: 'unavailable' });
    const documentText = await readActivationDocument(this.dependencies, descriptorPath);
    if (!documentText) return Object.freeze({ status: 'unavailable' });

    let descriptor: unknown;
    try {
      descriptor = JSON.parse(documentText) as unknown;
      if (serializeCanonicalLocalWhisperCatalogJson(descriptor) !== documentText) {
        return Object.freeze({ status: 'unavailable' });
      }
    } catch {
      return Object.freeze({ status: 'unavailable' });
    }
    if (!isRecord(descriptor) || !hasExactKeys(descriptor, ACTIVATION_KEYS)) {
      return Object.freeze({ status: 'unavailable' });
    }
    const appRevision = toLocalWhisperRevisionId(descriptor.appRevision);
    const resourcesPath = safeAbsoluteNonRoot(descriptor.resourcesPath);
    const publicKeys = parsePublicKeys(descriptor.publicKeys);
    const origins = parseOrigins(descriptor.origins);
    const trustedCertificateAuthorities = parseCertificateAuthorities(descriptor.trustedCertificateAuthorities);
    if (
      descriptor.schemaVersion !== ACTIVATION_SCHEMA_VERSION ||
      descriptor.mode !== ACTIVATION_MODE ||
      descriptor.purpose !== 'qualification' ||
      descriptor.appRevision !== this.dependencies.appRevision ||
      descriptor.workerProtocolVersion !== LOCAL_WHISPER_WORKER_PROTOCOL_VERSION ||
      descriptor.displayLabel !== LOCAL_WHISPER_DEVELOPMENT_DISPLAY_LABEL ||
      !appRevision ||
      !resourcesPath ||
      path.dirname(resourcesPath) !== path.dirname(descriptorPath) ||
      !publicKeys ||
      !origins ||
      !trustedCertificateAuthorities ||
      !isRecord(descriptor.catalogEnvelope)
    ) {
      return Object.freeze({ status: 'unavailable' });
    }

    const trustPolicy: LocalWhisperCatalogTrustPolicy = Object.freeze({
      purpose: 'qualification',
      publicKeys,
      origins,
      appRevision,
      workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    });
    const catalogDocument = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(descriptor.catalogEnvelope), 'utf8');
    if (!this.dependencies.authenticateCatalog(catalogDocument, trustPolicy)) {
      return Object.freeze({ status: 'unavailable' });
    }
    return Object.freeze({
      status: 'active',
      resourcesPath,
      trustedCertificateAuthorities,
      catalogInput: Object.freeze({
        activationPurpose: 'qualification',
        document: catalogDocument,
        trustPolicy,
      }),
    });
  }
}

/** Opens the selected descriptor without following its final path component. */
export function openLocalWhisperActivationFile(
  filePath: string,
  flags: number,
): ReturnType<typeof fileSystemPromises.open> {
  return fileSystemPromises.open(filePath, flags);
}
