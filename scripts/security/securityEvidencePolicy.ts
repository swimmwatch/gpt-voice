export const SECURITY_EVIDENCE_RETENTION_VARIABLE = '${{ vars.CI_EVIDENCE_RETENTION_DAYS }}';

const SAFE_RELATIVE_EVIDENCE_PATH = /^release-artifacts\/[a-z\d][a-z\d._/-]{0,255}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const FORBIDDEN_EVIDENCE_CONTENT =
  /\baudio\b|\btranscript\b|\bprompt\b|\bmodel[ -]?content\b|\b(?:api[ -]?)?key\b|\btoken\b|\bcookie\b|\bsession\b|\bbrowser[ -]?(?:profile|data)\b|\bcapability\b|\benvironment(?: dump)?\b|\b(?:home|users)\/|[A-Z]:\\|https?:\/\/(?!github\.com\/)/iu;
const HOSTED_SECURITY_VENDOR =
  /\b(?:snyk|semgrep|sonarqube|mend|whitesource|veracode|checkmarx|dependabot-alerts-api)\b/iu;

export const SECURITY_EVIDENCE_KINDS = Object.freeze([
  'application-scan',
  'attestation',
  'builder-image',
  'codeql',
  'dependency',
  'provenance',
  'sbom',
  'scorecard',
  'secret',
  'workflow',
] as const);

export type SecurityEvidenceKind = (typeof SECURITY_EVIDENCE_KINDS)[number];
export type SecurityEvidenceStorage =
  'github-actions-artifact' | 'github-attestation' | 'github-code-scanning' | 'none';

export const SECURITY_EVIDENCE_POLICY = Object.freeze({
  'application-scan': Object.freeze({ requiresDigest: true, storage: 'github-actions-artifact' }),
  attestation: Object.freeze({ requiresDigest: true, storage: 'github-attestation' }),
  'builder-image': Object.freeze({ requiresDigest: true, storage: 'github-actions-artifact' }),
  codeql: Object.freeze({ requiresDigest: false, storage: 'github-code-scanning' }),
  dependency: Object.freeze({ requiresDigest: false, storage: 'none' }),
  provenance: Object.freeze({ requiresDigest: true, storage: 'github-attestation' }),
  sbom: Object.freeze({ requiresDigest: true, storage: 'github-actions-artifact' }),
  scorecard: Object.freeze({ requiresDigest: false, storage: 'github-code-scanning' }),
  secret: Object.freeze({ requiresDigest: false, storage: 'none' }),
  workflow: Object.freeze({ requiresDigest: false, storage: 'none' }),
} satisfies Readonly<
  Record<SecurityEvidenceKind, { readonly requiresDigest: boolean; readonly storage: SecurityEvidenceStorage }>
>);

export interface SecurityEvidenceDescriptor {
  readonly digest: string | null;
  readonly kind: SecurityEvidenceKind;
  readonly path: string | null;
  readonly retention: typeof SECURITY_EVIDENCE_RETENTION_VARIABLE | null;
  readonly storage: SecurityEvidenceStorage;
}

function fail(code: string): never {
  throw new Error(`SECURITY_EVIDENCE_${code}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'));
  const keys = [...expected].sort((left, right) => left.localeCompare(right, 'en'));
  if (JSON.stringify(actual) !== JSON.stringify(keys)) fail(code);
}

function isKind(value: unknown): value is SecurityEvidenceKind {
  return typeof value === 'string' && SECURITY_EVIDENCE_KINDS.includes(value as SecurityEvidenceKind);
}

function isStorage(value: unknown): value is SecurityEvidenceStorage {
  return (
    value === 'github-actions-artifact' ||
    value === 'github-attestation' ||
    value === 'github-code-scanning' ||
    value === 'none'
  );
}

/** Owns the bounded retention and privacy contract for every security evidence class. */
export class SecurityEvidencePolicy {
  public verifyDescriptor(value: unknown): asserts value is SecurityEvidenceDescriptor {
    const descriptor = isRecord(value) ? value : fail('DESCRIPTOR_MALFORMED');
    exactKeys(descriptor, ['digest', 'kind', 'path', 'retention', 'storage'], 'DESCRIPTOR_MALFORMED');
    if (!isKind(descriptor.kind) || !isStorage(descriptor.storage)) fail('DESCRIPTOR_MALFORMED');
    const rule = SECURITY_EVIDENCE_POLICY[descriptor.kind];
    if (descriptor.storage !== rule.storage) fail('STORAGE_INVALID');
    const artifact = descriptor.storage === 'github-actions-artifact';
    if (artifact !== (descriptor.path !== null) || artifact !== (descriptor.retention !== null))
      fail('DESCRIPTOR_MALFORMED');
    if (descriptor.path !== null) {
      if (typeof descriptor.path !== 'string' || !SAFE_RELATIVE_EVIDENCE_PATH.test(descriptor.path)) {
        fail('PATH_INVALID');
      }
      this.assertPrivacySafe([descriptor.path]);
    }
    if (descriptor.retention !== null && descriptor.retention !== SECURITY_EVIDENCE_RETENTION_VARIABLE) {
      fail('RETENTION_INVALID');
    }
    if (
      (descriptor.digest === null && rule.requiresDigest) ||
      (descriptor.digest !== null && (typeof descriptor.digest !== 'string' || !SHA256.test(descriptor.digest)))
    ) {
      fail('DIGEST_INVALID');
    }
  }

  public assertPrivacySafe(values: readonly string[]): void {
    if (values.length === 0 || values.length > 32) fail('PRIVACY_INVALID');
    for (const value of values) {
      if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > 512 ||
        FORBIDDEN_EVIDENCE_CONTENT.test(value)
      ) {
        fail('PRIVACY_INVALID');
      }
    }
  }

  public verifyRepositoryConfiguration(input: {
    readonly workflows: Readonly<Record<string, string>>;
    readonly sources: readonly string[];
  }): void {
    const workflowText = Object.values(input.workflows).join('\n');
    const allText = [...Object.values(input.workflows), ...input.sources].join('\n');
    if (HOSTED_SECURITY_VENDOR.test(allText)) fail('HOSTED_VENDOR');
    if (
      !workflowText.includes('retention-days: ${{ vars.CI_EVIDENCE_RETENTION_DAYS }}') ||
      !workflowText.includes('release-artifacts/application-security-${{ matrix.artifactPlatform }}') ||
      !workflowText.includes('actions/attest-build-provenance@') ||
      !workflowText.includes('ossf/scorecard-action@') ||
      !workflowText.includes('github/codeql-action/upload-sarif@')
    ) {
      fail('CONFIGURATION_INCOMPLETE');
    }
    const prohibited =
      /(?:actions\/upload-artifact@|gh\s+api|curl|wget|Invoke-WebRequest)[^\n]*(?:https?:\/\/|upload|artifact)/iu;
    if (prohibited.test(workflowText.replace(/actions\/upload-artifact@[^\n]*/gu, ''))) fail('CONFIGURATION_INVALID');
  }
}
