import {
  isStopHookAcknowledged,
  normalizeStopHookInput,
  stopHookContinuation,
} from './process-watch-stop-hook-contracts.mjs';
import { ProcessWatchTerminalWaiter } from './process-watch-terminal-waiter.mjs';
import { assertAbortSignal, freezeRecord, runtimeFail } from './runtime-core-support.mjs';

const MAX_RECONCILIATION_ATTEMPTS = 3;

function fallbackOutcome(state) {
  if (state.phase === 'Success') return 'succeeded';
  return state.outcome === null || state.outcome === 'running' ? 'monitoring_failed' : state.outcome;
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

/** Waits once per active Codex turn and emits one exact terminal continuation. */
export class ProcessWatchStopHook {
  #repository;
  #waiter;

  constructor({ clock = () => Date.now(), deadlineFactory, hookTimeoutSeconds, poller, repository, waiter } = {}) {
    if (repository === null || typeof repository?.find !== 'function' || typeof repository?.consume !== 'function') {
      runtimeFail('invalid-stop-hook');
    }
    this.#repository = repository;
    this.#waiter =
      waiter ??
      new ProcessWatchTerminalWaiter({
        clock,
        ...(deadlineFactory === undefined ? {} : { deadlineFactory }),
        ...(hookTimeoutSeconds === undefined ? {} : { hookTimeoutSeconds }),
        ...(poller === undefined ? {} : { poller }),
      });
    if (typeof this.#waiter?.wait !== 'function') runtimeFail('invalid-stop-hook');
  }

  async handle(value, { signal } = {}) {
    let input = null;
    let match = null;
    try {
      assertAbortSignal(signal);
      input = normalizeStopHookInput(value);
      if (signal?.aborted) return freezeRecord({});
      match = await this.#repository.find(input);
      if (match.kind !== 'matched') return freezeRecord({});
      return await this.#handleMatch(input, match.watch, signal);
    } catch {
      if (input !== null && match?.kind === 'matched' && !signal?.aborted) {
        try {
          return await this.#reportMatchedFailure(input, match.watch);
        } catch {
          // A failure before an identity-bound acknowledgement must stay
          // neutral; an unvalidated continuation would grant no safe action.
        }
      }
      return freezeRecord({});
    }
  }

  async #reportMatchedFailure(input, watch) {
    const state = await watch.readState();
    if (state === null || state.sessionId !== input.sessionId) return freezeRecord({});
    const outcome = fallbackOutcome(state);
    const acknowledgement = await this.#acknowledge(input, watch, freezeRecord({ outcome, state }));
    return acknowledgement.kind === 'complete' ? acknowledgement.output : freezeRecord({});
  }

  async #acknowledge(input, watch, action) {
    const acknowledgementState = await watch.readState();
    if (!isSameState(acknowledgementState, action.state)) return freezeRecord({ kind: 'retry' });
    const existing = await watch.readAcknowledgement();
    if (isStopHookAcknowledged(existing, { ...acknowledgementState, outcome: action.outcome })) {
      await this.#repository.consume(acknowledgementState);
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
    if (!(await this.#repository.consume(acknowledgementState))) {
      return freezeRecord({ kind: 'complete', output: freezeRecord({}) });
    }
    return freezeRecord({
      kind: 'complete',
      output: stopHookContinuation({
        generation: acknowledgementState.generation,
        outcome: action.outcome,
        watchId: acknowledgementState.watchId,
      }),
    });
  }

  async #handleMatch(input, watch, signal) {
    for (let attempt = 0; attempt < MAX_RECONCILIATION_ATTEMPTS; attempt += 1) {
      const action = await this.#waiter.wait({ sessionId: input.sessionId, signal, watch });
      if (action.kind === 'inactive') return freezeRecord({});

      const acknowledgement = await this.#acknowledge(input, watch, action);
      if (acknowledgement.kind === 'complete') return acknowledgement.output;
    }
    return freezeRecord({});
  }
}
