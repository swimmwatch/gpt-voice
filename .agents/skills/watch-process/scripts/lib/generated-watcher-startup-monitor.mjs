import { setTimeout } from 'node:timers';

import { normalizeProcessWatchTarget } from './process-watch-invocation.mjs';
import { validateProcessStartToken } from './runtime-state-contracts.mjs';
import { freezeRecord, isRecord, requirePositiveInteger, runtimeFail } from './runtime-core-support.mjs';

const DEFAULT_STARTUP_TIMEOUT_MILLISECONDS = 15_000;
const DEFAULT_STARTUP_POLL_MILLISECONDS = 100;

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isConfirmedStartupState(state, processStartToken) {
  let hasTargetBinding = false;
  if (isRecord(state) && state.target !== null) {
    try {
      normalizeProcessWatchTarget(state.target, 'invalid-generated-watcher-heartbeat');
      hasTargetBinding = true;
    } catch {
      hasTargetBinding = false;
    }
  }
  return (
    isRecord(state) &&
    isRecord(state.heartbeat) &&
    state.heartbeat.startToken === processStartToken &&
    ['Blocked', 'NeedsAgent', 'Restarting', 'Success', 'Watching'].includes(state.phase) &&
    (hasTargetBinding || state.phase === 'Blocked')
  );
}

/** Waits only for a bounded heartbeat and never treats state as success proof. */
export class GeneratedWatcherStartupMonitor {
  #clock;
  #pollMilliseconds;
  #sleep;
  #startupTimeoutMilliseconds;

  constructor({
    clock = () => Date.now(),
    pollMilliseconds = DEFAULT_STARTUP_POLL_MILLISECONDS,
    sleep = defaultSleep,
    startupTimeoutMilliseconds = DEFAULT_STARTUP_TIMEOUT_MILLISECONDS,
  } = {}) {
    if (typeof clock !== 'function' || typeof sleep !== 'function')
      runtimeFail('invalid-generated-watcher-startup-monitor');
    this.#clock = clock;
    this.#pollMilliseconds = requirePositiveInteger(
      pollMilliseconds,
      'invalid-generated-watcher-startup-monitor',
      60_000,
    );
    this.#sleep = sleep;
    this.#startupTimeoutMilliseconds = requirePositiveInteger(
      startupTimeoutMilliseconds,
      'invalid-generated-watcher-startup-monitor',
      60_000,
    );
  }

  async waitForHeartbeat({ processStartToken, readState } = {}) {
    const token = validateProcessStartToken(processStartToken, 'invalid-generated-watcher-startup-monitor');
    if (typeof readState !== 'function') runtimeFail('invalid-generated-watcher-startup-monitor');
    const startedAt = this.#now();
    while (this.#now() - startedAt <= this.#startupTimeoutMilliseconds) {
      const state = await readState();
      if (isConfirmedStartupState(state, token)) return freezeRecord({ phase: state.phase, target: state.target });
      await this.#sleep(this.#pollMilliseconds);
    }
    runtimeFail('generated-watcher-startup-unconfirmed');
  }

  #now() {
    const value = this.#clock();
    if (!Number.isSafeInteger(value) || value < 0) runtimeFail('invalid-generated-watcher-startup-clock');
    return value;
  }
}
