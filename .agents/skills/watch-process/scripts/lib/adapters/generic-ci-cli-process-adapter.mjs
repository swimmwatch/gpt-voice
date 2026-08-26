import { ManagedProcessRunner } from '../managed-process-runner.mjs';
import { ProcessAdapter } from '../runtime-contracts.mjs';
import { digestNormalizedValue, freezeRecord, isRecord, requireString, runtimeFail } from '../runtime-core-support.mjs';
import { validateDigest, validateWatchId } from '../runtime-state-contracts.mjs';

import {
  assertAdapterDependencies,
  createFixedInputsDigest,
  digestAdapterCommand,
  isSuccessfulCommandResult,
  normalizeAdapterAttemptContext,
  normalizeAdapterCommandResult,
  resolveAdapterCommand,
} from './adapter-support.mjs';
import { GenericCiJsonOutputCollector } from './generic-ci-json-output-collector.mjs';
import { GenericCiResultContract } from './generic-ci-result-contract.mjs';

const GENERIC_CI_ADAPTER = 'generic-ci-cli';
const MAX_JSON_OUTPUT_BYTES = 262_144;
const STATUS_CATEGORIES = Object.freeze(['running', 'succeeded', 'failed', 'cancelled']);

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function sameReceiptTarget(left, right) {
  return (
    left.attempt === right.attempt &&
    left.identityDigest === right.identityDigest &&
    left.sourceSha === right.sourceSha &&
    left.targetId === right.targetId
  );
}

function sameProviderTarget(left, right) {
  return left.attempt === right.attempt && left.sourceSha === right.sourceSha && left.targetId === right.targetId;
}

function normalizeProviderStatus(value, code) {
  const status = requireString(value, code, { minimum: 1, maximum: 128 });
  for (const character of status) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) runtimeFail(code);
  }
  return status;
}

function normalizeStatusMap(value) {
  const code = 'invalid-generic-ci-status-map';
  const statusMap = assertClosedRecord(value, new Set(STATUS_CATEGORIES), code);
  const mapped = new Map();
  for (const category of STATUS_CATEGORIES) {
    if (!Array.isArray(statusMap[category]) || statusMap[category].length === 0) runtimeFail(code);
    for (const status of statusMap[category]) {
      const normalized = normalizeProviderStatus(status, code);
      if (mapped.has(normalized)) runtimeFail('generic-ci-status-map-ambiguous');
      mapped.set(normalized, category);
    }
  }
  return mapped;
}

function normalizeGenericContext(value, { timing } = {}) {
  const code = 'invalid-generic-ci-adapter-context';
  const context = assertClosedRecord(
    value,
    new Set([
      'attempt',
      'cancelAuthorized',
      'cancellationOutcome',
      'generation',
      'inputDigest',
      'sourceSha',
      'stateGeneration',
      'target',
      'targetId',
      'targetSelector',
      'timeoutMilliseconds',
      'timeoutSeconds',
    ]),
    code,
  );
  const { cancelAuthorized = false, ...attemptContext } = context;
  if (typeof cancelAuthorized !== 'boolean') runtimeFail(code);
  return freezeRecord({
    ...normalizeAdapterAttemptContext(attemptContext, { timing }),
    cancelAuthorized,
  });
}

function findIntent(log, operationKey) {
  return log.intents.find((candidate) => candidate.operationKey === operationKey);
}

/**
 * Provider-neutral adapter for an explicitly declared CLI that emits one
 * versioned JSON result per command. It never parses tables, logs, or prose.
 */
export class GenericCiCliProcessAdapter extends ProcessAdapter {
  #commands;
  #environmentAllowlist;
  #preflightCompleted = false;
  #providerId;
  #receiptStore;
  #resultContract;
  #runner;
  #scenario;
  #scenarioDigest;
  #statusMap;
  #watchId;
  #workspaceRoot;

  constructor({
    environmentAllowlist = [],
    receiptStore,
    resultContract,
    runner,
    scenario,
    scenarioDigest,
    watchId,
    workspaceRoot,
  } = {}) {
    super();
    if (!(runner instanceof ManagedProcessRunner) || !isRecord(scenario) || scenario.adapter !== GENERIC_CI_ADAPTER) {
      runtimeFail('invalid-generic-ci-adapter-dependency');
    }
    if (
      !Array.isArray(environmentAllowlist) ||
      !isRecord(scenario.adapterConfig) ||
      !isRecord(scenario.adapterConfig.commands)
    ) {
      runtimeFail('invalid-generic-ci-adapter-scenario');
    }
    const normalizedWatchId = validateWatchId(watchId, 'invalid-generic-ci-adapter-dependency');
    assertAdapterDependencies({ receiptStore, watchId: normalizedWatchId });
    const providerId = requireString(scenario.adapterConfig.providerId, 'invalid-generic-ci-adapter-scenario', {
      minimum: 2,
      maximum: 32,
    });
    if (!/^[a-z][a-z0-9-]{1,31}$/u.test(providerId)) runtimeFail('invalid-generic-ci-adapter-scenario');
    const selectedContract = resultContract ?? new GenericCiResultContract();
    if (!(selectedContract instanceof GenericCiResultContract)) runtimeFail('invalid-generic-ci-adapter-dependency');
    this.#commands = scenario.adapterConfig.commands;
    this.#environmentAllowlist = Object.freeze([...environmentAllowlist]);
    this.#providerId = providerId;
    this.#receiptStore = receiptStore;
    this.#resultContract = selectedContract;
    this.#runner = runner;
    this.#scenario = scenario;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-generic-ci-adapter-dependency');
    this.#statusMap = normalizeStatusMap(scenario.adapterConfig.statusMap);
    this.#watchId = normalizedWatchId;
    this.#workspaceRoot = typeof workspaceRoot === 'string' && workspaceRoot.length > 0 ? workspaceRoot : null;
    if (this.#workspaceRoot === null) runtimeFail('invalid-generic-ci-adapter-dependency');
  }

  async preflight(context) {
    const normalized = this.#normalizeContext(context);
    if (this.#commands.start === undefined) runtimeFail('generic-ci-start-unsupported');
    await this.#resolveCommand(this.#commands.start, normalized);
    await this.#resolveCommand(this.#commands.observe, normalized);
    await this.#resolveCommand(this.#commands.evidence, normalized);
    if (this.#commands.cancel !== undefined) await this.#resolveCommand(this.#commands.cancel, normalized);
    this.#preflightCompleted = true;
    return freezeRecord({ adapter: GENERIC_CI_ADAPTER, status: 'ready' });
  }

  async start(context) {
    this.#requirePreflight();
    return this.#startAttempt(this.#normalizeContext(context), 'start');
  }

  async attach(context) {
    const attached = await this.#resolveAttached(this.#normalizeContext(context));
    return attached.kind === 'blocked' ? this.#blocked(attached.blocker) : this.#attachmentResponse(attached);
  }

  async observe(context) {
    const attached = await this.#resolveAttached(this.#normalizeContext(context));
    if (attached.kind === 'blocked') return this.#blocked(attached.blocker);
    let invocation;
    try {
      invocation = await this.#runCommand(this.#commands.observe, attached.context);
    } catch (error) {
      if (error?.code?.startsWith('generic-ci-output-')) throw error;
      return freezeRecord({ outcome: 'monitoring_failed', status: 'failed', summaryCode: 'generic-ci-observe-failed' });
    }
    const result = this.#assertResult(invocation.result, {
      context: attached.context,
      expectedKinds: ['observation'],
      expectedOperationKey: attached.operationKey,
      expectedTarget: attached.target,
    });
    const category = this.#statusCategory(result);
    if (category === 'authentication_failed') {
      return freezeRecord({
        outcome: 'authentication_failed',
        status: 'failed',
        summaryCode: 'generic-ci-authentication-failed',
      });
    }
    if (category === 'running') return freezeRecord({ status: 'running', target: attached.target });
    if (category === 'cancelled') {
      return freezeRecord({ outcome: 'target_cancelled', status: 'cancelled', target: attached.target });
    }
    if (category === 'failed') {
      return freezeRecord({ outcome: 'target_failed', status: 'failed', target: attached.target });
    }
    this.#assertRequiredMembers(result);
    return freezeRecord({ outcome: 'succeeded', status: 'succeeded', target: attached.target });
  }

  async collectEvidence(context) {
    const attached = await this.#resolveAttached(this.#normalizeContext(context));
    if (attached.kind === 'blocked') return this.#blocked(attached.blocker);
    let invocation;
    try {
      invocation = await this.#runCommand(this.#commands.evidence, attached.context);
    } catch (error) {
      if (error?.code?.startsWith('generic-ci-output-')) throw error;
      return freezeRecord({
        outcome: 'monitoring_failed',
        status: 'failed',
        summaryCode: 'generic-ci-evidence-failed',
      });
    }
    const result = this.#assertResult(invocation.result, {
      context: attached.context,
      expectedKinds: ['evidence'],
      expectedOperationKey: attached.operationKey,
      expectedTarget: attached.target,
    });
    if (this.#statusCategory(result) === 'authentication_failed') {
      return freezeRecord({
        outcome: 'authentication_failed',
        status: 'failed',
        summaryCode: 'generic-ci-authentication-failed',
      });
    }
    this.#assertFailureEntries(result);
    return freezeRecord({
      evidence: invocation.evidence,
      failureEntries: result.failureEntries,
      status: 'collected',
      target: attached.target,
    });
  }

  async identity(context) {
    const attached = await this.#resolveAttached(this.#normalizeContext(context));
    return attached.kind === 'blocked'
      ? this.#blocked(attached.blocker)
      : freezeRecord({ identity: attached.identity, status: 'identified', target: attached.target });
  }

  async restart(context) {
    this.#requirePreflight();
    const attached = await this.#resolveAttached(this.#normalizeContext(context));
    if (attached.kind === 'blocked') return this.#blocked(attached.blocker);
    return this.#startAttempt(
      this.#normalizeContext({
        attempt: attached.context.attempt + 1,
        generation: attached.context.generation,
        inputDigest: attached.context.inputDigest,
        sourceSha: attached.context.sourceSha,
        targetId: attached.target.targetId,
        targetSelector: attached.context.targetSelector,
        timeoutSeconds: attached.context.timeoutSeconds,
      }),
      'retry',
    );
  }

  async cancel(context) {
    const normalized = this.#normalizeContext(context);
    if (this.#commands.cancel === undefined) return freezeRecord({ code: 'cancel-unsupported', status: 'unsupported' });
    if (!normalized.cancelAuthorized) return freezeRecord({ code: 'cancel-not-authorized', status: 'unsupported' });
    const attached = await this.#resolveAttached(normalized);
    if (attached.kind === 'blocked') return this.#blocked(attached.blocker);
    let invocation;
    try {
      invocation = await this.#runCommand(this.#commands.cancel, attached.context);
    } catch (error) {
      if (error?.code?.startsWith('generic-ci-output-')) throw error;
      return freezeRecord({ outcome: 'monitoring_failed', status: 'failed', summaryCode: 'generic-ci-cancel-failed' });
    }
    const result = this.#assertResult(invocation.result, {
      context: attached.context,
      expectedKinds: ['observation'],
      expectedOperationKey: attached.operationKey,
      expectedTarget: attached.target,
    });
    const category = this.#statusCategory(result);
    if (category === 'authentication_failed') {
      return freezeRecord({
        outcome: 'authentication_failed',
        status: 'failed',
        summaryCode: 'generic-ci-authentication-failed',
      });
    }
    if (category !== 'cancelled') runtimeFail('generic-ci-cancel-not-confirmed');
    return freezeRecord({ outcome: 'target_cancelled', status: 'cancelled', target: attached.target });
  }

  #normalizeContext(context) {
    const normalized = normalizeGenericContext(context, { timing: this.#scenario.timing });
    if (this.#scenario.target.requireExactSourceRevision && normalized.sourceSha === null) {
      runtimeFail('source-sha-required');
    }
    return normalized;
  }

  async #startAttempt(context, operationKind) {
    const prepared = await this.#prepareStart(context);
    const operation = freezeRecord({
      fixedInputsDigest: prepared.fixedInputsDigest,
      generation: context.generation,
      kind: operationKind,
      scenarioDigest: this.#scenarioDigest,
      sourceSha: context.sourceSha,
      watchId: this.#watchId,
    });
    const intentResult = await this.#receiptStore.recordIntent({ expectedGeneration: context.generation, operation });
    if (intentResult.intent.status === 'attached') {
      const attached = await this.#resolveAttached(
        this.#normalizeContext({ ...context, target: intentResult.intent.target }),
      );
      return attached.kind === 'blocked' ? this.#blocked(attached.blocker) : this.#attachmentResponse(attached);
    }
    const reconciliation = await this.#receiptStore.reconcile({
      exactMatches: [],
      expectedGeneration: context.generation,
      identityProven: true,
      operationKey: intentResult.intent.operationKey,
    });
    if (reconciliation.kind !== 'fresh-operation-permitted') return this.#blocked(reconciliation.blocker);

    const invocation = await this.#runResolvedCommand(prepared.command, context);
    const result = this.#assertResult(invocation.result, {
      context,
      expectedKinds: ['start', 'dispatch'],
      expectedOperationKey: intentResult.intent.operationKey,
    });
    if (this.#statusCategory(result) === 'authentication_failed') {
      return freezeRecord({
        outcome: 'authentication_failed',
        status: 'failed',
        summaryCode: 'generic-ci-authentication-failed',
      });
    }
    const target = this.#receiptTarget({
      commandDigest: prepared.commandDigest,
      context,
      operationKey: intentResult.intent.operationKey,
      providerTarget: result.target,
      fixedInputsDigest: prepared.fixedInputsDigest,
    });
    const receiptId = `receipt-generic-ci-${intentResult.intent.operationKey.slice(0, 48)}`;
    try {
      await this.#receiptStore.recordReceipt({
        expectedGeneration: context.generation,
        receipt: { operationKey: intentResult.intent.operationKey, receiptId, target, watchId: this.#watchId },
      });
    } catch {
      runtimeFail('operation-receipt-record-failed');
    }
    return freezeRecord({
      identity: this.#publicIdentity({
        commandDigest: prepared.commandDigest,
        context,
        fixedInputsDigest: prepared.fixedInputsDigest,
        operationKey: intentResult.intent.operationKey,
        target,
      }),
      receiptId,
      status: 'started',
      target,
    });
  }

  async #resolveAttached(context) {
    if (context.target === null) runtimeFail('adapter-target-required');
    const prepared = await this.#prepareStart(context);
    const log = await this.#receiptStore.read();
    const receipt = log.receipts.find((candidate) => sameReceiptTarget(candidate.target, context.target));
    const intent = receipt === undefined ? undefined : findIntent(log, receipt.operationKey);
    if (
      receipt === undefined ||
      intent === undefined ||
      intent.operation.generation !== context.generation ||
      intent.operation.scenarioDigest !== this.#scenarioDigest ||
      intent.operation.sourceSha !== context.sourceSha ||
      intent.operation.fixedInputsDigest !== prepared.fixedInputsDigest
    ) {
      return { blocker: 'target-lost', kind: 'blocked' };
    }
    const expectedTarget = this.#receiptTarget({
      commandDigest: prepared.commandDigest,
      context,
      fixedInputsDigest: prepared.fixedInputsDigest,
      operationKey: receipt.operationKey,
      providerTarget: context.target,
    });
    if (!sameReceiptTarget(expectedTarget, context.target)) return { blocker: 'target-lost', kind: 'blocked' };
    return {
      context,
      identity: this.#publicIdentity({
        commandDigest: prepared.commandDigest,
        context,
        fixedInputsDigest: prepared.fixedInputsDigest,
        operationKey: receipt.operationKey,
        target: expectedTarget,
      }),
      kind: 'attached',
      operationKey: receipt.operationKey,
      receiptId: receipt.receiptId,
      target: expectedTarget,
    };
  }

  async #prepareStart(context) {
    if (this.#commands.start === undefined) runtimeFail('generic-ci-start-unsupported');
    const command = await this.#resolveCommand(this.#commands.start, context);
    const commandDigest = digestAdapterCommand(command);
    return freezeRecord({
      command,
      commandDigest,
      fixedInputsDigest: createFixedInputsDigest({
        adapterName: GENERIC_CI_ADAPTER,
        attempt: context.attempt,
        commandDigest,
        inputDigest: context.inputDigest,
        sourceSha: context.sourceSha,
        watchId: this.#watchId,
      }),
    });
  }

  async #resolveCommand(definition, context) {
    return resolveAdapterCommand({
      command: definition,
      context,
      environmentAllowlist: this.#environmentAllowlist,
      watchId: this.#watchId,
      workspaceRoot: this.#workspaceRoot,
    });
  }

  async #runCommand(definition, context) {
    return this.#runResolvedCommand(await this.#resolveCommand(definition, context), context);
  }

  async #runResolvedCommand(command, context) {
    const collector = new GenericCiJsonOutputCollector({
      contract: this.#resultContract,
      maximumBytes: Math.min(MAX_JSON_OUTPUT_BYTES, this.#scenario.evidence.maxBytesPerAttempt),
    });
    try {
      const execution = await this.#runner.start({
        ...command,
        evidence: {
          maximumBytes: this.#scenario.evidence.maxBytesPerAttempt,
          maximumFailures: this.#scenario.evidence.maxFailures,
          maximumMilliseconds: Math.min(context.timeoutMilliseconds, this.#scenario.evidence.ttlSeconds * 1_000),
        },
        outputConsumer: (streamName, chunk) => collector.append(streamName, chunk),
      });
      const processResult = normalizeAdapterCommandResult(await execution.wait());
      const result = collector.parse();
      if (!isSuccessfulCommandResult(processResult) && result.authentication !== 'failed') {
        runtimeFail('generic-ci-command-failed');
      }
      return freezeRecord({ evidence: processResult.evidence, result });
    } finally {
      collector.dispose();
    }
  }

  #assertResult(result, { context, expectedKinds, expectedOperationKey, expectedTarget } = {}) {
    if (!expectedKinds.includes(result.kind)) runtimeFail('generic-ci-result-kind-mismatch');
    if (result.providerId !== this.#providerId) runtimeFail('generic-ci-provider-mismatch');
    if (result.target.attempt !== context.attempt || result.target.sourceSha !== context.sourceSha) {
      runtimeFail('generic-ci-target-identity-mismatch');
    }
    if (expectedTarget !== undefined && !sameProviderTarget(result.target, expectedTarget)) {
      runtimeFail('generic-ci-target-identity-mismatch');
    }
    if (expectedOperationKey !== undefined && result.operationKey !== expectedOperationKey) {
      runtimeFail('generic-ci-operation-key-mismatch');
    }
    for (const member of result.members) {
      if (member.sourceSha !== context.sourceSha) runtimeFail('generic-ci-member-identity-mismatch');
    }
    return result;
  }

  #statusCategory(result) {
    if (result.authentication === 'failed') return 'authentication_failed';
    const category = this.#statusMap.get(result.providerStatus);
    if (category === undefined) runtimeFail('generic-ci-status-unmapped');
    return category;
  }

  #assertRequiredMembers(result) {
    const membersById = new Map(result.members.map((member) => [member.memberId, member]));
    for (const requiredCheck of this.#scenario.success.requiredChecks) {
      const member = membersById.get(requiredCheck);
      if (member === undefined) runtimeFail('generic-ci-required-member-missing');
      const status = this.#statusMap.get(member.status);
      if (status === undefined) runtimeFail('generic-ci-member-status-unmapped');
      const allowedSkipped =
        this.#scenario.success.allowedSkippedChecks.includes(requiredCheck) && member.status === 'skipped';
      if (member.status === 'skipped' && !allowedSkipped) runtimeFail('generic-ci-required-member-failed');
      if (status !== 'succeeded' && !allowedSkipped) runtimeFail('generic-ci-required-member-failed');
    }
  }

  #assertFailureEntries(result) {
    const knownMemberIds = new Set([result.target.targetId, ...result.members.map((member) => member.memberId)]);
    for (const entry of result.failureEntries) {
      if (!knownMemberIds.has(entry.memberId)) runtimeFail('generic-ci-failure-member-unknown');
    }
  }

  #receiptTarget({ commandDigest, context, fixedInputsDigest, operationKey, providerTarget }) {
    const identityDigest = digestNormalizedValue('gpt-voice/watch-process/generic-ci-target/v1', {
      commandDigest,
      fixedInputsDigest,
      generation: context.generation,
      inputDigest: context.inputDigest,
      operationKey,
      providerId: this.#providerId,
      sourceSha: providerTarget.sourceSha,
      targetId: providerTarget.targetId,
      watchId: this.#watchId,
    });
    return freezeRecord({
      attempt: providerTarget.attempt,
      identityDigest,
      sourceSha: providerTarget.sourceSha,
      targetId: providerTarget.targetId,
    });
  }

  #publicIdentity({ commandDigest, context, fixedInputsDigest, operationKey, target }) {
    return freezeRecord({
      adapter: GENERIC_CI_ADAPTER,
      attempt: target.attempt,
      commandDigest,
      fixedInputsDigest,
      generation: context.generation,
      identityDigest: target.identityDigest,
      inputDigest: context.inputDigest,
      operationKey,
      providerId: this.#providerId,
      sourceSha: target.sourceSha,
      targetId: target.targetId,
      watchId: this.#watchId,
    });
  }

  #attachmentResponse(attached) {
    return freezeRecord({
      identity: attached.identity,
      receiptId: attached.receiptId,
      status: 'attached',
      target: attached.target,
    });
  }

  #blocked(blocker) {
    return freezeRecord({ blocker, status: 'blocked' });
  }

  #requirePreflight() {
    if (!this.#preflightCompleted) runtimeFail('adapter-preflight-required');
  }
}
