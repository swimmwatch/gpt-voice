import { freezeRecord, isRecord, runtimeFail } from './runtime-core-support.mjs';
import { validateSafeId, validateWatchId } from './runtime-state-contracts.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

export const PROCESS_WATCH_SELECTION_SCHEMA_VERSION = 2;
export const PROCESS_WATCH_SELECTION_STORAGE_ID = 'process-watch-selection';
export const PROCESS_WATCH_SELECTION_FILE_NAME = 'current-watch.json';

function normalizeSelection(value) {
  if (!isRecord(value)) runtimeFail('invalid-process-watch-selection');
  const legacy = value.schemaVersion === 1;
  const fields = new Set(legacy ? ['schemaVersion', 'sessionId', 'watchId', 'workspaceId'] : ['armed', 'schemaVersion', 'sessionId', 'watchId', 'workspaceId']);
  if (Object.keys(value).length !== fields.size) runtimeFail('invalid-process-watch-selection');
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) runtimeFail('invalid-process-watch-selection');
  }
  if (!legacy && value.schemaVersion !== PROCESS_WATCH_SELECTION_SCHEMA_VERSION) {
    runtimeFail('invalid-process-watch-selection');
  }
  if (!legacy && typeof value.armed !== 'boolean') runtimeFail('invalid-process-watch-selection');
  return freezeRecord({
    armed: legacy ? false : value.armed,
    schemaVersion: PROCESS_WATCH_SELECTION_SCHEMA_VERSION,
    sessionId: validateSafeId(value.sessionId, 'invalid-process-watch-selection'),
    watchId: validateWatchId(value.watchId, 'invalid-process-watch-selection'),
    workspaceId: validateSafeId(value.workspaceId, 'invalid-process-watch-selection'),
  });
}

/** Owns the private selection-only pointer to the current watch; it never grants authority. */
export class ProcessWatchSelectionStore {
  #storage;

  constructor({ storage, workspaceRoot } = {}) {
    const selectedStorage =
      storage ?? new WatchRuntimeStorage({ watchId: PROCESS_WATCH_SELECTION_STORAGE_ID, workspaceRoot });
    if (!(selectedStorage instanceof WatchRuntimeStorage)) runtimeFail('invalid-process-watch-selection-store');
    this.#storage = selectedStorage;
  }

  async read() {
    const value = await this.#storage.readJson(PROCESS_WATCH_SELECTION_FILE_NAME);
    return value === null ? null : normalizeSelection(value);
  }

  async write(value) {
    const selection = normalizeSelection({
      ...value,
      armed: true,
      schemaVersion: PROCESS_WATCH_SELECTION_SCHEMA_VERSION,
    });
    await this.#storage.writeJson(PROCESS_WATCH_SELECTION_FILE_NAME, selection);
    return selection;
  }

  async consume({ sessionId, watchId, workspaceId } = {}) {
    const expected = normalizeSelection({
      armed: true,
      schemaVersion: PROCESS_WATCH_SELECTION_SCHEMA_VERSION,
      sessionId,
      watchId,
      workspaceId,
    });
    const current = await this.read();
    if (
      current === null ||
      !current.armed ||
      current.sessionId !== expected.sessionId ||
      current.watchId !== expected.watchId ||
      current.workspaceId !== expected.workspaceId
    ) {
      return false;
    }
    await this.#storage.writeJson(PROCESS_WATCH_SELECTION_FILE_NAME, { ...current, armed: false });
    return true;
  }
}
