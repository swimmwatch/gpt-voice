import type {
  LockedPackage,
  LockedProductionClosure,
  LockedProductionClosurePolicy,
  SupportedDependencyTarget,
} from './lockedProductionClosure';

export interface ElectronNodeArchiveRuntimePolicyDependencies {
  readonly closurePolicy: LockedProductionClosurePolicy;
  readonly readApprovedRuntimeModules: () => unknown;
  readonly readPackageManifest: (packagePath: string) => unknown;
  readonly readRootPackageManifest: () => unknown;
}

export interface ElectronNodeArchiveRuntimeVerification {
  readonly bareOnlyPackages: readonly LockedPackage[];
  readonly completeClosure: LockedProductionClosure;
  readonly nodeRuntimePackages: readonly LockedPackage[];
  readonly target: SupportedDependencyTarget;
}

interface ExpectedPackage {
  readonly name: string;
  readonly path: string;
  readonly version: string;
}

const ARCHIVER_PACKAGE_NAME = 'archiver';
const TAR_STREAM_PACKAGE: ExpectedPackage = {
  name: 'tar-stream',
  path: 'node_modules/tar-stream',
  version: '3.2.0',
};
const BARE_FS_PACKAGE: ExpectedPackage = {
  name: 'bare-fs',
  path: 'node_modules/bare-fs',
  version: '4.7.4',
};
const SHARED_BARE_EVENTS_PACKAGE_NAME = 'bare-events';
const NODE_MODULES_PREFIX = 'node_modules/';
const PACKAGE_PATTERN_SUFFIX = '/**/*';
const SAFE_PACKAGE_NAME = /^(?:@[\w.~-]+\/[\w.~-]+|[\w.~-]+)$/u;

export const ELECTRON_NODE_ARCHIVER_BARE_ONLY_PACKAGES: readonly ExpectedPackage[] = Object.freeze([
  BARE_FS_PACKAGE,
  { name: 'bare-path', path: 'node_modules/bare-path', version: '3.1.1' },
  { name: 'bare-stream', path: 'node_modules/bare-stream', version: '2.13.3' },
  { name: 'bare-url', path: 'node_modules/bare-url', version: '2.4.6' },
  { name: 'teex', path: 'node_modules/teex', version: '1.0.1' },
]);

function failRuntimePolicy(detail: string): never {
  throw new Error(`Electron/Node archive runtime policy violation: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPackageIdentity(lockedPackage: Pick<LockedPackage, 'name' | 'path' | 'version'>): string {
  return `${lockedPackage.name}@${lockedPackage.version}:${lockedPackage.path}`;
}

function toPackagePattern(packageName: string): string {
  return `${NODE_MODULES_PREFIX}${packageName}${PACKAGE_PATTERN_SUFFIX}`;
}

function readStringArray(value: unknown, detail: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return failRuntimePolicy(detail);
  }
  const values = value as string[];
  if (new Set(values).size !== values.length) return failRuntimePolicy(detail);
  return Object.freeze([...values]);
}

/** Verifies Archiver's Electron/Node package graph independently of its complete locked closure. */
export class ElectronNodeArchiveRuntimePolicy {
  public constructor(private readonly dependencies: ElectronNodeArchiveRuntimePolicyDependencies) {}

  public verify(target: SupportedDependencyTarget): ElectronNodeArchiveRuntimeVerification {
    const completeClosure = this.dependencies.closurePolicy.resolvePackageClosure(ARCHIVER_PACKAGE_NAME, target);
    this.verifyTarStreamRuntimeContract(completeClosure);

    const nodeRuntimePaths = this.resolveNodeRuntimePaths(completeClosure);
    const nodeRuntimePackages = completeClosure.packages.filter((lockedPackage) =>
      nodeRuntimePaths.has(lockedPackage.path),
    );
    const bareOnlyPackages = completeClosure.packages.filter(
      (lockedPackage) => !nodeRuntimePaths.has(lockedPackage.path),
    );
    this.verifyBareOnlyPackages(bareOnlyPackages);
    if (!nodeRuntimePackages.some((lockedPackage) => lockedPackage.name === SHARED_BARE_EVENTS_PACKAGE_NAME)) {
      return failRuntimePolicy('shared bare-events package missing');
    }
    this.verifyPackagingConfiguration(nodeRuntimePackages, bareOnlyPackages);

    return Object.freeze({
      bareOnlyPackages: Object.freeze([...bareOnlyPackages]),
      completeClosure,
      nodeRuntimePackages: Object.freeze([...nodeRuntimePackages]),
      target,
    });
  }

  private readApprovedRuntimeModules(): ReadonlySet<string> {
    let value: unknown;
    try {
      value = this.dependencies.readApprovedRuntimeModules();
    } catch {
      return failRuntimePolicy('approved runtime modules unavailable');
    }
    const moduleNames = readStringArray(value, 'invalid approved runtime modules');
    if (moduleNames.some((name) => !SAFE_PACKAGE_NAME.test(name))) {
      return failRuntimePolicy('invalid approved runtime modules');
    }
    return new Set(moduleNames);
  }

  private readBuildFiles(): ReadonlySet<string> {
    let value: unknown;
    try {
      value = this.dependencies.readRootPackageManifest();
    } catch {
      return failRuntimePolicy('root package manifest unavailable');
    }
    if (!isRecord(value) || !isRecord(value.build)) {
      return failRuntimePolicy('invalid root package manifest');
    }
    return new Set(readStringArray(value.build.files, 'invalid build files'));
  }

  private readTarStreamManifest(): Record<string, unknown> {
    let value: unknown;
    try {
      value = this.dependencies.readPackageManifest(TAR_STREAM_PACKAGE.path);
    } catch {
      return failRuntimePolicy('tar-stream manifest unavailable');
    }
    if (!isRecord(value)) return failRuntimePolicy('invalid tar-stream manifest');
    return value;
  }

  private resolveNodeRuntimePaths(closure: LockedProductionClosure): ReadonlySet<string> {
    const reachable = new Set<string>();
    const pending = [''];
    for (let index = 0; index < pending.length; index += 1) {
      const parentPath = pending[index];
      for (const edge of closure.edges) {
        if (edge.fromPath !== parentPath || this.isBareRuntimeEdge(edge)) continue;
        if (reachable.has(edge.toPath)) continue;
        reachable.add(edge.toPath);
        pending.push(edge.toPath);
      }
    }
    return reachable;
  }

  private isBareRuntimeEdge(edge: LockedProductionClosure['edges'][number]): boolean {
    return (
      edge.fromPath === TAR_STREAM_PACKAGE.path &&
      edge.dependencyName === BARE_FS_PACKAGE.name &&
      edge.toPath === BARE_FS_PACKAGE.path
    );
  }

  private verifyBareOnlyPackages(packages: readonly LockedPackage[]): void {
    const actual = packages.map(toPackageIdentity).sort((left, right) => left.localeCompare(right, 'en'));
    const expected = ELECTRON_NODE_ARCHIVER_BARE_ONLY_PACKAGES.map(toPackageIdentity).sort((left, right) =>
      left.localeCompare(right, 'en'),
    );
    if (actual.length !== expected.length || actual.some((identity, index) => identity !== expected[index])) {
      return failRuntimePolicy('unexpected Bare-only package set');
    }
  }

  private verifyPackageIdentity(closure: LockedProductionClosure, expectedPackage: ExpectedPackage): LockedPackage {
    const lockedPackage = closure.packages.find((candidate) => candidate.path === expectedPackage.path);
    if (lockedPackage?.name !== expectedPackage.name || lockedPackage.version !== expectedPackage.version) {
      return failRuntimePolicy(`unexpected ${expectedPackage.name} lock`);
    }
    return lockedPackage;
  }

  private verifyPackagingConfiguration(
    nodeRuntimePackages: readonly LockedPackage[],
    bareOnlyPackages: readonly LockedPackage[],
  ): void {
    const buildFiles = this.readBuildFiles();
    const approvedRuntimeModules = this.readApprovedRuntimeModules();
    const nodeRuntimeNames = new Set(nodeRuntimePackages.map((lockedPackage) => lockedPackage.name));
    for (const packageName of nodeRuntimeNames) {
      if (!buildFiles.has(toPackagePattern(packageName)) || !approvedRuntimeModules.has(packageName)) {
        return failRuntimePolicy(`missing packaged Node runtime module ${packageName}`);
      }
    }
    for (const lockedPackage of bareOnlyPackages) {
      if (buildFiles.has(toPackagePattern(lockedPackage.name)) || approvedRuntimeModules.has(lockedPackage.name)) {
        return failRuntimePolicy(`included Bare-only module ${lockedPackage.name}`);
      }
    }
  }

  private verifyTarStreamRuntimeContract(closure: LockedProductionClosure): void {
    this.verifyPackageIdentity(closure, TAR_STREAM_PACKAGE);
    this.verifyPackageIdentity(closure, BARE_FS_PACKAGE);
    const matchingEdges = closure.edges.filter(
      (edge) => edge.fromPath === TAR_STREAM_PACKAGE.path && edge.dependencyName === BARE_FS_PACKAGE.name,
    );
    if (matchingEdges.length !== 1 || !this.isBareRuntimeEdge(matchingEdges[0])) {
      return failRuntimePolicy('unexpected tar-stream Bare dependency edge');
    }

    const manifest = this.readTarStreamManifest();
    if (
      manifest.name !== TAR_STREAM_PACKAGE.name ||
      manifest.version !== TAR_STREAM_PACKAGE.version ||
      !isRecord(manifest.dependencies) ||
      typeof manifest.dependencies[BARE_FS_PACKAGE.name] !== 'string' ||
      !isRecord(manifest.imports) ||
      !isRecord(manifest.imports.fs)
    ) {
      return failRuntimePolicy('invalid tar-stream runtime contract');
    }
    const fsMapping = manifest.imports.fs;
    if (Object.keys(fsMapping).length !== 2 || fsMapping.bare !== BARE_FS_PACKAGE.name || fsMapping.default !== 'fs') {
      return failRuntimePolicy('unexpected tar-stream fs conditions');
    }
  }
}
