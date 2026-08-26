type QualificationStatus = 'Pending';

export interface LocalWhisperImplementationReadiness {
  readonly implementationReady: true;
  readonly linuxQualification: QualificationStatus;
  readonly windowsQualification: QualificationStatus;
  readonly productionReady: false;
}

export interface ImplementationReadinessRepository {
  readText(relativePath: string): Promise<string>;
  listFiles(relativeRoot: string): Promise<readonly string[]>;
}

export type ImplementationReadinessFailureCode =
  'IMPLEMENTATION_CONTRACT_INVALID' | 'IMPLEMENTATION_CONTRACT_MISSING' | 'QUALIFICATION_EVIDENCE_NOT_PENDING';

/** Stable fail-closed result for one invalid or absent implementation contract. */
export class ImplementationReadinessError extends Error {
  public constructor(
    public readonly code: ImplementationReadinessFailureCode,
    public readonly contractId: string,
  ) {
    super(`${code}:${contractId}`);
    this.name = 'ImplementationReadinessError';
  }
}
