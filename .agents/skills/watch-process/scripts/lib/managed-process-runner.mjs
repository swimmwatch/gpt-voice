import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import { BoundedEvidenceBuffer } from './bounded-evidence-buffer.mjs';
import { ManagedProcessExecution } from './managed-process-execution.mjs';
import { DEFAULT_TERMINATION_GRACE_MILLISECONDS, isOwnedChildProcess } from './managed-process-support.mjs';
import {
  PROCESS_START_TOKEN_PATTERN,
  RuntimeCoreError,
  assertAbortSignal,
  freezeRecord,
  isRecord,
  requirePositiveInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import {
  buildAllowlistedEnvironment,
  resolveValidatedWorkingDirectory,
  validateProcessCommand,
} from './runtime-preflight.mjs';

const DEFAULT_EVIDENCE_LIMITS = Object.freeze({
  maximumBytes: 65_536,
  maximumFailures: 20,
  maximumMilliseconds: 300_000,
});

function createDefaultStartToken() {
  return randomBytes(16).toString('hex');
}

function normalizeEvidenceLimits(value, defaults) {
  if (value === undefined) return defaults;
  if (!isRecord(value)) runtimeFail('invalid-evidence-limits');
  const allowedFields = new Set(['maximumBytes', 'maximumFailures', 'maximumMilliseconds']);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) runtimeFail('invalid-evidence-limits');
  }
  return freezeRecord({
    maximumBytes: requirePositiveInteger(
      value.maximumBytes ?? defaults.maximumBytes,
      'invalid-evidence-limits',
      10_485_760,
    ),
    maximumFailures: requirePositiveInteger(
      value.maximumFailures ?? defaults.maximumFailures,
      'invalid-evidence-limits',
      100,
    ),
    maximumMilliseconds: requirePositiveInteger(
      value.maximumMilliseconds ?? defaults.maximumMilliseconds,
      'invalid-evidence-limits',
      604_800_000,
    ),
  });
}

function validateRunnerRequest(value, inheritedAllowlist, evidenceDefaults) {
  if (!isRecord(value)) runtimeFail('invalid-process-request');
  const allowedFields = new Set([
    'args',
    'cwd',
    'env',
    'environmentAllowlist',
    'evidence',
    'executable',
    'outputConsumer',
    'signal',
    'timeoutMilliseconds',
  ]);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) runtimeFail('invalid-process-request');
  }
  const command = validateProcessCommand({
    args: value.args,
    cwd: value.cwd,
    env: value.env,
    environmentAllowlist: value.environmentAllowlist ?? inheritedAllowlist,
    executable: value.executable,
    timeoutMilliseconds: value.timeoutMilliseconds,
  });
  if (value.outputConsumer !== undefined && typeof value.outputConsumer !== 'function') {
    runtimeFail('invalid-process-output-consumer');
  }
  return freezeRecord({
    command,
    evidence: normalizeEvidenceLimits(value.evidence, evidenceDefaults),
    outputConsumer: value.outputConsumer,
    signal: assertAbortSignal(value.signal),
  });
}

/**
 * Owns validated shell-free child starts and the private token-to-process
 * lifecycle map. It never accepts a PID as cancellation authority.
 */
export class ManagedProcessRunner {
  #clock;
  #environmentAllowlist;
  #evidenceDefaults;
  #fileSystem;
  #inheritedEnvironment;
  #owned = new Map();
  #platform;
  #signalProcess;
  #spawnProcess;
  #startTokenFactory;
  #terminationGraceMilliseconds;
  #workspaceRoot;

  constructor({
    clock = () => performance.now(),
    environmentAllowlist = [],
    evidenceDefaults = DEFAULT_EVIDENCE_LIMITS,
    fileSystem,
    inheritedEnvironment = process.env,
    platform = process.platform,
    signalProcess = process.kill,
    spawnProcess = spawn,
    startTokenFactory = createDefaultStartToken,
    terminationGraceMilliseconds = DEFAULT_TERMINATION_GRACE_MILLISECONDS,
    workspaceRoot = process.cwd(),
  } = {}) {
    if (typeof clock !== 'function' || typeof spawnProcess !== 'function' || typeof startTokenFactory !== 'function') {
      runtimeFail('invalid-process-runner-dependency');
    }
    if (typeof signalProcess !== 'function' || typeof platform !== 'string')
      runtimeFail('invalid-process-runner-dependency');
    this.#clock = clock;
    this.#environmentAllowlist = environmentAllowlist;
    this.#evidenceDefaults = normalizeEvidenceLimits(evidenceDefaults, DEFAULT_EVIDENCE_LIMITS);
    this.#fileSystem = fileSystem;
    this.#inheritedEnvironment = inheritedEnvironment;
    this.#platform = platform;
    this.#signalProcess = signalProcess;
    this.#spawnProcess = spawnProcess;
    this.#startTokenFactory = startTokenFactory;
    this.#terminationGraceMilliseconds = requirePositiveInteger(
      terminationGraceMilliseconds,
      'invalid-termination-grace',
      60_000,
    );
    this.#workspaceRoot = workspaceRoot;
  }

  async start(request) {
    const normalized = validateRunnerRequest(request, this.#environmentAllowlist, this.#evidenceDefaults);
    if (normalized.signal?.aborted) runtimeFail('process-aborted-before-start');
    const cwd = await resolveValidatedWorkingDirectory({
      cwd: normalized.command.cwd,
      ...(this.#fileSystem === undefined ? {} : { fileSystem: this.#fileSystem }),
      workspaceRoot: this.#workspaceRoot,
    });
    const environment = buildAllowlistedEnvironment({
      declaredEnvironment: normalized.command.env,
      inheritedEnvironment: this.#inheritedEnvironment,
      names: normalized.command.environmentAllowlist,
      platform: this.#platform,
    });
    const startToken = this.#startTokenFactory();
    if (
      typeof startToken !== 'string' ||
      !PROCESS_START_TOKEN_PATTERN.test(startToken) ||
      this.#owned.has(startToken)
    ) {
      runtimeFail('invalid-process-start-token');
    }
    const evidence = new BoundedEvidenceBuffer({
      clock: this.#clock,
      maximumBytes: normalized.evidence.maximumBytes,
      maximumFailures: normalized.evidence.maximumFailures,
      maximumMilliseconds: normalized.evidence.maximumMilliseconds,
    });
    let child;
    try {
      child = this.#spawnProcess(normalized.command.executable, normalized.command.args, {
        cwd,
        detached: this.#platform !== 'win32',
        env: environment,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      runtimeFail('process-spawn-failed');
    }
    if (!isOwnedChildProcess(child)) runtimeFail('process-spawn-failed');
    const execution = new ManagedProcessExecution({
      abortSignal: normalized.signal,
      child,
      evidence,
      onFinished: (startToken_, execution_) => {
        if (this.#owned.get(startToken_) === execution_) this.#owned.delete(startToken_);
      },
      outputConsumer: normalized.outputConsumer,
      platform: this.#platform,
      signalProcess: this.#signalProcess,
      startToken,
      terminationGraceMilliseconds: this.#terminationGraceMilliseconds,
      timeoutMilliseconds: normalized.command.timeoutMilliseconds,
    });
    this.#owned.set(startToken, execution);
    if (execution.finished) this.#owned.delete(startToken);
    return execution;
  }

  async run(request) {
    const execution = await this.start(request);
    return execution.wait();
  }

  async abortOwned(startToken) {
    if (typeof startToken !== 'string' || !PROCESS_START_TOKEN_PATTERN.test(startToken))
      runtimeFail('invalid-process-start-token');
    const execution = this.#owned.get(startToken);
    if (execution === undefined) runtimeFail('owned-process-not-found');
    return execution.abort();
  }

  owns(startToken) {
    return typeof startToken === 'string' && this.#owned.has(startToken);
  }

  /**
   * Returns a live execution only from this runner's private ownership map.
   * It never discovers or attaches to an operating-system PID.
   */
  getOwnedExecution(startToken) {
    if (typeof startToken !== 'string' || !PROCESS_START_TOKEN_PATTERN.test(startToken)) {
      runtimeFail('invalid-process-start-token');
    }
    const execution = this.#owned.get(startToken);
    return execution === undefined || execution.finished ? null : execution;
  }
}

export function isRuntimeCoreError(error) {
  return error instanceof RuntimeCoreError;
}
