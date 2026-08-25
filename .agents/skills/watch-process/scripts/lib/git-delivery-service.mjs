import { GitCommandRunner } from './git-command-runner.mjs';
import { GitWorktreeInspector } from './git-worktree-inspector.mjs';
import { OperationReceiptStore } from './operation-receipt-store.mjs';
import { REPAIR_CONTROL_SCHEMA_VERSION, REPAIR_DELIVERY_FILE_NAME } from './repair-control-contracts.mjs';
import {
  digestNormalizedValue,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { validateDigest, validateSourceSha, validateWatchId } from './runtime-state-contracts.mjs';
import { AtomicStateStore } from './atomic-state-store.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const DELIVERY_FILE_MAXIMUM_BYTES = 65_536;
const DELIVERY_STATUSES = new Set(['pending', 'committed', 'pushed']);
const DELIVERY_COMMIT_MESSAGE = 'watch-process repair';
const DELIVERY_OPERATION_TRAILER_PREFIX = 'Watch-Process-Operation: ';

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

function normalizeBranch(value, code) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) runtimeFail(code);
  if (/[^\w./-]/u.test(value) || value.startsWith('-') || value.includes('//') || value.includes('..')) {
    runtimeFail(code);
  }
  return value;
}

function hasOperationTrailer(message, operationKey) {
  return message.split(/\r?\n/u).some((line) => line === `${DELIVERY_OPERATION_TRAILER_PREFIX}${operationKey}`);
}

function upstreamDigest(upstream) {
  if (
    upstream === null ||
    typeof upstream !== 'object' ||
    typeof upstream.remote !== 'string' ||
    typeof upstream.branch !== 'string'
  ) {
    runtimeFail('git-upstream-invalid');
  }
  return digestNormalizedValue('gpt-voice/watch-process/git-upstream/v1', upstream);
}

function normalizeDeliveryRecord(value, { watchId }) {
  if (value === null) return null;
  const code = 'repair-delivery-corrupt';
  const record = assertClosedRecord(
    value,
    new Set([
      'branch',
      'newHeadSha',
      'operationKey',
      'patchDigest',
      'pushCurrentUpstream',
      'schemaVersion',
      'sourceSha',
      'status',
      'upstreamDigest',
      'watchId',
      'worktreeDigest',
    ]),
    code,
  );
  assertRequiredFields(
    record,
    [
      'branch',
      'newHeadSha',
      'operationKey',
      'patchDigest',
      'pushCurrentUpstream',
      'schemaVersion',
      'sourceSha',
      'status',
      'upstreamDigest',
      'watchId',
      'worktreeDigest',
    ],
    code,
  );
  if (
    record.schemaVersion !== REPAIR_CONTROL_SCHEMA_VERSION ||
    validateWatchId(record.watchId, code) !== watchId ||
    !DELIVERY_STATUSES.has(record.status) ||
    typeof record.pushCurrentUpstream !== 'boolean'
  ) {
    runtimeFail(code);
  }
  const newHeadSha = normalizeNullableSourceSha(record.newHeadSha, code);
  if ((record.status === 'pending') !== (newHeadSha === null)) runtimeFail(code);
  if (record.status === 'pushed' && !record.pushCurrentUpstream) runtimeFail(code);
  return freezeRecord({
    branch: normalizeBranch(record.branch, code),
    newHeadSha,
    operationKey: validateDigest(record.operationKey, code),
    patchDigest: validateDigest(record.patchDigest, code),
    pushCurrentUpstream: record.pushCurrentUpstream,
    schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION,
    sourceSha: validateSourceSha(record.sourceSha, code),
    status: record.status,
    upstreamDigest: validateDigest(record.upstreamDigest, code),
    watchId,
    worktreeDigest: validateDigest(record.worktreeDigest, code),
  });
}

function deliveryReceiptId(operationKey) {
  return `receipt-delivery-${operationKey.slice(0, 32)}`;
}

/** Creates one normal repair commit and conditionally reconciles a normal upstream push. */
export class GitDeliveryService {
  #commandRunner;
  #receiptStore;
  #scenarioDigest;
  #stateStore;
  #storage;
  #watchId;
  #worktreeInspector;

  constructor({ commandRunner, receiptStore, scenarioDigest, stateStore, storage, worktreeInspector } = {}) {
    if (!(commandRunner instanceof GitCommandRunner) || !(worktreeInspector instanceof GitWorktreeInspector)) {
      runtimeFail('invalid-git-delivery-service');
    }
    if (
      !(receiptStore instanceof OperationReceiptStore) ||
      !(stateStore instanceof AtomicStateStore) ||
      !(storage instanceof WatchRuntimeStorage)
    ) {
      runtimeFail('invalid-git-delivery-service');
    }
    if (receiptStore.watchId !== storage.watchId || stateStore.watchId !== storage.watchId) {
      runtimeFail('invalid-git-delivery-service');
    }
    this.#commandRunner = commandRunner;
    this.#receiptStore = receiptStore;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-git-delivery-service');
    this.#stateStore = stateStore;
    this.#storage = storage;
    this.#watchId = validateWatchId(storage.watchId, 'invalid-git-delivery-service');
    this.#worktreeInspector = worktreeInspector;
  }

  async deliver({
    attempt,
    expectedGeneration,
    patchDigest,
    pushCurrentUpstream,
    sourceSha,
    timeoutMilliseconds,
    worktreeDigest,
  } = {}) {
    if (!this.#stateStore.ownsLock) runtimeFail('delivery-lock-required');
    const generation = requireNonNegativeInteger(expectedGeneration, 'invalid-delivery-generation', 1_000_000_000);
    const source = validateSourceSha(sourceSha, 'invalid-delivery-source');
    const patch = validateDigest(patchDigest, 'invalid-delivery-patch');
    const worktree = validateDigest(worktreeDigest, 'invalid-delivery-worktree');
    const targetAttempt = requireNonNegativeInteger(attempt, 'invalid-delivery-attempt', 1_000_000);
    if (typeof pushCurrentUpstream !== 'boolean') runtimeFail('invalid-delivery-push-authority');
    await this.#stateStore.assertOwnership(generation);

    const branch = await this.#worktreeInspector.currentBranch({ timeoutMilliseconds });
    const upstream = await this.#worktreeInspector.currentUpstream({ timeoutMilliseconds });
    const selectedUpstreamDigest = upstreamDigest(upstream);
    const fixedInputsDigest = digestNormalizedValue('gpt-voice/watch-process/git-delivery-inputs/v1', {
      branch,
      patchDigest: patch,
      pushCurrentUpstream,
      sourceSha: source,
      upstreamDigest: selectedUpstreamDigest,
      watchId: this.#watchId,
      worktreeDigest: worktree,
    });
    const operation = freezeRecord({
      fixedInputsDigest,
      generation,
      kind: 'delivery',
      scenarioDigest: this.#scenarioDigest,
      sourceSha: source,
      watchId: this.#watchId,
    });
    const intent = await this.#receiptStore.recordIntent({ expectedGeneration: generation, operation });
    this.#assertIntentGeneration(intent.intent, generation);
    let existing = await this.#read();
    if (existing !== null && existing.operationKey !== intent.intent.operationKey) {
      await this.#assertCompletedPredecessor(existing, {
        branch,
        generation,
        pushCurrentUpstream,
        sourceSha: source,
        upstreamDigest: selectedUpstreamDigest,
      });
      existing = null;
    }
    if (existing !== null) {
      this.#assertSameOperation(existing, {
        branch,
        operationKey: intent.intent.operationKey,
        patchDigest: patch,
        pushCurrentUpstream,
        sourceSha: source,
        upstreamDigest: selectedUpstreamDigest,
        worktreeDigest: worktree,
      });
      if (existing.status !== 'pending') {
        return this.#reconcileCommitted({
          attempt: targetAttempt,
          existing,
          expectedGeneration: generation,
          timeoutMilliseconds,
          upstream,
        });
      }
      const recovered = await this.#reconcilePending({
        attempt: targetAttempt,
        expectedGeneration: generation,
        pending: existing,
        timeoutMilliseconds,
        upstream,
      });
      if (recovered !== null) return recovered;
    }

    const before = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
    if (before.headSha !== source || before.diffDigest !== worktree || before.changedFiles.length === 0) {
      runtimeFail('delivery-worktree-changed');
    }
    const pending =
      existing ??
      freezeRecord({
        branch,
        newHeadSha: null,
        operationKey: intent.intent.operationKey,
        patchDigest: patch,
        pushCurrentUpstream,
        schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION,
        sourceSha: source,
        status: 'pending',
        upstreamDigest: selectedUpstreamDigest,
        watchId: this.#watchId,
        worktreeDigest: worktree,
      });
    await this.#write(pending);
    return this.#commitAndDeliver({
      attempt: targetAttempt,
      expectedGeneration: generation,
      pending,
      timeoutMilliseconds,
      upstream,
    });
  }

  /** Reconciles an already persisted delivery after an interrupted watcher operation. */
  async reconcile({ attempt, expectedGeneration, timeoutMilliseconds } = {}) {
    if (!this.#stateStore.ownsLock) runtimeFail('delivery-lock-required');
    const generation = requireNonNegativeInteger(expectedGeneration, 'invalid-delivery-generation', 1_000_000_000);
    const targetAttempt = requireNonNegativeInteger(attempt, 'invalid-delivery-attempt', 1_000_000);
    await this.#stateStore.assertOwnership(generation);
    const existing = await this.#read();
    if (existing === null) return null;
    const receipts = await this.#receiptStore.read();
    const intent = receipts.intents.find((candidate) => candidate.operationKey === existing.operationKey);
    if (intent === undefined) runtimeFail('delivery-operation-conflict');
    if (intent.operation.generation !== generation) {
      this.#assertCompletedReceipt(existing, generation, receipts);
      const current = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
      if (current.headSha !== existing.newHeadSha) runtimeFail('delivery-operation-conflict');
      return null;
    }
    this.#assertIntentGeneration(intent, generation);
    const [branch, upstream] = await Promise.all([
      this.#worktreeInspector.currentBranch({ timeoutMilliseconds }),
      this.#worktreeInspector.currentUpstream({ timeoutMilliseconds }),
    ]);
    if (branch !== existing.branch || upstreamDigest(upstream) !== existing.upstreamDigest) {
      runtimeFail('delivery-operation-conflict');
    }
    if (existing.status !== 'pending') {
      return this.#reconcileCommitted({
        attempt: targetAttempt,
        existing,
        expectedGeneration: generation,
        timeoutMilliseconds,
        upstream,
      });
    }
    return this.#reconcilePending({
      attempt: targetAttempt,
      expectedGeneration: generation,
      pending: existing,
      timeoutMilliseconds,
      upstream,
    });
  }

  async assertArming({ timeoutMilliseconds } = {}) {
    if (!this.#stateStore.ownsLock) runtimeFail('delivery-lock-required');
    const [branch, upstream] = await Promise.all([
      this.#worktreeInspector.currentBranch({ timeoutMilliseconds }),
      this.#worktreeInspector.currentUpstream({ timeoutMilliseconds }),
    ]);
    return freezeRecord({
      branchDigest: digestNormalizedValue('gpt-voice/watch-process/git-branch/v1', { branch }),
      upstreamDigest: upstreamDigest(upstream),
    });
  }

  async #commitAndDeliver({ attempt, expectedGeneration, pending, timeoutMilliseconds, upstream }) {
    const current = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
    if (
      current.headSha !== pending.sourceSha ||
      current.diffDigest !== pending.worktreeDigest ||
      current.changedFiles.length === 0
    ) {
      runtimeFail('delivery-worktree-changed');
    }
    const add = await this.#commandRunner.run({
      args: ['add', '--', ...current.changedFiles],
      timeoutMilliseconds,
    });
    if (!add.terminal.succeeded) runtimeFail('delivery-stage-failed');
    const staged = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
    if (
      staged.headSha !== pending.sourceSha ||
      staged.diffDigest !== pending.worktreeDigest ||
      staged.changedFiles.length === 0
    ) {
      runtimeFail('delivery-worktree-changed');
    }
    const commit = await this.#commandRunner.run({
      args: [
        'commit',
        '--no-verify',
        '-m',
        DELIVERY_COMMIT_MESSAGE,
        '-m',
        `${DELIVERY_OPERATION_TRAILER_PREFIX}${pending.operationKey}`,
      ],
      timeoutMilliseconds,
    });
    if (!commit.terminal.succeeded) {
      const reconciled = await this.#reconcilePending({
        attempt,
        expectedGeneration,
        pending,
        timeoutMilliseconds,
        upstream,
      });
      if (reconciled !== null) return reconciled;
      runtimeFail('delivery-commit-failed');
    }
    const committedSnapshot = await this.#worktreeInspector.assertClean({ timeoutMilliseconds });
    if (committedSnapshot.headSha === pending.sourceSha) runtimeFail('delivery-head-unchanged');
    const committed = freezeRecord({ ...pending, newHeadSha: committedSnapshot.headSha, status: 'committed' });
    await this.#write(committed);
    const receipt = await this.#recordReceipt({ attempt, expectedGeneration, record: committed });
    if (!committed.pushCurrentUpstream) {
      return freezeRecord({
        newSourceSha: committed.newHeadSha,
        receiptId: receipt.receiptId,
        status: committed.status,
      });
    }
    return this.#pushAndVerify({ expectedGeneration, record: committed, receipt, timeoutMilliseconds, upstream });
  }

  async #reconcilePending({ attempt, expectedGeneration, pending, timeoutMilliseconds, upstream }) {
    const current = await this.#worktreeInspector.snapshot({ timeoutMilliseconds });
    if (
      current.headSha === pending.sourceSha &&
      current.diffDigest === pending.worktreeDigest &&
      current.changedFiles.length !== 0
    ) {
      return null;
    }
    if (current.changedFiles.length !== 0 || current.headSha === pending.sourceSha) runtimeFail('delivery-ambiguous');
    await this.#assertPendingCommit({
      headSha: current.headSha,
      operationKey: pending.operationKey,
      sourceSha: pending.sourceSha,
      timeoutMilliseconds,
    });
    const committed = freezeRecord({ ...pending, newHeadSha: current.headSha, status: 'committed' });
    await this.#write(committed);
    const receipt = await this.#recordReceipt({ attempt, expectedGeneration, record: committed });
    if (!committed.pushCurrentUpstream) {
      return freezeRecord({
        newSourceSha: committed.newHeadSha,
        receiptId: receipt.receiptId,
        status: committed.status,
      });
    }
    return this.#pushAndVerify({ expectedGeneration, record: committed, receipt, timeoutMilliseconds, upstream });
  }

  async #reconcileCommitted({ attempt, existing, expectedGeneration, timeoutMilliseconds, upstream }) {
    const current = await this.#worktreeInspector.assertClean({ timeoutMilliseconds });
    if (current.headSha !== existing.newHeadSha) runtimeFail('delivery-ambiguous');
    await this.#assertPendingCommit({
      headSha: existing.newHeadSha,
      operationKey: existing.operationKey,
      sourceSha: existing.sourceSha,
      timeoutMilliseconds,
    });
    const receipt = await this.#recordReceipt({ attempt, expectedGeneration, record: existing });
    if (!existing.pushCurrentUpstream) {
      return freezeRecord({ newSourceSha: existing.newHeadSha, receiptId: receipt.receiptId, status: existing.status });
    }
    return this.#pushAndVerify({ expectedGeneration, record: existing, receipt, timeoutMilliseconds, upstream });
  }

  async #pushAndVerify({ expectedGeneration, record, receipt, timeoutMilliseconds, upstream }) {
    const remoteBefore = await this.#worktreeInspector.remoteHead({ timeoutMilliseconds, upstream });
    if (remoteBefore === record.newHeadSha) {
      const pushed = freezeRecord({ ...record, status: 'pushed' });
      await this.#write(pushed);
      return freezeRecord({ newSourceSha: pushed.newHeadSha, receiptId: receipt.receiptId, status: pushed.status });
    }
    if (remoteBefore !== record.sourceSha) runtimeFail('delivery-push-ambiguous');
    const push = await this.#commandRunner.run({
      args: ['push', upstream.remote, `HEAD:refs/heads/${upstream.branch}`],
      timeoutMilliseconds,
    });
    const remoteAfter = await this.#worktreeInspector.remoteHead({ timeoutMilliseconds, upstream });
    if (remoteAfter !== record.newHeadSha) {
      if (!push.terminal.succeeded) runtimeFail('delivery-push-failed');
      runtimeFail('delivery-push-unverified');
    }
    const pushed = freezeRecord({ ...record, status: 'pushed' });
    await this.#write(pushed);
    await this.#stateStore.assertOwnership(expectedGeneration);
    return freezeRecord({ newSourceSha: pushed.newHeadSha, receiptId: receipt.receiptId, status: pushed.status });
  }

  async #recordReceipt({ attempt, expectedGeneration, record }) {
    if (record.newHeadSha === null) runtimeFail('delivery-receipt-unavailable');
    const target = freezeRecord({
      attempt,
      identityDigest: digestNormalizedValue('gpt-voice/watch-process/git-delivery-target/v1', {
        newHeadSha: record.newHeadSha,
        operationKey: record.operationKey,
        sourceSha: record.sourceSha,
        watchId: this.#watchId,
      }),
      sourceSha: record.sourceSha,
      targetId: `git-delivery-${record.newHeadSha}`,
    });
    const recorded = await this.#receiptStore.recordReceipt({
      expectedGeneration,
      receipt: freezeRecord({
        operationKey: record.operationKey,
        receiptId: deliveryReceiptId(record.operationKey),
        target,
        watchId: this.#watchId,
      }),
    });
    return recorded.receipt;
  }

  #assertIntentGeneration(intent, expectedGeneration) {
    if (
      intent?.operation?.generation !== expectedGeneration ||
      intent.operation.kind !== 'delivery' ||
      intent.operation.scenarioDigest !== this.#scenarioDigest
    ) {
      runtimeFail('delivery-operation-conflict');
    }
  }

  async #assertCompletedPredecessor(record, expected) {
    const expectedStatus = record.pushCurrentUpstream ? 'pushed' : 'committed';
    if (
      record.status !== expectedStatus ||
      record.newHeadSha !== expected.sourceSha ||
      record.branch !== expected.branch ||
      record.pushCurrentUpstream !== expected.pushCurrentUpstream ||
      record.upstreamDigest !== expected.upstreamDigest
    ) {
      runtimeFail('delivery-operation-conflict');
    }
    const receipts = await this.#receiptStore.read();
    this.#assertCompletedReceipt(record, expected.generation, receipts);
  }

  #assertCompletedReceipt(record, expectedGeneration, receipts) {
    const intent = receipts.intents.find((candidate) => candidate.operationKey === record.operationKey);
    const receipt = receipts.receipts.find((candidate) => candidate.operationKey === record.operationKey);
    if (
      intent?.status !== 'attached' ||
      intent.operation.kind !== 'delivery' ||
      intent.operation.scenarioDigest !== this.#scenarioDigest ||
      intent.operation.generation >= expectedGeneration ||
      receipt === undefined ||
      receipt.target.sourceSha !== record.sourceSha ||
      receipt.target.targetId !== `git-delivery-${record.newHeadSha}`
    ) {
      runtimeFail('delivery-operation-conflict');
    }
  }

  #assertSameOperation(record, expected) {
    if (
      record.branch !== expected.branch ||
      record.operationKey !== expected.operationKey ||
      record.patchDigest !== expected.patchDigest ||
      record.pushCurrentUpstream !== expected.pushCurrentUpstream ||
      record.sourceSha !== expected.sourceSha ||
      record.upstreamDigest !== expected.upstreamDigest ||
      record.worktreeDigest !== expected.worktreeDigest
    ) {
      runtimeFail('delivery-operation-conflict');
    }
  }

  async #assertPendingCommit({ headSha, operationKey, sourceSha, timeoutMilliseconds }) {
    const parentResponse = await this.#commandRunner.run({
      args: ['rev-parse', '--verify', `${headSha}^`],
      timeoutMilliseconds,
    });
    if (
      !parentResponse.terminal.succeeded ||
      validateSourceSha(parentResponse.stdout.trim(), 'delivery-ambiguous') !== sourceSha
    ) {
      runtimeFail('delivery-ambiguous');
    }
    const messageResponse = await this.#commandRunner.run({
      args: ['show', '--no-ext-diff', '--no-patch', '--format=%B', headSha],
      timeoutMilliseconds,
    });
    if (!messageResponse.terminal.succeeded || !hasOperationTrailer(messageResponse.stdout, operationKey)) {
      runtimeFail('delivery-ambiguous');
    }
  }

  async #read() {
    const value = await this.#storage.readJson(REPAIR_DELIVERY_FILE_NAME, {
      maximumBytes: DELIVERY_FILE_MAXIMUM_BYTES,
    });
    return normalizeDeliveryRecord(value, { watchId: this.#watchId });
  }

  async #write(record) {
    await this.#storage.writeJson(REPAIR_DELIVERY_FILE_NAME, record, { maximumBytes: DELIVERY_FILE_MAXIMUM_BYTES });
  }
}
