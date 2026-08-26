import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { FocusedLinuxPerformanceRunPlanCommand } from '@scripts/local-whisper/qualification/FocusedLinuxPerformanceRunPlanCommand';

const COMMIT = 'a'.repeat(40);
const ROOTS = Object.freeze({
  cache: path.resolve('cache'),
  candidate: path.resolve('candidate'),
  privateParent: path.resolve('private'),
  privateRun: path.resolve('private', 'run'),
  workspace: path.resolve('workspace'),
});

function focusedArguments(): readonly string[] {
  return [
    `--workspace-root=${ROOTS.workspace}`,
    `--cache-root=${ROOTS.cache}`,
    `--private-parent=${ROOTS.privateParent}`,
    `--private-run-root=${ROOTS.privateRun}`,
    `--candidate-worktree=${ROOTS.candidate}`,
    `--candidate-commit=${COMMIT}`,
    '--attempt-timeout-milliseconds=1000',
  ];
}

describe('focused Linux performance run-plan arguments', () => {
  it('parses the candidate-only path-explicit contract', () => {
    assert.deepEqual(FocusedLinuxPerformanceRunPlanCommand.parse(focusedArguments()), {
      attemptTimeoutMilliseconds: 1000,
      cacheRoot: ROOTS.cache,
      candidateCommit: COMMIT,
      candidateWorktree: ROOTS.candidate,
      privateParent: ROOTS.privateParent,
      privateRunRoot: ROOTS.privateRun,
      workspaceRoot: ROOTS.workspace,
    });
  });

  it('preserves the focused command error for malformed shared fields', () => {
    for (const invalid of [
      focusedArguments().slice(1),
      focusedArguments().map((value) =>
        value.startsWith('--candidate-commit=') ? '--candidate-commit=invalid' : value,
      ),
      focusedArguments().map((value) =>
        value.startsWith('--attempt-timeout-milliseconds=') ? '--attempt-timeout-milliseconds=999' : value,
      ),
    ]) {
      assert.throws(
        () => FocusedLinuxPerformanceRunPlanCommand.parse(invalid),
        /^Error: FOCUSED_PERFORMANCE_PLAN_ARGUMENT_INVALID$/u,
      );
    }
  });
});
