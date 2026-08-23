import {
  resolveAdapterCommand,
  digestAdapterCommand,
  normalizeAdapterCommandResult,
} from './adapters/adapter-support.mjs';
import { REPAIR_CONTROL_SCHEMA_VERSION, REPAIR_VERIFICATION_RECEIPTS_FILE_NAME } from './repair-control-contracts.mjs';
import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  requirePositiveInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { PROCESS_TERMINAL_CLASSIFICATIONS, normalizeProcessTerminal } from './runtime-contracts.mjs';
import { validateDigest, validateSourceSha, validateWatchId } from './runtime-state-contracts.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const MAX_VERIFICATION_RECEIPTS = 100;
const MAX_VERIFICATION_RECEIPT_BYTES = 262_144;

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

function normalizeNullableSourceSha(value, code) {
  return value === null ? null : validateSourceSha(value, code);
}

function normalizeEvidenceLimits(value) {
  const code = 'invalid-focused-verification-runner';
  const evidence = assertClosedRecord(value, new Set(['maxBytesPerAttempt', 'maxFailures', 'ttlSeconds']), code);
  assertRequiredFields(evidence, ['maxBytesPerAttempt', 'maxFailures', 'ttlSeconds'], code);
  return freezeRecord({
    maximumBytes: requirePositiveInteger(evidence.maxBytesPerAttempt, code, 10_485_760),
    maximumFailures: requirePositiveInteger(evidence.maxFailures, code, 100),
    maximumMilliseconds: requirePositiveInteger(evidence.ttlSeconds, code, 604_800) * 1_000,
  });
}

function normalizeTerminal(value, code) {
  const terminal = assertClosedRecord(value, new Set(['classification', 'exitCode', 'signal', 'succeeded']), code);
  assertRequiredFields(terminal, ['classification', 'exitCode', 'signal', 'succeeded'], code);
  if (!PROCESS_TERMINAL_CLASSIFICATIONS.includes(terminal.classification) || typeof terminal.succeeded !== 'boolean') {
    runtimeFail(code);
  }
  if (terminal.exitCode !== null) requireNonNegativeInteger(terminal.exitCode, code, 255);
  if (terminal.signal !== null && typeof terminal.signal !== 'string') runtimeFail(code);
  let normalized;
  try {
    normalized = normalizeProcessTerminal({
      aborted: terminal.classification === 'aborted',
      cleanupUnconfirmed: terminal.classification === 'cleanup_unconfirmed',
      exitCode: terminal.exitCode,
      signal: terminal.signal,
      startFailed: terminal.classification === 'spawn_failed',
      timedOut: terminal.classification === 'timed_out',
    });
  } catch {
    runtimeFail(code);
  }
  if (
    normalized.classification !== terminal.classification ||
    normalized.exitCode !== terminal.exitCode ||
    normalized.signal !== terminal.signal ||
    normalized.succeeded !== terminal.succeeded
  ) {
    runtimeFail(code);
  }
  return freezeRecord({
    classification: normalized.classification,
    exitCode: normalized.exitCode,
    signal: normalized.signal,
    succeeded: normalized.succeeded,
  });
}

function normalizeReceipt(value, watchId) {
  const code = 'repair-verification-receipts-corrupt';
  const receipt = assertClosedRecord(
    value,
    new Set([
      'commandDigest',
      'completedAtEpochMilliseconds',
      'environmentDigest',
      'generation',
      'headSha',
      'inputDigest',
      'receiptId',
      'sourceSha',
      'terminal',
      'watchId',
      'worktreeDigest',
    ]),
    code,
  );
  assertRequiredFields(
    receipt,
    [
      'commandDigest',
      'completedAtEpochMilliseconds',
      'environmentDigest',
      'generation',
      'headSha',
      'inputDigest',
      'receiptId',
      'sourceSha',
      'terminal',
      'watchId',
      'worktreeDigest',
    ],
    code,
  );
  if (
    validateWatchId(receipt.watchId, code) !== watchId ||
    !/^receipt-verify-[a-z0-9-]{3,55}$/u.test(receipt.receiptId)
  ) {
    runtimeFail(code);
  }
  return freezeRecord({
    commandDigest: validateDigest(receipt.commandDigest, code),
    completedAtEpochMilliseconds: requireNonNegativeInteger(
      receipt.completedAtEpochMilliseconds,
      code,
      Number.MAX_SAFE_INTEGER,
    ),
    environmentDigest: validateDigest(receipt.environmentDigest, code),
    generation: requireNonNegativeInteger(receipt.generation, code, 1_000_000_000),
    headSha: validateSourceSha(receipt.headSha, code),
    inputDigest: validateDigest(receipt.inputDigest, code),
    receiptId: receipt.receiptId,
    sourceSha: normalizeNullableSourceSha(receipt.sourceSha, code),
    terminal: normalizeTerminal(receipt.terminal, code),
    watchId,
    worktreeDigest: validateDigest(receipt.worktreeDigest, code),
  });
}

function emptyReceipts(watchId) {
  return freezeRecord({ receipts: freezeArray([]), schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION, watchId });
}

function normalizeReceiptLog(value, watchId) {
  if (value === null) return emptyReceipts(watchId);
  const code = 'repair-verification-receipts-corrupt';
  const log = assertClosedRecord(value, new Set(['receipts', 'schemaVersion', 'watchId']), code);
  assertRequiredFields(log, ['receipts', 'schemaVersion', 'watchId'], code);
  if (
    log.schemaVersion !== REPAIR_CONTROL_SCHEMA_VERSION ||
    validateWatchId(log.watchId, code) !== watchId ||
    !Array.isArray(log.receipts) ||
    log.receipts.length > MAX_VERIFICATION_RECEIPTS
  ) {
    runtimeFail(code);
  }
  const receipts = log.receipts.map((receipt) => normalizeReceipt(receipt, watchId));
  if (new Set(receipts.map((receipt) => receipt.receiptId)).size !== receipts.length) runtimeFail(code);
  return freezeRecord({ receipts: freezeArray(receipts), schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION, watchId });
}

function remainingMilliseconds(deadlineEpochMilliseconds, now) {
  const deadline = requireNonNegativeInteger(
    deadlineEpochMilliseconds,
    'invalid-verification-deadline',
    Number.MAX_SAFE_INTEGER,
  );
  const current = requireNonNegativeInteger(now, 'invalid-verification-clock', Number.MAX_SAFE_INTEGER);
  if (deadline <= current) runtimeFail('repair-deadline-exceeded');
  return deadline - current;
}

/** Runs only the scenario's focused verification array and persists output-free receipts. */
export class FocusedVerificationRunner {
  #clock;
  #evidenceLimits;
  #environmentAllowlist;
  #runner;
  #scenario;
  #scenarioDigest;
  #storage;
  #watchId;
  #workspaceRoot;

  constructor({
    clock = () => Date.now(),
    environmentAllowlist = [],
    runner,
    scenario,
    scenarioDigest,
    storage,
    workspaceRoot,
  } = {}) {
    if (typeof clock !== 'function' || !Array.isArray(environmentAllowlist) || typeof runner?.run !== 'function') {
      runtimeFail('invalid-focused-verification-runner');
    }
    if (!(storage instanceof WatchRuntimeStorage) || !isRecord(scenario) || !Array.isArray(scenario.verification)) {
      runtimeFail('invalid-focused-verification-runner');
    }
    this.#clock = clock;
    this.#evidenceLimits = normalizeEvidenceLimits(scenario.evidence);
    this.#environmentAllowlist = freezeArray(environmentAllowlist);
    this.#runner = runner;
    this.#scenario = scenario;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-focused-verification-runner');
    this.#storage = storage;
    this.#watchId = validateWatchId(storage.watchId, 'invalid-focused-verification-runner');
    this.#workspaceRoot =
      typeof workspaceRoot === 'string' ? workspaceRoot : runtimeFail('invalid-focused-verification-runner');
  }

  async run({ attemptContext, deadlineEpochMilliseconds, generation, headSha, worktreeDigest } = {}) {
    if (!isRecord(attemptContext)) runtimeFail('invalid-verification-attempt-context');
    const expectedGeneration = requireNonNegativeInteger(generation, 'invalid-verification-generation', 1_000_000_000);
    const verifiedHead = validateSourceSha(headSha, 'invalid-verification-head');
    const verifiedWorktree = validateDigest(worktreeDigest, 'invalid-verification-worktree');
    const receipts = await this.#read();
    const receiptIds = [];
    let currentLog = receipts;
    for (const [index, declaredCommand] of this.#scenario.verification.entries()) {
      const prepared = await resolveAdapterCommand({
        command: declaredCommand,
        context: attemptContext,
        environmentAllowlist: this.#environmentAllowlist,
        watchId: this.#watchId,
        workspaceRoot: this.#workspaceRoot,
      });
      const timeoutMilliseconds = Math.min(
        prepared.timeoutMilliseconds,
        remainingMilliseconds(deadlineEpochMilliseconds, this.#now()),
      );
      const command = freezeRecord({ ...prepared, timeoutMilliseconds });
      const result = normalizeAdapterCommandResult(
        await this.#runner.run({
          ...command,
          evidence: freezeRecord({
            maximumBytes: this.#evidenceLimits.maximumBytes,
            maximumFailures: this.#evidenceLimits.maximumFailures,
            maximumMilliseconds: Math.min(this.#evidenceLimits.maximumMilliseconds, timeoutMilliseconds),
          }),
        }),
      );
      const commandDigest = digestAdapterCommand(command);
      const environmentDigest = digestNormalizedValue('gpt-voice/watch-process/verification-environment/v1', {
        declared: command.env,
        inheritedNames: command.environmentAllowlist,
      });
      const receiptId = this.#receiptId({
        commandDigest,
        generation: expectedGeneration,
        index,
        receiptCount: currentLog.receipts.length,
      });
      const receipt = freezeRecord({
        commandDigest,
        completedAtEpochMilliseconds: this.#now(),
        environmentDigest,
        generation: expectedGeneration,
        headSha: verifiedHead,
        inputDigest: validateDigest(attemptContext.inputDigest, 'invalid-verification-attempt-context'),
        receiptId,
        sourceSha: normalizeNullableSourceSha(attemptContext.sourceSha, 'invalid-verification-attempt-context'),
        terminal: result.terminal,
        watchId: this.#watchId,
        worktreeDigest: verifiedWorktree,
      });
      currentLog = freezeRecord({ ...currentLog, receipts: freezeArray([...currentLog.receipts, receipt]) });
      await this.#write(currentLog);
      receiptIds.push(receiptId);
      if (!result.terminal.succeeded) {
        return freezeRecord({
          receiptIds: freezeArray(receiptIds),
          succeeded: false,
          summaryCode: 'verification-command-failed',
        });
      }
    }
    return freezeRecord({ receiptIds: freezeArray(receiptIds), succeeded: true, summaryCode: 'verification-passed' });
  }

  async #read() {
    const value = await this.#storage.readJson(REPAIR_VERIFICATION_RECEIPTS_FILE_NAME, {
      maximumBytes: MAX_VERIFICATION_RECEIPT_BYTES,
    });
    return normalizeReceiptLog(value, this.#watchId);
  }

  #receiptId({ commandDigest, generation, index, receiptCount }) {
    const digest = digestNormalizedValue('gpt-voice/watch-process/verification-receipt/v1', {
      commandDigest,
      generation,
      index,
      receiptCount,
      scenarioDigest: this.#scenarioDigest,
      watchId: this.#watchId,
    });
    return `receipt-verify-${generation}-${index}-${digest.slice(0, 24)}`;
  }

  async #write(log) {
    if (log.receipts.length > MAX_VERIFICATION_RECEIPTS) runtimeFail('verification-receipt-limit-reached');
    await this.#storage.writeJson(REPAIR_VERIFICATION_RECEIPTS_FILE_NAME, log, {
      maximumBytes: MAX_VERIFICATION_RECEIPT_BYTES,
    });
  }

  #now() {
    return requireNonNegativeInteger(this.#clock(), 'invalid-verification-clock', Number.MAX_SAFE_INTEGER);
  }
}
