import process from 'node:process';

import { AtomicStateStore } from './atomic-state-store.mjs';
import {
  normalizeStopHookAcknowledgement,
  STOP_HOOK_ACKNOWLEDGEMENT_FILE_NAME,
} from './process-watch-stop-hook-contracts.mjs';
import { normalizeRuntimeState } from './runtime-state-contracts.mjs';
import { runtimeFail } from './runtime-core-support.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

/** Reports only whether the operating system can disprove the lock owner's PID. */
export function probeStopHookProcessLiveness({ pid }) {
  try {
    process.kill(pid, 0);
    // The OS can prove only that a PID exists. A lock token cannot be rebuilt
    // from that PID, so preserve uncertainty instead of claiming a match.
    return 'unknown';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'not-running' : 'unknown';
  }
}

/** Owns one matched watch's state reads, lock liveness check, and acknowledgement record. */
export class ProcessWatchStopHookWatch {
  #livenessProbe;
  #storage;

  constructor({ livenessProbe = probeStopHookProcessLiveness, storage } = {}) {
    if (!(storage instanceof WatchRuntimeStorage) || typeof livenessProbe !== 'function') {
      runtimeFail('invalid-stop-hook-watch');
    }
    this.#livenessProbe = livenessProbe;
    this.#storage = storage;
  }

  async inspectWatcher(state) {
    const store = new AtomicStateStore({
      livenessProbe: this.#livenessProbe,
      sessionId: state.sessionId,
      storage: this.#storage,
      workspaceId: state.workspaceId,
    });
    return store.inspectLock();
  }

  async readAcknowledgement() {
    const value = await this.#storage.readJson(STOP_HOOK_ACKNOWLEDGEMENT_FILE_NAME);
    return value === null ? null : normalizeStopHookAcknowledgement(value);
  }

  async readState() {
    const value = await this.#storage.readJson('state.json');
    return value === null ? null : normalizeRuntimeState(value, { expectedWatchId: this.#storage.watchId });
  }

  async writeAcknowledgement(acknowledgement) {
    await this.#storage.writeJson(
      STOP_HOOK_ACKNOWLEDGEMENT_FILE_NAME,
      normalizeStopHookAcknowledgement(acknowledgement),
    );
  }
}
