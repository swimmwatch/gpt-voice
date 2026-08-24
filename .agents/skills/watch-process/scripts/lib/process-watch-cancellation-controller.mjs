import { AtomicStateStore } from './atomic-state-store.mjs';
import { AuditJournal } from './audit-journal.mjs';
import {
  REPAIR_CANCELLATION_FILE_NAME,
  REPAIR_CONTROL_SCHEMA_VERSION,
} from './repair-control-contracts.mjs';
import { ProcessWatchTransitionTable } from './process-watch-transition-table.mjs';
import { freezeRecord, requireNonNegativeInteger, runtimeFail } from './runtime-core-support.mjs';
import {
  validateProcessStartToken,
  validateSafeId,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const CANCELLABLE_REPAIR_PHASES = new Set(['Repairing', 'Verifying', 'Restarting']);

function cancellationResult(state) {
  return freezeRecord({
    blocker: state.blocker,
    generation: state.generation,
    outcome: state.outcome,
    phase: state.phase,
    watchId: state.watchId,
  });
}

/** Cancels monitoring at a safe boundary without loading the mutable scenario or watcher library. */
export class ProcessWatchCancellationController {
  #auditJournal;
  #clock;
  #processStartToken;
  #sessionId;
  #stateStore;
  #storage;
  #transitionTable;
  #watchId;

  constructor({
    clock = () => Date.now(),
    processStartToken,
    sessionId,
    stateStore,
    storage,
    transitionTable = new ProcessWatchTransitionTable(),
  } = {}) {
    if (
      typeof clock !== 'function' ||
      !(stateStore instanceof AtomicStateStore) ||
      !(storage instanceof WatchRuntimeStorage) ||
      !(transitionTable instanceof ProcessWatchTransitionTable)
    ) {
      runtimeFail('invalid-process-watch-cancellation-controller');
    }
    if (stateStore.watchId !== storage.watchId) runtimeFail('invalid-process-watch-cancellation-controller');
    this.#clock = clock;
    this.#processStartToken = validateProcessStartToken(
      processStartToken,
      'invalid-process-watch-cancellation-controller',
    );
    this.#sessionId = validateSafeId(sessionId, 'invalid-process-watch-cancellation-controller');
    this.#stateStore = stateStore;
    this.#storage = storage;
    this.#transitionTable = transitionTable;
    this.#watchId = validateWatchId(storage.watchId, 'invalid-process-watch-cancellation-controller');
    this.#auditJournal = new AuditJournal({ clock, stateStore, storage });
  }

  async cancel() {
    const state = await this.#stateStore.readState();
    if (state === null || (!CANCELLABLE_REPAIR_PHASES.has(state.phase) && state.phase !== 'Watching')) {
      return state === null ? freezeRecord({ phase: null }) : cancellationResult(state);
    }
    await this.#writeRequest();
    if (state.phase === 'Watching') return freezeRecord({ phase: state.phase, status: 'cancel-requested' });
    return this.#cancelAtSafeBoundary(state);
  }

  async #cancelAtSafeBoundary(initialState) {
    let acquired = false;
    try {
      await this.#stateStore.acquireLock({ processStartToken: this.#processStartToken });
      acquired = true;
      const state = await this.#stateStore.readState();
      if (state === null) return freezeRecord({ phase: null });
      if (!CANCELLABLE_REPAIR_PHASES.has(state.phase)) {
        await this.#storage.removeRegularFile(REPAIR_CANCELLATION_FILE_NAME).catch(() => undefined);
        return cancellationResult(state);
      }
      const transition = this.#transitionTable.assert({
        fromPhase: state.phase,
        outcome: 'user_cancelled',
        toPhase: 'Cancelled',
      });
      const next = freezeRecord({
        ...state,
        blocker: transition.blocker,
        generation: state.generation + 1,
        heartbeat: freezeRecord({ atEpochMilliseconds: this.#now(), startToken: this.#processStartToken }),
        outcome: transition.outcome,
        phase: transition.toPhase,
      });
      const cancelled = await this.#stateStore.compareAndSwap({ expectedGeneration: state.generation, state: next });
      await this.#auditJournal.append({
        event: freezeRecord({
          actor: 'agent',
          generation: cancelled.generation,
          libraryDigest: cancelled.libraryDigest,
          outcome: cancelled.outcome,
          phase: cancelled.phase,
          previousPhase: state.phase,
          receiptId: cancelled.receiptIds.at(-1) ?? null,
          scenarioDigest: cancelled.scenarioDigest,
          scriptDigest: cancelled.scriptDigest,
          sourceSha: cancelled.target?.sourceSha ?? null,
          summaryCode: 'watch-cancelled',
          targetIdentityDigest: cancelled.target?.identityDigest ?? null,
        }),
        expectedGeneration: cancelled.generation,
      });
      await this.#storage.removeRegularFile(REPAIR_CANCELLATION_FILE_NAME).catch(() => undefined);
      return cancellationResult(cancelled);
    } catch (error) {
      if (error?.code === 'lock-already-held' || error?.code === 'lock-already-owned') {
        return freezeRecord({ phase: initialState.phase, status: 'cancel-requested' });
      }
      throw error;
    } finally {
      if (acquired) await this.#stateStore.releaseLock();
    }
  }

  async #writeRequest() {
    await this.#storage.writeJson(REPAIR_CANCELLATION_FILE_NAME, {
      requestedAtEpochMilliseconds: this.#now(),
      schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION,
      sessionId: this.#sessionId,
      watchId: this.#watchId,
    });
  }

  #now() {
    return requireNonNegativeInteger(
      this.#clock(),
      'invalid-process-watch-cancellation-controller-clock',
      Number.MAX_SAFE_INTEGER,
    );
  }
}
