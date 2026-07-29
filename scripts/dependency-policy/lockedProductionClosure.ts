export const SUPPORTED_DEPENDENCY_TARGETS = [
  { cpu: 'x64', os: 'linux' },
  { cpu: 'x64', os: 'win32' },
] as const;

export type SupportedDependencyTarget = (typeof SUPPORTED_DEPENDENCY_TARGETS)[number];
export type DependencyEdgeKind = 'dependency' | 'optional' | 'peer' | 'optional-peer';

export interface LockedPackage {
  readonly cpu?: readonly string[];
  readonly gypfile: boolean;
  readonly hasInstallScript: boolean;
  readonly name: string;
  readonly optional: boolean;
  readonly os?: readonly string[];
  readonly path: string;
  readonly version: string;
}

export interface LockedDependencyEdge {
  readonly dependencyName: string;
  readonly fromPath: string;
  readonly kind: DependencyEdgeKind;
  readonly toPath: string;
}

export interface LockedProductionClosure {
  readonly edges: readonly LockedDependencyEdge[];
  readonly packages: readonly LockedPackage[];
  readonly target: SupportedDependencyTarget;
}

export interface LockedProductionClosurePolicyDependencies {
  readonly readLockfile: () => unknown;
}

interface LockfileEntry {
  readonly cpu?: readonly string[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly gypfile: boolean;
  readonly hasInstallScript: boolean;
  readonly name: string;
  readonly optional: boolean;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly os?: readonly string[];
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta: Readonly<Record<string, { readonly optional: boolean }>>;
  readonly path: string;
  readonly version: string;
}

interface ParsedLockfile {
  readonly entries: ReadonlyMap<string, LockfileEntry>;
  readonly root: LockfileEntry;
}

interface DependencyEdgeRequest {
  readonly dependencyName: string;
  readonly kind: DependencyEdgeKind;
  readonly optional: boolean;
}

const ROOT_PACKAGE_PATH = '';
const NODE_MODULES_SEGMENT = 'node_modules';
const SAFE_PACKAGE_NAME = /^(?:@[\w.~-]+\/[\w.~-]+|[\w.~-]+)$/u;

function failLockfile(detail: string): never {
  throw new Error(`Dependency policy violation: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, field: string, packagePath: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') failLockfile(`invalid ${field} for ${packagePath || 'root package'}`);
  return value;
}

function readStringRecord(value: unknown, field: string, packagePath: string): Readonly<Record<string, string>> {
  if (value === undefined) return {};
  if (!isRecord(value)) failLockfile(`invalid ${field} for ${packagePath || 'root package'}`);
  const result: Record<string, string> = {};
  for (const [name, range] of Object.entries(value)) {
    if (!SAFE_PACKAGE_NAME.test(name) || typeof range !== 'string' || !range.trim()) {
      failLockfile(`invalid ${field} for ${packagePath || 'root package'}`);
    }
    result[name] = range;
  }
  return Object.freeze(result);
}

function readTargetList(value: unknown, field: string, packagePath: string): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    failLockfile(`invalid ${field} for ${packagePath || 'root package'}`);
  }
  return Object.freeze([...new Set(value as string[])]);
}

function readPeerMetadata(
  value: unknown,
  packagePath: string,
): Readonly<Record<string, { readonly optional: boolean }>> {
  if (value === undefined) return {};
  if (!isRecord(value)) failLockfile(`invalid peer metadata for ${packagePath || 'root package'}`);
  const result: Record<string, { readonly optional: boolean }> = {};
  for (const [name, metadata] of Object.entries(value)) {
    if (!SAFE_PACKAGE_NAME.test(name) || !isRecord(metadata)) {
      failLockfile(`invalid peer metadata for ${packagePath || 'root package'}`);
    }
    const unexpectedKeys = Object.keys(metadata).filter((key) => key !== 'optional');
    if (unexpectedKeys.length > 0 || (metadata.optional !== undefined && typeof metadata.optional !== 'boolean')) {
      failLockfile(`invalid peer metadata for ${packagePath || 'root package'}`);
    }
    result[name] = Object.freeze({ optional: metadata.optional === true });
  }
  return Object.freeze(result);
}

function parsePackagePath(packagePath: string): readonly string[] {
  if (!packagePath.startsWith(`${NODE_MODULES_SEGMENT}/`) || packagePath.includes('\\')) {
    failLockfile('invalid package path');
  }

  const packageNames: string[] = [];
  let remaining = packagePath;
  while (remaining) {
    const prefix = `${NODE_MODULES_SEGMENT}/`;
    if (!remaining.startsWith(prefix)) failLockfile('invalid package path');
    remaining = remaining.slice(prefix.length);
    const next = remaining.indexOf(`/${NODE_MODULES_SEGMENT}/`);
    const packageName = next === -1 ? remaining : remaining.slice(0, next);
    if (!SAFE_PACKAGE_NAME.test(packageName)) failLockfile('invalid package path');
    packageNames.push(packageName);
    remaining = next === -1 ? '' : remaining.slice(next + 1);
  }
  return Object.freeze(packageNames);
}

function packagePathFromNames(packageNames: readonly string[], dependencyName: string): string {
  const prefix = packageNames.map((name) => `${NODE_MODULES_SEGMENT}/${name}`).join('/');
  return `${prefix ? `${prefix}/` : ''}${NODE_MODULES_SEGMENT}/${dependencyName}`;
}

function readEntry(packagePath: string, value: unknown): LockfileEntry {
  if (!isRecord(value)) failLockfile(`invalid package entry for ${packagePath || 'root package'}`);
  if (value.link !== undefined) failLockfile(`unsupported link state for ${packagePath || 'root package'}`);

  const packageNames = packagePath ? parsePackagePath(packagePath) : [];
  const derivedName = packageNames.length > 0 ? packageNames[packageNames.length - 1] : undefined;
  const declaredName = value.name;
  if (declaredName !== undefined && (typeof declaredName !== 'string' || !SAFE_PACKAGE_NAME.test(declaredName))) {
    failLockfile(`invalid package identity for ${packagePath || 'root package'}`);
  }
  if (derivedName && declaredName !== undefined && declaredName !== derivedName) {
    failLockfile(`inconsistent package identity for ${packagePath}`);
  }
  const name = derivedName ?? declaredName;
  if (!name) failLockfile('invalid root package identity');
  if (typeof value.version !== 'string' || !value.version.trim()) {
    failLockfile(`invalid package version for ${packagePath || 'root package'}`);
  }

  return Object.freeze({
    cpu: readTargetList(value.cpu, 'cpu', packagePath),
    dependencies: readStringRecord(value.dependencies, 'dependencies', packagePath),
    gypfile: readBoolean(value.gypfile, 'gypfile', packagePath),
    hasInstallScript: readBoolean(value.hasInstallScript, 'hasInstallScript', packagePath),
    name,
    optional: readBoolean(value.optional, 'optional', packagePath),
    optionalDependencies: readStringRecord(value.optionalDependencies, 'optionalDependencies', packagePath),
    os: readTargetList(value.os, 'os', packagePath),
    path: packagePath,
    peerDependencies: readStringRecord(value.peerDependencies, 'peerDependencies', packagePath),
    peerDependenciesMeta: readPeerMetadata(value.peerDependenciesMeta, packagePath),
    version: value.version,
  });
}

function isTargetValueAllowed(values: readonly string[] | undefined, targetValue: string): boolean {
  if (!values) return true;
  const exclusions = new Set(values.filter((value) => value.startsWith('!')).map((value) => value.slice(1)));
  if (exclusions.has(targetValue)) return false;
  const inclusions = values.filter((value) => !value.startsWith('!'));
  return inclusions.length === 0 || inclusions.includes(targetValue);
}

export function isPackageApplicable(
  entry: Pick<LockedPackage, 'cpu' | 'os'>,
  target: SupportedDependencyTarget,
): boolean {
  return isTargetValueAllowed(entry.os, target.os) && isTargetValueAllowed(entry.cpu, target.cpu);
}

function getDependencyRequests(entry: LockfileEntry, includeRootPeers: boolean): readonly DependencyEdgeRequest[] {
  const requests = new Map<string, DependencyEdgeRequest>();
  for (const dependencyName of Object.keys(entry.dependencies)) {
    requests.set(dependencyName, { dependencyName, kind: 'dependency', optional: false });
  }
  for (const dependencyName of Object.keys(entry.optionalDependencies)) {
    requests.set(dependencyName, { dependencyName, kind: 'optional', optional: true });
  }
  if (includeRootPeers) {
    for (const dependencyName of Object.keys(entry.peerDependencies)) {
      if (requests.has(dependencyName)) continue;
      const optional = entry.peerDependenciesMeta[dependencyName]?.optional === true;
      requests.set(dependencyName, {
        dependencyName,
        kind: optional ? 'optional-peer' : 'peer',
        optional,
      });
    }
  }
  return [...requests.values()].sort((left, right) => left.dependencyName.localeCompare(right.dependencyName, 'en'));
}

function toLockedPackage(entry: LockfileEntry): LockedPackage {
  return Object.freeze({
    cpu: entry.cpu,
    gypfile: entry.gypfile,
    hasInstallScript: entry.hasInstallScript,
    name: entry.name,
    optional: entry.optional,
    os: entry.os,
    path: entry.path,
    version: entry.version,
  });
}

/** Resolves deterministic, target-aware production graphs from an injected npm lockfile-v3 reader. */
export class LockedProductionClosurePolicy {
  private parsedLockfile: ParsedLockfile | null = null;

  public constructor(private readonly dependencies: LockedProductionClosurePolicyDependencies) {}

  public resolveProductionClosure(target: SupportedDependencyTarget): LockedProductionClosure {
    const lockfile = this.getLockfile();
    return this.resolveRequests(getDependencyRequests(lockfile.root, false), ROOT_PACKAGE_PATH, target);
  }

  public resolvePackageClosure(packageName: string, target: SupportedDependencyTarget): LockedProductionClosure {
    if (!SAFE_PACKAGE_NAME.test(packageName)) failLockfile('invalid requested package');
    const lockfile = this.getLockfile();
    const rootRequest = getDependencyRequests(lockfile.root, false).find(
      (request) => request.dependencyName === packageName,
    );
    if (!rootRequest) failLockfile(`missing root dependency ${packageName}`);
    return this.resolveRequests([rootRequest], ROOT_PACKAGE_PATH, target);
  }

  private getLockfile(): ParsedLockfile {
    if (this.parsedLockfile) return this.parsedLockfile;
    let rawLockfile: unknown;
    try {
      rawLockfile = this.dependencies.readLockfile();
    } catch {
      return failLockfile('lockfile unavailable');
    }
    if (!isRecord(rawLockfile) || rawLockfile.lockfileVersion !== 3 || !isRecord(rawLockfile.packages)) {
      return failLockfile('expected lockfile version 3');
    }

    const entries = new Map<string, LockfileEntry>();
    for (const [packagePath, value] of Object.entries(rawLockfile.packages)) {
      if (packagePath !== ROOT_PACKAGE_PATH) parsePackagePath(packagePath);
      entries.set(packagePath, readEntry(packagePath, value));
    }
    const root = entries.get(ROOT_PACKAGE_PATH);
    if (!root) return failLockfile('missing root package');
    this.parsedLockfile = Object.freeze({ entries, root });
    return this.parsedLockfile;
  }

  private resolveRequests(
    initialRequests: readonly DependencyEdgeRequest[],
    initialParentPath: string,
    target: SupportedDependencyTarget,
  ): LockedProductionClosure {
    const lockfile = this.getLockfile();
    const packages = new Map<string, LockedPackage>();
    const edges: LockedDependencyEdge[] = [];
    const pending: Array<{ readonly parentPath: string; readonly request: DependencyEdgeRequest }> =
      initialRequests.map((request) => ({ parentPath: initialParentPath, request }));

    for (let index = 0; index < pending.length; index += 1) {
      const { parentPath, request } = pending[index];
      const resolved = this.resolveDependency(lockfile, parentPath, request, target);
      if (!resolved) continue;
      edges.push({
        dependencyName: request.dependencyName,
        fromPath: parentPath,
        kind: request.kind,
        toPath: resolved.path,
      });
      if (packages.has(resolved.path)) continue;
      packages.set(resolved.path, toLockedPackage(resolved));
      for (const childRequest of getDependencyRequests(resolved, true)) {
        pending.push({ parentPath: resolved.path, request: childRequest });
      }
    }

    return Object.freeze({
      edges: Object.freeze(
        [...edges].sort(
          (left, right) =>
            left.fromPath.localeCompare(right.fromPath, 'en') ||
            left.dependencyName.localeCompare(right.dependencyName, 'en') ||
            left.toPath.localeCompare(right.toPath, 'en'),
        ),
      ),
      packages: Object.freeze([...packages.values()].sort((left, right) => left.path.localeCompare(right.path, 'en'))),
      target,
    });
  }

  private resolveDependency(
    lockfile: ParsedLockfile,
    parentPath: string,
    request: DependencyEdgeRequest,
    target: SupportedDependencyTarget,
  ): LockfileEntry | null {
    const parentNames = parentPath ? parsePackagePath(parentPath) : [];
    let foundInapplicable = false;
    for (let depth = parentNames.length; depth >= 0; depth -= 1) {
      const candidatePath = packagePathFromNames(parentNames.slice(0, depth), request.dependencyName);
      const candidate = lockfile.entries.get(candidatePath);
      if (!candidate) continue;
      if (isPackageApplicable(candidate, target)) return candidate;
      foundInapplicable = true;
    }

    if (request.optional) return null;
    const detail = foundInapplicable ? 'target-inapplicable required dependency' : 'unresolved required dependency';
    return failLockfile(`${detail} ${request.dependencyName}`);
  }
}
