import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const TEST_PATTERN = 'tests/**/*.test.ts';

function argumentError(code) {
  const error = new Error(code);
  error.name = 'NodeTestRunnerArgumentError';
  return error;
}

function positiveInteger(value, errorCode) {
  if (!/^[1-9]\d*$/u.test(value)) throw argumentError(errorCode);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw argumentError(errorCode);
  return parsed;
}

/** Parses the bounded CI test-runner command line, defaulting to all available CPUs. */
export function parseNodeTestRunnerArguments(arguments_, automaticConcurrency = availableParallelism()) {
  let concurrency = automaticConcurrency;
  let shard = null;
  let concurrencySeen = false;
  let shardSeen = false;

  for (const argument of arguments_) {
    if (argument.startsWith('--concurrency=')) {
      if (concurrencySeen) throw argumentError('DUPLICATE_CONCURRENCY');
      concurrency = positiveInteger(argument.slice('--concurrency='.length), 'INVALID_CONCURRENCY');
      concurrencySeen = true;
      continue;
    }
    if (argument.startsWith('--shard=')) {
      if (shardSeen) throw argumentError('DUPLICATE_SHARD');
      const match = /^--shard=([1-9]\d*)\/([1-9]\d*)$/u.exec(argument);
      if (!match) throw argumentError('INVALID_SHARD');
      const index = positiveInteger(match[1], 'INVALID_SHARD');
      const total = positiveInteger(match[2], 'INVALID_SHARD');
      if (index > total) throw argumentError('INVALID_SHARD');
      shard = Object.freeze({ index, total });
      shardSeen = true;
      continue;
    }
    throw argumentError('UNKNOWN_ARGUMENT');
  }

  return Object.freeze({ concurrency, shard });
}

/** Builds the exact shell-free Node test-runner arguments. */
export function nodeTestArguments(options) {
  return Object.freeze([
    '--import',
    'tsx',
    '--test',
    `--test-concurrency=${options.concurrency}`,
    ...(options.shard === null ? [] : [`--test-shard=${options.shard.index}/${options.shard.total}`]),
    TEST_PATTERN,
  ]);
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('NODE_TEST_CHILD_START_FAILED')));
    child.once('close', (exitCode, signal) => resolve(Object.freeze({ exitCode, signal })));
  });
}

/** Owns one measured Node test child process without retry or fallback. */
export class NodeTestRunner {
  constructor({
    clock = () => performance.now(),
    nodeVersion = process.version,
    parallelism = availableParallelism(),
    spawnProcess = spawn,
    writeOutput = (value) => process.stdout.write(value),
  } = {}) {
    this.clock = clock;
    this.nodeVersion = nodeVersion;
    this.parallelism = parallelism;
    this.spawnProcess = spawnProcess;
    this.writeOutput = writeOutput;
  }

  async run(options) {
    const shard = options.shard === null ? 'all' : `${options.shard.index}/${options.shard.total}`;
    this.writeOutput(
      `[node-test-ci] node=${this.nodeVersion} availableParallelism=${this.parallelism} concurrency=${options.concurrency} shard=${shard}\n`,
    );
    const startedAt = this.clock();
    const child = this.spawnProcess(process.execPath, nodeTestArguments(options), {
      stdio: 'inherit',
      windowsHide: true,
    });
    const outcome = await waitForChild(child);
    const elapsedMilliseconds = Math.max(0, Math.round(this.clock() - startedAt));
    this.writeOutput(
      `[node-test-ci] elapsedMs=${elapsedMilliseconds} exitCode=${outcome.exitCode ?? 'none'} signal=${outcome.signal ?? 'none'}\n`,
    );
    return outcome;
  }
}

async function main() {
  try {
    const parallelism = availableParallelism();
    const options = parseNodeTestRunnerArguments(process.argv.slice(2), parallelism);
    const outcome = await new NodeTestRunner({ parallelism }).run(options);
    if (outcome.signal !== null) {
      process.kill(process.pid, outcome.signal);
      return;
    }
    process.exitCode = outcome.exitCode ?? 1;
  } catch (error) {
    const code =
      error instanceof Error && error.name === 'NodeTestRunnerArgumentError'
        ? error.message
        : 'NODE_TEST_RUNNER_FAILED';
    process.stderr.write(`[node-test-ci] failure=${code}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
