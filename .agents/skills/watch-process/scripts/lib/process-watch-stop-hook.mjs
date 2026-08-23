import { DeadlineAwarePoller } from './deadline-aware-poller.mjs';
import { MonotonicDeadline } from './monotonic-deadline.mjs';
import {
  assertStopHookBudget,
  isStopHookAcknowledged,
  normalizeStopHookInput,
  STOP_HOOK_CLEANUP_MARGIN_SECONDS,
  STOP_HOOK_TIMEOUT_SECONDS,
  stopHookContinuation,
  stopHookTimingSummary,
} from './process-watch-stop-hook-contracts.mjs';
import { assertAbortSignal, freezeRecord, requireNonNegativeInteger, runtimeFail } from './runtime-core-support.mjs';

const MAX_RECONCILIATION_ATTEMPTS = 3;
const STOP_HOOK_POLL = Object.freeze({ initialSeconds: 1, maxSeconds: 10, multiplier: 2 });
const ACTIVE_WATCH_PHASES = Object.freeze([
  'Armed',
  'Preparing',
  'Watching',
  'Repairing',
  'Verifying',
  'Restarting',
  'Finalizing',
]);
const CONTINUATION_PHASES = Object.freeze(['Blocked', 'Cancelled', 'NeedsAgent']);

function defaultDeadlineFactory(options) {
  return new MonotonicDeadline(options);
}

function isSameState(left, right) {
  return (
    left !== null &&
    right !== null &&
    left.generation === right.generation &&
    left.sessionId === right.sessionId &&
    left.watchId === right.watchId &&
    left.workspaceId === right.workspaceId
  );
}

function isWaitablePhase(phase) {
  return ACTIVE_WATCH_PHASES.includes(phase);
}

/** Waits once per active Codex turn and emits a bounded continuation only for fresh agent work. */
export class ProcessWatchStopHook {
  #clock;
  #deadlineFactory;
  #hookTimeoutSeconds;
  #poller;
  #repository;

  constructor({
    clock = () => Date.now(),
    deadlineFactory = defaultDeadlineFactory,
    hookTimeoutSeconds = STOP_HOOK_TIMEOUT_SECONDS,
    poller = new DeadlineAwarePoller(),
    repository,
  } = {}) {
    if (typeof clock !== 'function' || typeof deadlineFactory !== 'function' || typeof poller?.poll !== 'function') {
      runtimeFail('invalid-stop-hook');
    }
    if (repository === null || typeof repository?.find !== 'function') runtimeFail('invalid-stop-hook');
    assertStopHookBudget({ hookTimeoutSeconds, timeoutSeconds: 1 });
    this.#clock = clock;
    this.#deadlineFactory = deadlineFactory;
    this.#hookTimeoutSeconds = hookTimeoutSeconds;
    this.#poller = poller;
    this.#repository = repository;
  }

  async handle(value, { signal } = {}) {
    let input;
    try {
      assertAbortSignal(signal);
      input = normalizeStopHookInput(value);
      if (input.stopHookActive || signal?.aborted) return freezeRecord({});
      const match = await this.#repository.find(input);
      if (match.kind !== 'matched') return freezeRecord({});
      return await this.#handleMatch(input, match.watch, signal);
    } catch {
      return freezeRecord({});
    }
  }

  async #acknowledge(input, watch, action) {
    const acknowledgementState = await watch.readState();
    if (!isSameState(acknowledgementState, action.state)) return freezeRecord({ kind: 'retry' });
    const existing = await watch.readAcknowledgement();
    if (isStopHookAcknowledged(existing, acknowledgementState)) {
      return freezeRecord({ kind: 'complete', output: freezeRecord({}) });
    }

    await watch.writeAcknowledgement({
      generation: acknowledgementState.generation,
      outcome: action.outcome,
      schemaVersion: 1,
      sessionId: acknowledgementState.sessionId,
      turnId: input.turnId,
      watchId: acknowledgementState.watchId,
    });
    const confirmedState = await watch.readState();
    if (!isSameState(confirmedState, acknowledgementState)) return freezeRecord({ kind: 'retry' });
    return freezeRecord({ kind: 'complete', output: stopHookContinuation(action.outcome) });
  }

  async #actionForState(input, watch, state) {
    if (state === null || state.sessionId !== input.sessionId || state.phase === 'Success') {
      return freezeRecord({ kind: 'inactive' });
    }
    try {
      assertStopHookBudget({ hookTimeoutSeconds: this.#hookTimeoutSeconds, timeoutSeconds: state.timeoutSeconds });
    } catch {
      return freezeRecord({ kind: 'continue', outcome: 'integrity_failed', state });
    }
    if (CONTINUATION_PHASES.includes(state.phase)) {
      return freezeRecord({ kind: 'continue', outcome: state.outcome ?? 'monitoring_failed', state });
    }
    if (!isWaitablePhase(state.phase)) return freezeRecord({ kind: 'continue', outcome: 'integrity_failed', state });
    if (state.phase !== 'Watching') return freezeRecord({ kind: 'wait', state });

    const lock = await watch.inspectWatcher(state);
    if (lock.kind === 'ambiguous') return freezeRecord({ kind: 'continue', outcome: 'monitoring_failed', state });
    if (
      lock.kind === 'missing' ||
      lock.kind === 'not-running' ||
      lock.kind === 'reused' ||
      (lock.generation !== undefined && lock.generation !== state.generation)
    ) {
      return freezeRecord({ kind: 'continue', outcome: 'watcher_lost', state });
    }
    return freezeRecord({ kind: 'wait', state });
  }

  async #handleMatch(input, watch, signal) {
    for (let attempt = 0; attempt < MAX_RECONCILIATION_ATTEMPTS; attempt += 1) {
      let action = await this.#readAction(input, watch);
      if (action.kind === 'inactive') return freezeRecord({});
      if (action.kind === 'wait') action = await this.#waitForAction(input, watch, action.state, signal);
      if (action.kind === 'inactive') return freezeRecord({});
      if (action.kind === 'wait')
        action = freezeRecord({ kind: 'continue', outcome: 'watcher_lost', state: action.state });

      const acknowledgement = await this.#acknowledge(input, watch, action);
      if (acknowledgement.kind === 'complete') return acknowledgement.output;
    }
    return freezeRecord({});
  }

  async #readAction(input, watch) {
    return this.#actionForState(input, watch, await watch.readState());
  }

  async #waitForAction(input, watch, state, signal) {
    const timing = stopHookTimingSummary(state, { hookTimeoutSeconds: this.#hookTimeoutSeconds });
    const now = this.#now();
    const configuredCeilingMilliseconds = timing.hookCeilingSeconds * 1_000;
    const deadlineWithCleanupMilliseconds =
      timing.effectiveAttemptDeadlineEpochMilliseconds + STOP_HOOK_CLEANUP_MARGIN_SECONDS * 1_000;
    const waitMilliseconds = Math.min(
      configuredCeilingMilliseconds,
      Math.max(0, deadlineWithCleanupMilliseconds - now),
      timing.approvedTimeoutSeconds * 1_000 + STOP_HOOK_CLEANUP_MARGIN_SECONDS * 1_000,
    );
    if (waitMilliseconds === 0) return freezeRecord({ kind: 'wait', state });

    const deadline = this.#deadlineFactory({ timeoutMilliseconds: waitMilliseconds });
    const result = await this.#poller.poll({
      deadline,
      observe: async () => {
        const action = await this.#readAction(input, watch);
        return freezeRecord({ action, terminal: action.kind !== 'wait' });
      },
      poll: STOP_HOOK_POLL,
      signal,
    });
    return result.kind === 'terminal' ? result.observation.action : freezeRecord({ kind: 'wait', state });
  }

  #now() {
    return requireNonNegativeInteger(this.#clock(), 'invalid-stop-hook-clock', Number.MAX_SAFE_INTEGER);
  }
}
