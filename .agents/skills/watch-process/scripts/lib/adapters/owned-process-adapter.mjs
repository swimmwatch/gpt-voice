import { ManagedProcessRunner } from '../managed-process-runner.mjs';
import { ProcessAdapter } from '../runtime-contracts.mjs';
import { freezeRecord, isRecord, runtimeFail } from '../runtime-core-support.mjs';
import { validateDigest, validateWatchId } from '../runtime-state-contracts.mjs';

import {
  ManagedProcessCommandDriver,
  assertAdapterDependencies,
  createFixedInputsDigest,
  createOwnedProcessIdentity,
  digestAdapterCommand,
  isSuccessfulCommandResult,
  normalizeAdapterAttemptContext,
  normalizeAdapterCommandResult,
  parseOwnedProcessTargetId,
  resolveAdapterCommand,
} from './adapter-support.mjs';
import { DeclaredOutputVerifier } from './declared-output-verifier.mjs';

const BLOCKED_STATUS = 'blocked';
const RUNNING_STATUS = 'running';
const ATTACHED_STATUS = 'attached';
const SUCCEEDED_STATUS = 'succeeded';
const FAILED_STATUS = 'failed';
const CANCELLED_STATUS = 'cancelled';

function sameTarget(left, right) {
  return (
    left.attempt === right.attempt &&
    left.identityDigest === right.identityDigest &&
    left.sourceSha === right.sourceSha &&
    left.targetId === right.targetId
  );
}

function hasCommandDriver(value) {
  return value !== null && typeof value === 'object' && typeof value.run === 'function';
}

function hasOutputVerifier(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.preflight === 'function' &&
    typeof value.verify === 'function'
  );
}

function normalizedOutputVerification(value) {
  if (!isRecord(value) || typeof value.succeeded !== 'boolean' || typeof value.code !== 'string') {
    runtimeFail('invalid-output-verifier-result');
  }
  return freezeRecord({ code: value.code, succeeded: value.succeeded });
}

/**
 * Shared ownership, receipt, identity, evidence, and cancellation lifecycle
 * for adapters that execute one watcher-owned local process.
 *
 * Subclasses own command selection and their success predicate. This class
 * never accepts a PID as identity or cancellation authority.
 */
export class OwnedProcessAdapter extends ProcessAdapter {
  #adapterName;
  #attempts = new Map();
  #commandDriver;
  #environmentAllowlist;
  #outputVerifier;
  #preflightCompleted = false;
  #receiptStore;
  #runner;
  #scenario;
  #scenarioDigest;
  #watchId;
  #workspaceRoot;

  constructor({
    adapterName,
    commandDriver,
    environmentAllowlist = [],
    outputVerifier,
    receiptStore,
    runner,
    scenario,
    scenarioDigest,
    watchId,
    workspaceRoot,
  } = {}) {
    super();
    if (typeof adapterName !== 'string' || !/^[a-z][a-z0-9-]{2,63}$/u.test(adapterName)) {
      runtimeFail('invalid-owned-process-adapter-dependency');
    }
    if (!(runner instanceof ManagedProcessRunner)) runtimeFail('invalid-owned-process-adapter-dependency');
    if (!isRecord(scenario) || scenario.adapter !== adapterName || !isRecord(scenario.adapterConfig)) {
      runtimeFail('invalid-owned-process-adapter-scenario');
    }
    if (!Array.isArray(environmentAllowlist)) runtimeFail('invalid-owned-process-adapter-dependency');
    const normalizedWatchId = validateWatchId(watchId, 'invalid-owned-process-adapter-dependency');
    assertAdapterDependencies({ receiptStore, watchId: normalizedWatchId });
    const selectedDriver = commandDriver ?? new ManagedProcessCommandDriver({ runner });
    const selectedOutputVerifier = outputVerifier ?? new DeclaredOutputVerifier();
    if (!hasCommandDriver(selectedDriver) || !hasOutputVerifier(selectedOutputVerifier)) {
      runtimeFail('invalid-owned-process-adapter-dependency');
    }
    this.#adapterName = adapterName;
    this.#commandDriver = selectedDriver;
    this.#environmentAllowlist = Object.freeze([...environmentAllowlist]);
    this.#outputVerifier = selectedOutputVerifier;
    this.#receiptStore = receiptStore;
    this.#runner = runner;
    this.#scenario = scenario;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-owned-process-adapter-dependency');
    this.#watchId = normalizedWatchId;
    this.#workspaceRoot = typeof workspaceRoot === 'string' && workspaceRoot.length > 0 ? workspaceRoot : null;
    if (this.#workspaceRoot === null) runtimeFail('invalid-owned-process-adapter-dependency');
  }

  get adapterName() {
    return this.#adapterName;
  }

  get scenario() {
    return this.#scenario;
  }

  get watchId() {
    return this.#watchId;
  }

  /** Validates static and resolved commands plus the required local availability probe. */
  async preflight(context) {
    const prepared = await this.#prepare(context);
    const outputSupport = await this.#outputVerifier.preflight({
      adapterName: this.#adapterName,
      requiredOutputs: this._requiredOutputs(),
      verificationCount: prepared.verificationCommands.length,
    });
    if (!isRecord(outputSupport) || outputSupport.supported !== true)
      runtimeFail('declared-output-verification-unsupported');

    const probeResult = normalizeAdapterCommandResult(await this.#commandDriver.run(this._preflightCommand(prepared)));
    if (!isSuccessfulCommandResult(probeResult)) runtimeFail(this._unavailableCode());
    this.#preflightCompleted = true;
    return freezeRecord({ adapter: this.#adapterName, status: 'ready' });
  }

  async start(context) {
    this.#requirePreflight();
    return this.#startAttempt(context, 'start');
  }

  /** Rebinds only a still-live child owned by this runner and exact receipt identity. */
  async attach(context) {
    const prepared = await this.#prepare(context);
    if (prepared.context.target === null) runtimeFail('adapter-target-required');
    const attached = await this.#attachPrepared(prepared);
    if (attached.kind === BLOCKED_STATUS) return this.#blocked(attached.blocker);
    return this.#attachmentResponse(attached.record);
  }

  async observe(context) {
    const resolved = await this.#resolveExistingAttempt(context);
    if (resolved.kind === BLOCKED_STATUS) return this.#blocked(resolved.blocker);
    const { prepared, record } = resolved;
    if (!record.execution.finished) return freezeRecord({ status: RUNNING_STATUS, target: record.identity.target });

    const result = await this.#waitForResult(record);
    const cancellationOutcome =
      record.cancellationOutcome ??
      (result.terminal.classification === 'signalled' && prepared.context.cancellationOutcome === 'target_cancelled'
        ? 'target_cancelled'
        : null);
    if (result.terminal.classification === 'aborted' || cancellationOutcome !== null) {
      return freezeRecord({
        outcome: cancellationOutcome ?? 'target_cancelled',
        status: CANCELLED_STATUS,
        target: record.identity.target,
        terminal: result.terminal,
      });
    }
    if (!this._isPrimaryResultSuccessful(result)) {
      return freezeRecord({
        outcome: 'target_failed',
        status: FAILED_STATUS,
        summaryCode: result.terminal.classification,
        target: record.identity.target,
        terminal: result.terminal,
      });
    }

    const verification = await this.#verifyAttempt(record, prepared);
    if (!verification.succeeded) {
      return freezeRecord({
        outcome: 'verification_failed',
        status: FAILED_STATUS,
        summaryCode: verification.code,
        target: record.identity.target,
        terminal: result.terminal,
      });
    }
    return freezeRecord({
      outcome: 'succeeded',
      status: SUCCEEDED_STATUS,
      target: record.identity.target,
      terminal: result.terminal,
      verificationCount: verification.count,
    });
  }

  /** Returns only BoundedEvidenceBuffer's safe summary after a terminal result. */
  async collectEvidence(context) {
    const resolved = await this.#resolveExistingAttempt(context);
    if (resolved.kind === BLOCKED_STATUS) return this.#blocked(resolved.blocker);
    const { record } = resolved;
    if (!record.execution.finished)
      return freezeRecord({ evidence: null, status: RUNNING_STATUS, target: record.identity.target });
    const result = await this.#waitForResult(record);
    return freezeRecord({
      evidence: result.evidence,
      status: 'completed',
      target: record.identity.target,
      terminal: result.terminal,
    });
  }

  async identity(context) {
    const resolved = await this.#resolveExistingAttempt(context);
    if (resolved.kind === BLOCKED_STATUS) return this.#blocked(resolved.blocker);
    return freezeRecord({
      identity: this.#publicIdentity(resolved.record.identity),
      status: 'identified',
      target: resolved.record.identity.target,
    });
  }

  /** Starts a distinct retry receipt only after the exact prior owned target is terminal. */
  async restart(context) {
    this.#requirePreflight();
    const resolved = await this.#resolveExistingAttempt(context);
    if (resolved.kind === BLOCKED_STATUS) return this.#blocked(resolved.blocker);
    if (!resolved.record.execution.finished) runtimeFail('restart-requires-terminal-target');
    const prior = resolved.prepared.context;
    return this.#startAttempt(
      {
        attempt: prior.attempt + 1,
        generation: prior.generation,
        inputDigest: prior.inputDigest,
        sourceSha: prior.sourceSha,
        targetId: prior.targetId,
        targetSelector: prior.targetSelector,
        timeoutSeconds: prior.timeoutSeconds,
      },
      'retry',
    );
  }

  /** Terminates only an exact currently owned token; uncertainty is a Blocked result. */
  async cancel(context) {
    const resolved = await this.#resolveExistingAttempt(context);
    if (resolved.kind === BLOCKED_STATUS) return this.#blocked(resolved.blocker);
    const { prepared, record } = resolved;
    const startToken = record.identity.startToken;
    if (
      record.execution.finished ||
      !this.#runner.owns(startToken) ||
      this.#runner.getOwnedExecution(startToken) !== record.execution ||
      record.execution.identity.startToken !== startToken
    ) {
      return this.#blocked('watcher-lost');
    }
    record.cancellationOutcome = prepared.context.cancellationOutcome ?? 'user_cancelled';
    try {
      const result = normalizeAdapterCommandResult(await this.#runner.abortOwned(startToken));
      record.resultTask = Promise.resolve(result);
      return freezeRecord({
        outcome: record.cancellationOutcome,
        status: CANCELLED_STATUS,
        target: record.identity.target,
        terminal: result.terminal,
      });
    } catch {
      return this.#blocked('watcher-lost');
    }
  }

  /** Subclasses resolve their primary declared command with this trusted substitution context. */
  async resolveScenarioCommand(command, context) {
    return resolveAdapterCommand({
      command,
      context,
      environmentAllowlist: this.#environmentAllowlist,
      watchId: this.#watchId,
      workspaceRoot: this.#workspaceRoot,
    });
  }

  _verificationDefinitions() {
    return this.#scenario.verification;
  }

  _requiredOutputs() {
    return this.#scenario.success.requiredOutputs;
  }

  _preflightCommand() {
    runtimeFail('adapter-method-not-implemented');
  }

  _unavailableCode() {
    runtimeFail('adapter-method-not-implemented');
  }

  _isPrimaryResultSuccessful() {
    runtimeFail('adapter-method-not-implemented');
  }

  _validatePreparedCommands() {
    runtimeFail('adapter-method-not-implemented');
  }

  async _resolvePrimaryCommand() {
    runtimeFail('adapter-method-not-implemented');
  }

  async #startAttempt(context, operationKind) {
    const prepared = await this.#prepare(context);
    const fixedInputsDigest = createFixedInputsDigest({
      adapterName: this.#adapterName,
      attempt: prepared.context.attempt,
      commandDigest: prepared.commandDigest,
      inputDigest: prepared.context.inputDigest,
      sourceSha: prepared.context.sourceSha,
      watchId: this.#watchId,
    });
    const operation = freezeRecord({
      fixedInputsDigest,
      generation: prepared.context.generation,
      kind: operationKind,
      scenarioDigest: this.#scenarioDigest,
      sourceSha: prepared.context.sourceSha,
      watchId: this.#watchId,
    });
    const intentResult = await this.#receiptStore.recordIntent({
      expectedGeneration: prepared.context.generation,
      operation,
    });
    if (intentResult.intent.status === 'attached') {
      const attachedPrepared = await this.#prepare({ ...prepared.context, target: intentResult.intent.target });
      const attached = await this.#attachPrepared(attachedPrepared);
      return attached.kind === BLOCKED_STATUS
        ? this.#blocked(attached.blocker)
        : this.#attachmentResponse(attached.record);
    }
    const reconciliation = await this.#receiptStore.reconcile({
      exactMatches: [],
      expectedGeneration: prepared.context.generation,
      identityProven: true,
      operationKey: intentResult.intent.operationKey,
    });
    if (reconciliation.kind !== 'fresh-operation-permitted') return this.#blocked(reconciliation.blocker);

    const execution = await this.#runner.start(prepared.primaryCommand);
    const identity = createOwnedProcessIdentity({
      adapterName: this.#adapterName,
      attempt: prepared.context.attempt,
      commandDigest: prepared.commandDigest,
      fixedInputsDigest,
      generation: prepared.context.generation,
      inputDigest: prepared.context.inputDigest,
      sourceSha: prepared.context.sourceSha,
      startToken: execution.identity.startToken,
      watchId: this.#watchId,
    });
    const receiptId = `receipt-${this.#adapterName}-${identity.attempt}-${identity.startToken}`;
    try {
      await this.#receiptStore.recordReceipt({
        expectedGeneration: prepared.context.generation,
        receipt: {
          operationKey: intentResult.intent.operationKey,
          receiptId,
          target: identity.target,
          watchId: this.#watchId,
        },
      });
    } catch {
      try {
        if (this.#runner.owns(identity.startToken)) await this.#runner.abortOwned(identity.startToken);
      } catch {
        // A receipt failure remains fail-closed; only the runner-owned cleanup was attempted.
      }
      runtimeFail('operation-receipt-record-failed');
    }
    const record = {
      execution,
      identity,
      operationKey: intentResult.intent.operationKey,
      receiptId,
      resultTask: null,
      verificationTask: null,
    };
    this.#attempts.set(identity.target.targetId, record);
    return this.#startResponse(record);
  }

  async #prepare(context) {
    const normalizedContext = normalizeAdapterAttemptContext(context, { timing: this.#scenario.timing });
    if (this.#scenario.target.requireExactSourceRevision && normalizedContext.sourceSha === null) {
      runtimeFail('source-sha-required');
    }
    const primaryCommand = await this._resolvePrimaryCommand(normalizedContext);
    const verificationCommands = [];
    for (const definition of this._verificationDefinitions()) {
      verificationCommands.push(await this.resolveScenarioCommand(definition, normalizedContext));
    }
    this._validatePreparedCommands({ context: normalizedContext, primaryCommand, verificationCommands });
    return freezeRecord({
      commandDigest: digestAdapterCommand(primaryCommand),
      context: normalizedContext,
      primaryCommand,
      verificationCommands: Object.freeze(verificationCommands),
    });
  }

  async #attachPrepared(prepared) {
    const target = prepared.context.target;
    let startToken;
    try {
      startToken = parseOwnedProcessTargetId({
        adapterName: this.#adapterName,
        attempt: target.attempt,
        targetId: target.targetId,
        watchId: this.#watchId,
      });
    } catch {
      return { blocker: 'target-lost', kind: BLOCKED_STATUS };
    }
    const fixedInputsDigest = createFixedInputsDigest({
      adapterName: this.#adapterName,
      attempt: prepared.context.attempt,
      commandDigest: prepared.commandDigest,
      inputDigest: prepared.context.inputDigest,
      sourceSha: prepared.context.sourceSha,
      watchId: this.#watchId,
    });
    const identity = createOwnedProcessIdentity({
      adapterName: this.#adapterName,
      attempt: prepared.context.attempt,
      commandDigest: prepared.commandDigest,
      fixedInputsDigest,
      generation: prepared.context.generation,
      inputDigest: prepared.context.inputDigest,
      sourceSha: prepared.context.sourceSha,
      startToken,
      watchId: this.#watchId,
    });
    if (!sameTarget(identity.target, target)) return { blocker: 'target-lost', kind: BLOCKED_STATUS };

    const log = await this.#receiptStore.read();
    const receipt = log.receipts.find((candidate) => sameTarget(candidate.target, target));
    const intent =
      receipt === undefined
        ? undefined
        : log.intents.find((candidate) => candidate.operationKey === receipt.operationKey);
    if (
      receipt === undefined ||
      intent === undefined ||
      intent.operation.generation !== prepared.context.generation ||
      intent.operation.scenarioDigest !== this.#scenarioDigest ||
      intent.operation.sourceSha !== prepared.context.sourceSha ||
      intent.operation.fixedInputsDigest !== fixedInputsDigest
    ) {
      return { blocker: 'target-lost', kind: BLOCKED_STATUS };
    }
    const execution = this.#runner.getOwnedExecution(startToken);
    if (execution === null || execution.finished || execution.identity.startToken !== startToken) {
      return { blocker: 'watcher-lost', kind: BLOCKED_STATUS };
    }
    const existing = this.#attempts.get(target.targetId);
    if (existing !== undefined && existing.execution !== execution)
      return { blocker: 'target-lost', kind: BLOCKED_STATUS };
    const record = existing ?? {
      execution,
      identity,
      operationKey: receipt.operationKey,
      receiptId: receipt.receiptId,
      resultTask: null,
      verificationTask: null,
    };
    this.#attempts.set(target.targetId, record);
    return { kind: ATTACHED_STATUS, record };
  }

  async #resolveExistingAttempt(context) {
    const prepared = await this.#prepare(context);
    if (prepared.context.target === null) runtimeFail('adapter-target-required');
    const existing = this.#attempts.get(prepared.context.target.targetId);
    if (existing !== undefined) {
      if (!this.#matchesPreparedRecord(existing, prepared)) return { blocker: 'target-lost', kind: BLOCKED_STATUS };
      return { kind: ATTACHED_STATUS, prepared, record: existing };
    }
    const attached = await this.#attachPrepared(prepared);
    return attached.kind === BLOCKED_STATUS ? attached : { kind: ATTACHED_STATUS, prepared, record: attached.record };
  }

  #matchesPreparedRecord(record, prepared) {
    const target = prepared.context.target;
    return (
      sameTarget(record.identity.target, target) &&
      record.identity.generation === prepared.context.generation &&
      record.identity.commandDigest === prepared.commandDigest &&
      record.identity.inputDigest === prepared.context.inputDigest &&
      record.identity.sourceSha === prepared.context.sourceSha
    );
  }

  async #waitForResult(record) {
    if (record.resultTask === null) {
      record.resultTask = Promise.resolve(record.execution.wait()).then((value) =>
        normalizeAdapterCommandResult(value),
      );
    }
    return record.resultTask;
  }

  async #verifyAttempt(record, prepared) {
    if (record.verificationTask === null) {
      record.verificationTask = this.#runVerification(prepared.verificationCommands);
    }
    return record.verificationTask;
  }

  async #runVerification(commands) {
    const results = [];
    for (const command of commands) {
      let result;
      try {
        result = normalizeAdapterCommandResult(await this.#commandDriver.run(command));
      } catch {
        return freezeRecord({ code: 'verification-command-failed', count: results.length, succeeded: false });
      }
      results.push(result);
      if (!isSuccessfulCommandResult(result)) {
        return freezeRecord({ code: 'verification-command-failed', count: results.length, succeeded: false });
      }
    }
    let output;
    try {
      output = normalizedOutputVerification(
        await this.#outputVerifier.verify({
          adapterName: this.#adapterName,
          requiredOutputs: this._requiredOutputs(),
          verificationResults: results,
        }),
      );
    } catch {
      return freezeRecord({ code: 'output-verification-failed', count: results.length, succeeded: false });
    }
    return freezeRecord({ code: output.code, count: results.length, succeeded: output.succeeded });
  }

  #startResponse(record) {
    return freezeRecord({
      identity: this.#publicIdentity(record.identity),
      receiptId: record.receiptId,
      status: 'started',
      target: record.identity.target,
    });
  }

  #attachmentResponse(record) {
    return freezeRecord({
      identity: this.#publicIdentity(record.identity),
      receiptId: record.receiptId,
      status: ATTACHED_STATUS,
      target: record.identity.target,
    });
  }

  #publicIdentity(identity) {
    return freezeRecord({
      adapter: this.#adapterName,
      attempt: identity.attempt,
      commandDigest: identity.commandDigest,
      generation: identity.generation,
      identityDigest: identity.identityDigest,
      inputDigest: identity.inputDigest,
      sourceSha: identity.sourceSha,
      startToken: identity.startToken,
      targetId: identity.target.targetId,
      watchId: this.#watchId,
    });
  }

  #blocked(blocker) {
    return freezeRecord({ blocker, status: BLOCKED_STATUS });
  }

  #requirePreflight() {
    if (!this.#preflightCompleted) runtimeFail('adapter-preflight-required');
  }
}
