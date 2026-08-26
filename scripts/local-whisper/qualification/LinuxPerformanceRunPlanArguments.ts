import * as path from 'node:path';

const COMMIT = /^[a-f0-9]{40}$/u;
const TIMEOUT = /^\d{4,7}$/u;
const MINIMUM_TIMEOUT_MILLISECONDS = 1_000;
const MAXIMUM_TIMEOUT_MILLISECONDS = 3_600_000;
const MAXIMUM_PATH_LENGTH = 4_096;

/** Owns the shared validation state for one path-explicit Linux performance run-plan command. */
export class LinuxPerformanceRunPlanArguments {
  public readonly attemptTimeoutMilliseconds: number;
  public readonly candidateCommit: string;
  private readonly values: ReadonlyMap<string, string>;

  public constructor(
    argv: readonly string[],
    allowedNames: readonly string[],
    private readonly errorCode: string,
  ) {
    if (argv.length !== allowedNames.length) this.invalid();
    const values = new Map<string, string>();
    for (const argument of argv) {
      const match = /^--([a-z-]+)=([^\r\n]+)$/u.exec(argument);
      if (!match) this.invalid();
      const [, name, value] = match;
      if (!name || !value || !allowedNames.includes(name) || values.has(name)) this.invalid();
      values.set(name, value);
    }
    const candidateCommit = values.get('candidate-commit');
    const timeoutText = values.get('attempt-timeout-milliseconds');
    if (!candidateCommit || !COMMIT.test(candidateCommit) || !timeoutText || !TIMEOUT.test(timeoutText)) this.invalid();
    const attemptTimeoutMilliseconds = Number(timeoutText);
    if (
      !Number.isSafeInteger(attemptTimeoutMilliseconds) ||
      attemptTimeoutMilliseconds < MINIMUM_TIMEOUT_MILLISECONDS ||
      attemptTimeoutMilliseconds > MAXIMUM_TIMEOUT_MILLISECONDS
    ) {
      this.invalid();
    }
    this.values = values;
    this.candidateCommit = candidateCommit;
    this.attemptTimeoutMilliseconds = attemptTimeoutMilliseconds;
  }

  public absolute(name: string): string {
    const value = this.values.get(name);
    if (!value || value.length > MAXIMUM_PATH_LENGTH || !path.isAbsolute(value) || value.includes('\0')) this.invalid();
    return path.resolve(value);
  }

  private invalid(): never {
    throw new Error(this.errorCode);
  }
}
