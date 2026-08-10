export type RepositorySecurityGate = 'dependency' | 'docker' | 'npm-signatures' | 'secrets';

export interface RepositorySecurityGates {
  readonly dependency: () => void;
  readonly docker: () => void;
  readonly npmSignatures: () => void;
  readonly secrets: () => void;
}

/** Ensures every repository-security gate propagates its own failed evidence. */
export class RepositorySecurityGatePolicy {
  public verify(gates: RepositorySecurityGates): void {
    this.run('dependency', gates.dependency);
    this.run('npm-signatures', gates.npmSignatures);
    this.run('secrets', gates.secrets);
    this.run('docker', gates.docker);
  }

  private run(gate: RepositorySecurityGate, verify: () => void): void {
    try {
      verify();
    } catch {
      throw new Error(`Repository security gate failed: ${gate}`);
    }
  }
}
