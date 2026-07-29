import path from 'node:path';
import type { LockedPackage } from './lockedProductionClosure';

export const PACKAGE_ARTIFACT_FINDING_KINDS = [
  'executable-script',
  'install-script',
  'native-binary',
  'native-build-metadata',
  'webassembly',
] as const;

export type PackageArtifactFindingKind = (typeof PACKAGE_ARTIFACT_FINDING_KINDS)[number];

export interface PackageArtifactFinding {
  readonly kind: PackageArtifactFindingKind;
  readonly packagePath: string;
  readonly relativePath: string;
}

export interface PackageArtifactInspection {
  readonly findings: readonly PackageArtifactFinding[];
  readonly packagePath: string;
}

export interface ArtifactDirectoryEntry {
  readonly kind: 'directory' | 'file' | 'other' | 'symbolic-link';
  readonly name: string;
}

export interface ArtifactFileStat {
  readonly mode: number;
}

export interface PackageArtifactClassifierDependencies {
  readonly readDirectory: (directoryPath: string) => readonly ArtifactDirectoryEntry[];
  readonly readFilePrefix: (filePath: string, maximumBytes: number) => Uint8Array;
  readonly readPackageManifest: (packageRoot: string) => unknown;
  readonly statFile: (filePath: string) => ArtifactFileStat;
}

const FILE_PREFIX_BYTES = 8;
const EXECUTABLE_MODE_MASK = 0o111;
const INSTALL_SCRIPT_NAMES = ['install', 'postinstall', 'preinstall'] as const;
const NATIVE_METADATA_FILENAMES = new Set(['binding.gyp', 'bindings.gyp']);
const NATIVE_METADATA_DIRECTORIES = new Set(['prebuilds']);
const NATIVE_MANIFEST_FIELDS = new Set(['binary', 'gypfile', 'napi', 'node-pre-gyp', 'prebuild', 'prebuilds']);
const NATIVE_SCRIPT_MARKERS = ['node-gyp', 'node-pre-gyp', 'prebuild-install'] as const;
const SAFE_ARTIFACT_NAME = /^[^/\\\0]+$/u;

const BINARY_MAGICS = [
  [0x4d, 0x5a],
  [0x7f, 0x45, 0x4c, 0x46],
  [0xfe, 0xed, 0xfa, 0xce],
  [0xce, 0xfa, 0xed, 0xfe],
  [0xfe, 0xed, 0xfa, 0xcf],
  [0xcf, 0xfa, 0xed, 0xfe],
  [0xca, 0xfe, 0xba, 0xbe],
  [0xbe, 0xba, 0xfe, 0xca],
  [0xca, 0xfe, 0xba, 0xbf],
  [0xbf, 0xba, 0xfe, 0xca],
] as const;
const WEBASSEMBLY_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const;
const SHEBANG_MAGIC = [0x23, 0x21] as const;

function failInspection(packagePath: string): never {
  throw new Error(`Package artifact inspection failed: ${packagePath}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.byteLength >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}

export function classifyPackageArtifact(
  bytes: Uint8Array,
  mode: number,
): Extract<PackageArtifactFindingKind, 'executable-script' | 'native-binary' | 'webassembly'> | null {
  if (hasPrefix(bytes, WEBASSEMBLY_MAGIC)) return 'webassembly';
  if (BINARY_MAGICS.some((magic) => hasPrefix(bytes, magic))) return 'native-binary';
  if ((mode & EXECUTABLE_MODE_MASK) !== 0 && hasPrefix(bytes, SHEBANG_MAGIC)) return 'executable-script';
  return null;
}

function toPortableRelativePath(value: string): string {
  return value.split(path.sep).join('/');
}

function createFinding(
  packagePath: string,
  relativePath: string,
  kind: PackageArtifactFindingKind,
): PackageArtifactFinding {
  return Object.freeze({ kind, packagePath, relativePath });
}

/** Inspects one installed package through injected filesystem and manifest readers. */
export class PackageArtifactClassifier {
  public constructor(private readonly dependencies: PackageArtifactClassifierDependencies) {}

  public inspectPackage(lockedPackage: LockedPackage, packageRoot: string): PackageArtifactInspection {
    const findings: PackageArtifactFinding[] = [];
    if (lockedPackage.hasInstallScript) {
      findings.push(createFinding(lockedPackage.path, 'package-lock.json#hasInstallScript', 'install-script'));
    }
    if (lockedPackage.gypfile) {
      findings.push(createFinding(lockedPackage.path, 'package-lock.json#gypfile', 'native-build-metadata'));
    }

    try {
      this.inspectManifest(lockedPackage.path, packageRoot, findings);
      this.inspectDirectory(lockedPackage.path, packageRoot, packageRoot, findings);
    } catch {
      return failInspection(lockedPackage.path);
    }
    return Object.freeze({
      findings: Object.freeze(
        [...findings].sort(
          (left, right) =>
            left.relativePath.localeCompare(right.relativePath, 'en') || left.kind.localeCompare(right.kind, 'en'),
        ),
      ),
      packagePath: lockedPackage.path,
    });
  }

  private inspectManifest(packagePath: string, packageRoot: string, findings: PackageArtifactFinding[]): void {
    const manifest = this.dependencies.readPackageManifest(packageRoot);
    if (!isRecord(manifest)) failInspection(packagePath);

    const scripts = manifest.scripts;
    if (scripts !== undefined && !isRecord(scripts)) failInspection(packagePath);
    if (isRecord(scripts)) {
      for (const scriptName of INSTALL_SCRIPT_NAMES) {
        const script = scripts[scriptName];
        if (script === undefined) continue;
        if (typeof script !== 'string') failInspection(packagePath);
        findings.push(createFinding(packagePath, `package.json#scripts.${scriptName}`, 'install-script'));
      }
      for (const [scriptName, script] of Object.entries(scripts)) {
        if (typeof script !== 'string') failInspection(packagePath);
        if (NATIVE_SCRIPT_MARKERS.some((marker) => script.includes(marker))) {
          findings.push(createFinding(packagePath, `package.json#scripts.${scriptName}`, 'native-build-metadata'));
        }
      }
    }

    for (const field of NATIVE_MANIFEST_FIELDS) {
      if (manifest[field] !== undefined && manifest[field] !== false) {
        findings.push(createFinding(packagePath, `package.json#${field}`, 'native-build-metadata'));
      }
    }
  }

  private inspectDirectory(
    packagePath: string,
    packageRoot: string,
    directoryPath: string,
    findings: PackageArtifactFinding[],
  ): void {
    const entries = [...this.dependencies.readDirectory(directoryPath)].sort((left, right) =>
      left.name.localeCompare(right.name, 'en'),
    );
    for (const entry of entries) {
      if (!SAFE_ARTIFACT_NAME.test(entry.name) || entry.name === '.' || entry.name === '..') {
        failInspection(packagePath);
      }
      const artifactPath = path.join(directoryPath, entry.name);
      const relativePath = toPortableRelativePath(path.relative(packageRoot, artifactPath));
      if (entry.kind === 'symbolic-link' || entry.kind === 'other') failInspection(packagePath);
      if (entry.kind === 'directory') {
        if (NATIVE_METADATA_DIRECTORIES.has(entry.name)) {
          findings.push(createFinding(packagePath, relativePath, 'native-build-metadata'));
        }
        this.inspectDirectory(packagePath, packageRoot, artifactPath, findings);
        continue;
      }
      if (NATIVE_METADATA_FILENAMES.has(entry.name) || entry.name.endsWith('.gyp')) {
        findings.push(createFinding(packagePath, relativePath, 'native-build-metadata'));
      }
      const stat = this.dependencies.statFile(artifactPath);
      if (!Number.isSafeInteger(stat.mode) || stat.mode < 0) failInspection(packagePath);
      const prefix = this.dependencies.readFilePrefix(artifactPath, FILE_PREFIX_BYTES);
      const kind = classifyPackageArtifact(prefix, stat.mode);
      if (kind) findings.push(createFinding(packagePath, relativePath, kind));
    }
  }
}
