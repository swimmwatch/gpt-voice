import { freezeRecord, runtimeFail } from './runtime-core-support.mjs';
import { ProcessWatchStopHookWatch, probeStopHookProcessLiveness } from './process-watch-stop-hook-watch.mjs';
import { PROCESS_WATCH_SELECTION_STORAGE_ID, ProcessWatchSelectionStore } from './process-watch-selection-store.mjs';
import { WatchRuntimeDirectory } from './watch-runtime-directory.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

/** Finds exactly one state that belongs to the invoking workspace and Codex session. */
export class ProcessWatchStopHookRepository {
  #livenessProbe;
  #runtimeDirectory;
  #selectionStore;
  #storageFactory;
  #workspaceRoot;

  constructor({
    livenessProbe = probeStopHookProcessLiveness,
    runtimeDirectory,
    selectionStore,
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
    this.#selectionStore = selectionStore ?? new ProcessWatchSelectionStore({ workspaceRoot });
    if (
      typeof this.#selectionStore?.read !== 'function' ||
      typeof this.#selectionStore?.consume !== 'function'
    ) {
      runtimeFail('invalid-stop-hook-repository');
    }
    this.#storageFactory = storageFactory;
    this.#workspaceRoot = workspaceRoot;
  }

  async find(input) {
    if (!(await this.#runtimeDirectory.matchesCwd(input.cwd))) return freezeRecord({ kind: 'inactive' });
    const watchIds = await this.#runtimeDirectory.listWatchIds();
    if (!watchIds.includes(PROCESS_WATCH_SELECTION_STORAGE_ID)) return freezeRecord({ kind: 'inactive' });
    const selection = await this.#selectionStore.read();
    if (selection === null || !selection.armed || selection.sessionId !== input.sessionId) {
      return freezeRecord({ kind: 'inactive' });
    }
    const storage = this.#storageFactory({ watchId: selection.watchId, workspaceRoot: this.#workspaceRoot });
    if (!(storage instanceof WatchRuntimeStorage)) runtimeFail('invalid-stop-hook-storage');
    const watch = new ProcessWatchStopHookWatch({ livenessProbe: this.#livenessProbe, storage });
    const state = await watch.readState();
    if (
      state === null ||
      state.sessionId !== selection.sessionId ||
      state.workspaceId !== selection.workspaceId ||
      state.watchId !== selection.watchId
    ) {
      return freezeRecord({ kind: 'inactive' });
    }
    return freezeRecord({ kind: 'matched', state, watch });
  }

  async consume(state) {
    return this.#selectionStore.consume({
      sessionId: state.sessionId,
      watchId: state.watchId,
      workspaceId: state.workspaceId,
    });
  }
}
