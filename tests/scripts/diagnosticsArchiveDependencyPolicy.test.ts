import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const WORKSPACE_PATH = path.resolve(__dirname, '../..');
const PACKAGE_JSON_PATH = path.join(WORKSPACE_PATH, 'package.json');
const PACKAGE_LOCK_PATH = path.join(WORKSPACE_PATH, 'package-lock.json');
const ARCHIVE_ADAPTER_PATH = path.join(WORKSPACE_PATH, 'src/main/services/diagnosticsArchiveFormat.ts');
const ARCHIVER_PACKAGE_PATH = 'node_modules/archiver';
const NATIVE_FILE_SUFFIXES = ['.dll', '.dylib', '.exe', '.node', '.so'] as const;
const FORBIDDEN_RUNTIME_DEPENDENCY_PATTERNS = [/^bindings$/u, /^node-gyp/u, /^node-pre-gyp/u, /^prebuild/u];

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
}

interface PackageLockEntry {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly dev?: boolean;
  readonly gypfile?: boolean;
  readonly hasInstallScript?: boolean;
}

interface PackageLock {
  readonly packages?: Readonly<Record<string, PackageLockEntry>>;
}

function readJson<Value>(filePath: string): Value {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Value;
}

function getDependencyClosure(packages: Readonly<Record<string, PackageLockEntry>>): ReadonlySet<string> {
  const closure = new Set<string>();
  const pending = [ARCHIVER_PACKAGE_PATH];

  while (pending.length > 0) {
    const packagePath = pending.pop();
    if (packagePath === undefined || closure.has(packagePath)) continue;
    const entry: PackageLockEntry | undefined = packages[packagePath];
    assert.ok(entry, `Missing lockfile entry: ${packagePath}`);
    closure.add(packagePath);

    for (const dependencyName of Object.keys(entry.dependencies ?? {})) {
      const nestedCandidate: string = `${packagePath}/node_modules/${dependencyName}`;
      const rootCandidate: string = `node_modules/${dependencyName}`;
      const resolvedPackagePath: string | null =
        packages[nestedCandidate] === undefined
          ? packages[rootCandidate] === undefined
            ? null
            : rootCandidate
          : nestedCandidate;
      assert.ok(resolvedPackagePath, `Missing locked dependency: ${dependencyName}`);
      pending.push(resolvedPackagePath);
    }
  }

  return closure;
}

describe('diagnostics archive dependency policy', () => {
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

  it('keeps the production archiver closure free of install scripts and native binaries', () => {
    const packageLock = readJson<PackageLock>(PACKAGE_LOCK_PATH);
    assert.ok(packageLock.packages);
    const dependencyClosure = getDependencyClosure(packageLock.packages);

    for (const packagePath of dependencyClosure) {
      const entry: PackageLockEntry | undefined = packageLock.packages[packagePath];
      assert.ok(entry);
      assert.notEqual(entry.gypfile, true, `${packagePath} must not require node-gyp`);
      assert.notEqual(entry.hasInstallScript, true, `${packagePath} must not run an install script`);

      const packageName = packagePath.slice(packagePath.lastIndexOf('node_modules/') + 'node_modules/'.length);
      assert.equal(
        FORBIDDEN_RUNTIME_DEPENDENCY_PATTERNS.some((pattern) => pattern.test(packageName)),
        false,
        packageName,
      );

      const installedPath = path.join(WORKSPACE_PATH, packagePath);
      assert.equal(fs.existsSync(installedPath), true, `${packagePath} must be installed for the policy gate`);
      const nativeFiles = fs
        .readdirSync(installedPath, { recursive: true, withFileTypes: true })
        .filter(
          (entry) => entry.isFile() && NATIVE_FILE_SUFFIXES.some((suffix) => entry.name.toLowerCase().endsWith(suffix)),
        );
      assert.deepEqual(nativeFiles, [], `${packagePath} must remain JavaScript-only`);
    }
  });
});
