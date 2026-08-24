import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';

import {
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireString,
  runtimeFail,
} from './runtime-core-support.mjs';
import { PROCESS_TERMINAL_CLASSIFICATIONS } from './runtime-contracts.mjs';

export const GIT_EXECUTABLE = 'git';
// Git resolves the per-user configuration from these profile locations.  Keep
// the child environment otherwise empty so unrelated inherited values cannot
// affect repair delivery or be exposed through its bounded evidence.
export const GIT_ENVIRONMENT_ALLOWLIST = freezeArray([
  'PATH',
  'SystemRoot',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'XDG_CONFIG_HOME',
  'GIT_CONFIG_GLOBAL',
]);

const MAX_GIT_ARGUMENTS = 600;
const MAX_GIT_ARGUMENT_BYTES = 4_096;
const MAX_GIT_OUTPUT_BYTES = 262_144;

function normalizeArguments(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GIT_ARGUMENTS) {
    runtimeFail('invalid-git-command');
  }
  return freezeArray(
    value.map((argument) => {
      const normalized = requireString(argument, 'invalid-git-command', {
        minimum: 0,
        maximum: MAX_GIT_ARGUMENT_BYTES,
      });
      if (/\0/u.test(normalized)) runtimeFail('invalid-git-command');
      return normalized;
    }),
  );
}

function normalizeEnvironmentAllowlist(value) {
  if (!Array.isArray(value) || value.length > 100) runtimeFail('invalid-git-command-runner');
  const names = [...GIT_ENVIRONMENT_ALLOWLIST, ...value];
  const normalized = names.map((name) =>
    requireString(name, 'invalid-git-command-runner', { minimum: 1, maximum: 128 }),
  );
  if (new Set(normalized.map((name) => name.toUpperCase())).size !== normalized.length) {
    runtimeFail('invalid-git-command-runner');
  }
  return freezeArray(normalized);
}

function normalizeTerminal(value) {
  if (!isRecord(value) || !PROCESS_TERMINAL_CLASSIFICATIONS.includes(value.classification)) {
    runtimeFail('invalid-git-command-result');
  }
  const exitCode =
    value.exitCode === null ? null : requireNonNegativeInteger(value.exitCode, 'invalid-git-command-result', 255);
  if (value.signal !== null && typeof value.signal !== 'string') runtimeFail('invalid-git-command-result');
  if (typeof value.succeeded !== 'boolean') runtimeFail('invalid-git-command-result');
  return freezeRecord({
    classification: value.classification,
    exitCode,
    signal: value.signal,
    succeeded: value.succeeded,
  });
}

/** Runs fixed Git argument arrays through the shared shell-free process boundary. */
export class GitCommandRunner {
  #environmentAllowlist;
  #runner;

  constructor({ environmentAllowlist = [], runner } = {}) {
    if (runner === null || typeof runner?.run !== 'function') runtimeFail('invalid-git-command-runner');
    this.#environmentAllowlist = normalizeEnvironmentAllowlist(environmentAllowlist);
    this.#runner = runner;
  }

  async run({ args, timeoutMilliseconds } = {}) {
    const commandArgs = normalizeArguments(args);
    const timeout = requirePositiveInteger(timeoutMilliseconds, 'invalid-git-command-timeout', 604_800_000);
    const stdoutChunks = [];
    let stdoutBytes = 0;
    let outputExceeded = false;
    const result = await this.#runner.run({
      args: commandArgs,
      cwd: '.',
      env: {},
      environmentAllowlist: this.#environmentAllowlist,
      evidence: {
        maximumBytes: MAX_GIT_OUTPUT_BYTES,
        maximumFailures: 20,
        maximumMilliseconds: timeout,
      },
      executable: GIT_EXECUTABLE,
      outputConsumer: (stream, chunk) => {
        if (stream !== 'stdout' || outputExceeded) return;
        const bytes = Buffer.from(chunk);
        stdoutBytes += bytes.byteLength;
        if (stdoutBytes > MAX_GIT_OUTPUT_BYTES) {
          outputExceeded = true;
          return;
        }
        stdoutChunks.push(bytes);
      },
      timeoutMilliseconds: timeout,
    });
    if (outputExceeded) runtimeFail('git-command-output-too-large');
    let stdout;
    try {
      stdout = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(stdoutChunks));
    } catch {
      runtimeFail('git-command-output-invalid');
    }
    return freezeRecord({ terminal: normalizeTerminal(result?.terminal), stdout });
  }
}
