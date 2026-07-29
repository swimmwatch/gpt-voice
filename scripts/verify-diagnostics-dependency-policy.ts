import * as fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ElectronNodeArchiveRuntimePolicy } from './dependency-policy/electronNodeArchiveRuntimePolicy';
import {
  LockedProductionClosurePolicy,
  SUPPORTED_DEPENDENCY_TARGETS,
  type SupportedDependencyTarget,
} from './dependency-policy/lockedProductionClosure';
import { PackageArtifactClassifier, type ArtifactDirectoryEntry } from './dependency-policy/packageArtifactClassifier';
import { ProductionAdvisoryPolicy } from './dependency-policy/productionAdvisoryPolicy';

interface DiagnosticsDependencyPolicyVerifierDependencies {
  readonly artifactClassifier: PackageArtifactClassifier;
  readonly closurePolicy: LockedProductionClosurePolicy;
  readonly hostTarget: SupportedDependencyTarget | null;
  readonly productionAdvisoryPolicy: ProductionAdvisoryPolicy;
  readonly runtimePolicy: ElectronNodeArchiveRuntimePolicy;
  readonly workspacePath: string;
}

interface DiagnosticsDependencyPolicyVerification {
  readonly bareOnlyFindingCount: number;
  readonly executableScriptCount: number;
  readonly hostArtifactPackages: number;
  readonly targetPackageCounts: Readonly<Record<string, number>>;
}

const ARCHIVER_PACKAGE_NAME = 'archiver';
const ARCHIVER_PACKAGE_PATH = 'node_modules/archiver';
const ARCHIVER_PACKAGE_VERSION = '8.0.0';
const BARE_FS_PACKAGE_NAME = 'bare-fs';
const PROHIBITED_ARCHIVER_FINDINGS = new Set([
  'install-script',
  'native-binary',
  'native-build-metadata',
  'webassembly',
]);
const AUDIT_TIMEOUT_MS = 120_000;
const AUDIT_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const FILE_PREFIX_BYTES = 8;

/** Runs repository integration evidence over the class-owned dependency policies. */
export class DiagnosticsDependencyPolicyVerifier {
  public constructor(private readonly dependencies: DiagnosticsDependencyPolicyVerifierDependencies) {}

  public verify(): DiagnosticsDependencyPolicyVerification {
    const targetPackageCounts: Record<string, number> = {};
    for (const target of SUPPORTED_DEPENDENCY_TARGETS) {
      const production = this.dependencies.closurePolicy.resolveProductionClosure(target);
      const runtime = this.dependencies.runtimePolicy.verify(target);
      this.verifyArchiverClosure(runtime.completeClosure.packages);
      if (production.packages.length <= runtime.completeClosure.packages.length) {
        throw new Error('Dependency policy violation: production and archiver closures are not distinct');
      }
      targetPackageCounts[`${target.os}-${target.cpu}`] = production.packages.length;
    }

    this.dependencies.productionAdvisoryPolicy.verify();
    let bareOnlyFindingCount = 0;
    let executableScriptCount = 0;
    let hostArtifactPackages = 0;
    if (this.dependencies.hostTarget) {
      const runtime = this.dependencies.runtimePolicy.verify(this.dependencies.hostTarget);
      let bareFsNativeEvidence = false;
      for (const lockedPackage of runtime.bareOnlyPackages) {
        const packageRoot = path.join(this.dependencies.workspacePath, lockedPackage.path);
        const inspection = this.dependencies.artifactClassifier.inspectPackage(lockedPackage, packageRoot);
        bareOnlyFindingCount += inspection.findings.length;
        if (
          lockedPackage.name === BARE_FS_PACKAGE_NAME &&
          inspection.findings.some(
            (finding) => finding.kind === 'native-binary' || finding.kind === 'native-build-metadata',
          )
        ) {
          bareFsNativeEvidence = true;
        }
      }
      if (!bareFsNativeEvidence) {
        throw new Error('Dependency policy violation: missing bare-fs native evidence');
      }

      hostArtifactPackages = runtime.nodeRuntimePackages.length;
      for (const lockedPackage of runtime.nodeRuntimePackages) {
        const packageRoot = path.join(this.dependencies.workspacePath, lockedPackage.path);
        const inspection = this.dependencies.artifactClassifier.inspectPackage(lockedPackage, packageRoot);
        for (const finding of inspection.findings) {
          if (finding.kind === 'executable-script') {
            executableScriptCount += 1;
          } else if (PROHIBITED_ARCHIVER_FINDINGS.has(finding.kind)) {
            throw new Error(`Dependency policy violation: prohibited artifact in ${finding.packagePath}`);
          }
        }
      }
    }

    return Object.freeze({
      bareOnlyFindingCount,
      executableScriptCount,
      hostArtifactPackages,
      targetPackageCounts: Object.freeze(targetPackageCounts),
    });
  }

  private verifyArchiverClosure(
    packages: readonly { readonly name: string; readonly path: string; readonly version: string }[],
  ): void {
    const archiver = packages.find((lockedPackage) => lockedPackage.path === ARCHIVER_PACKAGE_PATH);
    if (archiver?.name !== ARCHIVER_PACKAGE_NAME || archiver.version !== ARCHIVER_PACKAGE_VERSION) {
      throw new Error('Dependency policy violation: unexpected archiver lock');
    }
    if (packages.some((lockedPackage) => lockedPackage.name === 'tar')) {
      throw new Error('Dependency policy violation: CloakBrowser tar attributed to archiver');
    }
  }
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    throw new Error('Dependency policy input unavailable');
  }
}

function readNpmAuditReport(): unknown {
  const npmExecutable = process.env.npm_execpath;
  if (!npmExecutable) throw new Error('Production audit evidence unavailable');
  const audit = spawnSync(process.execPath, [npmExecutable, 'audit', '--json', '--omit=dev'], {
    cwd: WORKSPACE_PATH,
    encoding: 'utf8',
    maxBuffer: AUDIT_MAX_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: AUDIT_TIMEOUT_MS,
  });
  if (audit.error || !audit.stdout.trim()) throw new Error('Production audit evidence unavailable');
  try {
    return JSON.parse(audit.stdout) as unknown;
  } catch {
    throw new Error('Production audit evidence unavailable');
  }
}

function getHostTarget(): SupportedDependencyTarget | null {
  return (
    SUPPORTED_DEPENDENCY_TARGETS.find((target) => target.os === process.platform && target.cpu === process.arch) ?? null
  );
}

const WORKSPACE_PATH = path.resolve(__dirname, '..');
const PACKAGE_LOCK_PATH = path.join(WORKSPACE_PATH, 'package-lock.json');
const PACKAGE_JSON_PATH = path.join(WORKSPACE_PATH, 'package.json');
const PACKAGED_RUNTIME_POLICY_PATH = path.join(WORKSPACE_PATH, 'scripts/packaged-runtime-policy.mjs');
const SECURITY_POLICY_PATH = path.join(WORKSPACE_PATH, 'SECURITY.md');

async function runVerificationCommand(): Promise<void> {
  try {
    const packagedRuntimePolicy: unknown = await import(pathToFileURL(PACKAGED_RUNTIME_POLICY_PATH).href);
    const approvedRuntimeModules =
      typeof packagedRuntimePolicy === 'object' && packagedRuntimePolicy !== null
        ? (packagedRuntimePolicy as Record<string, unknown>).APPROVED_RUNTIME_MODULES
        : undefined;
    const closurePolicy = new LockedProductionClosurePolicy({
      readLockfile: () => readJsonFile(PACKAGE_LOCK_PATH),
    });
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
      readPackageManifest: (packageRoot) => readJsonFile(path.join(packageRoot, 'package.json')),
      statFile: (filePath) => ({ mode: fs.statSync(filePath).mode }),
    });
    const productionAdvisoryPolicy = new ProductionAdvisoryPolicy({
      closurePolicy,
      readAuditReport: readNpmAuditReport,
      readSecurityPolicy: () => fs.readFileSync(SECURITY_POLICY_PATH, 'utf8'),
    });
    const runtimePolicy = new ElectronNodeArchiveRuntimePolicy({
      closurePolicy,
      readApprovedRuntimeModules: () => approvedRuntimeModules,
      readPackageManifest: (packagePath) => readJsonFile(path.join(WORKSPACE_PATH, packagePath, 'package.json')),
      readRootPackageManifest: () => readJsonFile(PACKAGE_JSON_PATH),
    });
    const result = new DiagnosticsDependencyPolicyVerifier({
      artifactClassifier,
      closurePolicy,
      hostTarget: getHostTarget(),
      productionAdvisoryPolicy,
      runtimePolicy,
      workspacePath: WORKSPACE_PATH,
    }).verify();
    process.stdout.write(
      `Verified diagnostics dependency policy for ${Object.keys(result.targetPackageCounts).join(', ')}; ` +
        `${result.hostArtifactPackages} host Node-runtime packages, ${result.bareOnlyFindingCount} Bare-only ` +
        `findings, and ${result.executableScriptCount} executable scripts classified.\n`,
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error &&
      (error.message.startsWith('Dependency policy violation:') ||
        error.message.startsWith('Electron/Node archive runtime policy violation:') ||
        error.message.startsWith('Production advisory policy violation:') ||
        error.message.startsWith('Package artifact inspection failed:'))
        ? error.message
        : 'Diagnostics dependency policy verification failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runVerificationCommand();
}
