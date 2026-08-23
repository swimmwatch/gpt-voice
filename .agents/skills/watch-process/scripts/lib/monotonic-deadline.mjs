import { performance } from 'node:perf_hooks';

import { requirePositiveInteger, runtimeFail } from './runtime-core-support.mjs';

function normalizedClock(clock) {
  if (typeof clock !== 'function') runtimeFail('invalid-monotonic-clock');
  let previous = Number.NEGATIVE_INFINITY;
  return () => {
    const current = clock();
    if (!Number.isFinite(current)) runtimeFail('invalid-monotonic-clock');
    previous = Math.max(previous, current);
    return previous;
  };
}

/** Owns a monotonic expiry boundary shared by a poll loop and a managed child. */
export class MonotonicDeadline {
  #clock;
  #expiresAt;

  constructor({ clock = () => performance.now(), timeoutMilliseconds }) {
    this.#clock = normalizedClock(clock);
    const timeout = requirePositiveInteger(timeoutMilliseconds, 'invalid-deadline', 604_800_000);
    this.#expiresAt = this.#clock() + timeout;
  }

  get remainingMilliseconds() {
    return Math.max(0, Math.floor(this.#expiresAt - this.#clock()));
  }

  get expired() {
    return this.remainingMilliseconds === 0;
  }
}
