import { freezeRecord, runtimeFail } from './runtime-core-support.mjs';
import { ProcessWatchStopHookWatch, probeStopHookProcessLiveness } from './process-watch-stop-hook-watch.mjs';
import { WatchRuntimeDirectory } from './watch-runtime-directory.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

/** Finds exactly one state that belongs to the invoking workspace and Codex session. */
export class ProcessWatchStopHookRepository {
  #livenessProbe;
  #runtimeDirectory;
  #storageFactory;
  #workspaceRoot;

  constructor({
    livenessProbe = probeStopHookProcessLiveness,
    runtimeDirectory,
    storageFactory = (options) => new WatchRuntimeStorage(options),
    workspaceRoot,
  } = {}) {
    if (
      typeof livenessProbe !== 'function' ||
      typeof storageFactory !== 'function' ||
      typeof workspaceRoot !== 'string'
    ) {
      runtimeFail('invalid-stop-hook-repository');
    }
    if (
      runtimeDirectory !== undefined &&
      (typeof runtimeDirectory.matchesCwd !== 'function' || typeof runtimeDirectory.listWatchIds !== 'function')
    ) {
      runtimeFail('invalid-stop-hook-repository');
    }
    this.#livenessProbe = livenessProbe;
    this.#runtimeDirectory = runtimeDirectory ?? new WatchRuntimeDirectory({ workspaceRoot });
    this.#storageFactory = storageFactory;
    this.#workspaceRoot = workspaceRoot;
  }

  async find(input) {
    if (!(await this.#runtimeDirectory.matchesCwd(input.cwd))) return freezeRecord({ kind: 'inactive' });
    const matches = [];
    for (const watchId of await this.#runtimeDirectory.listWatchIds()) {
      const storage = this.#storageFactory({ watchId, workspaceRoot: this.#workspaceRoot });
      if (!(storage instanceof WatchRuntimeStorage)) runtimeFail('invalid-stop-hook-storage');
      const watch = new ProcessWatchStopHookWatch({ livenessProbe: this.#livenessProbe, storage });
      const state = await watch.readState();
      if (state !== null && state.sessionId === input.sessionId && state.phase !== 'Success') {
        matches.push(freezeRecord({ state, watch }));
      }
    }
    if (matches.length === 0) return freezeRecord({ kind: 'inactive' });
    if (matches.length !== 1) return freezeRecord({ kind: 'ambiguous' });
    return freezeRecord({ kind: 'matched', ...matches[0] });
  }
}
