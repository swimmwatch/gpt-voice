import { randomBytes } from 'node:crypto';
import process from 'node:process';

import { freezeRecord, isRecord, requireNonNegativeInteger, runtimeFail } from './runtime-core-support.mjs';
import {
  isTerminalPhase,
  normalizeRuntimeState,
  validateProcessStartToken,
  validateSafeId,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const LOCK_FILE_NAME = 'lock.json';
const STATE_FILE_NAME = 'state.json';
const CLEANUP_FILE_NAMES = Object.freeze(['attestation.json', 'events.jsonl', 'receipts.json', STATE_FILE_NAME]);
const LOCK_SCHEMA_VERSION = 1;
const AUDIT_ARCHIVE_FILE_NAME_PATTERN = /^events\.\d+-\d+\.jsonl$/u;

function normalizeClockValue(clock) {
  if (typeof clock !== 'function') runtimeFail('invalid-state-store-clock');
  const value = clock();
  return requireNonNegativeInteger(value, 'invalid-state-store-clock', Number.MAX_SAFE_INTEGER);
}

function normalizeProcessId(value) {
  if (value === null) return null;
  return requireNonNegativeInteger(value, 'invalid-state-store-process-id', Number.MAX_SAFE_INTEGER);
}

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function sameLock(left, right) {
  return (
    left.watchId === right.watchId &&
    left.workspaceId === right.workspaceId &&
    left.sessionId === right.sessionId &&
    left.processStartToken === right.processStartToken &&
    left.pid === right.pid &&
    left.generation === right.generation
  );
}

function normalizeLock(value, expectedWatchId) {
  const code = 'invalid-runtime-lock';
  const lock = assertClosedRecord(
    value,
    new Set([
      'acquiredAtEpochMilliseconds',
      'generation',
      'heartbeatAtEpochMilliseconds',
      'pid',
      'processStartToken',
      'schemaVersion',
      'sessionId',
      'watchId',
      'workspaceId',
    ]),
    code,
  );
  for (const field of [
    'acquiredAtEpochMilliseconds',
    'generation',
    'heartbeatAtEpochMilliseconds',
    'pid',
    'processStartToken',
    'schemaVersion',
    'sessionId',
    'watchId',
    'workspaceId',
  ]) {
    if (!Object.hasOwn(lock, field)) runtimeFail(code);
  }
  if (lock.schemaVersion !== LOCK_SCHEMA_VERSION) runtimeFail(code);
  const watchId = validateWatchId(lock.watchId, code);
  if (watchId !== expectedWatchId) runtimeFail(code);
  return freezeRecord({
    acquiredAtEpochMilliseconds: requireNonNegativeInteger(lock.acquiredAtEpochMilliseconds, code, Number.MAX_SAFE_INTEGER),
    generation: requireNonNegativeInteger(lock.generation, code, 1_000_000_000),
    heartbeatAtEpochMilliseconds: requireNonNegativeInteger(lock.heartbeatAtEpochMilliseconds, code, Number.MAX_SAFE_INTEGER),
    pid: normalizeProcessId(lock.pid),
    processStartToken: validateProcessStartToken(lock.processStartToken, code),
    schemaVersion: LOCK_SCHEMA_VERSION,
    sessionId: validateSafeId(lock.sessionId, code),
    watchId,
    workspaceId: validateSafeId(lock.workspaceId, code),
  });
}

function normalizeLiveness(value) {
  if (!['matching', 'not-running', 'reused', 'unknown'].includes(value)) runtimeFail('invalid-process-liveness-result');
  return value;
}

function createCleanupProcessStartToken() {
  return randomBytes(16).toString('hex');
}

function isCleanupArtifactFileName(fileName) {
  return CLEANUP_FILE_NAMES.includes(fileName) || AUDIT_ARCHIVE_FILE_NAME_PATTERN.test(fileName);
}

/**
 * Owns exclusive lock proof and generation-CAS state writes for one watch
 * directory. State is recovery input only; this class never treats it as proof
 * of target success.
 */
export class AtomicStateStore {
  #clock;
  #exclusiveTail = Promise.resolve();
  #livenessProbe;
  #ownedLock = null;
  #processId;
  #sessionId;
  #storage;
  #workspaceId;

  constructor({
    clock = () => Date.now(),
    livenessProbe,
    processId = process.pid,
    sessionId,
    storage,
    workspaceId,
  } = {}) {
    if (!(storage instanceof WatchRuntimeStorage)) runtimeFail('invalid-state-store-storage');
    if (livenessProbe !== undefined && typeof livenessProbe !== 'function') runtimeFail('invalid-state-store-liveness-probe');
    this.#clock = clock;
    this.#livenessProbe = livenessProbe;
    this.#processId = normalizeProcessId(processId);
    this.#sessionId = validateSafeId(sessionId, 'invalid-state-store-session-id');
    this.#storage = storage;
    this.#workspaceId = validateSafeId(workspaceId, 'invalid-state-store-workspace-id');
  }

  get watchId() {
    return this.#storage.watchId;
  }

  get ownsLock() {
    return this.#ownedLock !== null;
  }

  async acquireLock({ processStartToken }) {
    return this.#runExclusive(() => this.#acquireLock({ processStartToken }));
  }

  async #acquireLock({ processStartToken }) {
    if (this.#ownedLock !== null) runtimeFail('lock-already-owned');
    await this.#storage.initialize();
    const now = normalizeClockValue(this.#clock);
    const lock = freezeRecord({
      acquiredAtEpochMilliseconds: now,
      generation: 0,
      heartbeatAtEpochMilliseconds: now,
      pid: this.#processId,
      processStartToken: validateProcessStartToken(processStartToken, 'invalid-runtime-lock'),
      schemaVersion: LOCK_SCHEMA_VERSION,
      sessionId: this.#sessionId,
      watchId: this.watchId,
      workspaceId: this.#workspaceId,
    });
    const created = await this.#storage.createExclusiveJson(LOCK_FILE_NAME, lock);
    if (!created) {
      await this.#readExistingLockForOwnership();
      runtimeFail('lock-already-held');
    }
    this.#ownedLock = lock;
    return lock;
  }

  async inspectLock() {
    let lock;
    try {
      lock = await this.#readLock();
    } catch {
      return freezeRecord({ kind: 'ambiguous' });
    }
    if (lock === null) return freezeRecord({ kind: 'missing' });
    if (this.#livenessProbe === undefined) return freezeRecord({ generation: lock.generation, kind: 'unknown' });
    let liveness;
    try {
      liveness = normalizeLiveness(await this.#livenessProbe(freezeRecord({ pid: lock.pid, startToken: lock.processStartToken })));
    } catch {
      return freezeRecord({ generation: lock.generation, kind: 'unknown' });
    }
    return freezeRecord({ generation: lock.generation, kind: liveness });
  }

  async readState() {
    let value;
    try {
      value = await this.#storage.readJson(STATE_FILE_NAME);
      if (value === null) return null;
      return normalizeRuntimeState(value, { expectedWatchId: this.watchId });
    } catch {
      runtimeFail('state-corrupt');
    }
  }

  async writeInitialState(state) {
    return this.#runExclusive(() => this.#writeInitialState(state));
  }

  async #writeInitialState(state) {
    await this.#assertOwnership(0);
    const existingState = await this.readState();
    if (existingState !== null) runtimeFail('state-already-exists');
    const normalizedState = normalizeRuntimeState(state, { expectedWatchId: this.watchId });
    this.#assertStateOwnership(normalizedState, 0);
    await this.#storage.writeJson(STATE_FILE_NAME, normalizedState);
    return normalizedState;
  }

  async compareAndSwap({ expectedGeneration, state }) {
    return this.#runExclusive(() => this.#compareAndSwap({ expectedGeneration, state }));
  }

  async #compareAndSwap({ expectedGeneration, state }) {
    const expected = requireNonNegativeInteger(expectedGeneration, 'invalid-state-generation', 1_000_000_000);
    await this.#assertOwnership(expected);
    const currentState = await this.readState();
    if (currentState === null || currentState.generation !== expected) runtimeFail('state-generation-conflict');
    const normalizedState = normalizeRuntimeState(state, { expectedWatchId: this.watchId });
    this.#assertStateOwnership(normalizedState, expected + 1);
    await this.#storage.writeJson(STATE_FILE_NAME, normalizedState);
    await this.#replaceOwnedLock(expected + 1);
    return normalizedState;
  }

  async assertOwnership(expectedGeneration) {
    const generation = requireNonNegativeInteger(expectedGeneration, 'invalid-state-generation', 1_000_000_000);
    return this.#runExclusive(() => this.#assertOwnership(generation));
  }

  async withOwnership({ expectedGeneration, operation } = {}) {
    const generation = requireNonNegativeInteger(expectedGeneration, 'invalid-state-generation', 1_000_000_000);
    if (typeof operation !== 'function') runtimeFail('invalid-state-store-operation');
    return this.#runExclusive(async () => {
      await this.#assertOwnership(generation);
      const result = await operation();
      await this.#assertOwnership(generation);
      return result;
    });
  }

  async releaseLock() {
    return this.#runExclusive(() => this.#releaseLock());
  }

  async #releaseLock() {
    const ownedLock = this.#ownedLock;
    if (ownedLock === null) return false;
    await this.#assertOwnership(ownedLock.generation);
    const removed = await this.#storage.removeRegularFile(LOCK_FILE_NAME);
    if (!removed) runtimeFail('lock-ownership-mismatch');
    this.#ownedLock = null;
    return true;
  }

  /** Claims an unowned watch before removing only known, expired regular files. */
  async cleanupExpired({ retentionMilliseconds }) {
    return this.#runExclusive(() => this.#cleanupExpired({ retentionMilliseconds }));
  }

  async #cleanupExpired({ retentionMilliseconds }) {
    const retention = requireNonNegativeInteger(retentionMilliseconds, 'invalid-cleanup-retention', 604_800_000);
    if (this.#ownedLock !== null) return freezeRecord({ kind: 'preserved-active-lock' });
    try {
      await this.#acquireLock({ processStartToken: createCleanupProcessStartToken() });
    } catch (error) {
      if (error?.code !== 'lock-already-held') return freezeRecord({ kind: 'preserved-ambiguous-lock' });
      const inspection = await this.inspectLock();
      if (inspection.kind === 'missing') return freezeRecord({ kind: 'preserved-ambiguous-lock' });
      return freezeRecord({ kind: 'preserved-lock', lock: inspection.kind });
    }

    let state;
    try {
      const entries = await this.#storage.listEntries();
      const hasUnknownArtifact = entries.some(
        (entry) => entry.name !== LOCK_FILE_NAME && (entry.kind !== 'file' || !isCleanupArtifactFileName(entry.name)),
      );
      if (hasUnknownArtifact) return freezeRecord({ kind: 'preserved-ambiguous-artifacts' });

      try {
        state = await this.readState();
      } catch {
        return freezeRecord({ kind: 'preserved-ambiguous-state' });
      }
      const artifactFileNames = entries
        .filter((entry) => entry.name !== LOCK_FILE_NAME)
        .map((entry) => entry.name);
      if (state === null) {
        return artifactFileNames.length === 0
          ? freezeRecord({ kind: 'nothing-to-clean' })
          : freezeRecord({ kind: 'preserved-ambiguous-artifacts' });
      }
      const now = normalizeClockValue(this.#clock);
      if (!isTerminalPhase(state.phase) || now < state.deadlineEpochMilliseconds + retention) {
        return freezeRecord({ kind: 'preserved-active-state' });
      }

      let removedCount = 0;
      for (const fileName of [...artifactFileNames.filter((fileName) => fileName !== STATE_FILE_NAME), STATE_FILE_NAME]) {
        if (await this.#storage.removeRegularFile(fileName)) removedCount += 1;
      }
      return freezeRecord({ kind: 'removed-expired-artifacts', removedCount });
    } catch {
      return freezeRecord({ kind: 'preserved-ambiguous-artifacts' });
    } finally {
      await this.#releaseLock();
    }
  }

  async #assertOwnership(expectedGeneration) {
    const ownedLock = this.#ownedLock;
    if (ownedLock === null || ownedLock.generation !== expectedGeneration) runtimeFail('lock-ownership-mismatch');
    const currentLock = await this.#readExistingLockForOwnership();
    if (!sameLock(currentLock, ownedLock)) runtimeFail('lock-ownership-mismatch');
  }

  async #replaceOwnedLock(generation) {
    const ownedLock = this.#ownedLock;
    if (ownedLock === null) runtimeFail('lock-ownership-mismatch');
    const currentLock = await this.#readExistingLockForOwnership();
    if (!sameLock(currentLock, ownedLock)) runtimeFail('lock-ownership-mismatch');
    const replacement = freezeRecord({
      ...ownedLock,
      generation,
      heartbeatAtEpochMilliseconds: normalizeClockValue(this.#clock),
    });
    try {
      await this.#storage.writeJson(LOCK_FILE_NAME, replacement);
    } catch {
      runtimeFail('lock-state-diverged');
    }
    this.#ownedLock = replacement;
  }

  async #readExistingLockForOwnership() {
    const lock = await this.#readLock();
    if (lock === null) runtimeFail('lock-ownership-mismatch');
    return lock;
  }

  async #readLock() {
    try {
      const value = await this.#storage.readJson(LOCK_FILE_NAME);
      if (value === null) return null;
      return normalizeLock(value, this.watchId);
    } catch {
      runtimeFail('lock-ambiguous');
    }
  }

  #assertStateOwnership(state, generation) {
    if (
      state.generation !== generation ||
      state.workspaceId !== this.#workspaceId ||
      state.sessionId !== this.#sessionId ||
      state.heartbeat.startToken !== this.#ownedLock?.processStartToken
    ) {
      runtimeFail('invalid-state-ownership');
    }
  }

  #runExclusive(operation) {
    const result = this.#exclusiveTail.then(operation);
    this.#exclusiveTail = result.catch(() => undefined);
    return result;
  }
}

export { LOCK_FILE_NAME, STATE_FILE_NAME };
