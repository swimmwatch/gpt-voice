import * as path from 'node:path';

const PATH_ARGUMENTS = Object.freeze([
  'workspace-root',
  'cache-root',
  'private-parent',
  'private-run-root',
  'candidate-worktree',
] as const);
const ARGUMENTS = Object.freeze([...PATH_ARGUMENTS, 'candidate-commit', 'attempt-timeout-milliseconds'] as const);
const COMMIT = /^[a-f0-9]{40}$/u;

export interface FocusedLinuxPerformanceRunPlanCommandValue {
  readonly workspaceRoot: string;
  readonly cacheRoot: string;
  readonly privateParent: string;
  readonly privateRunRoot: string;
  readonly candidateWorktree: string;
  readonly candidateCommit: string;
  readonly attemptTimeoutMilliseconds: number;
}

function invalid(): never {
  throw new Error('FOCUSED_PERFORMANCE_PLAN_ARGUMENT_INVALID');
}

/** Parses one candidate-only Linux plan request; baseline worktrees and package aliases are intentionally absent. */
export class FocusedLinuxPerformanceRunPlanCommand {
  public static parse(argv: readonly string[]): FocusedLinuxPerformanceRunPlanCommandValue {
    if (argv.length !== ARGUMENTS.length) invalid();
    const values = new Map<string, string>();
    for (const argument of argv) {
      const match = /^--([a-z-]+)=([^\r\n]+)$/u.exec(argument);
      if (!match) invalid();
      const [, name, value] = match;
      if (!name || !value || !ARGUMENTS.includes(name as (typeof ARGUMENTS)[number]) || values.has(name)) invalid();
      values.set(name, value);
    }
    const absolute = (name: (typeof PATH_ARGUMENTS)[number]): string => {
      const value = values.get(name);
      if (!value || value.length > 4096 || !path.isAbsolute(value) || value.includes('\0')) invalid();
      return path.resolve(value);
    };
    const candidateCommit = values.get('candidate-commit');
    const timeoutText = values.get('attempt-timeout-milliseconds');
    if (!candidateCommit || !COMMIT.test(candidateCommit) || !timeoutText || !/^\d{4,7}$/u.test(timeoutText)) invalid();
    const attemptTimeoutMilliseconds = Number(timeoutText);
    if (
      !Number.isSafeInteger(attemptTimeoutMilliseconds) ||
      attemptTimeoutMilliseconds < 1000 ||
      attemptTimeoutMilliseconds > 3_600_000
    ) {
      invalid();
    }
    return Object.freeze({
      workspaceRoot: absolute('workspace-root'),
      cacheRoot: absolute('cache-root'),
      privateParent: absolute('private-parent'),
      privateRunRoot: absolute('private-run-root'),
      candidateWorktree: absolute('candidate-worktree'),
      candidateCommit,
      attemptTimeoutMilliseconds,
    });
  }
}
