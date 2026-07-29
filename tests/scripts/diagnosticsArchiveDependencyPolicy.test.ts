import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  ELECTRON_NODE_ARCHIVER_BARE_ONLY_PACKAGES,
  ElectronNodeArchiveRuntimePolicy,
} from '../../scripts/dependency-policy/electronNodeArchiveRuntimePolicy';
import {
  LockedProductionClosurePolicy,
  SUPPORTED_DEPENDENCY_TARGETS,
  type SupportedDependencyTarget,
} from '../../scripts/dependency-policy/lockedProductionClosure';
import {
  PackageArtifactClassifier,
  type ArtifactDirectoryEntry,
} from '../../scripts/dependency-policy/packageArtifactClassifier';

const WORKSPACE_PATH = path.resolve(__dirname, '../..');
const PACKAGE_JSON_PATH = path.join(WORKSPACE_PATH, 'package.json');
const PACKAGE_LOCK_PATH = path.join(WORKSPACE_PATH, 'package-lock.json');
const ARCHIVE_ADAPTER_PATH = path.join(WORKSPACE_PATH, 'src/main/services/diagnosticsArchiveFormat.ts');
const PACKAGED_RUNTIME_POLICY_PATH = path.join(WORKSPACE_PATH, 'scripts/packaged-runtime-policy.mjs');
const TAR_STREAM_PACKAGE_PATH = 'node_modules/tar-stream';
const FORBIDDEN_RUNTIME_DEPENDENCY_PATTERNS = [/^bindings$/u, /^node-gyp/u, /^node-pre-gyp/u, /^prebuild/u];
const PROHIBITED_ARCHIVER_FINDINGS = new Set([
  'install-script',
  'native-binary',
  'native-build-metadata',
  'webassembly',
]);
const FILE_PREFIX_BYTES = 8;
const FORBIDDEN_ANALYSIS_DEPENDENCIES = [
  'adm-zip',
  'extract-zip',
  'jszip',
  'node-stream-zip',
  'python-shell',
  'tar-stream',
  'unzipper',
  'yauzl',
] as const;

interface PackageJson {
  readonly build?: unknown;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
}

interface PackagedRuntimePolicyModule {
  readonly APPROVED_RUNTIME_MODULES: readonly string[];
}

function readJson<Value>(filePath: string): Value {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Value;
}

function isPackagedRuntimePolicyModule(value: unknown): value is PackagedRuntimePolicyModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).APPROVED_RUNTIME_MODULES)
  );
}

function getHostTarget(): SupportedDependencyTarget | null {
  return (
    SUPPORTED_DEPENDENCY_TARGETS.find((target) => target.os === process.platform && target.cpu === process.arch) ?? null
  );
}

describe('diagnostics archive dependency policy', () => {
  it('keeps diagnostics analysis outside package scripts and dependencies', () => {
    const packageJson = readJson<PackageJson>(PACKAGE_JSON_PATH);
    const directDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const dependencyName of FORBIDDEN_ANALYSIS_DEPENDENCIES) {
      assert.equal(directDependencies[dependencyName], undefined, dependencyName);
    }

    const scriptCommands = Object.values(packageJson.scripts ?? {}).join('\n');
    for (const forbiddenInvocation of [
      'analyze-diagnostics-archive',
      'inspect_diagnostics_archive',
      'python3',
      '.py',
    ]) {
      assert.equal(scriptCommands.includes(forbiddenInvocation), false, forbiddenInvocation);
    }

    const runtimeSources = fs
      .readdirSync(path.join(WORKSPACE_PATH, 'src'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name))
      .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8'))
      .join('\n');
    assert.equal(runtimeSources.includes('inspect_diagnostics_archive'), false);
    assert.equal(runtimeSources.includes('analyze-diagnostics-archive'), false);
    assert.equal(runtimeSources.includes('crc32.njs'), false);
  });

  it('keeps archiver direct and narrowly imported by the main archive adapter', () => {
    const packageJson = readJson<PackageJson>(PACKAGE_JSON_PATH);
    assert.equal(packageJson.dependencies?.archiver, '^8.0.0');

    const sourceFiles = fs
      .readdirSync(path.join(WORKSPACE_PATH, 'src'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name));
    const archiverImports = sourceFiles.filter((filePath) =>
      /from ['"]archiver['"]/u.test(fs.readFileSync(filePath, 'utf8')),
    );

    assert.deepEqual(archiverImports, [ARCHIVE_ADAPTER_PATH]);
    const adapterSource = fs.readFileSync(ARCHIVE_ADAPTER_PATH, 'utf8');
    for (const forbiddenModule of [
      'node:child_process',
      'node:http',
      'node:https',
      'node:net',
      'node:tls',
      '@main/providers',
      '@main/translateProviders',
    ]) {
      assert.equal(adapterSource.includes(forbiddenModule), false, forbiddenModule);
    }
  });

  it('keeps complete Archiver evidence while packaging only the Electron/Node runtime graph', async () => {
    const closurePolicy = new LockedProductionClosurePolicy({
      readLockfile: () => readJson<unknown>(PACKAGE_LOCK_PATH),
    });
    const importedPolicy: unknown = await import(pathToFileURL(PACKAGED_RUNTIME_POLICY_PATH).href);
    assert.ok(isPackagedRuntimePolicyModule(importedPolicy));
    const runtimePolicy = new ElectronNodeArchiveRuntimePolicy({
      closurePolicy,
      readApprovedRuntimeModules: () => importedPolicy.APPROVED_RUNTIME_MODULES,
      readPackageManifest: (packagePath) => {
        assert.equal(packagePath, TAR_STREAM_PACKAGE_PATH);
        return readJson<unknown>(path.join(WORKSPACE_PATH, packagePath, 'package.json'));
      },
      readRootPackageManifest: () => readJson<unknown>(PACKAGE_JSON_PATH),
    });

    for (const target of SUPPORTED_DEPENDENCY_TARGETS) {
      const productionClosure = closurePolicy.resolveProductionClosure(target);
      const runtime = runtimePolicy.verify(target);
      assert.ok(productionClosure.packages.length > runtime.completeClosure.packages.length);
      assert.equal(
        productionClosure.packages.some((lockedPackage) => lockedPackage.name === 'tar'),
        true,
      );
      assert.equal(
        runtime.completeClosure.packages.some((lockedPackage) => lockedPackage.name === 'tar'),
        false,
      );
      assert.deepEqual(
        runtime.bareOnlyPackages.map((lockedPackage) => lockedPackage.name),
        ELECTRON_NODE_ARCHIVER_BARE_ONLY_PACKAGES.map((lockedPackage) => lockedPackage.name),
      );
      assert.equal(
        runtime.nodeRuntimePackages.some((lockedPackage) => lockedPackage.name === 'bare-events'),
        true,
      );
    }

    const hostTarget = getHostTarget();
    if (!hostTarget) return;

    const artifactClassifier = new PackageArtifactClassifier({
      readDirectory: (directoryPath) =>
        fs.readdirSync(directoryPath, { withFileTypes: true }).map((entry): ArtifactDirectoryEntry => ({
          kind: entry.isDirectory()
            ? 'directory'
            : entry.isFile()
              ? 'file'
              : entry.isSymbolicLink()
                ? 'symbolic-link'
                : 'other',
          name: entry.name,
        })),
      readFilePrefix: (filePath, maximumBytes) => {
        const descriptor = fs.openSync(filePath, 'r');
        try {
          const buffer = Buffer.alloc(Math.min(maximumBytes, FILE_PREFIX_BYTES));
          const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.byteLength, 0);
          return buffer.subarray(0, bytesRead);
        } finally {
          fs.closeSync(descriptor);
        }
      },
      readPackageManifest: (packageRoot) => readJson<unknown>(path.join(packageRoot, 'package.json')),
      statFile: (filePath) => ({ mode: fs.statSync(filePath).mode }),
    });
    const runtime = runtimePolicy.verify(hostTarget);
    const bareFs = runtime.bareOnlyPackages.find((lockedPackage) => lockedPackage.name === 'bare-fs');
    assert.ok(bareFs);
    const bareFsInspection = artifactClassifier.inspectPackage(bareFs, path.join(WORKSPACE_PATH, bareFs.path));
    assert.equal(
      bareFsInspection.findings.some((finding) => finding.kind === 'native-build-metadata'),
      true,
    );
    assert.equal(
      bareFsInspection.findings.some((finding) => finding.kind === 'native-binary'),
      true,
    );

    for (const lockedPackage of runtime.nodeRuntimePackages) {
      assert.equal(
        FORBIDDEN_RUNTIME_DEPENDENCY_PATTERNS.some((pattern) => pattern.test(lockedPackage.name)),
        false,
        lockedPackage.name,
      );
      const installedPath = path.join(WORKSPACE_PATH, lockedPackage.path);
      assert.equal(fs.existsSync(installedPath), true, `${lockedPackage.path} must be installed for the host gate`);
      const inspection = artifactClassifier.inspectPackage(lockedPackage, installedPath);
      assert.deepEqual(
        inspection.findings.filter((finding) => PROHIBITED_ARCHIVER_FINDINGS.has(finding.kind)),
        [],
        `${lockedPackage.path} must remain JavaScript-only in Electron/Node packages`,
      );
    }
  });
});
