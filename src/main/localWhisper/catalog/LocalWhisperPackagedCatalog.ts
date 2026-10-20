import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { TextDecoder } from 'node:util';

import {
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
} from '@shared/localWhisper';

import type { LocalWhisperCatalogTrustPolicy } from './LocalWhisperCatalogTypes';

/**
 * Builds without authenticated production package resources remain disabled.
 * No development, fixture, or qualification authority is bundled into this fallback.
 */
export const PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT = Buffer.from(
  '{"mode":"disabled","publicationState":"disabled-deferred-publication","schemaVersion":1}',
  'utf8',
);

export const PACKAGED_LOCAL_WHISPER_CATALOG_PUBLIC_KEYS = Object.freeze([]);
export const PACKAGED_LOCAL_WHISPER_CATALOG_ORIGINS = Object.freeze([]);

declare const __LOCAL_WHISPER_PRODUCTION_BUNDLE_MANIFEST_SHA256__: string | null;

/** The release build pins approved package metadata inside app.asar, independently of sidecar resources. */
export const PACKAGED_LOCAL_WHISPER_BUNDLE_MANIFEST_SHA256 =
  typeof __LOCAL_WHISPER_PRODUCTION_BUNDLE_MANIFEST_SHA256__ === 'undefined'
    ? null
    : __LOCAL_WHISPER_PRODUCTION_BUNDLE_MANIFEST_SHA256__;

const SHA256_PATTERN = /^[a-f\d]{64}$/u;
const NON_PRODUCTION_KEY_PATTERN = /^(?:fixture|qualification)-/u;
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_CATALOG_BYTES = 12 * 1024 * 1024;
const STATE_KEYS = [
  'schemaVersion',
  'mode',
  'purpose',
  'platform',
  'catalogSha256',
  'bundleManifestSha256',
  'signingKeyId',
  'executableActionsEnabled',
] as const;
const KEYRING_KEYS = [
  'schemaVersion',
  'purpose',
  'appRevision',
  'workerProtocolVersion',
  'publicKeys',
  'origins',
] as const;
const MANIFEST_KEYS = [
  'schemaVersion',
  'purpose',
  'keyId',
  'catalogSha256',
  'createdBy',
  'synthetic',
  'files',
] as const;

interface PackagedCatalogDependencies {
  readonly bundleManifestSha256: string | null;
  readonly appRevision: string;
  readonly workerProtocolVersion: number;
  readonly platform: NodeJS.Platform;
  readonly resourcesPath: string;
  readonly readFile: (filePath: string) => Promise<Uint8Array>;
}

export interface LocalWhisperPackagedCatalogInput {
  readonly document: Uint8Array;
  readonly trustPolicy: LocalWhisperCatalogTrustPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Loads app-owned production trust from fixed package paths, never from settings or environment overrides. */
export class LocalWhisperPackagedCatalogRepository {
  private readonly decoder = new TextDecoder('utf8', { fatal: true });

  public constructor(private readonly dependencies: PackagedCatalogDependencies) {}

  public async load(): Promise<LocalWhisperPackagedCatalogInput | null> {
    try {
      const { platform, resourcesPath } = this.dependencies;
      if (
        !isSha256(this.dependencies.bundleManifestSha256) ||
        !['linux', 'win32'].includes(platform) ||
        !path.isAbsolute(resourcesPath) ||
        resourcesPath.includes('\0') ||
        path.normalize(resourcesPath) === path.parse(resourcesPath).root
      )
        return null;
      const root = path.join(resourcesPath, 'local-whisper');
      const stateBytes = await this.dependencies.readFile(path.join(root, 'catalog-state.json'));
      const state = this.parseMetadata(stateBytes);
      if (
        !hasExactKeys(state, STATE_KEYS) ||
        state.schemaVersion !== 1 ||
        state.mode !== 'production' ||
        state.purpose !== 'production' ||
        state.platform !== platform ||
        state.executableActionsEnabled !== true ||
        !isSha256(state.catalogSha256) ||
        !isSha256(state.bundleManifestSha256) ||
        !toLocalWhisperArtifactId(state.signingKeyId)
      )
        return null;

      const manifestBytes = await this.dependencies.readFile(path.join(root, 'bundle-manifest.json'));
      if (
        state.bundleManifestSha256 !== this.dependencies.bundleManifestSha256 ||
        digest(manifestBytes) !== this.dependencies.bundleManifestSha256
      )
        return null;
      const manifest = this.parseMetadata(manifestBytes);
      if (
        !hasExactKeys(manifest, MANIFEST_KEYS) ||
        manifest.schemaVersion !== 1 ||
        manifest.purpose !== 'production' ||
        manifest.synthetic !== false ||
        manifest.createdBy !== 'external-production-authority' ||
        manifest.keyId !== state.signingKeyId ||
        manifest.catalogSha256 !== state.catalogSha256
      )
        return null;

      const keyringBytes = await this.dependencies.readFile(path.join(root, 'keyring.json'));
      if (!this.matchesManifestFile(manifest.files, 'keyring.json', keyringBytes)) return null;
      const trustPolicy = this.parseTrustPolicy(this.parseMetadata(keyringBytes));
      if (!trustPolicy || !trustPolicy.publicKeys.some(({ keyId }) => keyId === state.signingKeyId)) return null;
      const catalogBytes = await this.dependencies.readFile(path.join(root, 'catalog.json'));
      if (
        catalogBytes.byteLength === 0 ||
        catalogBytes.byteLength > MAX_CATALOG_BYTES ||
        digest(catalogBytes) !== state.catalogSha256 ||
        !this.matchesManifestFile(manifest.files, 'catalog.json', catalogBytes)
      )
        return null;
      // The existing catalog repository authenticates the signature, purpose,
      // app/protocol compatibility and origin policy before activation.
      return Object.freeze({ document: Uint8Array.from(catalogBytes), trustPolicy });
    } catch {
      return null;
    }
  }

  private parseMetadata(bytes: Uint8Array): Record<string, unknown> {
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_METADATA_BYTES)
      throw new Error('PACKAGED_CATALOG_METADATA_INVALID');
    const text = this.decoder.decode(bytes);
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || serializeCanonicalLocalWhisperCatalogJson(value) !== text) {
      throw new Error('PACKAGED_CATALOG_METADATA_INVALID');
    }
    return value;
  }

  private matchesManifestFile(files: unknown, name: string, bytes: Uint8Array): boolean {
    if (!Array.isArray(files)) return false;
    const entries: unknown[] = files;
    const names = new Set<string>();
    let matched = false;
    for (const file of entries) {
      if (
        !isRecord(file) ||
        !hasExactKeys(file, ['path', 'sizeBytes', 'sha256']) ||
        typeof file.path !== 'string' ||
        names.has(file.path) ||
        !Number.isSafeInteger(file.sizeBytes) ||
        (file.sizeBytes as number) <= 0 ||
        !isSha256(file.sha256)
      )
        return false;
      names.add(file.path);
      if (file.path === name) matched = file.sizeBytes === bytes.byteLength && file.sha256 === digest(bytes);
    }
    return matched;
  }

  private parseTrustPolicy(keyring: Record<string, unknown>): LocalWhisperCatalogTrustPolicy | null {
    const revision = toLocalWhisperRevisionId(this.dependencies.appRevision);
    if (
      !hasExactKeys(keyring, KEYRING_KEYS) ||
      keyring.schemaVersion !== 1 ||
      keyring.purpose !== 'production' ||
      !revision ||
      keyring.appRevision !== revision ||
      !Number.isSafeInteger(this.dependencies.workerProtocolVersion) ||
      this.dependencies.workerProtocolVersion <= 0 ||
      keyring.workerProtocolVersion !== this.dependencies.workerProtocolVersion ||
      !Array.isArray(keyring.publicKeys) ||
      keyring.publicKeys.length === 0 ||
      !Array.isArray(keyring.origins) ||
      keyring.origins.length === 0
    )
      return null;
    const keys: unknown[] = keyring.publicKeys;
    const originEntries: unknown[] = keyring.origins;
    const publicKeys: LocalWhisperCatalogTrustPolicy['publicKeys'][number][] = [];
    const origins: LocalWhisperCatalogTrustPolicy['origins'][number][] = [];
    for (const entry of keys) {
      if (!isRecord(entry) || !hasExactKeys(entry, ['keyId', 'publicKeyPem'])) return null;
      const keyId = toLocalWhisperArtifactId(entry.keyId);
      if (!keyId || NON_PRODUCTION_KEY_PATTERN.test(keyId) || typeof entry.publicKeyPem !== 'string') return null;
      if (publicKeys.some((key) => key.keyId === keyId)) return null;
      publicKeys.push(Object.freeze({ keyId, publicKeyPem: entry.publicKeyPem }));
    }
    for (const entry of originEntries) {
      if (!isRecord(entry) || !hasExactKeys(entry, ['id', 'origin']) || typeof entry.origin !== 'string') return null;
      const id = toLocalWhisperArtifactId(entry.id);
      const url = new URL(entry.origin);
      if (!id || url.protocol !== 'https:' || url.origin !== entry.origin || url.username || url.password) return null;
      if (origins.some((origin) => origin.id === id)) return null;
      origins.push(Object.freeze({ id, origin: entry.origin }));
    }
    return Object.freeze({
      purpose: 'production',
      appRevision: revision,
      workerProtocolVersion: this.dependencies.workerProtocolVersion,
      publicKeys: Object.freeze(publicKeys),
      origins: Object.freeze(origins),
    });
  }
}

export function createPackagedLocalWhisperCatalogTrustPolicy(
  appRevision: string,
  workerProtocolVersion: number,
): LocalWhisperCatalogTrustPolicy | null {
  const revision = toLocalWhisperRevisionId(appRevision);
  if (!revision || !Number.isSafeInteger(workerProtocolVersion) || workerProtocolVersion <= 0) return null;
  return Object.freeze({
    purpose: 'production',
    publicKeys: PACKAGED_LOCAL_WHISPER_CATALOG_PUBLIC_KEYS,
    origins: PACKAGED_LOCAL_WHISPER_CATALOG_ORIGINS,
    appRevision: revision,
    workerProtocolVersion,
  });
}
