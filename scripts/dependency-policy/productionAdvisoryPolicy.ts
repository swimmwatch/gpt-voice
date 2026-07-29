import {
  SUPPORTED_DEPENDENCY_TARGETS,
  type LockedProductionClosure,
  type LockedProductionClosurePolicy,
} from './lockedProductionClosure';

export const KNOWN_PRODUCTION_ADVISORY_EXCEPTION = Object.freeze({
  advisoryId: 'GHSA-r292-9mhp-454m',
  dependencyName: 'tar',
  dependencyPath: 'node_modules/tar',
  dependencyVersion: '7.5.19',
  impact:
    'Uncontrolled recursion and uncatchable stack-overflow denial of service for crafted long-path tar member selection.',
  lastReviewed: '2026-07-29',
  lockedPath: 'cloakbrowser@0.5.2 -> tar@7.5.19',
  overridePolicy:
    'No compatible CloakBrowser resolution has been validated; a forced transitive override can break its archive/runtime behavior.',
  parentName: 'cloakbrowser',
  parentPath: 'node_modules/cloakbrowser',
  parentVersion: '0.5.2',
  recheckTriggers: 'Any CloakBrowser or lockfile change, advisory update, or compatible upstream fix.',
  severity: 'moderate',
});

export const KNOWN_PRODUCTION_ADVISORY_HEADING = '## Known production advisory exceptions';
export const KNOWN_PRODUCTION_ADVISORY_TABLE_HEADER =
  '| Advisory | Locked production path | Severity | Impact | Override policy | Responsible upstream dependency | Last reviewed | Recheck triggers |';
export const KNOWN_PRODUCTION_ADVISORY_TABLE_SEPARATOR = '| --- | --- | --- | --- | --- | --- | --- | --- |';
export const KNOWN_PRODUCTION_ADVISORY_ROW =
  `| \`${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.advisoryId}\` | ` +
  `\`${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.lockedPath}\` | ` +
  `${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.severity} | ` +
  `${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.impact} | ` +
  `${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.overridePolicy} | ` +
  `\`${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.parentName}\` | ` +
  `\`${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.lastReviewed}\` | ` +
  `${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.recheckTriggers} |`;

export interface ProductionAdvisoryPolicyDependencies {
  readonly closurePolicy: LockedProductionClosurePolicy;
  readonly readAuditReport: () => unknown;
  readonly readSecurityPolicy: () => string;
}

export interface ProductionAdvisoryPolicyResult {
  readonly advisoryId: string;
  readonly verifiedTargets: readonly string[];
}

interface AuditAdvisory {
  readonly id: string;
  readonly packageName: string;
  readonly severity: string;
}

interface ParsedAuditReport {
  readonly advisories: readonly AuditAdvisory[];
  readonly nodesByPackage: ReadonlyMap<string, readonly string[]>;
  readonly severityByPackage: ReadonlyMap<string, string>;
}

interface AuditReportCollections {
  readonly advisories: AuditAdvisory[];
  readonly nodesByPackage: Map<string, readonly string[]>;
  readonly severityByPackage: Map<string, string>;
  readonly transitiveReferences: Array<{ readonly from: string; readonly to: string }>;
}

const ADVISORY_ID_FROM_URL = /\/(GHSA-[a-z0-9-]+)$/u;
const AUDIT_SEVERITIES = new Set(['critical', 'high', 'info', 'low', 'moderate']);
const SAFE_AUDIT_PACKAGE_NAME = /^(?:@[\w.~-]+\/[\w.~-]+|[\w.~-]+)$/u;

function failAdvisory(detail: string): never {
  throw new Error(`Production advisory policy violation: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countExactLine(source: string, expected: string): number {
  return source.split(/\r?\n/u).filter((line) => line === expected).length;
}

function readSeverity(value: unknown, detail: string): string {
  if (typeof value !== 'string' || !AUDIT_SEVERITIES.has(value)) return failAdvisory(detail);
  return value;
}

function readAuditNodes(value: unknown, packageName: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (node) =>
        typeof node !== 'string' ||
        (!node.startsWith('node_modules/') && !node.includes('/node_modules/')) ||
        node.includes('\\') ||
        node.includes('..'),
    )
  ) {
    return failAdvisory(`invalid audit nodes for ${packageName}`);
  }
  return Object.freeze([...new Set(value as string[])].sort((left, right) => left.localeCompare(right, 'en')));
}

function readAuditVia(packageName: string, value: unknown, collections: AuditReportCollections): void {
  if (typeof value === 'string') {
    if (!SAFE_AUDIT_PACKAGE_NAME.test(value)) return failAdvisory(`invalid audit path for ${packageName}`);
    collections.transitiveReferences.push({ from: packageName, to: value });
    return;
  }
  if (!isRecord(value) || typeof value.url !== 'string') {
    return failAdvisory(`invalid advisory evidence for ${packageName}`);
  }
  const advisoryId = ADVISORY_ID_FROM_URL.exec(value.url)?.[1];
  if (!advisoryId) return failAdvisory(`invalid advisory identity for ${packageName}`);
  const dependencyName =
    typeof value.dependency === 'string' ? value.dependency : typeof value.name === 'string' ? value.name : packageName;
  if (dependencyName !== packageName) return failAdvisory(`inconsistent advisory identity for ${packageName}`);
  collections.advisories.push({
    id: advisoryId,
    packageName,
    severity: readSeverity(value.severity, `invalid advisory severity for ${packageName}`),
  });
}

function readAuditVulnerability(packageName: string, value: unknown, collections: AuditReportCollections): void {
  if (!SAFE_AUDIT_PACKAGE_NAME.test(packageName) || !isRecord(value)) {
    return failAdvisory('invalid production audit evidence');
  }
  if (value.name !== undefined && value.name !== packageName) {
    return failAdvisory(`inconsistent audit identity for ${packageName}`);
  }
  collections.severityByPackage.set(
    packageName,
    readSeverity(value.severity, `invalid audit severity for ${packageName}`),
  );
  collections.nodesByPackage.set(packageName, readAuditNodes(value.nodes, packageName));
  if (!Array.isArray(value.via)) return failAdvisory(`invalid audit path for ${packageName}`);
  for (const via of value.via) readAuditVia(packageName, via, collections);
}

function readAuditReport(value: unknown): ParsedAuditReport {
  if (!isRecord(value) || value.auditReportVersion !== 2 || !isRecord(value.vulnerabilities) || value.error) {
    return failAdvisory('production audit evidence unavailable');
  }

  const collections: AuditReportCollections = {
    advisories: [],
    nodesByPackage: new Map<string, readonly string[]>(),
    severityByPackage: new Map<string, string>(),
    transitiveReferences: [],
  };
  for (const [packageName, vulnerability] of Object.entries(value.vulnerabilities)) {
    readAuditVulnerability(packageName, vulnerability, collections);
  }

  for (const reference of collections.transitiveReferences) {
    if (!collections.severityByPackage.has(reference.to)) {
      return failAdvisory(`unresolved audit path for ${reference.from}`);
    }
  }
  return Object.freeze({
    advisories: Object.freeze(
      [...collections.advisories].sort(
        (left, right) =>
          left.id.localeCompare(right.id, 'en') || left.packageName.localeCompare(right.packageName, 'en'),
      ),
    ),
    nodesByPackage: collections.nodesByPackage,
    severityByPackage: collections.severityByPackage,
  });
}

function getLockedPackage(closure: LockedProductionClosure, packagePath: string) {
  return closure.packages.find((lockedPackage) => lockedPackage.path === packagePath);
}

/** Verifies the one canonical production advisory exception against lock and live-audit evidence. */
export class ProductionAdvisoryPolicy {
  public constructor(private readonly dependencies: ProductionAdvisoryPolicyDependencies) {}

  public verify(): ProductionAdvisoryPolicyResult {
    const securityPolicy = this.readSecurityPolicy();
    this.verifyCanonicalSecurityRow(securityPolicy);
    const auditReport = this.readAuditEvidence();
    this.verifyAuditEvidence(auditReport);

    const verifiedTargets: string[] = [];
    for (const target of SUPPORTED_DEPENDENCY_TARGETS) {
      const closure = this.dependencies.closurePolicy.resolveProductionClosure(target);
      this.verifyLockedPath(closure);
      verifiedTargets.push(`${target.os}-${target.cpu}`);
    }
    return Object.freeze({
      advisoryId: KNOWN_PRODUCTION_ADVISORY_EXCEPTION.advisoryId,
      verifiedTargets: Object.freeze(verifiedTargets),
    });
  }

  private readAuditEvidence(): ParsedAuditReport {
    try {
      return readAuditReport(this.dependencies.readAuditReport());
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('Production advisory policy violation:')) throw error;
      return failAdvisory('production audit evidence unavailable');
    }
  }

  private readSecurityPolicy(): string {
    try {
      const policy = this.dependencies.readSecurityPolicy();
      if (typeof policy !== 'string') return failAdvisory('security policy unavailable');
      return policy;
    } catch {
      return failAdvisory('security policy unavailable');
    }
  }

  private verifyAuditEvidence(auditReport: ParsedAuditReport): void {
    if (auditReport.advisories.length !== 1) return failAdvisory('unexpected production advisory set');
    const [advisory] = auditReport.advisories;
    if (
      advisory.id !== KNOWN_PRODUCTION_ADVISORY_EXCEPTION.advisoryId ||
      advisory.packageName !== KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyName ||
      advisory.severity !== KNOWN_PRODUCTION_ADVISORY_EXCEPTION.severity ||
      auditReport.severityByPackage.get(KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyName) !==
        KNOWN_PRODUCTION_ADVISORY_EXCEPTION.severity ||
      !auditReport.nodesByPackage
        .get(KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyName)
        ?.includes(KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyPath)
    ) {
      return failAdvisory('known advisory evidence mismatch');
    }
  }

  private verifyCanonicalSecurityRow(securityPolicy: string): void {
    if (
      countExactLine(securityPolicy, KNOWN_PRODUCTION_ADVISORY_HEADING) !== 1 ||
      countExactLine(securityPolicy, KNOWN_PRODUCTION_ADVISORY_TABLE_HEADER) !== 1 ||
      countExactLine(securityPolicy, KNOWN_PRODUCTION_ADVISORY_TABLE_SEPARATOR) !== 1 ||
      countExactLine(securityPolicy, KNOWN_PRODUCTION_ADVISORY_ROW) !== 1
    ) {
      return failAdvisory('canonical SECURITY.md exception mismatch');
    }
  }

  private verifyLockedPath(closure: LockedProductionClosure): void {
    const parent = getLockedPackage(closure, KNOWN_PRODUCTION_ADVISORY_EXCEPTION.parentPath);
    const dependency = getLockedPackage(closure, KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyPath);
    const exactEdge = closure.edges.some(
      (edge) =>
        edge.fromPath === KNOWN_PRODUCTION_ADVISORY_EXCEPTION.parentPath &&
        edge.dependencyName === KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyName &&
        edge.toPath === KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyPath,
    );
    if (
      parent?.name !== KNOWN_PRODUCTION_ADVISORY_EXCEPTION.parentName ||
      parent.version !== KNOWN_PRODUCTION_ADVISORY_EXCEPTION.parentVersion ||
      dependency?.name !== KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyName ||
      dependency.version !== KNOWN_PRODUCTION_ADVISORY_EXCEPTION.dependencyVersion ||
      !exactEdge
    ) {
      return failAdvisory(`locked path mismatch for ${KNOWN_PRODUCTION_ADVISORY_EXCEPTION.parentName}`);
    }
  }
}
