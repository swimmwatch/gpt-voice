import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import {
  OPERATION_RECEIPT_SCHEMA_VERSION,
  validateDigest,
  validateOperationKind,
  validateReceiptId,
  validateSourceSha,
  validateTargetId,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import { AtomicStateStore } from './atomic-state-store.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const RECEIPTS_FILE_NAME = 'receipts.json';
const LEGACY_OPERATION_RECEIPT_SCHEMA_VERSION = 1;
const MAX_OPERATION_RECORDS = 100;
const MAX_RECEIPT_FILE_BYTES = 262_144;

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function assertRequiredFields(record, fields, code) {
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) runtimeFail(code);
  }
}

function normalizeNullableSourceSha(value, code) {
  if (value === null) return null;
  return validateSourceSha(value, code);
}

function normalizeOperation(value, expectedWatchId) {
  const code = 'invalid-operation-intent';
  const operation = assertClosedRecord(
    value,
    new Set(['fixedInputsDigest', 'generation', 'kind', 'scenarioDigest', 'sourceSha', 'watchId']),
    code,
  );
  assertRequiredFields(
    operation,
    ['fixedInputsDigest', 'generation', 'kind', 'scenarioDigest', 'sourceSha', 'watchId'],
    code,
  );
  const watchId = validateWatchId(operation.watchId, code);
  if (watchId !== expectedWatchId) runtimeFail(code);
  return freezeRecord({
    fixedInputsDigest: validateDigest(operation.fixedInputsDigest, code),
    generation: requireNonNegativeInteger(operation.generation, code, 1_000_000_000),
    kind: validateOperationKind(operation.kind, code),
    scenarioDigest: validateDigest(operation.scenarioDigest, code),
    sourceSha: normalizeNullableSourceSha(operation.sourceSha, code),
    watchId,
  });
}

function operationKeyFor(operation) {
  return digestNormalizedValue('gpt-voice/watch-process/operation-key/v1', {
    fixedInputsDigest: operation.fixedInputsDigest,
    generation: operation.generation,
    kind: operation.kind,
    scenarioDigest: operation.scenarioDigest,
    sourceSha: operation.sourceSha,
    watchId: operation.watchId,
  });
}

export function createOperationKey(operation) {
  const watchId = validateWatchId(operation?.watchId, 'invalid-operation-intent');
  return operationKeyFor(normalizeOperation(operation, watchId));
}

function normalizeTarget(value, code) {
  const target = assertClosedRecord(value, new Set(['attempt', 'identityDigest', 'sourceSha', 'targetId']), code);
  assertRequiredFields(target, ['attempt', 'identityDigest', 'sourceSha', 'targetId'], code);
  return freezeRecord({
    attempt: requireNonNegativeInteger(target.attempt, code, 1_000_000),
    identityDigest: validateDigest(target.identityDigest, code),
    sourceSha: normalizeNullableSourceSha(target.sourceSha, code),
    targetId: validateTargetId(target.targetId, code),
  });
}

function sameCanonicalValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeIntent(value, expectedWatchId) {
  const code = 'invalid-operation-receipt-log';
  const intent = assertClosedRecord(
    value,
    new Set(['freshOperationReserved', 'operation', 'operationKey', 'status', 'target']),
    code,
  );
  assertRequiredFields(intent, ['freshOperationReserved', 'operation', 'operationKey', 'status', 'target'], code);
  if (typeof intent.freshOperationReserved !== 'boolean') runtimeFail(code);
  if (!['pending', 'attached', 'ambiguous'].includes(intent.status)) runtimeFail(code);
  const operation = normalizeOperation(intent.operation, expectedWatchId);
  const operationKey = validateDigest(intent.operationKey, code);
  if (operationKey !== operationKeyFor(operation)) runtimeFail(code);
  const target = intent.target === null ? null : normalizeTarget(intent.target, code);
  if ((intent.status === 'attached') !== (target !== null)) runtimeFail(code);
  return freezeRecord({
    freshOperationReserved: intent.freshOperationReserved,
    operation,
    operationKey,
    status: intent.status,
    target,
  });
}

function normalizeReceipt(value, expectedWatchId) {
  const code = 'invalid-operation-receipt-log';
  const receipt = assertClosedRecord(value, new Set(['operationKey', 'receiptId', 'target', 'watchId']), code);
  assertRequiredFields(receipt, ['operationKey', 'receiptId', 'target', 'watchId'], code);
  const watchId = validateWatchId(receipt.watchId, code);
  if (watchId !== expectedWatchId) runtimeFail(code);
  return freezeRecord({
    operationKey: validateDigest(receipt.operationKey, code),
    receiptId: validateReceiptId(receipt.receiptId, code),
    target: normalizeTarget(receipt.target, code),
    watchId,
  });
}

function normalizeTerminalReceipt(value, expectedWatchId) {
  const code = 'invalid-operation-receipt-log';
  const receipt = assertClosedRecord(
    value,
    new Set(['operationKey', 'receiptId', 'target', 'terminalDigest', 'watchId']),
    code,
  );
  assertRequiredFields(receipt, ['operationKey', 'receiptId', 'target', 'terminalDigest', 'watchId'], code);
  const watchId = validateWatchId(receipt.watchId, code);
  if (watchId !== expectedWatchId) runtimeFail(code);
  return freezeRecord({
    operationKey: validateDigest(receipt.operationKey, code),
    receiptId: validateReceiptId(receipt.receiptId, code),
    target: normalizeTarget(receipt.target, code),
    terminalDigest: validateDigest(receipt.terminalDigest, code),
    watchId,
  });
}

function emptyLog(watchId) {
  return freezeRecord({
    intents: freezeArray([]),
    receipts: freezeArray([]),
    schemaVersion: OPERATION_RECEIPT_SCHEMA_VERSION,
    terminalReceipts: freezeArray([]),
    watchId,
  });
}

function normalizeLog(value, expectedWatchId) {
  const code = 'invalid-operation-receipt-log';
  if (value === null) return emptyLog(expectedWatchId);
  const log = assertClosedRecord(
    value,
    new Set(['intents', 'receipts', 'schemaVersion', 'terminalReceipts', 'watchId']),
    code,
  );
  assertRequiredFields(log, ['intents', 'receipts', 'schemaVersion', 'watchId'], code);
  if (
    ![LEGACY_OPERATION_RECEIPT_SCHEMA_VERSION, OPERATION_RECEIPT_SCHEMA_VERSION].includes(log.schemaVersion) ||
    validateWatchId(log.watchId, code) !== expectedWatchId
  ) {
    runtimeFail(code);
  }
  if (!Array.isArray(log.intents) || !Array.isArray(log.receipts)) runtimeFail(code);
  const terminalReceiptValues =
    log.schemaVersion === LEGACY_OPERATION_RECEIPT_SCHEMA_VERSION ? [] : log.terminalReceipts;
  if (!Array.isArray(terminalReceiptValues)) runtimeFail(code);
  if (
    log.intents.length > MAX_OPERATION_RECORDS ||
    log.receipts.length > MAX_OPERATION_RECORDS ||
    terminalReceiptValues.length > MAX_OPERATION_RECORDS
  ) {
    runtimeFail(code);
  }
  const intents = log.intents.map((intent) => normalizeIntent(intent, expectedWatchId));
  const receipts = log.receipts.map((receipt) => normalizeReceipt(receipt, expectedWatchId));
  const terminalReceipts = terminalReceiptValues.map((receipt) => normalizeTerminalReceipt(receipt, expectedWatchId));
  if (new Set(intents.map((intent) => intent.operationKey)).size !== intents.length) runtimeFail(code);
  if (new Set(receipts.map((receipt) => receipt.receiptId)).size !== receipts.length) runtimeFail(code);
  if (new Set(receipts.map((receipt) => receipt.operationKey)).size !== receipts.length) runtimeFail(code);
  if (new Set(terminalReceipts.map((receipt) => receipt.receiptId)).size !== terminalReceipts.length) {
    runtimeFail(code);
  }
  if (new Set(terminalReceipts.map((receipt) => receipt.operationKey)).size !== terminalReceipts.length) {
    runtimeFail(code);
  }
  for (const receipt of receipts) {
    const intent = intents.find((candidate) => candidate.operationKey === receipt.operationKey);
    if (
      intent === undefined ||
      intent.status !== 'attached' ||
      intent.operation.sourceSha !== receipt.target.sourceSha ||
      !sameCanonicalValue(intent.target, receipt.target)
    ) {
      runtimeFail(code);
    }
  }
  for (const terminalReceipt of terminalReceipts) {
    const receipt = receipts.find((candidate) => candidate.receiptId === terminalReceipt.receiptId);
    if (
      receipt === undefined ||
      receipt.operationKey !== terminalReceipt.operationKey ||
      !sameCanonicalValue(receipt.target, terminalReceipt.target)
    ) {
      runtimeFail(code);
    }
  }
  return freezeRecord({
    intents: freezeArray(intents),
    receipts: freezeArray(receipts),
    schemaVersion: OPERATION_RECEIPT_SCHEMA_VERSION,
    terminalReceipts: freezeArray(terminalReceipts),
    watchId: expectedWatchId,
  });
}

function replaceIntent(log, replacement) {
  return freezeRecord({
    ...log,
    intents: freezeArray(
      log.intents.map((intent) => (intent.operationKey === replacement.operationKey ? replacement : intent)),
    ),
  });
}

/**
 * Persists intent-before-action and immutable receipt records. It contains no
 * provider client: adapters reconcile externally, then pass only normalized
 * exact matches back to this store.
 */
export class OperationReceiptStore {
  #mutationTail = Promise.resolve();
  #stateStore;
  #storage;

  constructor({ stateStore, storage } = {}) {
    if (!(stateStore instanceof AtomicStateStore) || !(storage instanceof WatchRuntimeStorage)) {
      runtimeFail('invalid-operation-receipt-store-dependency');
    }
    if (stateStore.watchId !== storage.watchId) runtimeFail('operation-receipt-watch-mismatch');
    this.#stateStore = stateStore;
    this.#storage = storage;
  }

  get watchId() {
    return this.#storage.watchId;
  }

  async read() {
    try {
      const value = await this.#storage.readJson(RECEIPTS_FILE_NAME, { maximumBytes: MAX_RECEIPT_FILE_BYTES });
      return normalizeLog(value, this.watchId);
    } catch {
      runtimeFail('operation-receipt-log-corrupt');
    }
  }

  async recordIntent({ expectedGeneration, operation }) {
    return this.#mutate(() => this.#recordIntent({ expectedGeneration, operation }));
  }

  async #recordIntent({ expectedGeneration, operation }) {
    const normalizedOperation = normalizeOperation(operation, this.watchId);
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        if (normalizedOperation.generation !== expectedGeneration) runtimeFail('operation-generation-mismatch');
        const operationKey = operationKeyFor(normalizedOperation);
        const log = await this.read();
        const existing = log.intents.find((intent) => intent.operationKey === operationKey);
        if (existing !== undefined) {
          if (!sameCanonicalValue(existing.operation, normalizedOperation)) runtimeFail('operation-key-conflict');
          return freezeRecord({ intent: existing, kind: 'existing' });
        }
        if (log.intents.length === MAX_OPERATION_RECORDS) runtimeFail('operation-receipt-limit-reached');
        const intent = freezeRecord({
          freshOperationReserved: false,
          operation: normalizedOperation,
          operationKey,
          status: 'pending',
          target: null,
        });
        await this.#writeLog(freezeRecord({ ...log, intents: freezeArray([...log.intents, intent]) }));
        return freezeRecord({ intent, kind: 'created' });
      },
    });
  }

  async recordReceipt({ expectedGeneration, receipt }) {
    return this.#mutate(() => this.#recordReceipt({ expectedGeneration, receipt }));
  }

  async #recordReceipt({ expectedGeneration, receipt }) {
    const normalizedReceipt = normalizeReceipt(receipt, this.watchId);
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const log = await this.read();
        const intent = log.intents.find((candidate) => candidate.operationKey === normalizedReceipt.operationKey);
        if (intent === undefined) runtimeFail('operation-intent-not-found');
        if (
          intent.status === 'ambiguous' ||
          intent.operation.sourceSha !== normalizedReceipt.target.sourceSha ||
          (intent.target !== null && !sameCanonicalValue(intent.target, normalizedReceipt.target))
        ) {
          runtimeFail('operation-receipt-ambiguous');
        }
        const existingById = log.receipts.find((candidate) => candidate.receiptId === normalizedReceipt.receiptId);
        if (existingById !== undefined) {
          if (!sameCanonicalValue(existingById, normalizedReceipt)) runtimeFail('receipt-id-conflict');
          return freezeRecord({ kind: 'existing', receipt: existingById });
        }
        const existingForOperation = log.receipts.find(
          (candidate) => candidate.operationKey === normalizedReceipt.operationKey,
        );
        if (existingForOperation !== undefined) {
          if (!sameCanonicalValue(existingForOperation.target, normalizedReceipt.target)) {
            runtimeFail('operation-receipt-ambiguous');
          }
          return freezeRecord({ kind: 'existing', receipt: existingForOperation });
        }
        if (log.receipts.length === MAX_OPERATION_RECORDS) runtimeFail('operation-receipt-limit-reached');
        const attachedIntent = freezeRecord({ ...intent, status: 'attached', target: normalizedReceipt.target });
        await this.#writeLog(
          freezeRecord({
            ...replaceIntent(log, attachedIntent),
            receipts: freezeArray([...log.receipts, normalizedReceipt]),
          }),
        );
        return freezeRecord({ kind: 'recorded', receipt: normalizedReceipt });
      },
    });
  }

  async recordTerminalReceipt({ expectedGeneration, receipt }) {
    return this.#mutate(() => this.#recordTerminalReceipt({ expectedGeneration, receipt }));
  }

  async #recordTerminalReceipt({ expectedGeneration, receipt }) {
    const normalizedReceipt = normalizeTerminalReceipt(receipt, this.watchId);
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const log = await this.read();
        const operationReceipt = log.receipts.find((candidate) => candidate.receiptId === normalizedReceipt.receiptId);
        if (
          operationReceipt === undefined ||
          operationReceipt.operationKey !== normalizedReceipt.operationKey ||
          !sameCanonicalValue(operationReceipt.target, normalizedReceipt.target)
        ) {
          runtimeFail('operation-terminal-receipt-mismatch');
        }
        const existing = log.terminalReceipts.find((candidate) => candidate.receiptId === normalizedReceipt.receiptId);
        if (existing !== undefined) {
          if (!sameCanonicalValue(existing, normalizedReceipt)) {
            runtimeFail('operation-terminal-receipt-conflict');
          }
          return freezeRecord({ kind: 'existing', receipt: existing });
        }
        if (log.terminalReceipts.length === MAX_OPERATION_RECORDS) {
          runtimeFail('operation-receipt-limit-reached');
        }
        await this.#writeLog(
          freezeRecord({
            ...log,
            terminalReceipts: freezeArray([...log.terminalReceipts, normalizedReceipt]),
          }),
        );
        return freezeRecord({ kind: 'recorded', receipt: normalizedReceipt });
      },
    });
  }

  /**
   * Reconciliation is idempotent: exactly one exact match attaches; zero can
   * reserve one fresh operation; multiple or unprovable results become blocked.
   */
  async reconcile({ exactMatches, expectedGeneration, identityProven, operationKey }) {
    return this.#mutate(() => this.#reconcile({ exactMatches, expectedGeneration, identityProven, operationKey }));
  }

  async #reconcile({ exactMatches, expectedGeneration, identityProven, operationKey }) {
    const key = validateDigest(operationKey, 'invalid-operation-key');
    if (
      typeof identityProven !== 'boolean' ||
      !Array.isArray(exactMatches) ||
      exactMatches.length > MAX_OPERATION_RECORDS
    ) {
      runtimeFail('invalid-operation-reconciliation');
    }
    const normalizedMatches = exactMatches.map((target) => normalizeTarget(target, 'invalid-operation-reconciliation'));
    const targetKeys = normalizedMatches.map((target) => JSON.stringify(target));
    if (new Set(targetKeys).size !== targetKeys.length) runtimeFail('invalid-operation-reconciliation');
    return this.#stateStore.withOwnership({
      expectedGeneration,
      operation: async () => {
        const log = await this.read();
        const intent = log.intents.find((candidate) => candidate.operationKey === key);
        if (intent === undefined || intent.operation.generation !== expectedGeneration)
          runtimeFail('operation-intent-not-found');

        if (intent.status === 'ambiguous') return freezeRecord({ blocker: 'dispatch-failed', kind: 'blocked' });
        if (!identityProven || normalizedMatches.length > 1) {
          const ambiguousIntent = freezeRecord({ ...intent, status: 'ambiguous', target: null });
          await this.#writeLog(replaceIntent(log, ambiguousIntent));
          return freezeRecord({ blocker: 'dispatch-failed', kind: 'blocked' });
        }

        const recordedReceipt = log.receipts.find((candidate) => candidate.operationKey === key);
        if (recordedReceipt !== undefined) {
          if (normalizedMatches.length !== 1 || !sameCanonicalValue(recordedReceipt.target, normalizedMatches[0])) {
            const ambiguousIntent = freezeRecord({ ...intent, status: 'ambiguous', target: null });
            await this.#writeLog(replaceIntent(log, ambiguousIntent));
            return freezeRecord({ blocker: 'target-lost', kind: 'blocked' });
          }
          if (intent.status !== 'attached') {
            await this.#writeLog(
              replaceIntent(log, freezeRecord({ ...intent, status: 'attached', target: recordedReceipt.target })),
            );
          }
          return freezeRecord({ kind: 'attached', target: recordedReceipt.target });
        }
        if (normalizedMatches.length === 1) {
          if (intent.status === 'attached' && !sameCanonicalValue(intent.target, normalizedMatches[0])) {
            const ambiguousIntent = freezeRecord({ ...intent, status: 'ambiguous', target: null });
            await this.#writeLog(replaceIntent(log, ambiguousIntent));
            return freezeRecord({ blocker: 'target-lost', kind: 'blocked' });
          }
          if (intent.status === 'attached') return freezeRecord({ kind: 'attached', target: intent.target });
          const attachedIntent = freezeRecord({ ...intent, status: 'attached', target: normalizedMatches[0] });
          await this.#writeLog(replaceIntent(log, attachedIntent));
          return freezeRecord({ kind: 'attached', target: normalizedMatches[0] });
        }
        if (intent.status === 'attached') return freezeRecord({ blocker: 'target-lost', kind: 'blocked' });
        if (intent.freshOperationReserved) return freezeRecord({ blocker: 'dispatch-failed', kind: 'blocked' });
        const reservedIntent = freezeRecord({ ...intent, freshOperationReserved: true });
        await this.#writeLog(replaceIntent(log, reservedIntent));
        return freezeRecord({ kind: 'fresh-operation-permitted', operationKey: key });
      },
    });
  }

  async #writeLog(log) {
    const normalizedLog = normalizeLog(log, this.watchId);
    await this.#storage.writeJson(RECEIPTS_FILE_NAME, normalizedLog, { maximumBytes: MAX_RECEIPT_FILE_BYTES });
  }

  #mutate(operation) {
    const mutation = this.#mutationTail.then(operation);
    this.#mutationTail = mutation.catch(() => undefined);
    return mutation;
  }
}

export { RECEIPTS_FILE_NAME };
