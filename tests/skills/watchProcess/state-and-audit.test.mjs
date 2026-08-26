import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';

import {
  ACTIVE_JOURNAL_FILE_NAME,
  AtomicStateStore,
  AuditJournal,
  OperationReceiptStore,
  SuccessAttestation,
  WatchRuntimeStorage,
  createOperationKey,
  normalizeRuntimeState,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';
import { OPERATION_RECEIPT_SCHEMA_VERSION } from '../../../.agents/skills/watch-process/scripts/lib/runtime-state-contracts.mjs';

const WATCH_ID = 'watch-001';
const WORKSPACE_ID = 'worktree-001';
const SESSION_ID = 'session-001';
const START_TOKEN = 'a'.repeat(32);
const OTHER_START_TOKEN = 'b'.repeat(32);
const DIGESTS = Object.freeze({
  fixedInputs: '1'.repeat(64),
  library: '2'.repeat(64),
  requiredContract: '3'.repeat(64),
  scenario: '4'.repeat(64),
  script: '5'.repeat(64),
  target: '6'.repeat(64),
  verificationCommand: '7'.repeat(64),
  verificationHead: '8'.repeat(64),
  verificationInput: '9'.repeat(64),
});

function validState({
  blocker = null,
  deadlineEpochMilliseconds = 1_000,
  generation = 0,
  outcome = null,
  phase = 'Armed',
  startToken = START_TOKEN,
  target = null,
  watchId = WATCH_ID,
} = {}) {
  return {
    blocker,
    deadlineEpochMilliseconds,
    failureFingerprints: [],
    generation,
    heartbeat: { atEpochMilliseconds: 10 + generation, startToken },
    libraryDigest: DIGESTS.library,
    outcome,
    phase,
    receiptIds: [],
    scenarioDigest: DIGESTS.scenario,
    scenarioId: 'scenario-001',
    schemaVersion: 1,
    scriptDigest: DIGESTS.script,
    sessionId: SESSION_ID,
    target,
    timeoutSeconds: 60,
    watchId,
    workspaceId: WORKSPACE_ID,
  };
}

function targetIdentity() {
  return {
    attempt: 1,
    identityDigest: DIGESTS.target,
    sourceSha: 'c'.repeat(40),
    targetId: 'target-001',
  };
}

function operation(generation = 0, kind = 'start') {
  return {
    fixedInputsDigest: DIGESTS.fixedInputs,
    generation,
    kind,
    scenarioDigest: DIGESTS.scenario,
    sourceSha: 'c'.repeat(40),
    watchId: WATCH_ID,
  };
}

function auditEvent(generation = 0) {
  return {
    actor: 'watcher',
    generation,
    libraryDigest: DIGESTS.library,
    outcome: null,
    phase: 'Armed',
    previousPhase: null,
    receiptId: null,
    scenarioDigest: DIGESTS.scenario,
    scriptDigest: DIGESTS.script,
    sourceSha: 'c'.repeat(40),
    summaryCode: 'watch-armed',
    targetIdentityDigest: null,
  };
}

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'watch-process-state-'));
  try {
    return await run(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

function createStorage(workspaceRoot, watchId = WATCH_ID) {
  return new WatchRuntimeStorage({ watchId, workspaceRoot });
}

function createStateStore(storage, { clock = () => 100, livenessProbe, sessionId = SESSION_ID } = {}) {
  return new AtomicStateStore({
    clock,
    livenessProbe,
    processId: 1234,
    sessionId,
    storage,
    workspaceId: WORKSPACE_ID,
  });
}

function attestationInput() {
  return {
    cleanup: { directChildExited: true, resultCode: 'cleanup-complete', treeVerified: true },
    finalObservationEpochMilliseconds: 100,
    generation: 4,
    libraryDigest: DIGESTS.library,
    operationKeys: [DIGESTS.fixedInputs],
    receiptIds: ['receipt-001'],
    requiredContract: {
      digest: DIGESTS.requiredContract,
      results: [{ allowedSkipped: false, conclusion: 'success', resultId: 'check-001' }],
    },
    scenario: { digest: DIGESTS.scenario, id: 'scenario-001', version: 'v1.0.0' },
    schemaVersion: 1,
    scriptDigest: DIGESTS.script,
    target: {
      identityDigest: DIGESTS.target,
      members: [{ attempt: 1, identityDigest: DIGESTS.target, memberId: 'member-001' }],
      sourceSha: 'c'.repeat(40),
      targetId: 'target-001',
    },
    timeoutSeconds: 60,
    verification: [
      {
        classification: 'succeeded',
        commandDigest: DIGESTS.verificationCommand,
        headIdentityDigest: DIGESTS.verificationHead,
        inputIdentityDigest: DIGESTS.verificationInput,
      },
    ],
    watchId: WATCH_ID,
  };
}

function freshProofFrom(attestation) {
  return {
    observedAtEpochMilliseconds: attestation.finalObservationEpochMilliseconds + 1,
    proofKind: 'external',
    receiptIds: attestation.receiptIds,
    requiredContract: attestation.requiredContract,
    target: attestation.target,
    verification: attestation.verification,
    watchId: attestation.watchId,
  };
}

describe('watch-process private state, receipts, and audit', () => {
  it('creates one private root and fails closed on concurrent, stale, or reused lock ownership', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const firstStorage = createStorage(workspaceRoot);
      const firstStore = createStateStore(firstStorage, { livenessProbe: async () => 'matching' });
      await firstStore.acquireLock({ processStartToken: START_TOKEN });

      const secondStore = createStateStore(createStorage(workspaceRoot), { livenessProbe: async () => 'reused' });
      assert.deepEqual(await secondStore.inspectLock(), { generation: 0, kind: 'reused' });
      await assert.rejects(() => secondStore.acquireLock({ processStartToken: OTHER_START_TOKEN }), {
        code: 'lock-already-held',
      });

      const staleStore = createStateStore(createStorage(workspaceRoot), { livenessProbe: async () => 'not-running' });
      assert.deepEqual(await staleStore.inspectLock(), { generation: 0, kind: 'not-running' });
      await assert.rejects(() => staleStore.acquireLock({ processStartToken: OTHER_START_TOKEN }), {
        code: 'lock-already-held',
      });
      assert.equal(firstStore.ownsLock, true);

      const concurrentStorage = createStorage(workspaceRoot, 'watch-concurrent');
      const attempts = await Promise.allSettled([
        createStateStore(concurrentStorage).acquireLock({ processStartToken: START_TOKEN }),
        createStateStore(createStorage(workspaceRoot, 'watch-concurrent')).acquireLock({
          processStartToken: OTHER_START_TOKEN,
        }),
      ]);
      assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
      assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
    });
  });

  it('recovers only a disproven abandoned lock that still matches persisted state', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = createStorage(workspaceRoot);
      const abandoned = createStateStore(storage);
      await abandoned.acquireLock({ processStartToken: START_TOKEN });
      await abandoned.writeInitialState(validState());

      const recovery = createStateStore(createStorage(workspaceRoot), {
        livenessProbe: async ({ pid, startToken }) => {
          assert.equal(pid, 1234);
          assert.equal(startToken, START_TOKEN);
          return 'not-running';
        },
      });
      assert.deepEqual(await recovery.recoverAbandonedLock(), {
        generation: 0,
        kind: 'recovered-abandoned-lock',
      });
      await recovery.acquireLock({ processStartToken: OTHER_START_TOKEN });
      assert.equal(recovery.ownsLock, true);
      await recovery.releaseLock();
    });

    await withWorkspace(async (workspaceRoot) => {
      const storage = createStorage(workspaceRoot);
      const active = createStateStore(storage);
      await active.acquireLock({ processStartToken: START_TOKEN });
      await active.writeInitialState(validState());

      const uncertain = createStateStore(createStorage(workspaceRoot), {
        livenessProbe: async () => 'unknown',
      });
      assert.deepEqual(await uncertain.recoverAbandonedLock(), {
        kind: 'preserved-lock',
        lock: 'unknown',
      });
      await assert.rejects(() => uncertain.acquireLock({ processStartToken: OTHER_START_TOKEN }), {
        code: 'lock-already-held',
      });
    });

    await withWorkspace(async (workspaceRoot) => {
      const storage = createStorage(workspaceRoot);
      const mismatched = createStateStore(storage);
      await mismatched.acquireLock({ processStartToken: START_TOKEN });
      await mismatched.writeInitialState(validState());
      await storage.writeJson('state.json', validState({ startToken: OTHER_START_TOKEN }));

      const recovery = createStateStore(createStorage(workspaceRoot), {
        livenessProbe: async () => 'not-running',
      });
      assert.deepEqual(await recovery.recoverAbandonedLock(), { kind: 'preserved-ambiguous-state' });
      await assert.rejects(() => recovery.acquireLock({ processStartToken: OTHER_START_TOKEN }), {
        code: 'lock-already-held',
      });
    });
  });

  it('writes state atomically with lock-bound monotonic generation CAS', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = createStorage(workspaceRoot);
      const store = createStateStore(storage);
      await store.acquireLock({ processStartToken: START_TOKEN });
      await store.writeInitialState(validState());
      const advanced = validState({ generation: 1, phase: 'Preparing' });
      assert.equal((await store.compareAndSwap({ expectedGeneration: 0, state: advanced })).generation, 1);
      assert.equal((await store.readState()).phase, 'Preparing');
      const competingUpdates = await Promise.allSettled([
        store.compareAndSwap({ expectedGeneration: 1, state: validState({ generation: 2, phase: 'Watching' }) }),
        store.compareAndSwap({ expectedGeneration: 1, state: validState({ generation: 2, phase: 'NeedsAgent' }) }),
      ]);
      const completedUpdate = competingUpdates.find((attempt) => attempt.status === 'fulfilled');
      assert.equal(competingUpdates.filter((attempt) => attempt.status === 'fulfilled').length, 1);
      assert.equal(competingUpdates.filter((attempt) => attempt.status === 'rejected').length, 1);
      assert.equal((await store.readState()).phase, completedUpdate.value.phase);
      await assert.rejects(() => store.compareAndSwap({ expectedGeneration: 0, state: advanced }), {
        code: 'lock-ownership-mismatch',
      });
      await assert.rejects(
        () => store.compareAndSwap({ expectedGeneration: 2, state: validState({ generation: 2, phase: 'Watching' }) }),
        { code: 'invalid-state-ownership' },
      );
    });
  });

  it('rejects corrupt, oversized, absolute-path, and raw-output state data', async () => {
    await withWorkspace(async (workspaceRoot) => {
      assert.throws(
        () =>
          new WatchRuntimeStorage({
            pathApi: { join() {}, resolve() {}, sep: '/' },
            watchId: WATCH_ID,
            workspaceRoot,
          }),
        { code: 'invalid-runtime-path-api' },
      );
      const storage = createStorage(workspaceRoot);
      const store = createStateStore(storage);
      await store.acquireLock({ processStartToken: START_TOKEN });
      await store.writeInitialState(validState());
      await writeFile(path.join(storage.rootPath, 'state.json'), '{');
      await assert.rejects(() => store.readState(), { code: 'state-corrupt' });
      await writeFile(path.join(storage.rootPath, 'state.json'), Buffer.alloc(1_048_577, 0x78));
      await assert.rejects(() => store.readState(), { code: 'state-corrupt' });

      assert.throws(
        () => normalizeRuntimeState(validState({ target: { ...targetIdentity(), targetId: '/tmp/raw-output' } })),
        { code: 'invalid-runtime-state' },
      );
      assert.throws(
        () =>
          normalizeRuntimeState(validState({ target: { ...targetIdentity(), targetId: 'raw output is not an id' } })),
        { code: 'invalid-runtime-state' },
      );
      assert.throws(() => normalizeRuntimeState({ ...validState(), command: 'do not serialize' }), {
        code: 'invalid-runtime-state',
      });
    });
  });

  it('rejects symbolic-link attacks and applies owner-only file permissions where supported', async (context) => {
    if (process.platform === 'win32') {
      context.skip('Windows symlink creation depends on local privileges');
      return;
    }
    await withWorkspace(async (workspaceRoot) => {
      const storage = createStorage(workspaceRoot);
      await storage.initialize();
      const outsidePath = path.join(workspaceRoot, 'outside.json');
      await writeFile(outsidePath, '{}');
      await symlink(outsidePath, path.join(storage.rootPath, 'lock.json'));
      const store = createStateStore(storage);
      await assert.rejects(() => store.acquireLock({ processStartToken: START_TOKEN }), {
        code: 'runtime-file-link-rejected',
      });

      const secondStorage = createStorage(workspaceRoot, 'watch-002');
      const secondStore = createStateStore(secondStorage);
      await secondStore.acquireLock({ processStartToken: START_TOKEN });
      if (process.platform !== 'win32') {
        const metadata = await stat(path.join(secondStorage.rootPath, 'lock.json'));
        assert.equal(metadata.mode & 0o077, 0);
      }

      const thirdStorage = createStorage(workspaceRoot, 'watch-004');
      await thirdStorage.initialize();
      const movedRootPath = `${thirdStorage.rootPath}-moved`;
      const outsideDirectory = path.join(workspaceRoot, 'outside-directory');
      await mkdir(outsideDirectory);
      await rename(thirdStorage.rootPath, movedRootPath);
      await symlink(outsideDirectory, thirdStorage.rootPath);
      await assert.rejects(() => thirdStorage.writeText('state.json', '{}'), {
        code: 'runtime-directory-link-rejected',
      });
    });
  });

  it('persists intent before a receipt and reconciles zero, one, and ambiguous exact matches idempotently', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = createStorage(workspaceRoot);
      const stateStore = createStateStore(storage);
      await stateStore.acquireLock({ processStartToken: START_TOKEN });
      await stateStore.writeInitialState(validState());
      const receipts = new OperationReceiptStore({ stateStore, storage });
      const [firstIntent, secondIntent] = await Promise.all([
        receipts.recordIntent({ expectedGeneration: 0, operation: operation() }),
        receipts.recordIntent({ expectedGeneration: 0, operation: operation() }),
      ]);
      const created = [firstIntent, secondIntent].find((result) => result.kind === 'created');
      const duplicate = [firstIntent, secondIntent].find((result) => result.kind === 'existing');
      assert.notEqual(created, undefined);
      assert.notEqual(duplicate, undefined);
      assert.equal(created.kind, 'created');
      assert.equal(duplicate.kind, 'existing');
      assert.equal(created.intent.operationKey, createOperationKey(operation()));

      const afterCrash = new OperationReceiptStore({ stateStore, storage });
      const firstReconciliation = await afterCrash.reconcile({
        exactMatches: [],
        expectedGeneration: 0,
        identityProven: true,
        operationKey: created.intent.operationKey,
      });
      assert.equal(firstReconciliation.kind, 'fresh-operation-permitted');
      const secondReconciliation = await afterCrash.reconcile({
        exactMatches: [],
        expectedGeneration: 0,
        identityProven: true,
        operationKey: created.intent.operationKey,
      });
      assert.deepEqual(secondReconciliation, { blocker: 'dispatch-failed', kind: 'blocked' });

      const attached = await afterCrash.reconcile({
        exactMatches: [targetIdentity()],
        expectedGeneration: 0,
        identityProven: true,
        operationKey: created.intent.operationKey,
      });
      assert.equal(attached.kind, 'attached');
      const recorded = await afterCrash.recordReceipt({
        expectedGeneration: 0,
        receipt: {
          operationKey: created.intent.operationKey,
          receiptId: 'receipt-001',
          target: targetIdentity(),
          watchId: WATCH_ID,
        },
      });
      assert.equal(recorded.kind, 'recorded');
      assert.equal((await afterCrash.read()).receipts.length, 1);
      const terminalReceipt = {
        operationKey: created.intent.operationKey,
        receiptId: 'receipt-001',
        target: targetIdentity(),
        terminalDigest: 'e'.repeat(64),
        watchId: WATCH_ID,
      };
      assert.equal(
        (await afterCrash.recordTerminalReceipt({ expectedGeneration: 0, receipt: terminalReceipt })).kind,
        'recorded',
      );
      const afterTerminalCrash = new OperationReceiptStore({ stateStore, storage });
      assert.equal(
        (await afterTerminalCrash.recordTerminalReceipt({ expectedGeneration: 0, receipt: terminalReceipt })).kind,
        'existing',
      );
      assert.equal((await afterTerminalCrash.read()).terminalReceipts.length, 1);
      await assert.rejects(
        () =>
          afterTerminalCrash.recordTerminalReceipt({
            expectedGeneration: 0,
            receipt: { ...terminalReceipt, terminalDigest: 'f'.repeat(64) },
          }),
        { code: 'operation-terminal-receipt-conflict' },
      );
      const currentLog = await afterTerminalCrash.read();
      await storage.writeJson('receipts.json', {
        intents: currentLog.intents,
        receipts: currentLog.receipts,
        schemaVersion: 1,
        watchId: currentLog.watchId,
      });
      const migratedLog = await new OperationReceiptStore({ stateStore, storage }).read();
      assert.equal(migratedLog.schemaVersion, OPERATION_RECEIPT_SCHEMA_VERSION);
      assert.deepEqual(migratedLog.terminalReceipts, []);

      const retry = await afterCrash.recordIntent({ expectedGeneration: 0, operation: operation(0, 'retry') });
      const ambiguous = await afterCrash.reconcile({
        exactMatches: [targetIdentity(), { ...targetIdentity(), attempt: 2, identityDigest: 'd'.repeat(64) }],
        expectedGeneration: 0,
        identityProven: true,
        operationKey: retry.intent.operationKey,
      });
      assert.deepEqual(ambiguous, { blocker: 'dispatch-failed', kind: 'blocked' });
      assert.deepEqual(
        await afterCrash.reconcile({
          exactMatches: [targetIdentity()],
          expectedGeneration: 0,
          identityProven: true,
          operationKey: retry.intent.operationKey,
        }),
        { blocker: 'dispatch-failed', kind: 'blocked' },
      );
    });
  });

  it('maintains a sanitized monotonic audit journal with bounded archive retention', async () => {
    await withWorkspace(async (workspaceRoot) => {
      let now = 1_000;
      const storage = createStorage(workspaceRoot);
      const stateStore = createStateStore(storage, { clock: () => now });
      await stateStore.acquireLock({ processStartToken: START_TOKEN });
      await stateStore.writeInitialState(validState());
      const journal = new AuditJournal({ clock: () => now++, stateStore, storage });
      await Promise.all(
        Array.from({ length: 401 }, () => journal.append({ event: auditEvent(), expectedGeneration: 0 })),
      );
      const active = await journal.readActive();
      assert.equal(active.length, 1);
      assert.equal(active[0].sequence, 401);
      const archives = (await storage.listRegularFileNames()).filter((name) => /^events\.\d+-\d+\.jsonl$/u.test(name));
      assert.equal(archives.length, 3);
      const rawJournal = await readFile(path.join(storage.rootPath, ACTIVE_JOURNAL_FILE_NAME), 'utf8');
      assert.equal(rawJournal.includes(workspaceRoot), false);
      assert.equal(rawJournal.includes('command'), false);
    });
  });

  it('requires a fresh matching proof before accepting a success attestation', () => {
    const contract = new SuccessAttestation();
    const attestation = contract.build(attestationInput());
    const proof = freshProofFrom(attestation);
    assert.equal(contract.validate({ attestation, freshProof: proof }).success, true);
    assert.throws(() => contract.validate({ attestation }), { code: 'fresh-success-proof-required' });
    assert.throws(() => contract.validate({ attestation, freshProof: { ...proof, observedAtEpochMilliseconds: 99 } }), {
      code: 'stale-success-proof',
    });
    assert.throws(
      () =>
        contract.validate({
          attestation: {
            ...attestation,
            requiredContract: {
              ...attestation.requiredContract,
              results: [{ allowedSkipped: false, conclusion: 'failure', resultId: 'check-001' }],
            },
          },
          freshProof: proof,
        }),
      { code: 'success-proof-mismatch' },
    );
  });

  it('cleans only expired terminal known artifacts and preserves ambiguous files', async (context) => {
    if (process.platform === 'win32') {
      context.skip('Windows symlink creation depends on local privileges');
      return;
    }
    await withWorkspace(async (workspaceRoot) => {
      let now = 2_000;
      const storage = createStorage(workspaceRoot);
      const store = createStateStore(storage, { clock: () => now });
      await store.acquireLock({ processStartToken: START_TOKEN });
      await store.writeInitialState(
        validState({ deadlineEpochMilliseconds: 1, outcome: 'succeeded', phase: 'Success' }),
      );
      await storage.writeJson('receipts.json', { safe: true });
      await storage.writeText('events.jsonl', '');
      await storage.writeJson('attestation.json', { safe: true });
      await store.releaseLock();
      assert.deepEqual(await store.cleanupExpired({ retentionMilliseconds: 0 }), {
        kind: 'removed-expired-artifacts',
        removedCount: 4,
      });
      assert.deepEqual(await store.cleanupExpired({ retentionMilliseconds: 0 }), { kind: 'nothing-to-clean' });

      now = 3_000;
      const protectedStorage = createStorage(workspaceRoot, 'watch-003');
      const protectedStore = createStateStore(protectedStorage, { clock: () => now });
      await protectedStore.acquireLock({ processStartToken: START_TOKEN });
      await protectedStore.writeInitialState(
        validState({ deadlineEpochMilliseconds: 1, outcome: 'succeeded', phase: 'Success', watchId: 'watch-003' }),
      );
      await symlink(path.join(workspaceRoot, 'outside.json'), path.join(protectedStorage.rootPath, 'events.jsonl'));
      await protectedStore.releaseLock();
      assert.deepEqual(await protectedStore.cleanupExpired({ retentionMilliseconds: 0 }), {
        kind: 'preserved-ambiguous-artifacts',
      });
    });
  });

  it('preserves expired state when the runtime root contains an unknown directory', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = createStorage(workspaceRoot);
      const store = createStateStore(storage, { clock: () => 2_000 });
      await store.acquireLock({ processStartToken: START_TOKEN });
      await store.writeInitialState(
        validState({ deadlineEpochMilliseconds: 1, outcome: 'succeeded', phase: 'Success' }),
      );
      await mkdir(path.join(storage.rootPath, 'evidence'));
      await store.releaseLock();

      assert.deepEqual(await store.cleanupExpired({ retentionMilliseconds: 0 }), {
        kind: 'preserved-ambiguous-artifacts',
      });
      assert.notEqual(await storage.readText('state.json'), null);
    });
  });
});
