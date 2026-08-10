export interface NpmCommandEvidence {
  readonly arguments: readonly string[];
  readonly exitCode: number;
  readonly output: string;
  readonly program: string;
}

interface SignatureAuditResult {
  readonly invalid: unknown[];
  readonly missing: unknown[];
}

const EXPECTED_INSTALL_ARGUMENTS = ['npm', 'ci', '--ignore-scripts', '--no-audit'] as const;
const EXPECTED_SIGNATURE_ARGUMENTS = ['npm', 'audit', 'signatures', '--json', '--ignore-scripts'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function equalArguments(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function parseSignatureAudit(output: string): SignatureAuditResult {
  try {
    const value = JSON.parse(output) as unknown;
    if (!isRecord(value) || !Array.isArray(value.invalid) || !Array.isArray(value.missing)) {
      throw new Error('invalid evidence');
    }
    return { invalid: value.invalid, missing: value.missing };
  } catch {
    throw new Error('npm signature policy violation: signature evidence malformed');
  }
}

/** Verifies that a Corepack-pinned, script-disabled lockfile install has clean npm signature evidence. */
export class NpmSignaturePolicy {
  public verify(input: {
    readonly expectedLockfileSha256: string;
    readonly install: NpmCommandEvidence;
    readonly installedLockfileSha256: string;
    readonly signatures: NpmCommandEvidence;
  }): void {
    if (
      !/^[a-f\d]{64}$/u.test(input.expectedLockfileSha256) ||
      input.expectedLockfileSha256 !== input.installedLockfileSha256
    ) {
      throw new Error('npm signature policy violation: lockfile identity mismatch');
    }
    this.verifyCommand(input.install, EXPECTED_INSTALL_ARGUMENTS, 'installation');
    this.verifyCommand(input.signatures, EXPECTED_SIGNATURE_ARGUMENTS, 'signature verification');
    const result = parseSignatureAudit(input.signatures.output);
    if (result.invalid.length > 0 || result.missing.length > 0) {
      throw new Error('npm signature policy violation: registry signature verification failed');
    }
  }

  private verifyCommand(evidence: NpmCommandEvidence, expectedArguments: readonly string[], stage: string): void {
    if (evidence.program !== 'corepack' || !equalArguments(evidence.arguments, expectedArguments)) {
      throw new Error(`npm signature policy violation: ${stage} command identity mismatch`);
    }
    if (evidence.exitCode !== 0) {
      throw new Error(`npm signature policy violation: ${stage} evidence unavailable`);
    }
  }
}
