import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import * as path from 'node:path';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

const HELPER_ROLES = ['filesystem-authority-guard', 'operation-scoped-launcher'] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

interface PackagedHelperIdentity {
  readonly role: (typeof HELPER_ROLES)[number];
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly mode: number;
}

export type LocalWhisperPackagedResourceResolution =
  | {
      readonly availability: 'available';
      readonly filesystemGuardExecutable: string;
      readonly launcherExecutable: string;
    }
  | { readonly availability: 'planned'; readonly code: 'PLANNED_UNAVAILABLE' };

export interface LocalWhisperPackagedResourceResolverDependencies {
  readonly platform: 'darwin' | 'linux' | 'win32';
  readonly resourcesPath: string;
  readonly readFile: (filePath: string) => Promise<Uint8Array>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function parseHelperManifest(value: unknown, platform: 'linux' | 'win32'): readonly PackagedHelperIdentity[] {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['schemaVersion', 'platform', 'helpers', 'licenseFile']) ||
    value.schemaVersion !== 1 ||
    value.platform !== platform ||
    value.licenseFile !== 'LICENSE.txt' ||
    !isUnknownArray(value.helpers) ||
    value.helpers.length !== HELPER_ROLES.length
  ) {
    throw new Error('PACKAGED_HELPER_MANIFEST_INVALID');
  }
  const extension = platform === 'win32' ? '.exe' : '';
  const expectedNames = [`fs-guard${extension}`, `local-whisper-launcher${extension}`];
  for (let index = 0; index < HELPER_ROLES.length; index += 1) {
    const helper = value.helpers[index];
    if (
      !isRecord(helper) ||
      !hasExactKeys(helper, ['role', 'name', 'sizeBytes', 'sha256', 'mode']) ||
      helper.role !== HELPER_ROLES[index] ||
      helper.name !== expectedNames[index] ||
      !Number.isSafeInteger(helper.sizeBytes) ||
      (helper.sizeBytes as number) <= 0 ||
      typeof helper.sha256 !== 'string' ||
      !SHA256_PATTERN.test(helper.sha256) ||
      helper.mode !== (platform === 'linux' ? 0o500 : 0)
    ) {
      throw new Error('PACKAGED_HELPER_MANIFEST_INVALID');
    }
  }
  return value.helpers as readonly PackagedHelperIdentity[];
}

function safeResourcesRoot(resourcesPath: string): string {
  if (!path.isAbsolute(resourcesPath) || resourcesPath.includes('\0'))
    throw new Error('PACKAGED_RESOURCE_ROOT_INVALID');
  const normalized = path.normalize(resourcesPath);
  if (normalized === path.parse(normalized).root) throw new Error('PACKAGED_RESOURCE_ROOT_INVALID');
  return normalized;
}

/** Resolves and authenticates main-only helper paths immediately before native process creation. */
export class LocalWhisperPackagedResourceResolver {
  private readonly decoder = new TextDecoder('utf8', { fatal: true });

  public constructor(private readonly dependencies: LocalWhisperPackagedResourceResolverDependencies) {}

  public async resolve(): Promise<LocalWhisperPackagedResourceResolution> {
    if (this.dependencies.platform === 'darwin') {
      return Object.freeze({ availability: 'planned', code: 'PLANNED_UNAVAILABLE' });
    }
    const resourcesRoot = safeResourcesRoot(this.dependencies.resourcesPath);
    const nativeRoot = path.join(resourcesRoot, 'local-whisper', 'native');
    const manifestPath = path.join(nativeRoot, 'helpers.manifest.json');
    const manifestBytes = await this.dependencies.readFile(manifestPath);
    let manifest: unknown;
    try {
      const manifestText = this.decoder.decode(manifestBytes);
      manifest = JSON.parse(manifestText) as unknown;
      if (serializeCanonicalLocalWhisperCatalogJson(manifest) !== manifestText) {
        throw new Error('PACKAGED_HELPER_MANIFEST_INVALID');
      }
    } catch {
      throw new Error('PACKAGED_HELPER_MANIFEST_INVALID');
    }
    const helpers = parseHelperManifest(manifest, this.dependencies.platform);
    const verifiedPaths: string[] = [];
    for (const helper of helpers) {
      const executablePath = path.join(nativeRoot, helper.name);
      const bytes = await this.dependencies.readFile(executablePath);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (bytes.byteLength !== helper.sizeBytes || digest !== helper.sha256) {
        throw new Error('PACKAGED_HELPER_IDENTITY_MISMATCH');
      }
      verifiedPaths.push(executablePath);
    }
    return Object.freeze({
      availability: 'available',
      filesystemGuardExecutable: verifiedPaths[0],
      launcherExecutable: verifiedPaths[1],
    });
  }
}
