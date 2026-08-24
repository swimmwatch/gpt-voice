import { AtomicStateStore } from './atomic-state-store.mjs';
import { FocusedVerificationRunner } from './focused-verification-runner.mjs';
import { GitDeliveryService } from './git-delivery-service.mjs';
import { ProcessWatchCancellationController } from './process-watch-cancellation-controller.mjs';
import { normalizeProcessWatchInvocation, normalizeProcessWatchTarget } from './process-watch-invocation.mjs';
import { ProcessWatchOrchestrator } from './process-watch-orchestrator.mjs';
import { blockerForWatchOutcome } from './process-watch-transition-table.mjs';
import {
  REPAIR_CANCELLATION_FILE_NAME,
  REPAIR_CONTROL_SCHEMA_VERSION,
  normalizeProcessWatchCancellation,
} from './repair-control-contracts.mjs';
import { RepairOwnershipLedger } from './repair-ownership-ledger.mjs';
import { freezeRecord, isRecord, requireNonNegativeInteger, runtimeFail } from './runtime-core-support.mjs';
import { ProcessAdapter } from './runtime-contracts.mjs';
import {
  validateDigest,
  validateProcessStartToken,
  validateSafeId,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const BLOCKABLE_REPAIR_PHASES = new Set(['NeedsAgent', 'Repairing', 'Verifying', 'Restarting']);
const CANCELLABLE_REPAIR_PHASES = new Set(['Repairing', 'Verifying', 'Restarting']);

function outcomeForBlocker(blocker) {
  const outcomes = Object.freeze({
    'authentication-failed': 'authentication_failed',
    'delivery-failed': 'delivery_failed',
    'dispatch-failed': 'dispatch_failed',
    'integrity-failed': 'integrity_failed',
    'scenario-changed': 'scenario_changed',
    'target-lost': 'target_lost',
    'verification-failed': 'verification_failed',
    'watcher-lost': 'watcher_lost',
  });
  return outcomes[blocker] ?? 'integrity_failed';
}

function outcomeForError(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code === 'repair-user-cancelled') return 'user_cancelled';
  if (code === 'scenario-changed') return 'scenario_changed';
  if (code.includes('authentication')) return 'authentication_failed';
  if (code.includes('dispatch')) return 'dispatch_failed';
  if (code === 'repair-fresh-target-required' || code.includes('target-lost')) return 'target_lost';
  if (code.includes('deadline') || code.includes('timed-out')) return 'timed_out';
  if (
    code === 'delivery-ambiguous' ||
    code === 'delivery-commit-failed' ||
    code === 'delivery-head-unchanged' ||
    code === 'delivery-push-ambiguous' ||
    code === 'delivery-push-failed' ||
    code === 'delivery-push-unverified' ||
    code === 'delivery-stage-failed'
  ) {
    return 'delivery_failed';
  }
  return 'integrity_failed';
}

/** Owns safe repair phases around agent edits while preserving every failed patch forward. */
export class ProcessWatchRepairController {
  #adapter;
  #cancellationController;
  #clock;
  #deliveryService;
  #orchestrator;
  #ownershipLedger;
  #processStartToken;
  #scenario;
  #scenarioDigest;
  #sessionId;
  #stateStore;
  #storage;
  #verificationRunner;
  #watchId;

  constructor({
    adapter,
    clock = () => Date.now(),
    deliveryService,
    orchestrator,
    ownershipLedger,
    processStartToken,
    scenario,
    scenarioDigest,
    sessionId,
    stateStore,
    storage,
    verificationRunner,
  } = {}) {
    if (!(adapter instanceof ProcessAdapter) || !(orchestrator instanceof ProcessWatchOrchestrator)) {
      runtimeFail('invalid-process-watch-repair-controller');
    }
    if (
      !(deliveryService instanceof GitDeliveryService) ||
      !(ownershipLedger instanceof RepairOwnershipLedger) ||
      !(verificationRunner instanceof FocusedVerificationRunner)
    ) {
      runtimeFail('invalid-process-watch-repair-controller');
    }
    if (
      !(stateStore instanceof AtomicStateStore) ||
      !(storage instanceof WatchRuntimeStorage) ||
      typeof clock !== 'function'
    ) {
      runtimeFail('invalid-process-watch-repair-controller');
    }
    if (!isRecord(scenario) || !isRecord(scenario.delivery) || typeof scenario.delivery.strategy !== 'string') {
      runtimeFail('invalid-process-watch-repair-controller');
    }
    if (stateStore.watchId !== storage.watchId) runtimeFail('invalid-process-watch-repair-controller');
    this.#adapter = adapter;
    this.#cancellationController = new ProcessWatchCancellationController({
      clock,
      processStartToken,
      sessionId,
      stateStore,
      storage,
    });
    this.#clock = clock;
    this.#deliveryService = deliveryService;
    this.#orchestrator = orchestrator;
    this.#ownershipLedger = ownershipLedger;
    this.#processStartToken = validateProcessStartToken(processStartToken, 'invalid-process-watch-repair-controller');
    this.#scenario = scenario;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-process-watch-repair-controller');
    this.#sessionId = validateSafeId(sessionId, 'invalid-process-watch-repair-controller');
    this.#stateStore = stateStore;
    this.#storage = storage;
    this.#verificationRunner = verificationRunner;
    this.#watchId = validateWatchId(storage.watchId, 'invalid-process-watch-repair-controller');
  }

  async beginRepair({ invocation } = {}) {
    return this.#withLock(async () => {
      let state = await this.#requirePhase('NeedsAgent');
      const cancelled = await this.#consumeCancellation(state);
      if (cancelled !== null) return this.#result(cancelled);
      const normalizedInvocation = this.#assertInvocationBinding(state, invocation);
      const timeoutMilliseconds = this.#remainingMilliseconds(state);
      if (this.#scenario.delivery.strategy === 'git-delivery') {
        await this.#deliveryService.assertArming({ timeoutMilliseconds });
      }
      await this.#ownershipLedger.arm({ expectedGeneration: state.generation, timeoutMilliseconds });
      state = await this.#orchestrator.advance({
        outcome: state.outcome ?? 'target_failed',
        summaryCode: 'repair-armed',
        toPhase: 'Repairing',
      });
      return this.#result(state, normalizedInvocation);
    });
  }

  async beginWrite({ candidatePaths } = {}) {
    return this.#withLock(async () => {
      const state = await this.#requirePhase('Repairing');
      const cancelled = await this.#consumeCancellation(state);
      if (cancelled !== null) return this.#result(cancelled);
      const summary = await this.#ownershipLedger.beginWrite({
        candidatePaths,
        expectedGeneration: state.generation,
        timeoutMilliseconds: this.#remainingMilliseconds(state),
      });
      return freezeRecord({ ...this.#result(state), repair: summary });
    });
  }

  async completeWrite({ candidatePaths } = {}) {
    return this.#withLock(async () => {
      const state = await this.#requirePhase('Repairing');
      const cancelled = await this.#consumeCancellation(state);
      if (cancelled !== null) return this.#result(cancelled);
      const summary = await this.#ownershipLedger.completeWrite({
        candidatePaths,
        expectedGeneration: state.generation,
        timeoutMilliseconds: this.#remainingMilliseconds(state),
      });
      return freezeRecord({ ...this.#result(state), repair: summary });
    });
  }

  async verify({ invocation } = {}) {
    return this.#withLock(async () => {
      let state = await this.#requirePhase('Repairing');
      const cancelled = await this.#consumeCancellation(state);
      if (cancelled !== null) return this.#result(cancelled);
      const normalizedInvocation = this.#assertInvocationBinding(state, invocation);
      const repair = await this.#ownershipLedger.assertStable({
        expectedGeneration: state.generation,
        timeoutMilliseconds: this.#remainingMilliseconds(state),
      });
      state = await this.#orchestrator.advance({
        outcome: state.outcome ?? 'target_failed',
        summaryCode: 'verification-started',
        toPhase: 'Verifying',
      });
      const verification = await this.#verificationRunner.run({
        attemptContext: this.#attemptContext(state, normalizedInvocation),
        deadlineEpochMilliseconds: state.deadlineEpochMilliseconds,
        generation: state.generation,
        headSha: repair.headSha,
        worktreeDigest: repair.worktreeDigest,
      });
      const cancelledAfterVerification = await this.#consumeCancellation(state);
      if (cancelledAfterVerification !== null) return this.#result(cancelledAfterVerification);
      if (!verification.succeeded) {
        state = await this.#orchestrator.advance({
          outcome: 'verification_failed',
          summaryCode: verification.summaryCode,
          toPhase: 'Repairing',
        });
      }
      return freezeRecord({ ...this.#result(state), verification });
    });
  }

  async deliverAndRestart({ invocation } = {}) {
    return this.#withLock(async () => {
      let state = await this.#requirePhase(['Verifying', 'Restarting']);
      const cancelled = await this.#consumeCancellation(state);
      if (cancelled !== null) return this.#result(cancelled);
      const normalizedInvocation = this.#assertInvocationBinding(state, invocation);
      let repair = null;
      if (state.phase === 'Verifying') {
        repair = await this.#ownershipLedger.assertStable({
          expectedGeneration: state.generation,
          timeoutMilliseconds: this.#remainingMilliseconds(state),
        });
        if (this.#scenario.delivery.strategy === 'no-restart') {
          state = await this.#orchestrator.advance({
            blocker: 'verification-failed',
            outcome: 'verification_failed',
            summaryCode: 'restart-not-declared',
            toPhase: 'Blocked',
          });
          return this.#result(state);
        }
        state = await this.#orchestrator.advance({
          outcome: state.outcome ?? 'target_failed',
          summaryCode: 'restart-started',
          toPhase: 'Restarting',
        });
      }
      let sourceSha = state.target?.sourceSha;
      if (this.#scenario.delivery.strategy === 'git-delivery') {
        if (this.#scenario.authority?.kind === 'version-scoped-github-release') {
          sourceSha = normalizedInvocation.sourceSha;
        }
        if (sourceSha === null || sourceSha === undefined) runtimeFail('delivery-source-required');
        let delivery = await this.#deliveryService.reconcile({
          attempt: state.target?.attempt ?? 0,
          expectedGeneration: state.generation,
          timeoutMilliseconds: this.#remainingMilliseconds(state),
        });
        if (delivery === null) {
          repair ??= await this.#ownershipLedger.assertStable({
            expectedGeneration: state.generation,
            timeoutMilliseconds: this.#remainingMilliseconds(state),
          });
          delivery = await this.#deliveryService.deliver({
            attempt: state.target?.attempt ?? 0,
            expectedGeneration: state.generation,
            patchDigest: repair.patchDigest,
            pushCurrentUpstream: this.#scenario.delivery.pushCurrentUpstream,
            sourceSha,
            timeoutMilliseconds: this.#remainingMilliseconds(state),
            worktreeDigest: repair.worktreeDigest,
          });
        }
        sourceSha = delivery.newSourceSha;
        await this.#ownershipLedger.markDelivered({
          expectedGeneration: state.generation,
          newHeadSha: sourceSha,
          timeoutMilliseconds: this.#remainingMilliseconds(state),
        });
      } else {
        await this.#ownershipLedger.assertStable({
          expectedGeneration: state.generation,
          timeoutMilliseconds: this.#remainingMilliseconds(state),
        });
      }
      const cancelledAfterDelivery = await this.#consumeCancellation(state);
      if (cancelledAfterDelivery !== null) return this.#result(cancelledAfterDelivery);
      const restartInvocation = freezeRecord({ ...normalizedInvocation, sourceSha, target: null });
      const context = this.#nextAttemptContext(state, restartInvocation, sourceSha);
      const preflight = await this.#adapter.preflight(context);
      const cancelledAfterPreflight = await this.#consumeCancellation(state);
      if (cancelledAfterPreflight !== null) return this.#result(cancelledAfterPreflight);
      if (preflight?.blocker !== undefined) {
        state = await this.#orchestrator.advance({
          blocker: preflight.blocker,
          outcome: outcomeForBlocker(preflight.blocker),
          summaryCode: 'repair-restart-preflight-blocked',
          toPhase: 'Blocked',
        });
        return this.#result(state);
      }
      const response =
        this.#scenario.delivery.strategy === 'git-delivery'
          ? await this.#adapter.start(context)
          : await this.#adapter.restart(this.#attemptContext(state, normalizedInvocation));
      const cancelledAfterRestart = await this.#consumeCancellation(state);
      if (cancelledAfterRestart !== null) return this.#result(cancelledAfterRestart);
      if (response?.status === 'blocked') {
        state = await this.#orchestrator.advance({
          blocker: response.blocker,
          outcome: outcomeForBlocker(response.blocker),
          summaryCode: 'repair-restart-blocked',
          toPhase: 'Blocked',
        });
        return this.#result(state);
      }
      if (!['attached', 'started'].includes(response?.status)) runtimeFail('repair-restart-response-invalid');
      const target = normalizeProcessWatchTarget(response.target, 'repair-fresh-target-required');
      if (state.target === null || target.attempt !== state.target.attempt + 1 || target.sourceSha !== sourceSha) {
        runtimeFail('repair-fresh-target-required');
      }
      const result = await this.#orchestrator.continueAfterRepair({
        invocation: restartInvocation,
        receiptId: response.receiptId,
        target,
      });
      return this.#result(result);
    });
  }

  async cancel() {
    return this.#cancellationController.cancel();
  }

  async #withLock(operation) {
    await this.#stateStore.acquireLock({ processStartToken: this.#processStartToken });
    try {
      return await operation();
    } catch (error) {
      return await this.#blockForError(error);
    } finally {
      await this.#stateStore.releaseLock();
    }
  }

  async #blockForError(error) {
    const state = await this.#readStateOrNull();
    if (state === null || !BLOCKABLE_REPAIR_PHASES.has(state.phase)) throw error;
    const outcome = outcomeForError(error);
    if (outcome === 'user_cancelled') {
      const cancelled = await this.#orchestrator.advance({
        outcome: 'user_cancelled',
        summaryCode: 'repair-cancelled',
        toPhase: 'Cancelled',
      });
      return this.#result(cancelled);
    }
    const blocked = await this.#orchestrator.advance({
      blocker: blockerForWatchOutcome(outcome),
      outcome,
      summaryCode: typeof error?.code === 'string' ? error.code : 'repair-blocked',
      toPhase: 'Blocked',
    });
    return this.#result(blocked);
  }

  #assertInvocationBinding(state, invocation) {
    const normalized = normalizeProcessWatchInvocation(invocation, this.#scenario);
    const releaseSourceRebind = this.#scenario.authority?.kind === 'version-scoped-github-release';
    if (
      state.scenarioDigest !== this.#scenarioDigest ||
      state.timeoutSeconds !== normalized.timeoutSeconds ||
      state.deadlineEpochMilliseconds !== normalized.deadlineEpochMilliseconds ||
      state.target === null ||
      (!releaseSourceRebind && state.target.sourceSha !== normalized.sourceSha)
    ) {
      runtimeFail('scenario-changed');
    }
    return normalized;
  }

  #attemptContext(state, invocation) {
    if (state.target === null) runtimeFail('repair-target-required');
    return freezeRecord({
      attempt: state.target.attempt,
      generation: state.generation,
      inputDigest: invocation.inputDigest,
      sourceSha: state.target.sourceSha,
      target: state.target,
      targetId: state.target.targetId,
      targetSelector: invocation.targetSelector,
      timeoutMilliseconds: state.timeoutSeconds * 1_000,
      timeoutSeconds: state.timeoutSeconds,
    });
  }

  #nextAttemptContext(state, invocation, sourceSha) {
    if (state.target === null) runtimeFail('repair-target-required');
    return freezeRecord({
      attempt: state.target.attempt + 1,
      generation: state.generation,
      inputDigest: invocation.inputDigest,
      sourceSha,
      target: null,
      targetId: state.target.targetId,
      targetSelector: invocation.targetSelector,
      timeoutMilliseconds: state.timeoutSeconds * 1_000,
      timeoutSeconds: state.timeoutSeconds,
    });
  }

  async #consumeCancellation(state) {
    const value = await this.#storage.readJson(REPAIR_CANCELLATION_FILE_NAME);
    if (value === null) return null;
    normalizeProcessWatchCancellation(value, { sessionId: this.#sessionId, watchId: this.#watchId });
    if (!CANCELLABLE_REPAIR_PHASES.has(state.phase)) runtimeFail('repair-cancellation-unexpected');
    const cancelled = await this.#orchestrator.advance({
      outcome: 'user_cancelled',
      summaryCode: 'repair-cancelled',
      toPhase: 'Cancelled',
    });
    await this.#storage.removeRegularFile(REPAIR_CANCELLATION_FILE_NAME).catch(() => undefined);
    return cancelled;
  }

  #remainingMilliseconds(state) {
    const remaining = state.deadlineEpochMilliseconds - this.#now();
    if (remaining <= 0) runtimeFail('repair-deadline-exceeded');
    return remaining;
  }

  async #requirePhase(expectedPhases) {
    const state = await this.#stateStore.readState();
    const phases = Array.isArray(expectedPhases) ? expectedPhases : [expectedPhases];
    if (state === null || !phases.includes(state.phase)) runtimeFail('repair-phase-invalid');
    return state;
  }

  async #readStateOrNull() {
    try {
      return await this.#stateStore.readState();
    } catch {
      return null;
    }
  }

  #result(state, invocation = undefined) {
    return freezeRecord({
      blocker: state.blocker,
      generation: state.generation,
      outcome: state.outcome,
      phase: state.phase,
      ...(invocation === undefined ? {} : { timeoutSeconds: invocation.timeoutSeconds }),
      watchId: state.watchId,
    });
  }

  #now() {
    return requireNonNegativeInteger(this.#clock(), 'invalid-repair-clock', Number.MAX_SAFE_INTEGER);
  }
}
