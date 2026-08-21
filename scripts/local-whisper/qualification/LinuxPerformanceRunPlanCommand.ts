import { LinuxPerformanceRunPlanArguments } from './LinuxPerformanceRunPlanArguments';

const PATH_ARGUMENTS = Object.freeze([
  'workspace-root',
  'cache-root',
  'private-parent',
  'private-run-root',
  'baseline-worktree',
  'candidate-worktree',
] as const);
const ARGUMENTS = Object.freeze([...PATH_ARGUMENTS, 'candidate-commit', 'attempt-timeout-milliseconds'] as const);

export interface LinuxPerformanceRunPlanCommandValue {
  readonly workspaceRoot: string;
  readonly cacheRoot: string;
  readonly privateParent: string;
  readonly privateRunRoot: string;
  readonly baselineWorktree: string;
  readonly candidateWorktree: string;
  readonly candidateCommit: string;
  readonly attemptTimeoutMilliseconds: number;
}

/** Parses only the exact path-explicit private Linux run-plan contract. */
export class LinuxPerformanceRunPlanCommand {
  public static parse(argv: readonly string[]): LinuxPerformanceRunPlanCommandValue {
    const arguments_ = new LinuxPerformanceRunPlanArguments(argv, ARGUMENTS, 'PERFORMANCE_PLAN_ARGUMENT_INVALID');
    return Object.freeze({
      workspaceRoot: arguments_.absolute('workspace-root'),
      cacheRoot: arguments_.absolute('cache-root'),
      privateParent: arguments_.absolute('private-parent'),
      privateRunRoot: arguments_.absolute('private-run-root'),
      baselineWorktree: arguments_.absolute('baseline-worktree'),
      candidateWorktree: arguments_.absolute('candidate-worktree'),
      candidateCommit: arguments_.candidateCommit,
      attemptTimeoutMilliseconds: arguments_.attemptTimeoutMilliseconds,
    });
  }
}
