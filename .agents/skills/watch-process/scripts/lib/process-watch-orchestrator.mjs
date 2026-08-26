import { AuditJournal } from './audit-journal.mjs';
import { AtomicStateStore } from './atomic-state-store.mjs';
import { DeadlineAwarePoller } from './deadline-aware-poller.mjs';
import { MonotonicDeadline } from './monotonic-deadline.mjs';
import { normalizeProcessWatchInvocation, normalizeProcessWatchTarget } from './process-watch-invocation.mjs';
import { ProcessWatchTransitionTable } from './process-watch-transition-table.mjs';
import { REPAIR_CANCELLATION_FILE_NAME, normalizeProcessWatchCancellation } from './repair-control-contracts.mjs';
import { ProcessAdapter } from './runtime-contracts.mjs';
import {
  RUNTIME_STATE_SCHEMA_VERSION,
  validateDigest,
  validateProcessStartToken,
  validateReceiptId,
  validateSafeId,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import {
  RuntimeCoreError,
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { SuccessAttestation } from './success-attestation.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const ATTESTATION_FILE_NAME = 'attestation.json';
const MAX_FAILURE_FINGERPRINTS = 100;
const LOCAL_ADAPTERS = new Set(['docker-build', 'local-command']);
const AGENT_CONTROLLED_PHASES = new Set(['NeedsAgent', 'Repairing', 'Verifying', 'Restarting']);
const INTERRUPTED_WATCHER_PHASES = new Set(['Preparing', 'Watching', 'Finalizing']);

function sameTarget(left, right) {
  return (
    left !== null &&
    right !== null &&
    left.attempt === right.attempt &&
    left.identityDigest === right.identityDigest &&
    left.sourceSha === right.sourceSha &&
    left.targetId === right.targetId
  );
}

function outcomeFromBlocker(blocker) {
  const mapping = Object.freeze({
    'authentication-failed': 'authentication_failed',
    'delivery-failed': 'delivery_failed',
    'dispatch-failed': 'dispatch_failed',
    'integrity-failed': 'integrity_failed',
    'scenario-changed': 'scenario_changed',
    'target-lost': 'target_lost',
    'verification-failed': 'verification_failed',
    'watcher-lost': 'watcher_lost',
  });
  return mapping[blocker] ?? 'monitoring_failed';
}

function outcomeFromError(error) {
  const code = error instanceof RuntimeCoreError ? error.code : null;
  if (code === null) return 'integrity_failed';
  if (code.includes('authentication')) return 'authentication_failed';
  if (code.includes('dispatch')) return 'dispatch_failed';
  if (code.includes('delivery')) return 'delivery_failed';
  if (code.includes('verification') || code.includes('success-proof') || code.includes('attestation')) {
    return 'verification_failed';
  }
  if (code.includes('deadline') || code.includes('timed-out')) return 'timed_out';
  if (code.includes('target-lost') || code.includes('target-identity')) return 'target_lost';
  if (code.includes('scenario') || code.includes('digest')) return 'scenario_changed';
  if (code.includes('lock') || code.includes('generation') || code.includes('state')) return 'monitoring_failed';
  return 'integrity_failed';
}

function safeSummaryCode(value, fallback = 'state-transition') {
  if (typeof value === 'string' && /^[a-z][a-z0-9-]{2,63}$/u.test(value)) return value;
  return fallback;
}

function normalizeReceiptIds(values) {
  if (!Array.isArray(values) || values.length > 100) runtimeFail('invalid-watch-receipt-ids');
  const normalized = values.map((value) => validateReceiptId(value, 'invalid-watch-receipt-ids'));
  if (new Set(normalized).size !== normalized.length) runtimeFail('invalid-watch-receipt-ids');
  return freezeArray(normalized);
}

function targetFromResponse(response) {
  if (!isRecord(response) || !Object.hasOwn(response, 'target')) runtimeFail('adapter-target-missing');
  return normalizeProcessWatchTarget(response.target, 'adapter-target-missing');
}

function responseStatus(response) {
  if (!isRecord(response) || typeof response.status !== 'string') runtimeFail('invalid-adapter-response');
  return response.status;
}

/**
 * Owns one watcher process's phase state, safe adapter calls, audit events,
 * deadline polling, and terminal proof. It intentionally stops at NeedsAgent;
 * source repair and delivery remain owned by later task packets.
 */
export class ProcessWatchOrchestrator {
  #adapter;
  #auditJournal;
  #clock;
  #deadlineFactory;
  #libraryDigest;
  #operationGeneration = null;
  #poller;
  #processStartToken;
  #scenario;
  #scenarioDigest;
  #scriptDigest;
  #sessionId;
  #stateStore;
  #storage;
  #successAttestation;
  #transitionTable;
  #watchId;
  #workspaceId;

  constructor({
    adapter,
    auditJournal,
    clock = () => Date.now(),
    deadlineFactory = (options) => new MonotonicDeadline(options),
    libraryDigest,
    poller = new DeadlineAwarePoller(),
    processStartToken,
    scenario,
    scenarioDigest,
    scriptDigest,
    sessionId,
    stateStore,
    storage,
    successAttestation = new SuccessAttestation(),
    transitionTable = new ProcessWatchTransitionTable(),
    workspaceId,
  } = {}) {
    if (
      !(adapter instanceof ProcessAdapter) ||
      !(auditJournal instanceof AuditJournal) ||
      !(poller instanceof DeadlineAwarePoller)
    ) {
      runtimeFail('invalid-process-watch-orchestrator-dependency');
    }
    if (!(stateStore instanceof AtomicStateStore) || !(storage instanceof WatchRuntimeStorage)) {
      runtimeFail('invalid-process-watch-orchestrator-dependency');
    }
    if (
      !(successAttestation instanceof SuccessAttestation) ||
      !(transitionTable instanceof ProcessWatchTransitionTable)
    ) {
      runtimeFail('invalid-process-watch-orchestrator-dependency');
    }
    if (
      typeof clock !== 'function' ||
      typeof deadlineFactory !== 'function' ||
      stateStore.watchId !== storage.watchId
    ) {
      runtimeFail('invalid-process-watch-orchestrator-dependency');
    }
    if (
      !isRecord(scenario) ||
      typeof scenario.id !== 'string' ||
      !isRecord(scenario.target) ||
      !isRecord(scenario.timing)
    ) {
      runtimeFail('invalid-process-watch-orchestrator-scenario');
    }
    this.#adapter = adapter;
    this.#auditJournal = auditJournal;
    this.#clock = clock;
    this.#deadlineFactory = deadlineFactory;
    this.#libraryDigest = validateDigest(libraryDigest, 'invalid-process-watch-orchestrator-digest');
    this.#poller = poller;
    this.#processStartToken = validateProcessStartToken(processStartToken, 'invalid-process-watch-orchestrator-token');
    this.#scenario = scenario;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-process-watch-orchestrator-digest');
    this.#scriptDigest = validateDigest(scriptDigest, 'invalid-process-watch-orchestrator-digest');
    this.#sessionId = validateSafeId(sessionId, 'invalid-process-watch-orchestrator-id');
    this.#stateStore = stateStore;
    this.#storage = storage;
    this.#successAttestation = successAttestation;
    this.#transitionTable = transitionTable;
    this.#watchId = validateWatchId(storage.watchId, 'invalid-process-watch-orchestrator-id');
    this.#workspaceId = validateSafeId(workspaceId, 'invalid-process-watch-orchestrator-id');
  }

  /** Starts or resumes only the persisted target represented by invocation. */
  async run(invocation) {
    const normalizedInvocation = normalizeProcessWatchInvocation(invocation, this.#scenario);
    let state = null;
    await this.#stateStore.acquireLock({ processStartToken: this.#processStartToken });
    try {
      state = await this.#stateStore.readState();
      if (state === null) {
        state = await this.#createInitialState(normalizedInvocation);
      } else {
        this.#assertStateBinding(state, normalizedInvocation);
      }

      if (
        state.phase === 'Success' ||
        state.phase === 'Cancelled' ||
        state.phase === 'NeedsAgent' ||
        state.phase === 'Blocked'
      ) {
        return this.#result(state);
      }
      if (state.phase === 'Armed' || state.phase === 'Preparing') {
        return await this.#prepare(state, normalizedInvocation);
      }
      if (state.phase === 'Watching') {
        // A new process cannot prove ownership of a local child started by a
        // crashed watcher. It must not infer the missing operation generation.
        return await this.#block(state, 'watcher_lost', 'watcher-recovery-required');
      }
      if (state.phase === 'Finalizing') return await this.#finalize(state, normalizedInvocation);
      return await this.#block(state, 'integrity_failed', 'unsupported-resume-phase');
    } catch (error) {
      const latestState = await this.#stateStore.readState().catch(() => state);
      if (latestState !== null) {
        return await this.#safeBlock(latestState, outcomeFromError(error), safeSummaryCode(error?.code));
      }
      throw error;
    } finally {
      await this.#stateStore.releaseLock();
    }
  }

  /** Refreshes an explicitly resumed deadline and safely reattaches interrupted monitoring. */
  async resume(invocation, { allowVersionScopedReleaseRecovery = false } = {}) {
    const normalizedInvocation = normalizeProcessWatchInvocation(invocation, this.#scenario);
    if (typeof allowVersionScopedReleaseRecovery !== 'boolean') runtimeFail('invalid-release-recovery-request');
    let shouldRun = false;
    let result;
    await this.#stateStore.acquireLock({ processStartToken: this.#processStartToken });
    try {
      let state = await this.#stateStore.readState();
      if (state === null) runtimeFail('resume-state-required');
      if (allowVersionScopedReleaseRecovery) {
        this.#assertVersionScopedReleaseRecoveryBinding(state, normalizedInvocation);
      } else {
        this.#assertResumeBinding(state, normalizedInvocation);
      }
      if (state.phase === 'Success' || state.phase === 'Cancelled') return this.#result(state);

      if (INTERRUPTED_WATCHER_PHASES.has(state.phase)) {
        await this.#block(state, 'watcher_lost', 'explicit-resume-interrupted-watcher');
        state = await this.#stateStore.readState();
        if (state === null) runtimeFail('resume-state-required');
      }

      if (allowVersionScopedReleaseRecovery && state.phase === 'Blocked') {
        state = await this.#transition(state, {
          actor: 'agent',
          deadlineEpochMilliseconds: normalizedInvocation.deadlineEpochMilliseconds,
          libraryDigest: this.#libraryDigest,
          outcome: null,
          scenarioDigest: this.#scenarioDigest,
          scriptDigest: this.#scriptDigest,
          summaryCode: 'explicit-release-recovery-rearmed',
          target: null,
          timeoutSeconds: normalizedInvocation.timeoutSeconds,
          toPhase: 'Armed',
        });
        shouldRun = true;
        result = this.#result(state);
      } else if (state.phase === 'Blocked') {
        state = await this.#transition(state, {
          actor: 'agent',
          deadlineEpochMilliseconds: normalizedInvocation.deadlineEpochMilliseconds,
          outcome: null,
          summaryCode: 'explicit-resume-rearmed',
          timeoutSeconds: normalizedInvocation.timeoutSeconds,
          toPhase: 'Armed',
        });
        shouldRun = true;
        result = this.#result(state);
      } else if (state.phase === 'Armed') {
        state = await this.#refreshDeadline(state, normalizedInvocation, 'explicit-resume-refreshed');
        shouldRun = true;
        result = this.#result(state);
      } else if (AGENT_CONTROLLED_PHASES.has(state.phase)) {
        state = await this.#refreshDeadline(state, normalizedInvocation, 'explicit-resume-agent-phase');
        result = this.#result(state);
      } else {
        runtimeFail('unsupported-resume-phase');
      }
    } finally {
      await this.#stateStore.releaseLock();
    }
    return shouldRun ? this.run(normalizedInvocation) : result;
  }

  /** Performs one lock-bound repair-controller transition without exposing private state mutation. */
  async advance({ blocker = null, failureFingerprints, outcome, receiptIds, summaryCode, target, toPhase } = {}) {
    if (!this.#stateStore.ownsLock) runtimeFail('orchestrator-lock-required');
    const state = await this.#stateStore.readState();
    if (state === null) runtimeFail('orchestrator-state-required');
    const integrityOutcome = this.#staticIntegrityOutcome(state);
    if (integrityOutcome !== null) {
      await this.#block(state, integrityOutcome, 'state-digest-changed');
      return this.#stateStore.readState();
    }
    return this.#transition(state, {
      actor: 'agent',
      blocker,
      failureFingerprints,
      outcome,
      receiptIds,
      summaryCode,
      target,
      toPhase,
    });
  }

  /** Binds a newly started repair attempt before returning to normal watcher polling. */
  async continueAfterRepair({ invocation, receiptId, target } = {}) {
    if (!this.#stateStore.ownsLock) runtimeFail('orchestrator-lock-required');
    const normalizedInvocation = normalizeProcessWatchInvocation(invocation, this.#scenario);
    const state = await this.#stateStore.readState();
    if (state === null || state.phase !== 'Restarting' || state.target === null) {
      runtimeFail('repair-restart-state-required');
    }
    const integrityOutcome = this.#staticIntegrityOutcome(state);
    if (integrityOutcome !== null) return this.#block(state, integrityOutcome, 'state-digest-changed');
    const freshTarget = normalizeProcessWatchTarget(target, 'repair-fresh-target-required');
    if (
      freshTarget.attempt !== state.target.attempt + 1 ||
      freshTarget.sourceSha !== normalizedInvocation.sourceSha ||
      freshTarget.identityDigest === state.target.identityDigest
    ) {
      return this.#block(state, 'target_lost', 'repair-fresh-target-required');
    }
    const operationGeneration = state.generation;
    const next = await this.#transition(state, {
      actor: 'agent',
      outcome: 'running',
      receiptIds: normalizeReceiptIds([...state.receiptIds, validateReceiptId(receiptId, 'repair-receipt-missing')]),
      summaryCode: 'repair-fresh-target-bound',
      target: freshTarget,
      toPhase: 'Watching',
    });
    this.#operationGeneration = operationGeneration;
    return this.#watch(next, normalizedInvocation);
  }

  async #createInitialState(invocation) {
    const state = freezeRecord({
      blocker: null,
      deadlineEpochMilliseconds: invocation.deadlineEpochMilliseconds,
      failureFingerprints: freezeArray([]),
      generation: 0,
      heartbeat: freezeRecord({ atEpochMilliseconds: this.#now(), startToken: this.#processStartToken }),
      libraryDigest: this.#libraryDigest,
      outcome: null,
      phase: 'Armed',
      receiptIds: freezeArray([]),
      scenarioDigest: this.#scenarioDigest,
      scenarioId: this.#scenario.id,
      schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
      scriptDigest: this.#scriptDigest,
      sessionId: this.#sessionId,
      target: invocation.target,
      timeoutSeconds: invocation.timeoutSeconds,
      watchId: this.#watchId,
      workspaceId: this.#workspaceId,
    });
    const initial = await this.#stateStore.writeInitialState(state);
    await this.#appendAudit(initial, null, 'armed');
    return initial;
  }

  async #prepare(state, invocation) {
    let current = state;
    if (current.phase === 'Armed') {
      current = await this.#transition(current, {
        outcome: 'running',
        summaryCode: 'preparing',
        toPhase: 'Preparing',
      });
    }
    this.#assertDeadline(current);
    if (
      current.target === null &&
      invocation.targetSelector === 'unspecified' &&
      !this.#scenario.target.selectorKinds.includes('start')
    ) {
      runtimeFail('target-start-not-declared');
    }
    const context = this.#adapterContext(current, invocation, current.generation);
    const preflight = await this.#adapter.preflight(context);
    if (isRecord(preflight) && responseStatus(preflight) === 'blocked') {
      return this.#block(current, outcomeFromBlocker(preflight.blocker), 'adapter-preflight-blocked');
    }
    this.#operationGeneration = current.generation;
    const response = current.target === null ? await this.#adapter.start(context) : await this.#adapter.attach(context);
    if (responseStatus(response) === 'blocked') {
      return this.#block(current, outcomeFromBlocker(response.blocker), 'adapter-start-blocked');
    }
    if (!['attached', 'started'].includes(responseStatus(response))) runtimeFail('adapter-start-response-invalid');
    const target = targetFromResponse(response);
    if (current.target !== null && !sameTarget(current.target, target)) runtimeFail('adapter-target-identity-mismatch');
    const receiptId = validateReceiptId(response.receiptId, 'adapter-receipt-missing');
    const next = await this.#transition(current, {
      outcome: 'running',
      receiptIds: normalizeReceiptIds([...current.receiptIds, receiptId]),
      summaryCode: 'target-bound',
      target,
      toPhase: 'Watching',
    });
    return this.#watch(next, invocation);
  }

  async #watch(state, invocation) {
    this.#assertDeadline(state);
    if (this.#operationGeneration === null) return this.#block(state, 'watcher_lost', 'operation-generation-lost');
    let current = state;
    const initialCancellation = await this.#consumeCancellation(current, invocation);
    if (initialCancellation !== null) return this.#result(initialCancellation);
    const deadline = this.#deadlineFactory({ timeoutMilliseconds: this.#remainingMilliseconds(current) });
    const result = await this.#poller.poll({
      deadline,
      poll: this.#scenario.timing.poll,
      observe: async () => {
        current = await this.#transition(current, {
          outcome: 'running',
          summaryCode: 'watch-heartbeat',
          toPhase: 'Watching',
        });
        const cancellation = await this.#consumeCancellation(current, invocation);
        if (cancellation !== null) {
          current = cancellation;
          return freezeRecord({ cancelled: true, terminal: true });
        }
        const observation = await this.#adapter.observe(
          this.#adapterContext(current, invocation, this.#operationGeneration),
        );
        const status = responseStatus(observation);
        return freezeRecord({ observation, terminal: status !== 'running' });
      },
    });
    if (result.kind === 'deadline-exceeded') return this.#block(current, 'timed_out', 'watch-deadline-exceeded');
    if (result.observation.cancelled === true) return this.#result(current);
    const observation = result.observation.observation;
    const status = responseStatus(observation);
    if (status === 'blocked')
      return this.#block(current, outcomeFromBlocker(observation.blocker), 'adapter-observe-blocked');
    if (status === 'succeeded') return this.#finalize(current, invocation);
    if (status === 'cancelled') {
      const cancelled = await this.#transition(current, {
        outcome: 'target_cancelled',
        summaryCode: 'target-cancelled',
        toPhase: 'Cancelled',
      });
      return this.#result(cancelled);
    }
    if (status !== 'failed') runtimeFail('adapter-observation-status-invalid');
    return this.#needsAgent(current, invocation);
  }

  async #consumeCancellation(state, invocation) {
    const value = await this.#storage.readJson(REPAIR_CANCELLATION_FILE_NAME);
    if (value === null) return null;
    normalizeProcessWatchCancellation(value, { sessionId: this.#sessionId, watchId: this.#watchId });
    let next;
    if (LOCAL_ADAPTERS.has(this.#scenario.adapter)) {
      const response = await this.#adapter.cancel({
        ...this.#adapterContext(state, invocation, this.#operationGeneration),
        cancellationOutcome: 'user_cancelled',
      });
      if (responseStatus(response) === 'blocked') {
        const outcome = outcomeFromBlocker(response.blocker);
        next = await this.#transition(state, {
          blocker: this.#transitionTable.blockerForOutcome(outcome),
          outcome,
          summaryCode: 'local-cancel-blocked',
          toPhase: 'Blocked',
        });
      } else if (responseStatus(response) === 'cancelled') {
        next = await this.#transition(state, {
          outcome: 'user_cancelled',
          summaryCode: 'local-watch-cancelled',
          toPhase: 'Cancelled',
        });
      } else {
        next = await this.#transition(state, {
          blocker: this.#transitionTable.blockerForOutcome('monitoring_failed'),
          outcome: 'monitoring_failed',
          summaryCode: 'local-cancel-unconfirmed',
          toPhase: 'Blocked',
        });
      }
    } else {
      next = await this.#transition(state, {
        outcome: 'user_cancelled',
        summaryCode: 'remote-watch-stopped-without-target-cancel',
        toPhase: 'Cancelled',
      });
    }
    await this.#storage.removeRegularFile(REPAIR_CANCELLATION_FILE_NAME).catch(() => undefined);
    return next;
  }

  async #needsAgent(state, invocation) {
    const failureFingerprint = await this.#collectFailureFingerprint(state, invocation);
    const failureFingerprints = state.failureFingerprints.includes(failureFingerprint)
      ? state.failureFingerprints
      : freezeArray([...state.failureFingerprints, failureFingerprint].slice(-MAX_FAILURE_FINGERPRINTS));
    const next = await this.#transition(state, {
      failureFingerprints,
      outcome: 'target_failed',
      summaryCode: 'target-failed',
      toPhase: 'NeedsAgent',
    });
    return this.#result(next);
  }

  async #collectFailureFingerprint(state, invocation) {
    try {
      const evidence = await this.#adapter.collectEvidence(
        this.#adapterContext(state, invocation, this.#operationGeneration),
      );
      return digestNormalizedValue('gpt-voice/watch-process/failure/v1', {
        code: typeof evidence?.summaryCode === 'string' ? evidence.summaryCode : 'target-failed',
        target: state.target,
      });
    } catch {
      // Evidence is helpful, but failure to collect it must not hide a failed target.
      return digestNormalizedValue('gpt-voice/watch-process/failure/v1', {
        code: 'evidence-unavailable',
        target: state.target,
      });
    }
  }

  async #finalize(state, invocation) {
    let current = state;
    if (current.phase === 'Watching') {
      current = await this.#transition(current, {
        outcome: 'running',
        summaryCode: 'finalizing',
        toPhase: 'Finalizing',
      });
    }
    this.#assertDeadline(current);
    if (this.#operationGeneration === null) return this.#block(current, 'watcher_lost', 'operation-generation-lost');
    const freshObservation = await this.#adapter.observe(
      this.#adapterContext(current, invocation, this.#operationGeneration),
    );
    const status = responseStatus(freshObservation);
    if (status === 'blocked')
      return this.#block(current, outcomeFromBlocker(freshObservation.blocker), 'final-proof-blocked');
    if (status !== 'succeeded') return this.#block(current, 'verification_failed', 'final-proof-not-green');
    const target = targetFromResponse(freshObservation);
    if (!sameTarget(current.target, target)) return this.#block(current, 'target_lost', 'final-proof-target-mismatch');
    const proof = this.#createFreshProof(current, freshObservation);
    const ownsLocalChild = LOCAL_ADAPTERS.has(this.#scenario.adapter);
    const attestation = this.#successAttestation.build({
      cleanup: freezeRecord({
        directChildExited: ownsLocalChild,
        resultCode: ownsLocalChild ? 'local-child-exited' : 'no-local-child',
        treeVerified: ownsLocalChild,
      }),
      finalObservationEpochMilliseconds: proof.observedAtEpochMilliseconds,
      generation: current.generation + 1,
      libraryDigest: this.#libraryDigest,
      operationKeys: freezeArray([
        digestNormalizedValue('gpt-voice/watch-process/final-operation/v1', {
          receiptIds: current.receiptIds,
          target: current.target,
          watchId: this.#watchId,
        }),
      ]),
      receiptIds: current.receiptIds,
      requiredContract: proof.requiredContract,
      scenario: freezeRecord({
        digest: this.#scenarioDigest,
        id: this.#scenario.id,
        version: this.#scenario.schemaVersion,
      }),
      schemaVersion: 1,
      scriptDigest: this.#scriptDigest,
      target: proof.target,
      timeoutSeconds: current.timeoutSeconds,
      verification: proof.verification,
      watchId: this.#watchId,
    });
    this.#successAttestation.validate({ attestation, freshProof: proof });
    await this.#stateStore.withOwnership({
      expectedGeneration: current.generation,
      operation: () => this.#storage.writeJson(ATTESTATION_FILE_NAME, attestation),
    });
    const success = await this.#transition(current, {
      outcome: 'succeeded',
      summaryCode: 'success-attested',
      toPhase: 'Success',
    });
    return this.#result(success);
  }

  async #block(state, outcome, summaryCode) {
    const blocker = this.#transitionTable.blockerForOutcome(outcome);
    const blocked = await this.#transition(state, { blocker, outcome, summaryCode, toPhase: 'Blocked' });
    return this.#result(blocked);
  }

  async #safeBlock(state, outcome, summaryCode) {
    if (state.phase === 'Blocked' || state.phase === 'Success' || state.phase === 'Cancelled')
      return this.#result(state);
    return this.#block(state, outcome, summaryCode);
  }

  async #transition(
    state,
    {
      actor = 'watcher',
      blocker = null,
      deadlineEpochMilliseconds,
      failureFingerprints,
      libraryDigest,
      outcome,
      receiptIds,
      scenarioDigest,
      scriptDigest,
      summaryCode,
      target,
      timeoutSeconds,
      toPhase,
    },
  ) {
    const transition = this.#transitionTable.assert({ blocker, fromPhase: state.phase, outcome, toPhase });
    const next = freezeRecord({
      ...state,
      blocker: transition.blocker,
      deadlineEpochMilliseconds: deadlineEpochMilliseconds ?? state.deadlineEpochMilliseconds,
      failureFingerprints: failureFingerprints ?? state.failureFingerprints,
      generation: state.generation + 1,
      heartbeat: freezeRecord({ atEpochMilliseconds: this.#now(), startToken: this.#processStartToken }),
      libraryDigest: libraryDigest ?? state.libraryDigest,
      outcome: transition.outcome,
      phase: transition.toPhase,
      receiptIds: receiptIds ?? state.receiptIds,
      scenarioDigest: scenarioDigest ?? state.scenarioDigest,
      scriptDigest: scriptDigest ?? state.scriptDigest,
      target: target === undefined ? state.target : target,
      timeoutSeconds: timeoutSeconds ?? state.timeoutSeconds,
    });
    const written = await this.#stateStore.compareAndSwap({ expectedGeneration: state.generation, state: next });
    await this.#appendAudit(written, state.phase, summaryCode, actor);
    return written;
  }

  async #refreshDeadline(state, invocation, summaryCode) {
    const next = freezeRecord({
      ...state,
      deadlineEpochMilliseconds: invocation.deadlineEpochMilliseconds,
      generation: state.generation + 1,
      heartbeat: freezeRecord({ atEpochMilliseconds: this.#now(), startToken: this.#processStartToken }),
      timeoutSeconds: invocation.timeoutSeconds,
    });
    const written = await this.#stateStore.compareAndSwap({ expectedGeneration: state.generation, state: next });
    await this.#appendAudit(written, state.phase, summaryCode, 'agent');
    return written;
  }

  #assertResumeBinding(state, invocation) {
    const staticIntegrityOutcome = this.#staticIntegrityOutcome(state);
    if (staticIntegrityOutcome === 'scenario_changed') runtimeFail('scenario-changed');
    if (staticIntegrityOutcome === 'integrity_failed') runtimeFail('watch-state-integrity-mismatch');
    const targetChanged =
      (state.target === null) !== (invocation.target === null) ||
      (state.target !== null && invocation.target !== null && !sameTarget(state.target, invocation.target));
    if (
      state.sessionId !== this.#sessionId ||
      state.workspaceId !== this.#workspaceId ||
      targetChanged ||
      (state.target !== null && state.target.sourceSha !== invocation.sourceSha)
    ) {
      runtimeFail('watch-state-integrity-mismatch');
    }
  }

  #assertVersionScopedReleaseRecoveryBinding(state, invocation) {
    const authority = this.#scenario.authority;
    if (
      authority?.kind !== 'version-scoped-github-release' ||
      state.scenarioId !== this.#scenario.id ||
      state.sessionId !== this.#sessionId ||
      state.workspaceId !== this.#workspaceId ||
      state.phase !== 'Blocked' ||
      !['target_lost', 'watcher_lost'].includes(state.outcome) ||
      state.target === null ||
      state.target.sourceSha === null ||
      state.target.sourceSha !== invocation.sourceSha ||
      invocation.target !== null
    ) {
      runtimeFail('release-recovery-binding-invalid');
    }
  }

  #adapterContext(state, invocation, generation) {
    const context = {
      attempt: state.target?.attempt ?? 1,
      generation,
      inputDigest: invocation.inputDigest,
      sourceSha: invocation.sourceSha,
      stateGeneration: state.generation,
      targetId: state.target?.targetId ?? null,
      targetSelector: invocation.targetSelector,
      timeoutSeconds: state.timeoutSeconds,
    };
    if (state.target !== null) context.target = state.target;
    return freezeRecord(context);
  }

  #assertStateBinding(state, invocation) {
    const staticIntegrityOutcome = this.#staticIntegrityOutcome(state);
    if (staticIntegrityOutcome === 'scenario_changed') runtimeFail('scenario-changed');
    if (staticIntegrityOutcome === 'integrity_failed') runtimeFail('watch-state-integrity-mismatch');
    if (
      state.sessionId !== this.#sessionId ||
      state.workspaceId !== this.#workspaceId ||
      state.timeoutSeconds !== invocation.timeoutSeconds ||
      state.deadlineEpochMilliseconds !== invocation.deadlineEpochMilliseconds
    ) {
      runtimeFail('watch-state-integrity-mismatch');
    }
  }

  #staticIntegrityOutcome(state) {
    if (state.scenarioDigest !== this.#scenarioDigest || state.scenarioId !== this.#scenario.id)
      return 'scenario_changed';
    if (state.libraryDigest !== this.#libraryDigest || state.scriptDigest !== this.#scriptDigest)
      return 'integrity_failed';
    return null;
  }

  #assertDeadline(state) {
    if (this.#remainingMilliseconds(state) === 0) runtimeFail('watch-deadline-exceeded');
  }

  #remainingMilliseconds(state) {
    return Math.max(0, state.deadlineEpochMilliseconds - this.#now());
  }

  #createFreshProof(state, observation) {
    if (isRecord(observation.successProof)) return observation.successProof;
    const target = normalizeProcessWatchTarget(observation.target, 'invalid-fresh-observation');
    const member = freezeRecord({
      attempt: target.attempt,
      identityDigest: target.identityDigest,
      memberId: target.targetId,
    });
    const requiredContract = freezeRecord({
      digest: digestNormalizedValue('gpt-voice/watch-process/exact-target-contract/v1', {
        scenarioDigest: this.#scenarioDigest,
        target,
      }),
      results: freezeArray([freezeRecord({ allowedSkipped: false, conclusion: 'success', resultId: 'exact-target' })]),
    });
    const verification = freezeArray([
      freezeRecord({
        classification: 'succeeded',
        commandDigest: digestNormalizedValue('gpt-voice/watch-process/final-verification/v1', target),
        headIdentityDigest: target.identityDigest,
        inputIdentityDigest: digestNormalizedValue('gpt-voice/watch-process/final-input/v1', {
          scenarioDigest: this.#scenarioDigest,
          target,
        }),
      }),
    ]);
    return freezeRecord({
      observedAtEpochMilliseconds: this.#now(),
      proofKind: LOCAL_ADAPTERS.has(this.#scenario.adapter) ? 'local' : 'external',
      receiptIds: state.receiptIds,
      requiredContract,
      target: freezeRecord({
        identityDigest: target.identityDigest,
        members: freezeArray([member]),
        sourceSha: target.sourceSha,
        targetId: target.targetId,
      }),
      verification,
      watchId: this.#watchId,
    });
  }

  async #appendAudit(state, previousPhase, summaryCode, actor = 'watcher') {
    await this.#auditJournal.append({
      event: freezeRecord({
        actor,
        generation: state.generation,
        libraryDigest: this.#libraryDigest,
        outcome: state.outcome,
        phase: state.phase,
        previousPhase,
        receiptId: state.receiptIds.at(-1) ?? null,
        scenarioDigest: this.#scenarioDigest,
        scriptDigest: this.#scriptDigest,
        sourceSha: state.target?.sourceSha ?? null,
        summaryCode: safeSummaryCode(summaryCode),
        targetIdentityDigest: state.target?.identityDigest ?? null,
      }),
      expectedGeneration: state.generation,
    });
  }

  #now() {
    return requireNonNegativeInteger(this.#clock(), 'invalid-process-watch-clock', Number.MAX_SAFE_INTEGER);
  }

  #result(state) {
    return freezeRecord({
      blocker: state.blocker,
      generation: state.generation,
      outcome: state.outcome,
      phase: state.phase,
      target: state.target,
      watchId: state.watchId,
    });
  }
}

export { ATTESTATION_FILE_NAME };
