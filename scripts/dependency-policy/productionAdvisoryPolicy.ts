import { SUPPORTED_DEPENDENCY_TARGETS, type LockedProductionClosurePolicy } from './lockedProductionClosure';

export const PRODUCTION_ADVISORY_EXCEPTIONS_HEADING = '## Known production advisory exceptions';
export const NO_PRODUCTION_ADVISORY_EXCEPTIONS = 'No production advisory exceptions are currently approved.';

export interface ProductionAdvisoryPolicyDependencies {
  readonly closurePolicy: LockedProductionClosurePolicy;
  readonly readAuditReport: () => unknown;
  readonly readSecurityPolicy: () => string;
}

export interface ProductionAdvisoryPolicyResult {
  readonly advisoryExceptions: readonly string[];
  readonly verifiedTargets: readonly string[];
}

function failAdvisory(detail: string): never {
  throw new Error(`Production advisory policy violation: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countExactLine(source: string, expected: string): number {
  return source.split(/\r?\n/u).filter((line) => line === expected).length;
}

/** Verifies that production dependency audits are clean and no exception is documented. */
export class ProductionAdvisoryPolicy {
  public constructor(private readonly dependencies: ProductionAdvisoryPolicyDependencies) {}

  public verify(): ProductionAdvisoryPolicyResult {
    this.verifySecurityPolicy(this.readSecurityPolicy());
    this.verifyAuditEvidence(this.readAuditEvidence());

    const verifiedTargets: string[] = [];
    for (const target of SUPPORTED_DEPENDENCY_TARGETS) {
      this.dependencies.closurePolicy.resolveProductionClosure(target);
      verifiedTargets.push(`${target.os}-${target.cpu}`);
    }
    return Object.freeze({
      advisoryExceptions: Object.freeze([]),
      verifiedTargets: Object.freeze(verifiedTargets),
    });
  }

  private readAuditEvidence(): unknown {
    try {
      return this.dependencies.readAuditReport();
    } catch {
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

  private verifyAuditEvidence(value: unknown): void {
    if (!isRecord(value) || value.auditReportVersion !== 2 || !isRecord(value.vulnerabilities) || value.error) {
      return failAdvisory('production audit evidence unavailable');
    }
    if (Object.keys(value.vulnerabilities).length !== 0) {
      return failAdvisory('unexpected production advisory set');
    }
  }

  private verifySecurityPolicy(securityPolicy: string): void {
    if (
      countExactLine(securityPolicy, PRODUCTION_ADVISORY_EXCEPTIONS_HEADING) !== 1 ||
      countExactLine(securityPolicy, NO_PRODUCTION_ADVISORY_EXCEPTIONS) !== 1
    ) {
      return failAdvisory('canonical SECURITY.md exception state mismatch');
    }
  }
}
