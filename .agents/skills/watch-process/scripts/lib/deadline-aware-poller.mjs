import { clearTimeout, setTimeout } from 'node:timers';

import { MonotonicDeadline } from './monotonic-deadline.mjs';
import {
  RuntimeCoreError,
  assertAbortSignal,
  freezeRecord,
  isRecord,
  requirePositiveInteger,
  runtimeFail,
} from './runtime-core-support.mjs';

/** Waits without polling and rejects promptly when the supplied signal is aborted. */
export function waitForAbortableDelay(milliseconds, signal) {
  const delay = requirePositiveInteger(milliseconds, 'invalid-poll-delay', 604_800_000);
  const abortSignal = assertAbortSignal(signal);
  if (abortSignal?.aborted) return Promise.reject(new RuntimeCoreError('poll-aborted'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RuntimeCoreError('poll-aborted'));
    };
    abortSignal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Normalizes the scenario's bounded exponential polling values to milliseconds. */
export function normalizePollTiming(poll) {
  if (!isRecord(poll)) runtimeFail('invalid-poll-timing');
  const initialSeconds = requirePositiveInteger(poll.initialSeconds, 'invalid-poll-timing', 300);
  const maxSeconds = requirePositiveInteger(poll.maxSeconds, 'invalid-poll-timing', 900);
  if (maxSeconds < initialSeconds || typeof poll.multiplier !== 'number' || !Number.isFinite(poll.multiplier)) {
    runtimeFail('invalid-poll-timing');
  }
  if (poll.multiplier < 1 || poll.multiplier > 4) runtimeFail('invalid-poll-timing');
  return freezeRecord({
    initialMilliseconds: initialSeconds * 1_000,
    maxMilliseconds: maxSeconds * 1_000,
    multiplier: poll.multiplier,
  });
}

/**
 * Owns bounded exponential backoff. It performs no busy loop or provider work;
 * adapters supply the single observation callback.
 */
export class DeadlineAwarePoller {
  #sleep;

  constructor({ sleep = waitForAbortableDelay } = {}) {
    if (typeof sleep !== 'function') runtimeFail('invalid-poll-sleeper');
    this.#sleep = sleep;
  }

  async poll({ deadline, observe, poll, signal }) {
    if (!(deadline instanceof MonotonicDeadline) || typeof observe !== 'function') runtimeFail('invalid-poll-request');
    const timing = normalizePollTiming(poll);
    const abortSignal = assertAbortSignal(signal);
    let attempts = 0;
    let delayMilliseconds = timing.initialMilliseconds;

    while (!deadline.expired) {
      if (abortSignal?.aborted) runtimeFail('poll-aborted');
      attempts += 1;
      const observation = await observe(
        freezeRecord({ attempt: attempts, remainingMilliseconds: deadline.remainingMilliseconds }),
      );
      if (!isRecord(observation) || typeof observation.terminal !== 'boolean') runtimeFail('invalid-poll-observation');
      if (observation.terminal) return freezeRecord({ attempts, kind: 'terminal', observation });

      const remainingMilliseconds = deadline.remainingMilliseconds;
      if (remainingMilliseconds === 0) break;
      await this.#sleep(Math.max(1, Math.min(delayMilliseconds, remainingMilliseconds)), abortSignal);
      delayMilliseconds = Math.min(timing.maxMilliseconds, Math.ceil(delayMilliseconds * timing.multiplier));
    }
    return freezeRecord({ attempts, kind: 'deadline-exceeded' });
  }
}
