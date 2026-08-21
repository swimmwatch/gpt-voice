import { LinuxPerformanceRunPlanArguments } from './LinuxPerformanceRunPlanArguments';

const PATH_ARGUMENTS = Object.freeze([
  'workspace-root',
  'cache-root',
  'private-parent',
  'private-run-root',
  'candidate-worktree',
] as const);
const ARGUMENTS = Object.freeze([...PATH_ARGUMENTS, 'candidate-commit', 'attempt-timeout-milliseconds'] as const);

export interface FocusedLinuxPerformanceRunPlanCommandValue {
  readonly workspaceRoot: string;
  readonly cacheRoot: string;
  readonly privateParent: string;
  readonly privateRunRoot: string;
  readonly candidateWorktree: string;
  readonly candidateCommit: string;
  readonly attemptTimeoutMilliseconds: number;
}

/** Parses one candidate-only Linux plan request; baseline worktrees and package aliases are intentionally absent. */
export class FocusedLinuxPerformanceRunPlanCommand {
  public static parse(argv: readonly string[]): FocusedLinuxPerformanceRunPlanCommandValue {
    const arguments_ = new LinuxPerformanceRunPlanArguments(
      argv,
      ARGUMENTS,
      'FOCUSED_PERFORMANCE_PLAN_ARGUMENT_INVALID',
    );
    return Object.freeze({
      workspaceRoot: arguments_.absolute('workspace-root'),
      cacheRoot: arguments_.absolute('cache-root'),
      privateParent: arguments_.absolute('private-parent'),
      privateRunRoot: arguments_.absolute('private-run-root'),
      candidateWorktree: arguments_.absolute('candidate-worktree'),
      candidateCommit: arguments_.candidateCommit,
      attemptTimeoutMilliseconds: arguments_.attemptTimeoutMilliseconds,
    });
  }
}
