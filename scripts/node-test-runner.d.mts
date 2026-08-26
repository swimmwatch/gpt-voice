import type { EventEmitter } from 'node:events';

export interface NodeTestRunnerOptions {
  readonly concurrency: number;
  readonly shard: Readonly<{ readonly index: number; readonly total: number }> | null;
}

export interface NodeTestRunnerOutcome {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}

export function parseNodeTestRunnerArguments(
  arguments_: readonly string[],
  automaticConcurrency?: number,
): NodeTestRunnerOptions;
export function nodeTestArguments(options: NodeTestRunnerOptions): readonly string[];

export class NodeTestRunner {
  public constructor(options?: {
    readonly clock?: () => number;
    readonly nodeVersion?: string;
    readonly parallelism?: number;
    readonly spawnProcess?: (
      command: string,
      arguments_: readonly string[],
      options: Readonly<{ readonly stdio: 'inherit'; readonly windowsHide: true }>,
    ) => EventEmitter;
    readonly writeOutput?: (value: string) => void;
  });

  public run(options: NodeTestRunnerOptions): Promise<NodeTestRunnerOutcome>;
}
