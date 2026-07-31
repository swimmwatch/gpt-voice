/* eslint-disable max-classes-per-file -- Independent state-owning policy fixtures keep injected test state isolated. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  LockedProductionClosurePolicy,
  SUPPORTED_DEPENDENCY_TARGETS,
  type LockedPackage,
} from '../../scripts/dependency-policy/lockedProductionClosure';
import {
  ELECTRON_NODE_ARCHIVER_BARE_ONLY_PACKAGES,
  ElectronNodeArchiveRuntimePolicy,
} from '../../scripts/dependency-policy/electronNodeArchiveRuntimePolicy';
import {
  PackageArtifactClassifier,
  classifyPackageArtifact,
  type ArtifactDirectoryEntry,
} from '../../scripts/dependency-policy/packageArtifactClassifier';
import {
  NO_PRODUCTION_ADVISORY_EXCEPTIONS,
  PRODUCTION_ADVISORY_EXCEPTIONS_HEADING,
  ProductionAdvisoryPolicy,
} from '../../scripts/dependency-policy/productionAdvisoryPolicy';

interface FixtureLockEntry {
  cpu?: string[];
  dependencies?: Record<string, string>;
  gypfile?: boolean;
  hasInstallScript?: boolean;
  link?: boolean;
  name?: string;
  optional?: boolean;
  optionalDependencies?: Record<string, string>;
  os?: string[];
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  version: string;
}

interface FixtureLockfile {
  lockfileVersion: number;
  packages: Record<string, FixtureLockEntry>;
}

const FIXTURE_PACKAGE: LockedPackage = {
  gypfile: false,
  hasInstallScript: false,
  name: 'fixture-package',
  optional: false,
  path: 'node_modules/fixture-package',
  version: '1.0.0',
};
const CLOAKBROWSER_VERSION = '0.5.3';
const TAR_VERSION = '7.5.22';
const NATIVE_MAGIC_FIXTURES = {
  'elf-without-suffix': [0x7f, 0x45, 0x4c, 0x46],
  'fat-32-be': [0xca, 0xfe, 0xba, 0xbe],
  'fat-32-le': [0xbe, 0xba, 0xfe, 0xca],
  'fat-64-be': [0xca, 0xfe, 0xba, 0xbf],
  'fat-64-le': [0xbf, 0xba, 0xfe, 0xca],
  'mach-32-be': [0xfe, 0xed, 0xfa, 0xce],
  'mach-32-le': [0xce, 0xfa, 0xed, 0xfe],
  'mach-64-be': [0xfe, 0xed, 0xfa, 0xcf],
  'mach-64-le': [0xcf, 0xfa, 0xed, 0xfe],
  'pe-without-exe': [0x4d, 0x5a],
} as const;

class DependencyPolicyFixture {
  public readonly lockfile = this.createLockfile();
  public readonly policy = new LockedProductionClosurePolicy({
    readLockfile: () => this.lockfile,
  });

  public cloneLockfile(): FixtureLockfile {
    return structuredClone(this.lockfile);
  }

  private createLockfile(): FixtureLockfile {
    return {
      lockfileVersion: 3,
      packages: {
        '': {
          dependencies: {
            archiver: '1.0.0',
            cloakbrowser: CLOAKBROWSER_VERSION,
            'cycle-a': '1.0.0',
            'parent-a': '1.0.0',
            'parent-b': '1.0.0',
          },
          name: 'fixture-root',
          version: '1.0.0',
        },
        'node_modules/archiver': {
          dependencies: {
            hoisted: '1.0.0',
            nested: '1.0.0',
          },
          optionalDependencies: {
            'absent-optional': '1.0.0',
            'arm-helper': '1.0.0',
            'linux-helper': '1.0.0',
            'not-windows-helper': '1.0.0',
            'windows-helper': '1.0.0',
            'x64-helper': '1.0.0',
          },
          peerDependencies: {
            'optional-peer': '1.0.0',
            'required-peer': '1.0.0',
          },
          peerDependenciesMeta: {
            'optional-peer': { optional: true },
          },
          version: '1.0.0',
        },
        'node_modules/archiver/node_modules/nested': {
          dependencies: { hoisted: '1.0.0' },
          version: '2.0.0',
        },
        'node_modules/arm-helper': { cpu: ['arm64'], optional: true, version: '1.0.0' },
        'node_modules/cloakbrowser': {
          dependencies: { tar: '^7.0.0' },
          version: CLOAKBROWSER_VERSION,
        },
        'node_modules/cycle-a': { dependencies: { 'cycle-b': '1.0.0' }, version: '1.0.0' },
        'node_modules/cycle-b': { dependencies: { 'cycle-a': '1.0.0' }, version: '1.0.0' },
        'node_modules/hoisted': { version: '1.0.0' },
        'node_modules/linux-helper': { optional: true, os: ['linux'], version: '1.0.0' },
        'node_modules/nested': { version: '1.0.0' },
        'node_modules/not-windows-helper': { optional: true, os: ['!win32'], version: '1.0.0' },
        'node_modules/parent-a': { dependencies: { hoisted: '1.0.0' }, version: '1.0.0' },
        'node_modules/parent-b': { dependencies: { hoisted: '1.0.0' }, version: '1.0.0' },
        'node_modules/required-peer': { version: '1.0.0' },
        'node_modules/tar': {
          version: TAR_VERSION,
        },
        'node_modules/windows-helper': { optional: true, os: ['win32'], version: '1.0.0' },
        'node_modules/x64-helper': { cpu: ['x64'], optional: true, version: '1.0.0' },
      },
    };
  }
}

class ElectronNodeArchiveRuntimeFixture {
  public readonly approvedRuntimeModules = ['archiver', 'bare-events', 'tar-stream'];
  public readonly buildFiles = [
    ...this.approvedRuntimeModules.map((name) => `node_modules/${name}/**/*`),
    ...ELECTRON_NODE_ARCHIVER_BARE_ONLY_PACKAGES.map(({ name }) => `!node_modules/${name}{,/**/*}`),
  ];
  public readonly lockfile: FixtureLockfile = {
    lockfileVersion: 3,
    packages: {
      '': {
        dependencies: { archiver: '8.0.0' },
        name: 'fixture-root',
        version: '1.0.0',
      },
      'node_modules/archiver': {
        dependencies: { 'bare-events': '2.9.1', 'tar-stream': '3.2.0' },
        version: '8.0.0',
      },
      'node_modules/bare-events': { version: '2.9.1' },
      'node_modules/bare-fs': {
        dependencies: {
          'bare-events': '2.9.1',
          'bare-path': '3.1.1',
          'bare-stream': '2.13.3',
          'bare-url': '2.4.6',
        },
        version: '4.7.4',
      },
      'node_modules/bare-path': { version: '3.1.1' },
      'node_modules/bare-stream': {
        dependencies: { 'bare-events': '2.9.1', teex: '1.0.1' },
        version: '2.13.3',
      },
      'node_modules/bare-url': { version: '2.4.6' },
      'node_modules/tar-stream': {
        dependencies: { 'bare-fs': '^4.5.5' },
        version: '3.2.0',
      },
      'node_modules/teex': { version: '1.0.1' },
    },
  };
  public tarStreamManifest: Record<string, unknown> = {
    dependencies: { 'bare-fs': '^4.5.5' },
    imports: { fs: { bare: 'bare-fs', default: 'fs' } },
    name: 'tar-stream',
    version: '3.2.0',
  };

  public createPolicy(): ElectronNodeArchiveRuntimePolicy {
    return new ElectronNodeArchiveRuntimePolicy({
      closurePolicy: new LockedProductionClosurePolicy({ readLockfile: () => this.lockfile }),
      readApprovedRuntimeModules: () => this.approvedRuntimeModules,
      readPackageManifest: () => this.tarStreamManifest,
      readRootPackageManifest: () => ({ build: { files: this.buildFiles } }),
    });
  }
}

class PackageArtifactFixture {
  public readonly directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-dependency-policy-'));
  public readonly classifier = new PackageArtifactClassifier({
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
    readFilePrefix: (filePath, maximumBytes) => fs.readFileSync(filePath).subarray(0, maximumBytes),
    readPackageManifest: (packageRoot) =>
      JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as unknown,
    statFile: (filePath) => ({ mode: fs.statSync(filePath).mode }),
  });

  public constructor() {
    fs.writeFileSync(path.join(this.directory, 'package.json'), '{"name":"fixture-package","version":"1.0.0"}');
  }

  public dispose(): void {
    fs.rmSync(this.directory, { force: true, recursive: true });
  }

  public write(relativePath: string, bytes: readonly number[] | string, mode = 0o644): void {
    const filePath = path.join(this.directory, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, typeof bytes === 'string' ? bytes : Uint8Array.from(bytes), { mode });
    fs.chmodSync(filePath, mode);
  }
}

const artifactFixtures: PackageArtifactFixture[] = [];

afterEach(() => {
  for (const fixture of artifactFixtures) fixture.dispose();
  artifactFixtures.length = 0;
});

function createArtifactFixture(): PackageArtifactFixture {
  const fixture = new PackageArtifactFixture();
  artifactFixtures.push(fixture);
  return fixture;
}

function createSecurityPolicy(): string {
  return [
    '# Security Policy',
    '',
    PRODUCTION_ADVISORY_EXCEPTIONS_HEADING,
    '',
    NO_PRODUCTION_ADVISORY_EXCEPTIONS,
    '',
  ].join('\n');
}

function createAuditReport(): Record<string, unknown> {
  return {
    auditReportVersion: 2,
    vulnerabilities: {},
  };
}

describe('locked production closure policy', () => {
  it('resolves nested, hoisted, repeated, cyclic, optional, peer, OS, and CPU edges deterministically', () => {
    const fixture = new DependencyPolicyFixture();
    const linux = fixture.policy.resolvePackageClosure('archiver', SUPPORTED_DEPENDENCY_TARGETS[0]);
    const windows = fixture.policy.resolvePackageClosure('archiver', SUPPORTED_DEPENDENCY_TARGETS[1]);
    const linuxPaths = linux.packages.map((lockedPackage) => lockedPackage.path);
    const windowsPaths = windows.packages.map((lockedPackage) => lockedPackage.path);

    assert.equal(linuxPaths.includes('node_modules/archiver/node_modules/nested'), true);
    assert.equal(linuxPaths.includes('node_modules/nested'), false);
    assert.equal(linuxPaths.filter((packagePath) => packagePath === 'node_modules/hoisted').length, 1);
    assert.equal(linuxPaths.includes('node_modules/linux-helper'), true);
    assert.equal(linuxPaths.includes('node_modules/not-windows-helper'), true);
    assert.equal(linuxPaths.includes('node_modules/windows-helper'), false);
    assert.equal(windowsPaths.includes('node_modules/linux-helper'), false);
    assert.equal(windowsPaths.includes('node_modules/not-windows-helper'), false);
    assert.equal(windowsPaths.includes('node_modules/windows-helper'), true);
    assert.equal(linuxPaths.includes('node_modules/x64-helper'), true);
    assert.equal(windowsPaths.includes('node_modules/x64-helper'), true);
    assert.equal(linuxPaths.includes('node_modules/arm-helper'), false);
    assert.equal(linuxPaths.includes('node_modules/required-peer'), true);
    assert.equal(linuxPaths.includes('node_modules/optional-peer'), false);
    assert.equal(linuxPaths.includes('node_modules/absent-optional'), false);
    assert.deepEqual(
      linuxPaths,
      [...linuxPaths].sort((left, right) => left.localeCompare(right, 'en')),
    );

    const production = fixture.policy.resolveProductionClosure(SUPPORTED_DEPENDENCY_TARGETS[0]);
    assert.equal(
      production.packages.some((lockedPackage) => lockedPackage.name === 'tar'),
      true,
    );
    assert.equal(
      linux.packages.some((lockedPackage) => lockedPackage.name === 'tar'),
      false,
    );
    assert.equal(production.packages.filter((lockedPackage) => lockedPackage.name === 'cycle-a').length, 1);
    assert.equal(production.packages.filter((lockedPackage) => lockedPackage.name === 'cycle-b').length, 1);
  });

  it('fails closed for unresolved required, required peer, target-inapplicable, link, identity, and schema errors', () => {
    const fixture = new DependencyPolicyFixture();
    const cases: FixtureLockfile[] = [];

    const unresolved = fixture.cloneLockfile();
    unresolved.packages['node_modules/archiver'].dependencies = { missing: '1.0.0' };
    cases.push(unresolved);

    const missingPeer = fixture.cloneLockfile();
    delete missingPeer.packages['node_modules/required-peer'];
    cases.push(missingPeer);

    const targetInapplicable = fixture.cloneLockfile();
    targetInapplicable.packages[''].dependencies = { 'linux-helper': '1.0.0' };
    cases.push(targetInapplicable);

    const linked = fixture.cloneLockfile();
    linked.packages['node_modules/archiver'].link = true;
    cases.push(linked);

    const inconsistent = fixture.cloneLockfile();
    inconsistent.packages['node_modules/archiver'].name = 'different-package';
    cases.push(inconsistent);

    const malformed = fixture.cloneLockfile();
    malformed.lockfileVersion = 2;
    cases.push(malformed);

    for (const lockfile of cases) {
      const policy = new LockedProductionClosurePolicy({ readLockfile: () => lockfile });
      assert.throws(
        () => policy.resolveProductionClosure(SUPPORTED_DEPENDENCY_TARGETS[1]),
        /Dependency policy violation/u,
      );
    }
  });
});

describe('Electron/Node archive runtime policy', () => {
  it('retains complete Bare evidence while deriving the exact shared Node runtime on both targets', () => {
    const fixture = new ElectronNodeArchiveRuntimeFixture();
    for (const target of SUPPORTED_DEPENDENCY_TARGETS) {
      const result = fixture.createPolicy().verify(target);
      assert.deepEqual(
        result.bareOnlyPackages.map((lockedPackage) => lockedPackage.name),
        ELECTRON_NODE_ARCHIVER_BARE_ONLY_PACKAGES.map((lockedPackage) => lockedPackage.name),
      );
      assert.equal(
        result.completeClosure.packages.some((lockedPackage) => lockedPackage.name === 'bare-fs'),
        true,
      );
      assert.equal(
        result.nodeRuntimePackages.some((lockedPackage) => lockedPackage.name === 'bare-fs'),
        false,
      );
      assert.equal(
        result.nodeRuntimePackages.some((lockedPackage) => lockedPackage.name === 'bare-events'),
        true,
      );
    }
  });

  it('fails changed runtime conditions, versions, branch membership, and packaging configuration', () => {
    const cases: Array<{
      readonly fixture: ElectronNodeArchiveRuntimeFixture;
      readonly targetIndex: 0 | 1;
    }> = [];

    const changedDefault = new ElectronNodeArchiveRuntimeFixture();
    changedDefault.tarStreamManifest = {
      ...changedDefault.tarStreamManifest,
      imports: { fs: { bare: 'bare-fs', default: 'bare-fs' } },
    };
    cases.push({ fixture: changedDefault, targetIndex: 0 });

    const missingConditions = new ElectronNodeArchiveRuntimeFixture();
    delete missingConditions.tarStreamManifest.imports;
    cases.push({ fixture: missingConditions, targetIndex: 0 });

    const ambiguousConditions = new ElectronNodeArchiveRuntimeFixture();
    ambiguousConditions.tarStreamManifest = {
      ...ambiguousConditions.tarStreamManifest,
      imports: { fs: { bare: 'bare-fs', browser: 'bare-fs', default: 'fs' } },
    };
    cases.push({ fixture: ambiguousConditions, targetIndex: 0 });

    const changedVersion = new ElectronNodeArchiveRuntimeFixture();
    changedVersion.lockfile.packages['node_modules/bare-fs'].version = '4.7.5';
    cases.push({ fixture: changedVersion, targetIndex: 0 });

    const changedBranch = new ElectronNodeArchiveRuntimeFixture();
    changedBranch.lockfile.packages['node_modules/bare-fs'].dependencies = {
      ...changedBranch.lockfile.packages['node_modules/bare-fs'].dependencies,
      extra: '1.0.0',
    };
    changedBranch.lockfile.packages['node_modules/extra'] = { version: '1.0.0' };
    cases.push({ fixture: changedBranch, targetIndex: 0 });

    const changedTargetParity = new ElectronNodeArchiveRuntimeFixture();
    changedTargetParity.lockfile.packages['node_modules/bare-url'].os = ['linux'];
    cases.push({ fixture: changedTargetParity, targetIndex: 1 });

    const includedBuildPattern = new ElectronNodeArchiveRuntimeFixture();
    includedBuildPattern.buildFiles.push('node_modules/bare-fs/**/*');
    cases.push({ fixture: includedBuildPattern, targetIndex: 0 });

    const missingBareOnlyExclusion = new ElectronNodeArchiveRuntimeFixture();
    missingBareOnlyExclusion.buildFiles.splice(
      missingBareOnlyExclusion.buildFiles.indexOf('!node_modules/bare-fs{,/**/*}'),
      1,
    );
    cases.push({ fixture: missingBareOnlyExclusion, targetIndex: 0 });

    const overbroadNodeModulesExclusion = new ElectronNodeArchiveRuntimeFixture();
    overbroadNodeModulesExclusion.buildFiles.push('!node_modules/bare-*{,/**/*}');
    cases.push({ fixture: overbroadNodeModulesExclusion, targetIndex: 0 });

    const includedRuntimeModule = new ElectronNodeArchiveRuntimeFixture();
    includedRuntimeModule.approvedRuntimeModules.push('bare-fs');
    cases.push({ fixture: includedRuntimeModule, targetIndex: 0 });

    const missingNodeModule = new ElectronNodeArchiveRuntimeFixture();
    missingNodeModule.buildFiles.splice(missingNodeModule.buildFiles.indexOf('node_modules/tar-stream/**/*'), 1);
    cases.push({ fixture: missingNodeModule, targetIndex: 0 });

    for (const { fixture, targetIndex } of cases) {
      assert.throws(
        () => fixture.createPolicy().verify(SUPPORTED_DEPENDENCY_TARGETS[targetIndex]),
        /Electron\/Node archive runtime policy violation|Dependency policy violation/u,
      );
    }
  });

  it('normalizes injected reader failures without exposing machine paths or raw errors', () => {
    const fixture = new ElectronNodeArchiveRuntimeFixture();
    const privateCanary = '/private/user/runtime-policy-secret';
    const policy = new ElectronNodeArchiveRuntimePolicy({
      closurePolicy: new LockedProductionClosurePolicy({ readLockfile: () => fixture.lockfile }),
      readApprovedRuntimeModules: () => fixture.approvedRuntimeModules,
      readPackageManifest: () => {
        throw new Error(privateCanary);
      },
      readRootPackageManifest: () => ({ build: { files: fixture.buildFiles } }),
    });

    assert.throws(
      () => policy.verify(SUPPORTED_DEPENDENCY_TARGETS[0]),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'Electron/Node archive runtime policy violation: tar-stream manifest unavailable' &&
        !error.message.includes(privateCanary),
    );
  });
});

describe('package artifact classifier', () => {
  it('detects PE, ELF, every Mach-O form, Wasm, and executable scripts from bytes and mode', () => {
    const fixture = createArtifactFixture();
    for (const [name, magic] of Object.entries(NATIVE_MAGIC_FIXTURES)) fixture.write(name, magic);
    fixture.write('module.wasm', [0x00, 0x61, 0x73, 0x6d]);
    fixture.write('script', '#!/usr/bin/env node\n', 0o755);
    fixture.write('ordinary.js', 'export const value = 1;\n');
    fixture.write('misleading.exe', 'ordinary text');
    fixture.write('misleading.node', 'ordinary text');
    fixture.write('partial-elf', [0x7f, 0x45]);

    const inspection = fixture.classifier.inspectPackage(FIXTURE_PACKAGE, fixture.directory);
    const nativePaths = inspection.findings
      .filter((finding) => finding.kind === 'native-binary')
      .map((finding) => finding.relativePath);
    assert.deepEqual(
      nativePaths,
      Object.keys(NATIVE_MAGIC_FIXTURES).sort((left, right) => left.localeCompare(right, 'en')),
    );
    assert.equal(
      inspection.findings.some((finding) => finding.kind === 'webassembly'),
      true,
    );
    assert.equal(
      inspection.findings.some((finding) => finding.kind === 'executable-script'),
      true,
    );
    for (const negative of ['misleading.exe', 'misleading.node', 'ordinary.js', 'partial-elf']) {
      assert.equal(
        inspection.findings.some((finding) => finding.relativePath === negative),
        false,
        negative,
      );
    }
    assert.equal(classifyPackageArtifact(Uint8Array.of(0x23, 0x21), 0o644), null);
  });

  it('detects install hooks and native-build metadata from lock, manifest, and directory evidence', () => {
    const fixture = createArtifactFixture();
    fixture.write(
      'package.json',
      JSON.stringify({
        binary: { module_name: 'native' },
        name: 'fixture-package',
        scripts: {
          build: 'node-gyp rebuild',
          install: 'prebuild-install',
        },
        version: '1.0.0',
      }),
    );
    fixture.write('binding.gyp', '{}');
    fixture.write('prebuilds/linux-x64/native.node', 'misleading text');

    const inspection = fixture.classifier.inspectPackage(
      { ...FIXTURE_PACKAGE, gypfile: true, hasInstallScript: true },
      fixture.directory,
    );
    assert.equal(
      inspection.findings.some((finding) => finding.kind === 'install-script'),
      true,
    );
    assert.equal(
      inspection.findings.some((finding) => finding.kind === 'native-build-metadata'),
      true,
    );
    assert.equal(
      inspection.findings.some(
        (finding) => finding.relativePath === 'prebuilds/linux-x64/native.node' && finding.kind === 'native-binary',
      ),
      false,
    );
  });

  it('normalizes reader failures without exposing machine paths or raw exceptions', () => {
    const classifier = new PackageArtifactClassifier({
      readDirectory: () => {
        throw new Error('/home/private-user/private-reader-canary');
      },
      readFilePrefix: () => Uint8Array.of(),
      readPackageManifest: () => ({}),
      statFile: () => ({ mode: 0 }),
    });

    assert.throws(
      () => classifier.inspectPackage(FIXTURE_PACKAGE, '/home/private-user/private-package-canary'),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'Package artifact inspection failed: node_modules/fixture-package' &&
        !error.message.includes('private'),
    );
  });
});

describe('production advisory policy', () => {
  it('requires a clean production audit and verifies both target closures', () => {
    const fixture = new DependencyPolicyFixture();
    const result = new ProductionAdvisoryPolicy({
      closurePolicy: fixture.policy,
      readAuditReport: createAuditReport,
      readSecurityPolicy: createSecurityPolicy,
    }).verify();

    assert.deepEqual(result.advisoryExceptions, []);
    assert.deepEqual(result.verifiedTargets, ['linux-x64', 'win32-x64']);
  });

  it('fails unresolved closures, malformed audits, advisories, and inconsistent documentation', () => {
    const fixture = new DependencyPolicyFixture();
    const failures: Array<{ audit: unknown; lockfile: FixtureLockfile; security: string }> = [];

    const unresolved = fixture.cloneLockfile();
    delete unresolved.packages['node_modules/cloakbrowser'];
    failures.push({ audit: createAuditReport(), lockfile: unresolved, security: createSecurityPolicy() });

    const newAdvisory = createAuditReport();
    (newAdvisory.vulnerabilities as Record<string, unknown>).tar = {};
    failures.push({ audit: newAdvisory, lockfile: fixture.cloneLockfile(), security: createSecurityPolicy() });
    failures.push({
      audit: { auditReportVersion: 2 },
      lockfile: fixture.cloneLockfile(),
      security: createSecurityPolicy(),
    });
    failures.push({
      audit: createAuditReport(),
      lockfile: fixture.cloneLockfile(),
      security: createSecurityPolicy().replace(NO_PRODUCTION_ADVISORY_EXCEPTIONS, ''),
    });
    failures.push({
      audit: createAuditReport(),
      lockfile: fixture.cloneLockfile(),
      security: `${createSecurityPolicy()}${PRODUCTION_ADVISORY_EXCEPTIONS_HEADING}\n`,
    });

    for (const failure of failures) {
      const policy = new ProductionAdvisoryPolicy({
        closurePolicy: new LockedProductionClosurePolicy({ readLockfile: () => failure.lockfile }),
        readAuditReport: () => failure.audit,
        readSecurityPolicy: () => failure.security,
      });
      assert.throws(() => policy.verify(), /Production advisory policy violation|Dependency policy violation/u);
    }
  });
});
