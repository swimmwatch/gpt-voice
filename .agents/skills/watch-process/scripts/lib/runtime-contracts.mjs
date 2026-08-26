import {
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  runtimeFail,
} from './runtime-core-support.mjs';

export const PROCESS_OBSERVATION_STATUSES = freezeArray(['pending', 'running', 'succeeded', 'failed', 'cancelled']);

export const PROCESS_TERMINAL_CLASSIFICATIONS = freezeArray([
  'succeeded',
  'nonzero_exit',
  'signalled',
  'timed_out',
  'aborted',
  'spawn_failed',
  'cleanup_unconfirmed',
]);

export const WATCH_FAILURE_OUTCOMES = freezeArray([
  'verification_failed',
  'delivery_failed',
  'dispatch_failed',
  'authentication_failed',
  'watcher_lost',
  'target_lost',
  'user_cancelled',
  'target_cancelled',
]);

function validSignal(value) {
  return typeof value === 'string' && /^SIG[A-Z0-9]+$/u.test(value);
}

/**
 * Converts child-process termination details into the closed, log-free result
 * consumed by adapters and the later orchestrator.
 */
export function normalizeProcessTerminal(input) {
  if (!isRecord(input)) runtimeFail('invalid-process-terminal');
  const {
    aborted = false,
    cleanupUnconfirmed = false,
    exitCode = null,
    signal = null,
    startFailed = false,
    timedOut = false,
  } = input;

  if (
    typeof aborted !== 'boolean' ||
    typeof cleanupUnconfirmed !== 'boolean' ||
    typeof startFailed !== 'boolean' ||
    typeof timedOut !== 'boolean'
  ) {
    runtimeFail('invalid-process-terminal');
  }
  if (exitCode !== null) requireNonNegativeInteger(exitCode, 'invalid-process-terminal', 255);
  if (signal !== null && !validSignal(signal)) runtimeFail('invalid-process-terminal');

  if (cleanupUnconfirmed) {
    return freezeRecord({ classification: 'cleanup_unconfirmed', exitCode: null, signal: null, succeeded: false });
  }
  if (startFailed)
    return freezeRecord({ classification: 'spawn_failed', exitCode: null, signal: null, succeeded: false });
  if (timedOut) return freezeRecord({ classification: 'timed_out', exitCode: null, signal: null, succeeded: false });
  if (aborted) return freezeRecord({ classification: 'aborted', exitCode: null, signal: null, succeeded: false });
  if (signal !== null) return freezeRecord({ classification: 'signalled', exitCode: null, signal, succeeded: false });
  if (exitCode === 0) return freezeRecord({ classification: 'succeeded', exitCode: 0, signal: null, succeeded: true });
  if (exitCode !== null)
    return freezeRecord({ classification: 'nonzero_exit', exitCode, signal: null, succeeded: false });
  runtimeFail('invalid-process-terminal');
}

/**
 * Adapter-facing contract. Concrete adapters own provider interaction and must
 * implement every method; this base never performs remote work itself.
 *
 * @abstract
 * @property {(context: object) => Promise<object>} preflight
 * @property {(context: object) => Promise<object>} start
 * @property {(context: object) => Promise<object>} attach
 * @property {(context: object) => Promise<object>} observe
 * @property {(context: object) => Promise<object>} collectEvidence
 * @property {(context: object) => Promise<object>} identity
 * @property {(context: object) => Promise<object>} restart
 * @property {(context: object) => Promise<object>} cancel
 */
export class ProcessAdapter {
  async preflight() {
    this.#missingMethod();
  }

  async start() {
    this.#missingMethod();
  }

  async attach() {
    this.#missingMethod();
  }

  async observe() {
    this.#missingMethod();
  }

  async collectEvidence() {
    this.#missingMethod();
  }

  async identity() {
    this.#missingMethod();
  }

  async restart() {
    this.#missingMethod();
  }

  async cancel() {
    this.#missingMethod();
  }

  #missingMethod() {
    runtimeFail('adapter-method-not-implemented');
  }
}
