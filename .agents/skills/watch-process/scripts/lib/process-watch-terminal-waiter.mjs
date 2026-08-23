import { DeadlineAwarePoller } from './deadline-aware-poller.mjs';
import { MonotonicDeadline } from './monotonic-deadline.mjs';
import {
  assertStopHookBudget,
  STOP_HOOK_CLEANUP_MARGIN_SECONDS,
  STOP_HOOK_TIMEOUT_SECONDS,
  stopHookTimingSummary,
} from './process-watch-stop-hook-contracts.mjs';
import { assertAbortSignal, freezeRecord, requireNonNegativeInteger, runtimeFail } from './runtime-core-support.mjs';
import { validateSafeId } from './runtime-state-contracts.mjs';

const WAIT_POLL = Object.freeze({ initialSeconds: 1, maxSeconds: 10, multiplier: 2 });
const ACTIVE_PHASES = Object.freeze([
  'Armed',
  'Preparing',
  'Watching',
  'Repairing',
  'Verifying',
  'Restarting',
  'Finalizing',
]);
const TERMINAL_HANDOFF_PHASES = Object.freeze(['Blocked', 'Cancelled', 'NeedsAgent', 'Success']);

function defaultDeadlineFactory(options) {
  return new MonotonicDeadline(options);
}

/** Waits without model calls and classifies one exact watch generation. */
export class ProcessWatchTerminalWaiter {
  #clock;
  #deadlineFactory;
  #hookTimeoutSeconds;
  #poller;

  constructor({
    clock = () => Date.now(),
    deadlineFactory = defaultDeadlineFactory,
    hookTimeoutSeconds = STOP_HOOK_TIMEOUT_SECONDS,
    poller = new DeadlineAwarePoller(),
  } = {}) {
    if (typeof clock !== 'function' || typeof deadlineFactory !== 'function' || typeof poller?.poll !== 'function') {
      runtimeFail('invalid-process-watch-terminal-waiter');
    }
    assertStopHookBudget({ hookTimeoutSeconds, timeoutSeconds: 1 });
    this.#clock = clock;
    this.#deadlineFactory = deadlineFactory;
    this.#hookTimeoutSeconds = hookTimeoutSeconds;
    this.#poller = poller;
  }

  async wait({ sessionId, signal, watch } = {}) {
    const expectedSessionId = validateSafeId(sessionId, 'invalid-process-watch-terminal-wait');
    assertAbortSignal(signal);
    if (watch === null || typeof watch?.readState !== 'function' || typeof watch?.inspectWatcher !== 'function') {
      runtimeFail('invalid-process-watch-terminal-wait');
    }
    let action = await this.#readAction(expectedSessionId, watch);
    if (action.kind !== 'wait') return action;

    const timing = stopHookTimingSummary(action.state, { hookTimeoutSeconds: this.#hookTimeoutSeconds });
    const waitMilliseconds = Math.min(
      timing.hookCeilingSeconds * 1_000,
      Math.max(
        0,
        timing.effectiveAttemptDeadlineEpochMilliseconds + STOP_HOOK_CLEANUP_MARGIN_SECONDS * 1_000 - this.#now(),
      ),
      timing.approvedTimeoutSeconds * 1_000 + STOP_HOOK_CLEANUP_MARGIN_SECONDS * 1_000,
    );
    if (waitMilliseconds === 0) {
      return freezeRecord({ kind: 'continue', outcome: 'timed_out', state: action.state });
    }

    const result = await this.#poller.poll({
      deadline: this.#deadlineFactory({ timeoutMilliseconds: waitMilliseconds }),
      observe: async () => {
        const observation = await this.#readAction(expectedSessionId, watch);
        return freezeRecord({ action: observation, terminal: observation.kind !== 'wait' });
      },
      poll: WAIT_POLL,
      signal,
    });
    if (result.kind === 'terminal') return result.observation.action;
    return freezeRecord({ kind: 'continue', outcome: 'timed_out', state: action.state });
  }

  async #readAction(sessionId, watch) {
    const state = await watch.readState();
    if (state === null || state.sessionId !== sessionId) return freezeRecord({ kind: 'inactive' });
    try {
      assertStopHookBudget({ hookTimeoutSeconds: this.#hookTimeoutSeconds, timeoutSeconds: state.timeoutSeconds });
    } catch {
      return freezeRecord({ kind: 'continue', outcome: 'integrity_failed', state });
    }
    if (TERMINAL_HANDOFF_PHASES.includes(state.phase)) {
      const outcome = state.phase === 'Success' ? 'succeeded' : (state.outcome ?? 'monitoring_failed');
      return freezeRecord({ kind: 'continue', outcome, state });
    }
    if (!ACTIVE_PHASES.includes(state.phase)) {
      return freezeRecord({ kind: 'continue', outcome: 'integrity_failed', state });
    }
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

  #now() {
    return requireNonNegativeInteger(
      this.#clock(),
      'invalid-process-watch-terminal-waiter-clock',
      Number.MAX_SAFE_INTEGER,
    );
  }
}
