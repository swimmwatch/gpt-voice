import { AtomicStateStore } from './atomic-state-store.mjs';
import { GitWorktreeInspector } from './git-worktree-inspector.mjs';
import { REPAIR_CONTROL_SCHEMA_VERSION, REPAIR_OWNERSHIP_FILE_NAME } from './repair-control-contracts.mjs';
import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { validateDigest, validateSourceSha, validateWatchId } from './runtime-state-contracts.mjs';
import { RepairScope, normalizeWorkspaceRelativePath } from './scenario-repair-scope.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const MAX_REPAIR_FILES = 500;
const MAX_REPAIR_LEDGER_BYTES = 524_288;
const OWNERSHIP_STATUSES = new Set(['armed', 'write-open', 'tracked', 'delivered']);

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function assertRequiredFields(value, fields, code) {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) runtimeFail(code);
  }
}

function normalizePath(value, code) {
  try {
    return normalizeWorkspaceRelativePath(value, '$.repairPath');
  } catch {
    runtimeFail(code);
  }
}

function normalizeFileIdentity(value, code) {
  const identity = assertClosedRecord(value, new Set(['byteLength', 'contentDigest', 'exists', 'mode', 'path']), code);
  assertRequiredFields(identity, ['byteLength', 'contentDigest', 'exists', 'mode', 'path'], code);
  const exists = typeof identity.exists === 'boolean' ? identity.exists : runtimeFail(code);
  const byteLength = requireNonNegativeInteger(identity.byteLength, code, 10_485_760);
  const path = normalizePath(identity.path, code);
  if (!exists) {
    if (byteLength !== 0 || identity.contentDigest !== null || identity.mode !== null) runtimeFail(code);
    return freezeRecord({ byteLength, contentDigest: null, exists, mode: null, path });
  }
  return freezeRecord({
    byteLength,
    contentDigest: validateDigest(identity.contentDigest, code),
    exists,
    mode: requireNonNegativeInteger(identity.mode, code, 0o7777),
    path,
  });
}

function sameFileIdentity(left, right) {
  return GitWorktreeInspector.sameFileIdentity(left, right);
}

function normalizeSnapshot(value, code) {
  const snapshot = assertClosedRecord(value, new Set(['changedFiles', 'diffDigest', 'files', 'headSha']), code);
  assertRequiredFields(snapshot, ['changedFiles', 'diffDigest', 'files', 'headSha'], code);
  if (
    !Array.isArray(snapshot.changedFiles) ||
    !Array.isArray(snapshot.files) ||
    snapshot.changedFiles.length > MAX_REPAIR_FILES
  ) {
    runtimeFail(code);
  }
  const changedFiles = snapshot.changedFiles.map((candidate) => normalizePath(candidate, code)).sort();
  const files = snapshot.files
    .map((entry) => normalizeFileIdentity(entry, code))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (
    new Set(changedFiles).size !== changedFiles.length ||
    new Set(files.map((entry) => entry.path)).size !== files.length ||
    files.length !== changedFiles.length ||
    files.some((entry, index) => entry.path !== changedFiles[index])
  ) {
    runtimeFail(code);
  }
  return freezeRecord({
    changedFiles: freezeArray(changedFiles),
    diffDigest: validateDigest(snapshot.diffDigest, code),
    files: freezeArray(files),
    headSha: validateSourceSha(snapshot.headSha, code),
  });
}

function normalizeOwnedFile(value, code) {
  const entry = assertClosedRecord(value, new Set(['base', 'current', 'path']), code);
  assertRequiredFields(entry, ['base', 'current', 'path'], code);
  const path = normalizePath(entry.path, code);
  const base = normalizeFileIdentity(entry.base, code);
  const current = normalizeFileIdentity(entry.current, code);
  if (base.path !== path || current.path !== path) runtimeFail(code);
  return freezeRecord({ base, current, path });
}

function normalizeOpenWrite(value, code) {
  if (value === null) return null;
  const openWrite = assertClosedRecord(value, new Set(['before', 'candidateFiles', 'candidatePaths']), code);
  assertRequiredFields(openWrite, ['before', 'candidateFiles', 'candidatePaths'], code);
  if (!Array.isArray(openWrite.candidatePaths) || !Array.isArray(openWrite.candidateFiles)) runtimeFail(code);
  const candidatePaths = openWrite.candidatePaths.map((candidate) => normalizePath(candidate, code)).sort();
  const candidateFiles = openWrite.candidateFiles
    .map((entry) => normalizeFileIdentity(entry, code))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (
    candidatePaths.length === 0 ||
    candidatePaths.length > MAX_REPAIR_FILES ||
    new Set(candidatePaths).size !== candidatePaths.length ||
    candidateFiles.length !== candidatePaths.length ||
    candidateFiles.some((entry, index) => entry.path !== candidatePaths[index])
  ) {
    runtimeFail(code);
  }
  return freezeRecord({
    before: normalizeSnapshot(openWrite.before, code),
    candidateFiles: freezeArray(candidateFiles),
    candidatePaths: freezeArray(candidatePaths),
  });
}

function normalizeOwnershipRecord(value, { scenarioDigest, watchId }) {
  const code = 'repair-ownership-corrupt';
  const record = assertClosedRecord(
    value,
    new Set(['baseline', 'latest', 'openWrite', 'ownedFiles', 'scenarioDigest', 'schemaVersion', 'status', 'watchId']),
    code,
  );
  assertRequiredFields(
    record,
    ['baseline', 'latest', 'openWrite', 'ownedFiles', 'scenarioDigest', 'schemaVersion', 'status', 'watchId'],
    code,
  );
  if (
    record.schemaVersion !== REPAIR_CONTROL_SCHEMA_VERSION ||
    validateWatchId(record.watchId, code) !== watchId ||
    validateDigest(record.scenarioDigest, code) !== scenarioDigest ||
    !OWNERSHIP_STATUSES.has(record.status) ||
    !Array.isArray(record.ownedFiles) ||
    record.ownedFiles.length > MAX_REPAIR_FILES
  ) {
    runtimeFail(code);
  }
  const ownedFiles = record.ownedFiles
    .map((entry) => normalizeOwnedFile(entry, code))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(ownedFiles.map((entry) => entry.path)).size !== ownedFiles.length) runtimeFail(code);
  const openWrite = normalizeOpenWrite(record.openWrite, code);
  if ((record.status === 'write-open') !== (openWrite !== null)) runtimeFail(code);
  if (record.status !== 'write-open' && openWrite !== null) runtimeFail(code);
  return freezeRecord({
    baseline: normalizeSnapshot(record.baseline, code),
    latest: normalizeSnapshot(record.latest, code),
    openWrite,
    ownedFiles: freezeArray(ownedFiles),
    scenarioDigest,
    schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION,
    status: record.status,
    watchId,
  });
}

function samePaths(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function summaryForRecord(record) {
  const patchDigest = digestNormalizedValue('gpt-voice/watch-process/repair-patch/v1', {
    files: record.ownedFiles.map((entry) => ({
      base: entry.base.contentDigest,
      current: entry.current.contentDigest,
      path: entry.path,
    })),
    worktreeDigest: record.latest.diffDigest,
  });
  const bytesChanged = record.ownedFiles.reduce(
    (total, entry) => total + entry.base.byteLength + entry.current.byteLength,
    0,
  );
  return freezeRecord({
    bytesChanged,
    changedFileCount: record.ownedFiles.length,
    headSha: record.latest.headSha,
    patchDigest,
    worktreeDigest: record.latest.diffDigest,
  });
}

/** Records only hashes and safe relative paths around agent-owned forward repairs. */
export class RepairOwnershipLedger {
  #repairScope;
  #scenarioDigest;
  #stateStore;
  #storage;
  #watchId;
  #workspaceRoot;
  #worktreeInspector;

  constructor({ repair, scenarioDigest, stateStore, storage, workspaceRoot, worktreeInspector } = {}) {
    if (!(stateStore instanceof AtomicStateStore) || !(storage instanceof WatchRuntimeStorage)) {
      runtimeFail('invalid-repair-ownership-ledger');
    }
    if (!(worktreeInspector instanceof GitWorktreeInspector) || typeof workspaceRoot !== 'string') {
      runtimeFail('invalid-repair-ownership-ledger');
    }
    this.#repairScope = new RepairScope(repair);
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-repair-ownership-ledger');
    this.#stateStore = stateStore;
    this.#storage = storage;
    this.#watchId = validateWatchId(storage.watchId, 'invalid-repair-ownership-ledger');
    this.#workspaceRoot = workspaceRoot;
    this.#worktreeInspector = worktreeInspector;
  }

  async arm({ expectedGeneration, timeoutMilliseconds } = {}) {
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const existing = await this.#readOptional();
        if (existing !== null && existing.status !== 'delivered') runtimeFail('repair-ownership-existing');
        const snapshot = await this.#worktreeInspector.assertClean({ timeoutMilliseconds });
        const record = freezeRecord({
          baseline: snapshot,
          latest: snapshot,
          openWrite: null,
          ownedFiles: freezeArray([]),
          scenarioDigest: this.#scenarioDigest,
          schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION,
          status: 'armed',
          watchId: this.#watchId,
        });
        await this.#write(record);
        return summaryForRecord(record);
      },
    });
  }

  async beginWrite({ candidatePaths, expectedGeneration, timeoutMilliseconds } = {}) {
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const record = await this.#read();
        if (record.status === 'write-open' || record.status === 'delivered') runtimeFail('repair-write-not-available');
        const normalizedPaths = await this.#validateCandidatePaths(candidatePaths);
        const before = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
        if (!GitWorktreeInspector.sameSnapshot(record.latest, before)) runtimeFail('repair-external-change');
        const candidateFiles = await this.#worktreeInspector.snapshotFiles(normalizedPaths);
        const next = freezeRecord({
          ...record,
          openWrite: freezeRecord({ before, candidateFiles, candidatePaths: normalizedPaths }),
          status: 'write-open',
        });
        await this.#write(next);
        return freezeRecord({ candidateCount: normalizedPaths.length, worktreeDigest: before.diffDigest });
      },
    });
  }

  async completeWrite({ candidatePaths, expectedGeneration, timeoutMilliseconds } = {}) {
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const record = await this.#read();
        if (record.status !== 'write-open' || record.openWrite === null) runtimeFail('repair-write-not-open');
        const normalizedPaths = await this.#validateCandidatePaths(candidatePaths);
        if (!samePaths(record.openWrite.candidatePaths, normalizedPaths))
          runtimeFail('repair-write-candidates-changed');
        const after = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
        this.#assertWriteWindow(record, after);
        const next = this.#completeRecord(record, after);
        await this.#write(next);
        return summaryForRecord(next);
      },
    });
  }

  async assertStable({ expectedGeneration, timeoutMilliseconds } = {}) {
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const record = await this.#read();
        if (record.status === 'write-open') runtimeFail('repair-write-unresolved');
        if (record.status === 'delivered') return summaryForRecord(record);
        const current = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
        if (!GitWorktreeInspector.sameSnapshot(record.latest, current)) runtimeFail('repair-external-change');
        const identities = await this.#worktreeInspector.snapshotFiles(record.ownedFiles.map((entry) => entry.path));
        for (const [index, identity] of identities.entries()) {
          if (!sameFileIdentity(identity, record.ownedFiles[index].current)) runtimeFail('repair-external-change');
        }
        return summaryForRecord(record);
      },
    });
  }

  async markDelivered({ expectedGeneration, newHeadSha, timeoutMilliseconds } = {}) {
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const record = await this.#read();
        const snapshot = await this.#worktreeInspector.assertClean({ timeoutMilliseconds });
        if (snapshot.headSha !== validateSourceSha(newHeadSha, 'invalid-delivered-head'))
          runtimeFail('delivery-head-mismatch');
        const next = freezeRecord({ ...record, latest: snapshot, openWrite: null, status: 'delivered' });
        await this.#write(next);
        return summaryForRecord(next);
      },
    });
  }

  async summary() {
    return summaryForRecord(await this.#read());
  }

  #assertWriteWindow(record, after) {
    const openWrite = record.openWrite;
    if (openWrite === null || openWrite.before.headSha !== after.headSha) runtimeFail('repair-external-change');
    const previousPaths = new Set(record.latest.changedFiles);
    const candidates = new Set(openWrite.candidatePaths);
    for (const path of after.changedFiles) {
      if (!previousPaths.has(path) && !candidates.has(path)) runtimeFail('repair-external-change');
    }
    for (const path of previousPaths) {
      if (!after.changedFiles.includes(path) && !candidates.has(path)) runtimeFail('repair-external-change');
    }
  }

  #completeRecord(record, after) {
    const openWrite = record.openWrite;
    if (openWrite === null) runtimeFail('repair-write-not-open');
    const priorByPath = new Map(record.ownedFiles.map((entry) => [entry.path, entry]));
    const candidateBeforeByPath = new Map(openWrite.candidateFiles.map((entry) => [entry.path, entry]));
    const afterByPath = new Map(after.files.map((entry) => [entry.path, entry]));
    const ownedFiles = [];
    const patchFiles = [];
    let bytesChanged = 0;
    for (const path of after.changedFiles) {
      if (!this.#repairScope.includes(path)) runtimeFail('repair-path-outside-scope');
      const prior = priorByPath.get(path);
      const base = prior?.base ?? candidateBeforeByPath.get(path);
      const current = afterByPath.get(path);
      if (base === undefined || current === undefined) runtimeFail('repair-external-change');
      let operation = 'modify';
      if (!base.exists && current.exists) operation = 'create';
      if (base.exists && !current.exists) operation = 'delete';
      bytesChanged += base.byteLength + current.byteLength;
      ownedFiles.push(freezeRecord({ base, current, path }));
      patchFiles.push(freezeRecord({ operation, path }));
    }
    this.#repairScope.assertPatch({ bytesChanged, files: patchFiles });
    return freezeRecord({
      ...record,
      latest: after,
      openWrite: null,
      ownedFiles: freezeArray(ownedFiles),
      status: 'tracked',
    });
  }

  async #read() {
    const value = await this.#storage.readJson(REPAIR_OWNERSHIP_FILE_NAME, { maximumBytes: MAX_REPAIR_LEDGER_BYTES });
    if (value === null) runtimeFail('repair-ownership-missing');
    return normalizeOwnershipRecord(value, { scenarioDigest: this.#scenarioDigest, watchId: this.#watchId });
  }

  async #readOptional() {
    const value = await this.#storage.readJson(REPAIR_OWNERSHIP_FILE_NAME, { maximumBytes: MAX_REPAIR_LEDGER_BYTES });
    return value === null
      ? null
      : normalizeOwnershipRecord(value, { scenarioDigest: this.#scenarioDigest, watchId: this.#watchId });
  }

  async #validateCandidatePaths(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_REPAIR_FILES)
      runtimeFail('invalid-repair-candidates');
    const paths = value.map((candidate) => normalizePath(candidate, 'invalid-repair-candidates')).sort();
    if (new Set(paths).size !== paths.length) runtimeFail('invalid-repair-candidates');
    for (const candidatePath of paths) {
      await this.#repairScope.assertCandidatePath({ candidatePath, workspaceRoot: this.#workspaceRoot });
    }
    return freezeArray(paths);
  }

  async #write(record) {
    await this.#storage.writeJson(REPAIR_OWNERSHIP_FILE_NAME, record, { maximumBytes: MAX_REPAIR_LEDGER_BYTES });
  }
}
