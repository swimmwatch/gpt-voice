import { clearTimeout, setTimeout } from 'node:timers';

import { normalizeProcessTerminal } from './runtime-contracts.mjs';
import { freezeRecord } from './runtime-core-support.mjs';
import { terminateOwnedProcessTree, validProcessId } from './managed-process-support.mjs';

/**
 * Owns one child created by a matching ManagedProcessRunner token. A PID is
 * metadata only; cancellation is authorized through the runner's private token
 * map and this execution instance.
 */
export class ManagedProcessExecution {
  #abortListener;
  #abortSignal;
  #child;
  #cleanup = freezeRecord({
    attempted: false,
    directChildRequested: false,
    strategy: 'not-requested',
    treeVerified: false,
  });
  #completion;
  #deadlineTimer;
  #evidence;
  #forceTimer = null;
  #onFinished;
  #outputConsumer;
  #platform;
  #resolveCompletion;
  #settled = false;
  #signalProcess;
  #startToken;
  #terminationGraceMilliseconds;
  #terminationReason = null;
  #terminationTask = null;

  constructor({
    abortSignal,
    child,
    evidence,
    onFinished,
    outputConsumer,
    platform,
    signalProcess,
    startToken,
    terminationGraceMilliseconds,
    timeoutMilliseconds,
  }) {
    this.#abortSignal = abortSignal;
    this.#child = child;
    this.#evidence = evidence;
    this.#onFinished = onFinished;
    this.#outputConsumer = outputConsumer;
    this.#platform = platform;
    this.#signalProcess = signalProcess;
    this.#startToken = startToken;
    this.#terminationGraceMilliseconds = terminationGraceMilliseconds;
    this.#completion = new Promise((resolve) => {
      this.#resolveCompletion = resolve;
    });

    this.#listenToOutput(child.stdout, 'stdout');
    this.#listenToOutput(child.stderr, 'stderr');
    child.once('error', () => this.#finish({ startFailed: true }));
    child.once('close', (exitCode, signal) => this.#finish({ exitCode, signal }));
    this.#deadlineTimer = setTimeout(() => {
      void this.#terminate('timed-out');
    }, timeoutMilliseconds);
    if (abortSignal !== undefined) {
      this.#abortListener = () => {
        void this.#terminate('aborted');
      };
      abortSignal.addEventListener('abort', this.#abortListener, { once: true });
      if (abortSignal.aborted) void this.#terminate('aborted');
    }
  }

  get identity() {
    return freezeRecord({
      pid: validProcessId(this.#child.pid) ? this.#child.pid : null,
      startToken: this.#startToken,
    });
  }

  get finished() {
    return this.#settled;
  }

  async abort() {
    await this.#terminate('aborted');
    return this.wait();
  }

  wait() {
    return this.#completion;
  }

  async #terminate(reason) {
    if (this.#settled) return;
    if (this.#terminationTask !== null) return this.#terminationTask;
    this.#terminationReason = reason;
    this.#terminationTask = Promise.resolve().then(() => {
      this.#cleanup = terminateOwnedProcessTree({
        child: this.#child,
        platform: this.#platform,
        signal: 'SIGTERM',
        signalProcess: this.#signalProcess,
      });
      this.#forceTimer = setTimeout(() => {
        this.#forceTerminate();
      }, this.#terminationGraceMilliseconds);
    });
    return this.#terminationTask;
  }

  #forceTerminate() {
    if (this.#settled) return;
    const forced = terminateOwnedProcessTree({
      child: this.#child,
      platform: this.#platform,
      signal: 'SIGKILL',
      signalProcess: this.#signalProcess,
    });
    this.#cleanup = freezeRecord({ ...forced, forced: true });
    this.#finish({ cleanupUnconfirmed: true });
  }

  #finish({ cleanupUnconfirmed = false, exitCode = null, signal = null, startFailed = false } = {}) {
    if (this.#settled) return;
    this.#settled = true;
    clearTimeout(this.#deadlineTimer);
    if (this.#forceTimer !== null) clearTimeout(this.#forceTimer);
    if (this.#abortSignal !== undefined && this.#abortListener !== undefined) {
      this.#abortSignal.removeEventListener('abort', this.#abortListener);
    }
    const cleanup = freezeRecord({
      ...this.#cleanup,
      directChildExited: !cleanupUnconfirmed && !startFailed && validProcessId(this.#child.pid),
      requested: this.#terminationReason !== null,
    });
    const terminal = normalizeProcessTerminal({
      aborted: this.#terminationReason === 'aborted',
      cleanupUnconfirmed,
      exitCode: exitCode ?? null,
      signal: signal ?? null,
      startFailed,
      timedOut: this.#terminationReason === 'timed-out',
    });
    const result = freezeRecord({ cleanup, evidence: this.#evidence.summary(), identity: this.identity, terminal });
    this.#onFinished(this.#startToken, this);
    this.#resolveCompletion(result);
  }

  #listenToOutput(stream, streamName) {
    if (stream !== null && stream !== undefined && typeof stream.on === 'function') {
      stream.on('data', (chunk) => {
        this.#evidence.append(streamName, chunk);
        try {
          this.#outputConsumer?.(streamName, chunk);
        } catch {
          this.#evidence.recordFailure('output-consumer-failed');
        }
      });
    }
  }
}
