import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import * as path from 'node:path';

import { extractFile, listPackage } from '@electron/asar';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { withVerifiedRegularFile } from './verifiedRegularFile';

export const APPLICATION_ARTIFACT_SECURITY_SCHEMA_VERSION = 1;
export const APPLICATION_SBOM_FORMAT = 'CycloneDX-1.6';
export const APPLICATION_ARTIFACT_SECURITY_MAXIMUM_BYTES = 16 * 1024;
export const APPLICATION_SBOM_MAXIMUM_BYTES = 256 * 1024;
export const APPLICATION_SECURITY_SCANNER = Object.freeze({ name: 'trivy', version: '0.69.3' });

const DATABASE_MAXIMUM_AGE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const MAXIMUM_COMPONENTS = 256;
const MAXIMUM_FILES = 50_000;
const MAXIMUM_FILE_BYTES = 1024 * 1024 * 1024;
const MAXIMUM_PACKAGE_LOCK_BYTES = 2 * 1024 * 1024;
const MAXIMUM_PACKAGED_PACKAGE_JSON_BYTES = 64 * 1024;
const MAXIMUM_SOURCE_LOCK_BYTES = 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const SAFE_COMPONENT = /^[\w@.+/-]{1,160}$/u;
const SAFE_COMPONENT_NAME = /^[\w@.+/ -]{1,160}$/u;
const SAFE_PATH_COMPONENT = /^[\w@.+ -]{1,160}$/u;
const TRIVY_REPORT_SCHEMA_VERSION = 2;

const PLATFORM_FORMATS = Object.freeze({
  linux: Object.freeze(['appimage', 'deb', 'rpm', 'unpacked'] as const),
  win32: Object.freeze(['nsis', 'unpacked'] as const),
});

const EXPECTED_NATIVE_LOCKS = Object.freeze([
  Object.freeze({
    lockId: 'googletest-v1.17.0-52eb810',
    name: 'googletest',
    repository: 'https://github.com/google/googletest.git',
    revision: '52eb8108c5bdec04579160ae17225d66034bd723',
  }),
  Object.freeze({
    lockId: 'nlohmann-json-v3.12.0-subset',
    name: 'nlohmann-json',
    repository: 'https://github.com/nlohmann/json.git',
    revision: '55f93686c01528224f448c19128836e7df245f72',
  }),
  Object.freeze({
    lockId: 'whisper-cpp-v1.9.1-f049fff',
    name: 'whisper.cpp',
    repository: 'https://github.com/ggml-org/whisper.cpp.git',
    revision: 'f049fff95a089aa9969deb009cdd4892b3e74916',
  }),
]);

export type ApplicationSecurityPlatform = keyof typeof PLATFORM_FORMATS;
export type ApplicationPackageFormat = (typeof PLATFORM_FORMATS)[ApplicationSecurityPlatform][number];

interface CycloneDxComponent {
  readonly 'bom-ref': string;
  readonly hashes?: readonly { readonly alg: 'SHA-256'; readonly content: string }[];
  readonly name: string;
  readonly properties?: readonly { readonly name: string; readonly value: string }[];
  readonly purl?: string;
  readonly type: 'application' | 'file' | 'library';
  readonly version: string;
}

export interface ApplicationSbom {
  readonly bomFormat: 'CycloneDX';
  readonly components: readonly CycloneDxComponent[];
  readonly metadata: { readonly component: CycloneDxComponent };
  readonly specVersion: '1.6';
  readonly version: 1;
}

export interface ArtifactSecurityRecord {
  readonly attestation: null;
  readonly checksumSha256: string;
  readonly packageFormat: ApplicationPackageFormat;
  readonly packageSha256: string;
  readonly platform: ApplicationSecurityPlatform;
  readonly result: 'clean';
  readonly sbom: { readonly format: typeof APPLICATION_SBOM_FORMAT; readonly sha256: string };
  readonly scannedAt: string;
  readonly scanner: {
    readonly database: { readonly sha256: string; readonly updatedAt: string };
    readonly name: 'trivy';
    readonly version: '0.69.3';
  };
  readonly schemaVersion: typeof APPLICATION_ARTIFACT_SECURITY_SCHEMA_VERSION;
  readonly sourceCommit: string;
  readonly unpackedRootSha256: string;
}

interface PackageLockEntry {
  readonly dev?: unknown;
  readonly name?: unknown;
  readonly version?: unknown;
}

interface TrivyDatabase {
  readonly DownloadedAt?: unknown;
  readonly NextUpdate?: unknown;
  readonly UpdatedAt?: unknown;
  readonly Version?: unknown;
}

interface FileManifestEntry {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

function fail(code: string): never {
  throw new Error(`APPLICATION_ARTIFACT_SECURITY_${code}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], code: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'));
  const expected = [...keys].sort((left, right) => left.localeCompare(right, 'en'));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code);
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(serializeCanonicalLocalWhisperCatalogJson(value), 'utf8');
}

function safeSha256(value: unknown, code: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(code);
  return value;
}

function safeSourceCommit(value: unknown, code: string): string {
  if (typeof value !== 'string' || !SOURCE_COMMIT.test(value)) fail(code);
  return value;
}

function safeTimestamp(value: unknown, code: string): string {
  if (typeof value !== 'string' || !TIMESTAMP.test(value)) fail(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(code);
  const normalized = new Date(parsed).toISOString();
  if (normalized.slice(0, 10) !== value.slice(0, 10)) fail(code);
  return normalized;
}

function packageFormat(platform: ApplicationSecurityPlatform, value: unknown): ApplicationPackageFormat {
  if (typeof value !== 'string' || !PLATFORM_FORMATS[platform].includes(value as never)) fail('FORMAT_INVALID');
  return value as ApplicationPackageFormat;
}

function packageNameFromLockPath(lockPath: string, entry: PackageLockEntry): string | null {
  if (typeof entry.name === 'string' && SAFE_COMPONENT.test(entry.name)) return entry.name;
  const marker = 'node_modules/';
  const index = lockPath.lastIndexOf(marker);
  const candidate = index >= 0 ? lockPath.slice(index + marker.length) : '';
  return SAFE_COMPONENT.test(candidate) ? candidate : null;
}

function isPackagedPackageJsonPath(archiveEntry: string): boolean {
  const segments = archiveEntry.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) return false;
  const nodeModulesIndex = segments.lastIndexOf('node_modules');
  if (nodeModulesIndex < 0 || segments[segments.length - 1] !== 'package.json') return false;
  const packageSegments = segments.slice(nodeModulesIndex + 1, -1);
  return (
    (packageSegments.length === 1 && !packageSegments[0]?.startsWith('@')) ||
    (packageSegments.length === 2 && packageSegments[0]?.startsWith('@') === true)
  );
}

function npmPurl(name: string, version: string): string {
  return `pkg:npm/${encodeURIComponent(name).replace(/%2F/gu, '/')}@${encodeURIComponent(version)}`;
}

function componentComparator(left: CycloneDxComponent, right: CycloneDxComponent): number {
  return left['bom-ref'].localeCompare(right['bom-ref'], 'en');
}

function isBinaryName(name: string, platform: ApplicationSecurityPlatform): boolean {
  const lower = name.toLowerCase();
  return platform === 'win32'
    ? lower.endsWith('.exe') || lower.endsWith('.dll')
    : lower.endsWith('.so') || lower.includes('.so.') || lower === 'gpt-voice' || lower === 'chrome';
}

function parseJson(bytes: Buffer, code: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    fail(code);
  }
}

function canonicalTrivyArtifactName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024) fail('SCAN_MALFORMED');
  const normalized = value.replace(/\\/gu, '/').replace(/^(?:\.\/)+/u, '');
  const segments = normalized.split('/');
  if (
    segments.length === 0 ||
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..' || !SAFE_PATH_COMPONENT.test(segment),
    )
  ) {
    fail('SCAN_MALFORMED');
  }
  return segments.join('/');
}

function normalizeTrivyReport(value: unknown, expectedArtifact: string, role: 'filesystem' | 'sbom'): void {
  const report = isRecord(value) ? value : fail('SCAN_MALFORMED');
  const rawResults = report.Results;
  const expectedArtifactType = role === 'filesystem' ? 'filesystem' : 'cyclonedx';
  if (
    report.SchemaVersion !== TRIVY_REPORT_SCHEMA_VERSION ||
    canonicalTrivyArtifactName(report.ArtifactName) !== expectedArtifact ||
    report.ArtifactType !== expectedArtifactType
  ) {
    fail('SCAN_MALFORMED');
  }
  if (rawResults === undefined && role === 'filesystem') return;
  if (
    !Array.isArray(rawResults) ||
    (role === 'sbom' && rawResults.length === 0) ||
    rawResults.length > MAXIMUM_COMPONENTS
  ) {
    fail('SCAN_MALFORMED');
  }
  for (const result of rawResults) {
    if (
      !isRecord(result) ||
      typeof result.Target !== 'string' ||
      result.Target.length === 0 ||
      typeof result.Class !== 'string' ||
      result.Class.length === 0 ||
      typeof result.Type !== 'string' ||
      result.Type.length === 0
    ) {
      fail('SCAN_MALFORMED');
    }
    if (result.Vulnerabilities === undefined || result.Vulnerabilities === null) continue;
    if (!Array.isArray(result.Vulnerabilities) || result.Vulnerabilities.length > MAXIMUM_COMPONENTS) {
      fail('SCAN_MALFORMED');
    }
    for (const vulnerability of result.Vulnerabilities) {
      if (!isRecord(vulnerability) || typeof vulnerability.Severity !== 'string') fail('SCAN_MALFORMED');
      if (vulnerability.Severity !== 'HIGH' && vulnerability.Severity !== 'CRITICAL') fail('SCAN_AMBIGUOUS');
      fail('SCAN_FINDING');
    }
  }
}

/** Builds a bounded whole-application CycloneDX document from final assembled bytes. */
export class ApplicationSbomGenerator {
  public async generate(input: {
    readonly packageFormat: ApplicationPackageFormat;
    readonly packageSha256: string;
    readonly platform: ApplicationSecurityPlatform;
    readonly sourceCommit: string;
    readonly unpackedRoot: string;
    readonly workspaceRoot: string;
  }): Promise<{ readonly document: ApplicationSbom; readonly sha256: string; readonly unpackedRootSha256: string }> {
    const platform = input.platform;
    const format = packageFormat(platform, input.packageFormat);
    const sourceCommit = safeSourceCommit(input.sourceCommit, 'SOURCE_COMMIT_INVALID');
    const packageSha256 = safeSha256(input.packageSha256, 'PACKAGE_DIGEST_INVALID');
    const unpackedRoot = path.resolve(input.unpackedRoot);
    const workspaceRoot = path.resolve(input.workspaceRoot);
    const manifest = await this.fileManifest(unpackedRoot);
    const unpackedRootSha256 = sha256(canonicalBytes(manifest));
    const packageJson = this.packageJson(
      await this.readBounded(path.join(workspaceRoot, 'package.json'), undefined, 'PACKAGE_JSON'),
    );
    const components = await this.components({
      manifest,
      packageFormat: format,
      packageJson,
      packageSha256,
      platform,
      sourceCommit,
      unpackedRoot,
      workspaceRoot,
    });
    const application: CycloneDxComponent = Object.freeze({
      'bom-ref': `pkg:generic/gpt-voice@${packageJson.version}`,
      name: 'gpt-voice',
      properties: Object.freeze([
        Object.freeze({ name: 'gpt-voice:package-format', value: format }),
        Object.freeze({ name: 'gpt-voice:package-sha256', value: packageSha256 }),
        Object.freeze({ name: 'gpt-voice:platform', value: platform }),
        Object.freeze({ name: 'gpt-voice:source-commit', value: sourceCommit }),
        Object.freeze({ name: 'gpt-voice:unpacked-root-sha256', value: unpackedRootSha256 }),
      ]),
      purl: `pkg:generic/gpt-voice@${packageJson.version}`,
      type: 'application',
      version: packageJson.version,
    });
    const document: ApplicationSbom = Object.freeze({
      bomFormat: 'CycloneDX',
      components: Object.freeze([...components].sort(componentComparator)),
      metadata: Object.freeze({ component: application }),
      specVersion: '1.6',
      version: 1,
    });
    const encoded = canonicalBytes(document);
    if (encoded.byteLength > APPLICATION_SBOM_MAXIMUM_BYTES) fail('SBOM_TOO_LARGE');
    return Object.freeze({ document, sha256: sha256(encoded), unpackedRootSha256 });
  }

  private async components(input: {
    readonly manifest: readonly FileManifestEntry[];
    readonly packageFormat: ApplicationPackageFormat;
    readonly packageJson: { readonly name: string; readonly version: string };
    readonly packageSha256: string;
    readonly platform: ApplicationSecurityPlatform;
    readonly sourceCommit: string;
    readonly unpackedRoot: string;
    readonly workspaceRoot: string;
  }): Promise<CycloneDxComponent[]> {
    const components = new Map<string, CycloneDxComponent>();
    const add = (component: CycloneDxComponent): void => {
      if (!SAFE_COMPONENT_NAME.test(component.name) || !SAFE_COMPONENT.test(component.version)) {
        fail('COMPONENT_INVALID');
      }
      if (components.has(component['bom-ref'])) return;
      components.set(component['bom-ref'], Object.freeze(component));
      if (components.size > MAXIMUM_COMPONENTS) fail('COMPONENT_LIMIT');
    };

    const productionComponents = await this.productionNodeComponents(input.workspaceRoot);
    const assembledComponents = await this.assembledNodeComponents(input.unpackedRoot, productionComponents);
    for (const component of productionComponents) {
      add({
        ...component,
        properties: Object.freeze([
          Object.freeze({
            name: 'gpt-voice:component-evidence',
            value: assembledComponents.has(component['bom-ref']) ? 'final-app-asar' : 'source-lock-bundled',
          }),
        ]),
      });
    }
    for (const component of await this.nativeSourceComponents(input.workspaceRoot)) add(component);
    for (const component of this.binaryComponents(input.manifest, input.platform)) add(component);

    for (const required of ['cloakbrowser', 'playwright-core']) {
      if (![...assembledComponents.values()].some((component) => component.name === required)) {
        fail('ASSEMBLY_COMPONENT_MISSING');
      }
    }
    for (const required of ['electron']) {
      const packageVersion = await this.packageVersion(input.workspaceRoot, required);
      add({
        'bom-ref': npmPurl(required, packageVersion),
        name: required,
        purl: npmPurl(required, packageVersion),
        type: 'library',
        version: packageVersion,
      });
    }

    const helperManifest = await this.readHelperManifest(input.unpackedRoot, input.platform, input.manifest);
    for (const helper of helperManifest) {
      add({
        'bom-ref': `urn:sha256:${helper.sha256}`,
        hashes: Object.freeze([Object.freeze({ alg: 'SHA-256', content: helper.sha256 })]),
        name: helper.name,
        properties: Object.freeze([Object.freeze({ name: 'gpt-voice:component-kind', value: 'local-whisper-helper' })]),
        type: 'file',
        version: helper.sha256.slice(0, 16),
      });
    }
    return [...components.values()];
  }

  private packageJson(bytes: Buffer): { readonly name: string; readonly version: string } {
    const value = parseJson(bytes, 'PACKAGE_JSON_INVALID');
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.version !== 'string')
      fail('PACKAGE_JSON_INVALID');
    if (!SAFE_COMPONENT.test(value.name) || !SAFE_COMPONENT.test(value.version)) fail('PACKAGE_JSON_INVALID');
    return Object.freeze({ name: value.name, version: value.version });
  }

  private async productionNodeComponents(workspaceRoot: string): Promise<CycloneDxComponent[]> {
    const value = parseJson(
      await this.readBounded(path.join(workspaceRoot, 'package-lock.json'), MAXIMUM_PACKAGE_LOCK_BYTES, 'LOCKFILE'),
      'LOCKFILE_INVALID',
    );
    if (!isRecord(value) || !isRecord(value.packages)) fail('LOCKFILE_INVALID');
    const components: CycloneDxComponent[] = [];
    for (const [lockPath, rawEntry] of Object.entries(value.packages)) {
      if (lockPath === '' || !isRecord(rawEntry) || rawEntry.dev === true || typeof rawEntry.version !== 'string')
        continue;
      const name = packageNameFromLockPath(lockPath, rawEntry);
      if (!name || !SAFE_COMPONENT.test(rawEntry.version)) fail('LOCKFILE_INVALID');
      const purl = npmPurl(name, rawEntry.version);
      components.push(Object.freeze({ 'bom-ref': purl, name, purl, type: 'library', version: rawEntry.version }));
    }
    return components;
  }

  private async assembledNodeComponents(
    unpackedRoot: string,
    productionComponents: readonly CycloneDxComponent[],
  ): Promise<ReadonlyMap<string, CycloneDxComponent>> {
    const archivePath = path.join(unpackedRoot, 'resources', 'app.asar');
    const metadata = await lstat(archivePath).catch(() => fail('ASSEMBLY_UNAVAILABLE'));
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > MAXIMUM_FILE_BYTES) {
      fail('ASSEMBLY_INVALID');
    }
    let entries: string[];
    try {
      entries = listPackage(archivePath, { isPack: false });
    } catch {
      fail('ASSEMBLY_INVALID');
    }
    if (entries.length === 0 || entries.length > MAXIMUM_FILES) fail('ASSEMBLY_INVALID');
    const expected = new Set(productionComponents.map((component) => component['bom-ref']));
    const components = new Map<string, CycloneDxComponent>();
    for (const rawPath of entries) {
      const extractEntry = rawPath.replace(/^[\\/]+/u, '');
      const archiveEntry = extractEntry.replace(/\\/gu, '/');
      if (!isPackagedPackageJsonPath(archiveEntry)) continue;
      let bytes: Buffer;
      try {
        bytes = Buffer.from(extractFile(archivePath, extractEntry));
      } catch {
        fail('ASSEMBLY_INVALID');
      }
      if (bytes.byteLength < 1 || bytes.byteLength > MAXIMUM_PACKAGED_PACKAGE_JSON_BYTES) fail('ASSEMBLY_INVALID');
      const value = parseJson(bytes, 'ASSEMBLY_INVALID');
      if (
        !isRecord(value) ||
        typeof value.name !== 'string' ||
        !SAFE_COMPONENT.test(value.name) ||
        typeof value.version !== 'string' ||
        !SAFE_COMPONENT.test(value.version)
      ) {
        fail('ASSEMBLY_INVALID');
      }
      const purl = npmPurl(value.name, value.version);
      if (!expected.has(purl)) fail('ASSEMBLY_COMPONENT_MISMATCH');
      components.set(
        purl,
        Object.freeze({ 'bom-ref': purl, name: value.name, purl, type: 'library', version: value.version }),
      );
      if (components.size > MAXIMUM_COMPONENTS) fail('COMPONENT_LIMIT');
    }
    return components;
  }

  private async nativeSourceComponents(workspaceRoot: string): Promise<CycloneDxComponent[]> {
    const root = path.join(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks');
    const components: CycloneDxComponent[] = [];
    for (const expected of EXPECTED_NATIVE_LOCKS) {
      const value = parseJson(
        await this.readBounded(path.join(root, `${expected.lockId}.json`), MAXIMUM_SOURCE_LOCK_BYTES, 'SOURCE_LOCK'),
        'SOURCE_LOCK_INVALID',
      );
      if (
        !isRecord(value) ||
        value.lockId !== expected.lockId ||
        value.repository !== expected.repository ||
        value.commit !== expected.revision
      ) {
        fail('SOURCE_LOCK_INVALID');
      }
      const purl = `pkg:github/${expected.repository
        .split('/')
        .slice(-2)
        .join('/')
        .replace(/\.git$/u, '')}@${expected.revision}`;
      components.push(
        Object.freeze({
          'bom-ref': purl,
          name: expected.name,
          properties: Object.freeze([Object.freeze({ name: 'gpt-voice:lock-id', value: expected.lockId })]),
          purl,
          type: 'library',
          version: expected.revision,
        }),
      );
    }
    return components;
  }

  private binaryComponents(
    manifest: readonly FileManifestEntry[],
    platform: ApplicationSecurityPlatform,
  ): CycloneDxComponent[] {
    return manifest
      .filter(
        (entry) =>
          !entry.path.startsWith('resources/local-whisper/native/') &&
          isBinaryName(path.posix.basename(entry.path), platform),
      )
      .map((entry) => {
        const name = path.posix.basename(entry.path);
        return Object.freeze({
          'bom-ref': `urn:sha256:${entry.sha256}`,
          hashes: Object.freeze([Object.freeze({ alg: 'SHA-256', content: entry.sha256 })]),
          name,
          properties: Object.freeze([
            Object.freeze({ name: 'gpt-voice:component-kind', value: 'redistributed-os-library' }),
          ]),
          type: 'file',
          version: entry.sha256.slice(0, 16),
        });
      });
  }

  private async packageVersion(workspaceRoot: string, name: string): Promise<string> {
    const packagePath = path.join(workspaceRoot, 'node_modules', ...name.split('/'), 'package.json');
    const value = parseJson(
      await this.readBounded(packagePath, undefined, 'RUNTIME_COMPONENT'),
      'RUNTIME_COMPONENT_MISSING',
    );
    if (
      !isRecord(value) ||
      value.name !== name ||
      typeof value.version !== 'string' ||
      !SAFE_COMPONENT.test(value.version)
    ) {
      fail('RUNTIME_COMPONENT_MISSING');
    }
    return value.version;
  }

  private async readHelperManifest(
    unpackedRoot: string,
    platform: ApplicationSecurityPlatform,
    manifest: readonly FileManifestEntry[],
  ): Promise<readonly { readonly name: string; readonly sha256: string }[]> {
    const manifestPath = path.join(unpackedRoot, 'resources', 'local-whisper', 'native', 'helpers.manifest.json');
    const value = parseJson(
      await this.readBounded(manifestPath, undefined, 'HELPER_MANIFEST'),
      'HELPER_MANIFEST_INVALID',
    );
    if (
      !isRecord(value) ||
      value.platform !== platform ||
      !Array.isArray(value.helpers) ||
      value.helpers.length !== 2
    ) {
      fail('HELPER_MANIFEST_INVALID');
    }
    const files = new Map(manifest.map((entry) => [entry.path, entry]));
    const names = new Set<string>();
    return Object.freeze(
      value.helpers.map((entry) => {
        if (!isRecord(entry) || typeof entry.name !== 'string' || !SAFE_COMPONENT.test(entry.name)) {
          fail('HELPER_MANIFEST_INVALID');
        }
        if (names.has(entry.name)) fail('HELPER_MANIFEST_INVALID');
        names.add(entry.name);
        const sha256 = safeSha256(entry.sha256, 'HELPER_MANIFEST_INVALID');
        const packaged = files.get(`resources/local-whisper/native/${entry.name}`);
        if (!packaged || packaged.sha256 !== sha256) fail('HELPER_MANIFEST_DIGEST_MISMATCH');
        return Object.freeze({ name: entry.name, sha256 });
      }),
    );
  }

  private async fileManifest(root: string): Promise<readonly FileManifestEntry[]> {
    const rootMetadata = await lstat(root).catch(() => fail('UNPACKED_ROOT_UNAVAILABLE'));
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) fail('UNPACKED_ROOT_KIND_INVALID');
    const result: FileManifestEntry[] = [];
    const visit = async (directory: string, prefix: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true }).catch(() => fail('UNPACKED_ROOT_READ_INVALID'));
      for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
        if (!SAFE_PATH_COMPONENT.test(entry.name)) fail('UNPACKED_ROOT_NAME_INVALID');
        const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        const candidate = path.join(directory, entry.name);
        const metadata = await lstat(candidate).catch(() => fail('UNPACKED_ROOT_ENTRY_UNAVAILABLE'));
        if (metadata.isSymbolicLink()) fail('UNPACKED_ROOT_LINK_INVALID');
        if (metadata.isDirectory()) {
          await visit(candidate, relative);
          continue;
        }
        if (!metadata.isFile()) fail('UNPACKED_ROOT_ENTRY_KIND_INVALID');
        if (metadata.size < 0 || metadata.size > MAXIMUM_FILE_BYTES) fail('UNPACKED_ROOT_SIZE_INVALID');
        result.push(
          Object.freeze({
            path: relative,
            sha256: await this.sha256File(candidate, metadata.size, 'UNPACKED_ROOT_ENTRY_CONTENT_INVALID'),
            sizeBytes: metadata.size,
          }),
        );
        if (result.length > MAXIMUM_FILES) fail('UNPACKED_ROOT_LIMIT');
      }
    };
    await visit(root, '');
    if (result.length === 0) fail('UNPACKED_ROOT_EMPTY');
    return Object.freeze(result);
  }

  private async sha256File(filePath: string, expectedSize: number, code: string): Promise<string> {
    return await withVerifiedRegularFile(
      {
        filePath,
        invalid: () => fail(code),
        maximumBytes: expectedSize,
        unavailable: () => fail(code),
      },
      async (file, sizeBytes) => {
        const digest = createHash('sha256');
        let byteLength = 0;
        try {
          for await (const chunk of file.createReadStream({ autoClose: false })) {
            const bytes = Buffer.from(chunk);
            byteLength += bytes.byteLength;
            if (byteLength > sizeBytes) fail(code);
            digest.update(bytes);
          }
        } catch {
          fail(code);
        }
        if (byteLength !== sizeBytes) fail(code);
        return digest.digest('hex');
      },
    );
  }

  private async readBounded(
    filePath: string,
    maximumBytes = APPLICATION_SBOM_MAXIMUM_BYTES,
    failureClass = 'INPUT',
  ): Promise<Buffer> {
    return await withVerifiedRegularFile(
      {
        filePath,
        invalid: () => fail(`${failureClass}_INVALID`),
        maximumBytes,
        minimumBytes: 1,
        unavailable: () => fail(`${failureClass}_UNAVAILABLE`),
      },
      async (file, expectedSize) => {
        const bytes = await file.readFile().catch(() => fail(`${failureClass}_UNAVAILABLE`));
        if (bytes.byteLength !== expectedSize) fail(`${failureClass}_INVALID`);
        return bytes;
      },
    );
  }
}

/** Validates scanner/database inputs and creates the privacy-safe artifact-security record. */
export class ArtifactVulnerabilityPolicy {
  public createRecord(input: {
    readonly checksumSha256: string;
    readonly database: unknown;
    readonly databaseSha256: string;
    readonly filesystemReport: unknown;
    readonly filesystemTarget: string;
    readonly now: Date;
    readonly packageFormat: ApplicationPackageFormat;
    readonly packageSha256: string;
    readonly platform: ApplicationSecurityPlatform;
    readonly sbomReport: unknown;
    readonly sbomSha256: string;
    readonly sbomTarget: string;
    readonly sourceCommit: string;
    readonly unpackedRootSha256: string;
  }): ArtifactSecurityRecord {
    const platform = input.platform;
    const format = packageFormat(platform, input.packageFormat);
    const now = input.now;
    if (!Number.isFinite(now.getTime())) fail('CLOCK_INVALID');
    this.verifyDatabase(input.database, input.databaseSha256, now);
    normalizeTrivyReport(input.filesystemReport, input.filesystemTarget, 'filesystem');
    normalizeTrivyReport(input.sbomReport, input.sbomTarget, 'sbom');
    const scannedAt = now.toISOString();
    if (!TIMESTAMP.test(scannedAt)) fail('CLOCK_INVALID');
    const database = input.database as TrivyDatabase;
    const record: ArtifactSecurityRecord = Object.freeze({
      attestation: null,
      checksumSha256: safeSha256(input.checksumSha256, 'CHECKSUM_INVALID'),
      packageFormat: format,
      packageSha256: safeSha256(input.packageSha256, 'PACKAGE_DIGEST_INVALID'),
      platform,
      result: 'clean',
      sbom: Object.freeze({ format: APPLICATION_SBOM_FORMAT, sha256: safeSha256(input.sbomSha256, 'SBOM_INVALID') }),
      scannedAt,
      scanner: Object.freeze({
        database: Object.freeze({
          sha256: safeSha256(input.databaseSha256, 'DATABASE_INVALID'),
          updatedAt: safeTimestamp(database.UpdatedAt, 'DATABASE_INVALID'),
        }),
        name: APPLICATION_SECURITY_SCANNER.name,
        version: APPLICATION_SECURITY_SCANNER.version,
      }),
      schemaVersion: APPLICATION_ARTIFACT_SECURITY_SCHEMA_VERSION,
      sourceCommit: safeSourceCommit(input.sourceCommit, 'SOURCE_COMMIT_INVALID'),
      unpackedRootSha256: safeSha256(input.unpackedRootSha256, 'UNPACKED_ROOT_INVALID'),
    });
    this.verifyRecord(record);
    if (canonicalBytes(record).byteLength > APPLICATION_ARTIFACT_SECURITY_MAXIMUM_BYTES) fail('RECORD_TOO_LARGE');
    return record;
  }

  public verifyRecord(value: unknown): asserts value is ArtifactSecurityRecord {
    const record = isRecord(value) ? value : fail('RECORD_INVALID');
    exactKeys(
      record,
      [
        'attestation',
        'checksumSha256',
        'packageFormat',
        'packageSha256',
        'platform',
        'result',
        'sbom',
        'scannedAt',
        'scanner',
        'schemaVersion',
        'sourceCommit',
        'unpackedRootSha256',
      ],
      'RECORD_INVALID',
    );
    if (
      record.schemaVersion !== APPLICATION_ARTIFACT_SECURITY_SCHEMA_VERSION ||
      record.attestation !== null ||
      record.result !== 'clean' ||
      (record.platform !== 'linux' && record.platform !== 'win32')
    ) {
      fail('RECORD_INVALID');
    }
    const platform = record.platform;
    packageFormat(platform, record.packageFormat);
    safeSha256(record.packageSha256, 'RECORD_INVALID');
    safeSha256(record.unpackedRootSha256, 'RECORD_INVALID');
    safeSha256(record.checksumSha256, 'RECORD_INVALID');
    safeSourceCommit(record.sourceCommit, 'RECORD_INVALID');
    safeTimestamp(record.scannedAt, 'RECORD_INVALID');
    if (!isRecord(record.sbom) || record.sbom.format !== APPLICATION_SBOM_FORMAT) fail('RECORD_INVALID');
    safeSha256(record.sbom.sha256, 'RECORD_INVALID');
    if (
      !isRecord(record.scanner) ||
      record.scanner.name !== APPLICATION_SECURITY_SCANNER.name ||
      record.scanner.version !== APPLICATION_SECURITY_SCANNER.version ||
      !isRecord(record.scanner.database)
    ) {
      fail('RECORD_INVALID');
    }
    safeSha256(record.scanner.database.sha256, 'RECORD_INVALID');
    safeTimestamp(record.scanner.database.updatedAt, 'RECORD_INVALID');
    const canonical = canonicalBytes(record);
    if (canonical.byteLength > APPLICATION_ARTIFACT_SECURITY_MAXIMUM_BYTES) fail('RECORD_TOO_LARGE');
  }

  public verifyBinding(input: {
    readonly checksumSha256: string;
    readonly packageFormat: ApplicationPackageFormat;
    readonly packageSha256: string;
    readonly platform: ApplicationSecurityPlatform;
    readonly record: unknown;
    readonly sbom: unknown;
    readonly sourceCommit: string;
    readonly unpackedRootSha256: string;
  }): void {
    this.verifyRecord(input.record);
    const record = input.record;
    if (
      record.checksumSha256 !== safeSha256(input.checksumSha256, 'BINDING_INVALID') ||
      record.packageSha256 !== safeSha256(input.packageSha256, 'BINDING_INVALID') ||
      record.packageFormat !== packageFormat(input.platform, input.packageFormat) ||
      record.platform !== input.platform ||
      record.sourceCommit !== safeSourceCommit(input.sourceCommit, 'BINDING_INVALID') ||
      record.unpackedRootSha256 !== safeSha256(input.unpackedRootSha256, 'BINDING_INVALID') ||
      record.sbom.sha256 !== sha256(canonicalBytes(input.sbom))
    ) {
      fail('BINDING_INVALID');
    }
  }

  private verifyDatabase(value: unknown, digest: string, now: Date): void {
    const database = isRecord(value) ? (value as TrivyDatabase) : fail('DATABASE_INVALID');
    const version = database.Version;
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) fail('DATABASE_INVALID');
    const downloadedAt = Date.parse(safeTimestamp(database.DownloadedAt, 'DATABASE_INVALID'));
    const updatedAt = Date.parse(safeTimestamp(database.UpdatedAt, 'DATABASE_INVALID'));
    const nextUpdate = Date.parse(safeTimestamp(database.NextUpdate, 'DATABASE_INVALID'));
    if (
      downloadedAt > now.getTime() ||
      updatedAt > now.getTime() ||
      nextUpdate <= now.getTime() ||
      now.getTime() - updatedAt > DATABASE_MAXIMUM_AGE_MILLISECONDS
    ) {
      fail('DATABASE_STALE');
    }
    safeSha256(digest, 'DATABASE_INVALID');
  }
}

export function canonicalArtifactSecurityJson(value: unknown): string {
  return serializeCanonicalLocalWhisperCatalogJson(value);
}

export function applicationSecurityFormats(platform: ApplicationSecurityPlatform): readonly ApplicationPackageFormat[] {
  return PLATFORM_FORMATS[platform];
}
