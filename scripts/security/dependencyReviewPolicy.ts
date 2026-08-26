export const SUPPORTED_NPM_DEPENDENCY_FILES = ['package.json', 'package-lock.json'] as const;

export interface DependencyReviewAdvisory {
  readonly severity: string;
}

export interface DependencyReviewEvidence {
  readonly advisories: readonly DependencyReviewAdvisory[];
}

function isSupportedNpmDependencyFile(filePath: string): boolean {
  return (SUPPORTED_NPM_DEPENDENCY_FILES as readonly string[]).includes(filePath);
}

/** Separates supported npm dependency-review evidence from custom native source locks. */
export class DependencyReviewPolicy {
  public verify(input: { readonly changedFiles: readonly string[]; readonly evidence: unknown }): void {
    const supportedChanges = input.changedFiles.filter(isSupportedNpmDependencyFile);
    if (supportedChanges.length === 0) return;
    if (!this.isEvidence(input.evidence)) {
      throw new Error('Dependency review policy violation: supported npm evidence malformed');
    }
    if (
      input.evidence.advisories.some((advisory) => advisory.severity === 'high' || advisory.severity === 'critical')
    ) {
      throw new Error('Dependency review policy violation: high or critical dependency finding');
    }
  }

  private isEvidence(value: unknown): value is DependencyReviewEvidence {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Array.isArray((value as Record<string, unknown>).advisories) &&
      (value as { advisories: unknown[] }).advisories.every(
        (advisory) =>
          typeof advisory === 'object' &&
          advisory !== null &&
          !Array.isArray(advisory) &&
          typeof (advisory as Record<string, unknown>).severity === 'string',
      )
    );
  }
}
