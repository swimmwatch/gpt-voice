import { URL } from 'node:url';

import { ManagedProcessRunner } from '../managed-process-runner.mjs';
import { ProcessAdapter } from '../runtime-contracts.mjs';
import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  isRecord,
  requireString,
  runtimeFail,
} from '../runtime-core-support.mjs';
import { validateDigest, validateWatchId } from '../runtime-state-contracts.mjs';

import {
  assertAdapterDependencies,
  createFixedInputsDigest,
  isSuccessfulCommandResult,
  mergeEnvironmentAllowlists,
  normalizeAdapterAttemptContext,
  normalizeAdapterCommandResult,
} from './adapter-support.mjs';
import { GitHubActionsJsonOutputCollector } from './github-actions-json-output-collector.mjs';
import {
  isAllowedGitHubWorkflow,
  normalizeGitHubBranchRequiredChecks,
  normalizeGitHubCheckRuns,
  normalizeGitHubCommitStatuses,
  normalizeGitHubCurrentBranchPullRequest,
  normalizeGitHubJobs,
  normalizeGitHubPullRequest,
  normalizeGitHubRepository,
  normalizeGitHubRuleRequiredChecks,
  normalizeGitHubRun,
  normalizeGitHubUser,
  normalizeGitHubWorkflowAllowlist,
  normalizeGitHubWorkflowRuns,
  normalizeGitHubWorkspaceRepository,
  parseGitHubPullRequestSelector,
  parseGitHubRunSelector,
  workflowFilenameForRun,
} from './github-actions-response-contract.mjs';

const GITHUB_ACTIONS_ADAPTER = 'github-actions';
const GITHUB_CLI_EXECUTABLE = 'gh';
const GITHUB_CLI_ENVIRONMENT_ALLOWLIST = freezeArray([
  'PATH',
  'HOME',
  'USERPROFILE',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
  'XDG_STATE_HOME',
  'APPDATA',
  'LOCALAPPDATA',
  'GH_CONFIG_DIR',
  'SystemRoot',
]);
const MAX_JSON_OUTPUT_BYTES = 262_144;
const REMOTE_COMMAND_FAILED = Symbol('remote-command-failed');
const RUN_TARGET_PATTERN = /^github-actions-run-(\d+)-provider-attempt-(\d+)$/u;
const PR_TARGET_PATTERN = /^github-actions-pr-(\d+)-attempt-(\d+)$/u;
const DISPATCH_INPUT_NAME_PATTERN = /^[A-Za-z][\w-]{0,63}$/u;
const DISPATCH_FORBIDDEN_PATTERN = /deploy|force[-_]?push|publish|release/iu;

const JSON_PROJECTIONS = Object.freeze({
  branchRequiredChecks:
    '{contexts:(.protection.required_status_checks.contexts // []),checks:((.protection.required_status_checks.checks // []) | map({context,appId:.app_id}))}',
  checkRuns:
    '[.check_runs[] | {id,name,status,conclusion,headSha:.head_sha,detailsUrl:.details_url,appId:(.app.id // null)}]',
  jobs: '[.jobs[] | {id,name,status,conclusion}]',
  currentBranchPullRequest: '{number,headSha:.headRefOid,baseRef:.baseRefName,headRef:.headRefName,state}',
  pullRequest: '{number,headSha:.head.sha,baseRef:.base.ref}',
  repository: '{fullName:.full_name}',
  ruleRequiredChecks:
    '[.[]? | select(.type == "required_status_checks") | (.parameters.required_status_checks // [])[] | {context,appId:(.integration_id // null)}]',
  run: '{id,runAttempt:.run_attempt,headSha:.head_sha,event,path,status,conclusion,htmlUrl:.html_url,displayTitle:.display_title}',
  statuses: '[.statuses[] | {id,context,state,sha}]',
  user: '{login}',
  workflowRuns:
    '[.workflow_runs[] | {id,runAttempt:.run_attempt,headSha:.head_sha,event,path,status,conclusion,htmlUrl:.html_url,displayTitle:.display_title}]',
});

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function sameTarget(left, right) {
  return (
    left.attempt === right.attempt &&
    left.identityDigest === right.identityDigest &&
    left.sourceSha === right.sourceSha &&
    left.targetId === right.targetId
  );
}

function normalizeRepository(value, code) {
  const repository = requireString(value, code, { maximum: 200, minimum: 3 });
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) runtimeFail(code);
  return repository;
}

function containsControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function normalizeMode(value) {
  if (!['pull-request-contract', 'run'].includes(value)) runtimeFail('invalid-github-actions-mode');
  return value;
}

function normalizeDispatchValue(value, code) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    if (value.length > 1_000 || containsControlCharacter(value)) runtimeFail(code);
    return value;
  }
  runtimeFail(code);
}

function normalizeDispatch(value, workflowAllowlist) {
  const code = 'invalid-github-dispatch-config';
  if (value === undefined) {
    return freezeRecord({ enabled: false, idempotencyInput: null, inputs: freezeRecord({}), workflow: null });
  }
  const dispatch = assertClosedRecord(value, new Set(['enabled', 'idempotencyInput', 'inputs', 'workflow']), code);
  if (typeof dispatch.enabled !== 'boolean' || !isRecord(dispatch.inputs)) runtimeFail(code);
  const inputs = {};
  for (const [name, input] of Object.entries(dispatch.inputs)) {
    if (!DISPATCH_INPUT_NAME_PATTERN.test(name)) runtimeFail(code);
    if (DISPATCH_FORBIDDEN_PATTERN.test(name)) runtimeFail('github-dispatch-prohibited-input');
    const normalized = normalizeDispatchValue(input, code);
    if (typeof normalized === 'string' && DISPATCH_FORBIDDEN_PATTERN.test(normalized)) {
      runtimeFail('github-dispatch-prohibited-input');
    }
    inputs[name] = normalized;
  }
  if (!dispatch.enabled) {
    if (dispatch.workflow !== undefined || dispatch.idempotencyInput !== undefined) runtimeFail(code);
    return freezeRecord({ enabled: false, idempotencyInput: null, inputs: freezeRecord(inputs), workflow: null });
  }
  const workflow = requireString(dispatch.workflow, code, { maximum: 256, minimum: 1 });
  if (!workflowAllowlist.includes(workflow)) runtimeFail('github-dispatch-workflow-not-allowed');
  const idempotencyInput = requireString(dispatch.idempotencyInput, code, { maximum: 64, minimum: 1 });
  if (!DISPATCH_INPUT_NAME_PATTERN.test(idempotencyInput) || Object.hasOwn(inputs, idempotencyInput)) runtimeFail(code);
  if (DISPATCH_FORBIDDEN_PATTERN.test(idempotencyInput)) runtimeFail('github-dispatch-prohibited-input');
  return freezeRecord({ enabled: true, idempotencyInput, inputs: freezeRecord(inputs), workflow });
}

function parseRunTarget(target) {
  const match = RUN_TARGET_PATTERN.exec(target.targetId);
  if (match === null || Number(match[2]) <= 0) runtimeFail('invalid-github-run-target');
  return freezeRecord({ providerAttempt: Number(match[2]), runId: match[1] });
}

function parsePullRequestTarget(target) {
  const match = PR_TARGET_PATTERN.exec(target.targetId);
  if (match === null || Number(match[2]) !== target.attempt) runtimeFail('invalid-github-pull-request-target');
  return freezeRecord({ number: Number(match[1]) });
}

function classifyRun(run) {
  if (['in_progress', 'pending', 'queued', 'requested', 'waiting'].includes(run.status)) return 'running';
  if (run.status !== 'completed') return 'failed';
  if (run.conclusion === 'success') return 'succeeded';
  if (run.conclusion === 'cancelled') return 'cancelled';
  return 'failed';
}

function classifyJob(job, allowedSkippedChecks) {
  if (job.status !== 'completed') return 'running';
  if (job.conclusion === 'success') return 'succeeded';
  if (job.conclusion === 'skipped' && allowedSkippedChecks.includes(job.name)) return 'succeeded';
  if (job.conclusion === 'cancelled') return 'cancelled';
  return 'failed';
}

function classifyCheckRun(checkRun, allowedSkippedChecks) {
  if (checkRun.status !== 'completed') return 'running';
  if (checkRun.conclusion === 'success') return 'succeeded';
  if (checkRun.conclusion === 'skipped' && allowedSkippedChecks.includes(checkRun.name)) return 'succeeded';
  if (checkRun.conclusion === 'cancelled') return 'cancelled';
  return 'failed';
}

function classifyCommitStatus(status) {
  if (status.state === 'success') return 'succeeded';
  if (['expected', 'pending'].includes(status.state)) return 'running';
  if (status.state === 'cancelled') return 'cancelled';
  return 'failed';
}

function combineOutcomes(outcomes) {
  if (outcomes.some((outcome) => outcome === 'failed')) return 'failed';
  if (outcomes.some((outcome) => outcome === 'cancelled')) return 'cancelled';
  if (outcomes.some((outcome) => outcome === 'running')) return 'running';
  return 'succeeded';
}

function requiredContract({ branchRequiredChecks, mode, ruleRequiredChecks, scenario }) {
  const providerRequirements = [];
  for (const context of branchRequiredChecks.contexts) providerRequirements.push({ appId: null, context });
  providerRequirements.push(...branchRequiredChecks.checks, ...ruleRequiredChecks);
  const byKey = new Map();
  for (const requirement of providerRequirements) {
    const key = `${requirement.context}:${requirement.appId ?? 'any'}`;
    byKey.set(key, requirement);
  }
  const provider = [...byKey.values()].sort((left, right) => {
    const leftKey = `${left.context}:${left.appId ?? ''}`;
    const rightKey = `${right.context}:${right.appId ?? ''}`;
    return leftKey.localeCompare(rightKey);
  });
  let evaluationMode;
  let requirements;
  if (mode === 'provider-required') {
    evaluationMode = provider.length === 0 ? 'pipeline-discovery' : 'provider-required';
    requirements = provider;
  } else if (mode === 'listed') {
    evaluationMode = 'listed';
    requirements = scenario.success.requiredChecks.map((context) => ({ appId: null, context }));
  } else {
    evaluationMode = 'none';
    requirements = [];
  }
  const selected = requirements.map((requirement) => freezeRecord({ ...requirement }));
  return freezeRecord({
    digest: digestNormalizedValue('gpt-voice/watch-process/github-required-contract/v1', {
      provider,
      evaluationMode,
      requiredChecksMode: mode,
      selected,
    }),
    evaluationMode,
    requirements: freezeArray(selected),
  });
}

function detailsRunId(detailsUrl, repository) {
  if (detailsUrl === null) return null;
  let url;
  try {
    url = new URL(detailsUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
  const segments = url.pathname.split('/').filter(Boolean);
  const expected = repository.split('/');
  if (
    segments.length < 5 ||
    segments[0].toLowerCase() !== expected[0].toLowerCase() ||
    segments[1].toLowerCase() !== expected[1].toLowerCase() ||
    segments[2] !== 'actions' ||
    segments[3] !== 'runs' ||
    !/^\d+$/u.test(segments[4])
  ) {
    return null;
  }
  return segments[4];
}

function summarizeEvidence(values) {
  return freezeRecord({
    capturedBytes: values.reduce((total, value) => total + value.capturedBytes, 0),
    receivedBytes: values.reduce((total, value) => total + value.receivedBytes, 0),
    requestCount: values.length,
    truncated: values.some((value) => value.truncated),
  });
}

/** Observes exact GitHub run/PR contracts and dispatches only declared, correlatable workflows. */
export class GitHubActionsProcessAdapter extends ProcessAdapter {
  #dispatch;
  #environmentAllowlist;
  #evidenceByIdentity = new Map();
  #fallbackMembership = null;
  #mode;
  #preflightCompleted = false;
  #preflightTarget = null;
  #receiptStore;
  #repository;
  #runner;
  #scenario;
  #scenarioDigest;
  #watchId;
  #workflowAllowlist;
  #workspaceRoot;

  constructor({
    environmentAllowlist = [],
    receiptStore,
    runner,
    scenario,
    scenarioDigest,
    watchId,
    workspaceRoot,
  } = {}) {
    super();
    if (
      !(runner instanceof ManagedProcessRunner) ||
      !isRecord(scenario) ||
      scenario.adapter !== GITHUB_ACTIONS_ADAPTER
    ) {
      runtimeFail('invalid-github-actions-adapter-dependency');
    }
    if (!Array.isArray(environmentAllowlist) || !isRecord(scenario.adapterConfig)) {
      runtimeFail('invalid-github-actions-adapter-scenario');
    }
    const normalizedWatchId = validateWatchId(watchId, 'invalid-github-actions-adapter-dependency');
    assertAdapterDependencies({ receiptStore, watchId: normalizedWatchId });
    const repository = normalizeRepository(
      scenario.adapterConfig.repository,
      'invalid-github-actions-adapter-scenario',
    );
    const mode = normalizeMode(scenario.adapterConfig.mode);
    const workflowAllowlist = normalizeGitHubWorkflowAllowlist(scenario.adapterConfig.workflowAllowlist);
    const dispatch = normalizeDispatch(scenario.adapterConfig.dispatch, workflowAllowlist);
    if (dispatch.enabled && !scenario.target.selectorKinds.includes('start')) {
      runtimeFail('github-dispatch-start-not-authorized');
    }
    this.#dispatch = dispatch;
    this.#environmentAllowlist = mergeEnvironmentAllowlists(
      GITHUB_CLI_ENVIRONMENT_ALLOWLIST,
      environmentAllowlist,
    );
    this.#mode = mode;
    this.#receiptStore = receiptStore;
    this.#repository = repository;
    this.#runner = runner;
    this.#scenario = scenario;
    this.#scenarioDigest = validateDigest(scenarioDigest, 'invalid-github-actions-adapter-dependency');
    this.#watchId = normalizedWatchId;
    this.#workflowAllowlist = workflowAllowlist;
    this.#workspaceRoot = typeof workspaceRoot === 'string' && workspaceRoot.length > 0 ? workspaceRoot : null;
    if (this.#workspaceRoot === null) runtimeFail('invalid-github-actions-adapter-dependency');
  }

  async preflight(context) {
    this.#preflightCompleted = false;
    this.#preflightTarget = null;
    const normalized = this.#normalizeContext(context);
    const cli = await this.#runExitOnly(normalized, ['--version']);
    if (!cli.succeeded) runtimeFail('github-cli-unavailable');
    const authentication = await this.#readJson(normalized, ['api', 'user', '--jq', JSON_PROJECTIONS.user]);
    if (!authentication.succeeded) return this.#blocked('authentication-failed');
    normalizeGitHubUser(authentication.value);
    try {
      const workspace = await this.#requireJson(normalized, ['repo', 'view', '--json', 'nameWithOwner']);
      const workspaceRepository = normalizeGitHubWorkspaceRepository(workspace.value);
      if (workspaceRepository.nameWithOwner.toLowerCase() !== this.#repository.toLowerCase()) {
        runtimeFail('github-workspace-repository-mismatch');
      }
      const repository = await this.#requireJson(normalized, [
        'api',
        `repos/${this.#repository}`,
        '--jq',
        JSON_PROJECTIONS.repository,
      ]);
      const selectedRepository = normalizeGitHubRepository(repository.value);
      if (selectedRepository.fullName.toLowerCase() !== this.#repository.toLowerCase()) {
        runtimeFail('github-repository-mismatch');
      }
      if (this.#resolvesExistingTarget(normalized)) {
        this.#preflightTarget = (await this.#resolveTarget(normalized)).target;
      } else {
        this.#preflightTarget = null;
        this.#assertDispatchPermitted();
      }
    } catch (error) {
      if (error === REMOTE_COMMAND_FAILED) return await this.#remoteBlocker(normalized);
      if (this.#isTargetIdentityError(error)) return this.#blocked('target-lost');
      throw error;
    }
    this.#preflightCompleted = true;
    return freezeRecord({ adapter: GITHUB_ACTIONS_ADAPTER, status: 'ready' });
  }

  async start(context) {
    this.#requirePreflight();
    const normalized = this.#normalizeContext(context);
    try {
      if (this.#resolvesExistingTarget(normalized)) {
        const resolved = await this.#resolveTarget(normalized);
        if (!sameTarget(this.#preflightTarget, resolved.target)) return this.#blocked('target-lost');
        return this.#attachmentResponse(resolved);
      }
      return await this.#dispatchWorkflow(normalized);
    } catch (error) {
      if (error === REMOTE_COMMAND_FAILED) return await this.#remoteBlocker(normalized);
      if (this.#isTargetIdentityError(error)) return this.#blocked('target-lost');
      throw error;
    }
  }

  async attach(context) {
    const normalized = this.#normalizeContext(context);
    if (normalized.target === null) runtimeFail('adapter-target-required');
    try {
      return this.#attachmentResponse(await this.#resolveTarget(normalized));
    } catch (error) {
      if (error === REMOTE_COMMAND_FAILED) return await this.#remoteFailure(normalized, 'github-attach-failed');
      if (this.#isTargetIdentityError(error)) return this.#blocked('target-lost');
      throw error;
    }
  }

  async observe(context) {
    const normalized = this.#normalizeContext(context);
    if (normalized.target === null) runtimeFail('adapter-target-required');
    try {
      const resolved = await this.#resolveTarget(normalized);
      if (this.#mode === 'run') return await this.#observeRun(normalized, resolved);
      return this.#observePullRequest(normalized, resolved);
    } catch (error) {
      if (error === REMOTE_COMMAND_FAILED) return this.#remoteFailure(normalized, 'github-observe-failed');
      if (this.#isTargetIdentityError(error)) return this.#blocked('target-lost');
      throw error;
    }
  }

  async collectEvidence(context) {
    const normalized = this.#normalizeContext(context);
    if (normalized.target === null) runtimeFail('adapter-target-required');
    const cacheKey = `${normalized.target.targetId}:${normalized.target.identityDigest}`;
    const cached = this.#evidenceByIdentity.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const resolved = await this.#resolveTarget(normalized);
      const evidence =
        this.#mode === 'run'
          ? await this.#collectRunEvidence(normalized, resolved)
          : await this.#collectPullRequestEvidence(normalized, resolved);
      this.#evidenceByIdentity.set(cacheKey, evidence);
      return evidence;
    } catch (error) {
      if (error === REMOTE_COMMAND_FAILED) return this.#remoteFailure(normalized, 'github-evidence-failed');
      if (this.#isTargetIdentityError(error)) return this.#blocked('target-lost');
      throw error;
    }
  }

  async identity(context) {
    const normalized = this.#normalizeContext(context);
    if (normalized.target === null) runtimeFail('adapter-target-required');
    try {
      const resolved = await this.#resolveTarget(normalized);
      return freezeRecord({ identity: resolved.identity, status: 'identified', target: resolved.target });
    } catch (error) {
      if (error === REMOTE_COMMAND_FAILED) return this.#remoteFailure(normalized, 'github-identity-failed');
      if (this.#isTargetIdentityError(error)) return this.#blocked('target-lost');
      throw error;
    }
  }

  async restart(context) {
    this.#requirePreflight();
    const normalized = this.#normalizeContext(context);
    if (this.#mode !== 'run' || !this.#dispatch.enabled) runtimeFail('github-restart-unsupported');
    if (normalized.target === null) runtimeFail('adapter-target-required');
    return this.#dispatchWorkflow(
      this.#normalizeContext({
        attempt: normalized.attempt + 1,
        generation: normalized.generation,
        inputDigest: normalized.inputDigest,
        sourceSha: normalized.sourceSha,
        targetId: normalized.targetId,
        targetSelector: 'unspecified',
        timeoutSeconds: normalized.timeoutSeconds,
      }),
    );
  }

  async cancel() {
    return freezeRecord({ code: 'cancel-unsupported', status: 'unsupported' });
  }

  #normalizeContext(context) {
    const normalized = normalizeAdapterAttemptContext(context, { timing: this.#scenario.timing });
    if (this.#scenario.target.requireExactSourceRevision && normalized.sourceSha === null)
      runtimeFail('source-sha-required');
    return normalized;
  }

  #assertDispatchPermitted() {
    if (!this.#dispatch.enabled || this.#mode !== 'run' || !this.#scenario.target.selectorKinds.includes('start')) {
      runtimeFail('github-target-required');
    }
  }

  #resolvesExistingTarget(context) {
    return (
      this.#mode === 'pull-request-contract' || context.target !== null || context.targetSelector !== 'unspecified'
    );
  }

  async #resolveTarget(context) {
    if (this.#mode === 'run') {
      const selection =
        context.target === null
          ? parseGitHubRunSelector(context.targetSelector, this.#repository)
          : parseRunTarget(context.target);
      const resolved = await this.#queryRun(context, selection.runId, {
        // A fresh run URL identifies a run but not its provider rerun attempt.
        // Bind that immutable attempt from the fresh provider response; later
        // attachment parses and proves the attempt stored in the target ID.
        expectedProviderAttempt: context.target === null ? null : selection.providerAttempt,
        targetAttempt: context.attempt,
      });
      this.#assertExactTarget(context, resolved.target);
      return resolved;
    }
    let selection;
    if (context.target !== null) {
      selection = parsePullRequestTarget(context.target);
    } else if (context.targetSelector === 'unspecified') {
      selection = await this.#currentBranchPullRequest(context);
    } else {
      selection = parseGitHubPullRequestSelector(context.targetSelector, this.#repository);
    }
    const resolved = await this.#queryPullRequest(context, selection.number);
    this.#assertExactTarget(context, resolved.target);
    return resolved;
  }

  async #currentBranchPullRequest(context) {
    const response = await this.#readJson(context, [
      'pr',
      'view',
      '--json',
      'number,headRefOid,baseRefName,headRefName,state',
      '--jq',
      JSON_PROJECTIONS.currentBranchPullRequest,
    ]);
    if (!response.succeeded) runtimeFail('github-current-branch-pull-request-not-found');
    const pullRequest = normalizeGitHubCurrentBranchPullRequest(response.value);
    if (pullRequest.state !== 'OPEN' || pullRequest.headSha !== context.sourceSha) {
      runtimeFail('github-source-sha-mismatch');
    }
    return freezeRecord({
      baseRef: pullRequest.baseRef,
      headRef: pullRequest.headRef,
      number: pullRequest.number,
      repository: this.#repository,
    });
  }

  #assertExactTarget(context, target) {
    if (context.target !== null && !sameTarget(context.target, target)) runtimeFail('github-target-identity-mismatch');
  }

  async #queryRun(context, runId, { expectedProviderAttempt, targetAttempt }) {
    const response = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/actions/runs/${runId}`,
      '--jq',
      JSON_PROJECTIONS.run,
    ]);
    const run = normalizeGitHubRun(response.value);
    if (run.id !== runId || run.headSha !== context.sourceSha) runtimeFail('github-source-sha-mismatch');
    if (expectedProviderAttempt !== null && run.runAttempt !== expectedProviderAttempt) {
      runtimeFail('github-run-attempt-mismatch');
    }
    if (!isAllowedGitHubWorkflow(run, this.#workflowAllowlist)) runtimeFail('github-workflow-not-allowed');
    const workflow = workflowFilenameForRun(run);
    const identityDigest = digestNormalizedValue('gpt-voice/watch-process/github-run-identity/v1', {
      generation: context.generation,
      inputDigest: context.inputDigest,
      repository: this.#repository,
      runAttempt: run.runAttempt,
      runId: run.id,
      sourceSha: run.headSha,
      watchId: this.#watchId,
      workflow,
    });
    const target = freezeRecord({
      attempt: targetAttempt,
      identityDigest,
      sourceSha: run.headSha,
      targetId: `github-actions-run-${run.id}-provider-attempt-${run.runAttempt}`,
    });
    return freezeRecord({
      evidence: response.evidence,
      identity: freezeRecord({
        adapter: GITHUB_ACTIONS_ADAPTER,
        event: run.event,
        generation: context.generation,
        identityDigest,
        inputDigest: context.inputDigest,
        mode: 'run',
        repository: this.#repository,
        runAttempt: run.runAttempt,
        runId: run.id,
        sourceSha: run.headSha,
        watchId: this.#watchId,
        workflow,
      }),
      run,
      target,
    });
  }

  async #queryPullRequest(context, pullRequestNumber) {
    const evidence = [];
    const pullRequestResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/pulls/${pullRequestNumber}`,
      '--jq',
      JSON_PROJECTIONS.pullRequest,
    ]);
    evidence.push(pullRequestResponse.evidence);
    const pullRequest = normalizeGitHubPullRequest(pullRequestResponse.value);
    if (pullRequest.number !== pullRequestNumber || pullRequest.headSha !== context.sourceSha) {
      runtimeFail('github-source-sha-mismatch');
    }
    const baseRef = encodeURIComponent(pullRequest.baseRef);
    const branchRequirementsResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/branches/${baseRef}`,
      '--jq',
      JSON_PROJECTIONS.branchRequiredChecks,
    ]);
    evidence.push(branchRequirementsResponse.evidence);
    const rulesResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/rules/branches/${baseRef}`,
      '--jq',
      JSON_PROJECTIONS.ruleRequiredChecks,
    ]);
    evidence.push(rulesResponse.evidence);
    const checkRunsResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/commits/${context.sourceSha}/check-runs?per_page=100`,
      '--jq',
      JSON_PROJECTIONS.checkRuns,
    ]);
    evidence.push(checkRunsResponse.evidence);
    const statusesResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/commits/${context.sourceSha}/status`,
      '--jq',
      JSON_PROJECTIONS.statuses,
    ]);
    evidence.push(statusesResponse.evidence);
    const workflowRunsResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/actions/runs?head_sha=${context.sourceSha}&per_page=100`,
      '--jq',
      JSON_PROJECTIONS.workflowRuns,
    ]);
    evidence.push(workflowRunsResponse.evidence);
    const branchRequiredChecks = normalizeGitHubBranchRequiredChecks(branchRequirementsResponse.value);
    const ruleRequiredChecks = normalizeGitHubRuleRequiredChecks(rulesResponse.value);
    const checkRuns = normalizeGitHubCheckRuns(checkRunsResponse.value);
    const statuses = normalizeGitHubCommitStatuses(statusesResponse.value);
    const workflowRuns = normalizeGitHubWorkflowRuns(workflowRunsResponse.value);
    for (const checkRun of checkRuns) {
      if (checkRun.headSha !== context.sourceSha) runtimeFail('github-pr-member-source-sha-mismatch');
    }
    for (const status of statuses) {
      if (status.sha !== context.sourceSha) runtimeFail('github-pr-member-source-sha-mismatch');
    }
    for (const workflowRun of workflowRuns) {
      if (workflowRun.headSha !== context.sourceSha) runtimeFail('github-pr-member-source-sha-mismatch');
    }
    const required = requiredContract({
      branchRequiredChecks,
      mode: this.#scenario.success.requiredChecksMode,
      ruleRequiredChecks,
      scenario: this.#scenario,
    });
    const identityDigest = digestNormalizedValue('gpt-voice/watch-process/github-pr-contract-identity/v1', {
      generation: context.generation,
      inputDigest: context.inputDigest,
      pullRequestNumber,
      repository: this.#repository,
      requiredContractDigest: required.digest,
      sourceSha: context.sourceSha,
      watchId: this.#watchId,
    });
    const target = freezeRecord({
      attempt: context.attempt,
      identityDigest,
      sourceSha: context.sourceSha,
      targetId: `github-actions-pr-${pullRequestNumber}-attempt-${context.attempt}`,
    });
    return freezeRecord({
      branchRequiredChecks,
      checkRuns,
      evidence: freezeArray(evidence),
      identity: freezeRecord({
        adapter: GITHUB_ACTIONS_ADAPTER,
        generation: context.generation,
        identityDigest,
        inputDigest: context.inputDigest,
        mode: 'pull-request-contract',
        pullRequestNumber,
        repository: this.#repository,
        requiredContractDigest: required.digest,
        sourceSha: context.sourceSha,
        watchId: this.#watchId,
      }),
      pullRequest,
      required,
      statuses,
      target,
      workflowRuns,
    });
  }

  async #observeRun(context, resolved) {
    const category = classifyRun(resolved.run);
    if (category === 'running') return freezeRecord({ status: 'running', target: resolved.target });
    if (category === 'cancelled')
      return freezeRecord({ outcome: 'target_cancelled', status: 'cancelled', target: resolved.target });
    if (category === 'failed')
      return freezeRecord({ outcome: 'target_failed', status: 'failed', target: resolved.target });
    const jobsResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/actions/runs/${resolved.run.id}/attempts/${resolved.run.runAttempt}/jobs?per_page=100`,
      '--jq',
      JSON_PROJECTIONS.jobs,
    ]);
    const jobs = normalizeGitHubJobs(jobsResponse.value);
    const outcomes = this.#requiredJobOutcomes(jobs);
    const jobsCategory = combineOutcomes(outcomes);
    if (jobsCategory === 'running') return freezeRecord({ status: 'running', target: resolved.target });
    if (jobsCategory === 'cancelled') {
      return freezeRecord({ outcome: 'target_cancelled', status: 'cancelled', target: resolved.target });
    }
    if (jobsCategory === 'failed')
      return freezeRecord({ outcome: 'target_failed', status: 'failed', target: resolved.target });
    return freezeRecord({ outcome: 'succeeded', status: 'succeeded', target: resolved.target });
  }

  #requiredJobOutcomes(jobs) {
    const requiredNames =
      this.#scenario.success.requiredChecksMode === 'listed'
        ? this.#scenario.success.requiredChecks
        : jobs.map((job) => job.name);
    if (requiredNames.length === 0) return ['failed'];
    const outcomes = [];
    for (const requiredName of requiredNames) {
      const matches = jobs.filter((job) => job.name === requiredName);
      if (matches.length !== 1) return ['failed'];
      outcomes.push(classifyJob(matches[0], this.#scenario.success.allowedSkippedChecks));
    }
    return outcomes;
  }

  #observePullRequest(context, resolved) {
    if (resolved.required.evaluationMode === 'pipeline-discovery') {
      return this.#observeDiscoveredPullRequest(resolved);
    }
    const outcomes = [];
    for (const requirement of resolved.required.requirements) {
      const candidates = [];
      for (const checkRun of resolved.checkRuns) {
        if (
          checkRun.name === requirement.context &&
          (requirement.appId === null || checkRun.appId === requirement.appId)
        ) {
          candidates.push({ kind: 'check-run', value: checkRun });
        }
      }
      if (requirement.appId === null) {
        for (const status of resolved.statuses) {
          if (status.context === requirement.context) candidates.push({ kind: 'commit-status', value: status });
        }
      }
      if (candidates.length !== 1)
        return freezeRecord({ outcome: 'target_failed', status: 'failed', target: resolved.target });
      const candidate = candidates[0];
      if (candidate.kind === 'check-run') {
        const referencedRun = detailsRunId(candidate.value.detailsUrl, this.#repository);
        if (referencedRun !== null) {
          const workflowRuns = resolved.workflowRuns.filter((run) => run.id === referencedRun);
          if (workflowRuns.length !== 1 || !isAllowedGitHubWorkflow(workflowRuns[0], this.#workflowAllowlist)) {
            return this.#blocked('target-lost');
          }
        }
        outcomes.push(classifyCheckRun(candidate.value, this.#scenario.success.allowedSkippedChecks));
      } else {
        outcomes.push(classifyCommitStatus(candidate.value));
      }
    }
    const category = combineOutcomes(outcomes);
    if (category === 'running') return freezeRecord({ status: 'running', target: resolved.target });
    if (category === 'cancelled') {
      return freezeRecord({ outcome: 'target_cancelled', status: 'cancelled', target: resolved.target });
    }
    if (category === 'failed')
      return freezeRecord({ outcome: 'target_failed', status: 'failed', target: resolved.target });
    return freezeRecord({ outcome: 'succeeded', status: 'succeeded', target: resolved.target });
  }

  #observeDiscoveredPullRequest(resolved) {
    const pipeline = this.#discoveredPipeline(resolved);
    if (pipeline.blocked) return this.#blocked('target-lost');
    if (pipeline.workflowCount === 0 || pipeline.members.length === 0) {
      this.#fallbackMembership = null;
      return freezeRecord({ status: 'running', target: resolved.target });
    }
    const membershipStable = this.#recordFallbackMembership(resolved.target, pipeline.members);
    const category = combineOutcomes(pipeline.outcomes);
    if (category === 'running' || (category === 'succeeded' && !membershipStable)) {
      return freezeRecord({ status: 'running', target: resolved.target });
    }
    if (category === 'cancelled') {
      return freezeRecord({ outcome: 'target_cancelled', status: 'cancelled', target: resolved.target });
    }
    if (category === 'failed') {
      return freezeRecord({ outcome: 'target_failed', status: 'failed', target: resolved.target });
    }
    return freezeRecord({ outcome: 'succeeded', status: 'succeeded', target: resolved.target });
  }

  #discoveredPipeline(resolved) {
    const members = [];
    const outcomes = [];
    const workflowRunsById = new Map();
    for (const run of resolved.workflowRuns) {
      if (!isAllowedGitHubWorkflow(run, this.#workflowAllowlist) || workflowRunsById.has(run.id)) {
        return freezeRecord({ blocked: true, members: freezeArray([]), outcomes: freezeArray([]), workflowCount: 0 });
      }
      workflowRunsById.set(run.id, run);
      members.push(`workflow-run-${run.id}-attempt-${run.runAttempt}`);
      outcomes.push(classifyRun(run));
    }
    for (const checkRun of resolved.checkRuns) {
      const referencedRun = detailsRunId(checkRun.detailsUrl, this.#repository);
      if (referencedRun !== null) {
        if (!workflowRunsById.has(referencedRun)) {
          return freezeRecord({ blocked: true, members: freezeArray([]), outcomes: freezeArray([]), workflowCount: 0 });
        }
        continue;
      }
      members.push(`check-run-${checkRun.id}`);
      outcomes.push(classifyCheckRun(checkRun, this.#scenario.success.allowedSkippedChecks));
    }
    for (const status of resolved.statuses) {
      members.push(`commit-status-${status.id}`);
      outcomes.push(classifyCommitStatus(status));
    }
    if (new Set(members).size !== members.length) {
      return freezeRecord({ blocked: true, members: freezeArray([]), outcomes: freezeArray([]), workflowCount: 0 });
    }
    members.sort((left, right) => left.localeCompare(right));
    return freezeRecord({
      blocked: false,
      members: freezeArray(members),
      outcomes: freezeArray(outcomes),
      workflowCount: resolved.workflowRuns.length,
    });
  }

  #recordFallbackMembership(target, members) {
    const digest = digestNormalizedValue('gpt-voice/watch-process/github-pr-pipeline-members/v1', {
      members,
      sourceSha: target.sourceSha,
      targetId: target.targetId,
    });
    const observations =
      this.#fallbackMembership?.identityDigest === target.identityDigest && this.#fallbackMembership.digest === digest
        ? this.#fallbackMembership.observations + 1
        : 1;
    this.#fallbackMembership = freezeRecord({ digest, identityDigest: target.identityDigest, observations });
    return observations >= 2;
  }

  async #collectRunEvidence(context, resolved) {
    const jobsResponse = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/actions/runs/${resolved.run.id}/attempts/${resolved.run.runAttempt}/jobs?per_page=100`,
      '--jq',
      JSON_PROJECTIONS.jobs,
    ]);
    const jobs = normalizeGitHubJobs(jobsResponse.value);
    const failureEntries = freezeArray(
      jobs
        .filter((job) => classifyJob(job, this.#scenario.success.allowedSkippedChecks) === 'failed')
        .map((job) => freezeRecord({ classification: 'github-job-failed', memberId: `job-${job.id}` })),
    );
    return freezeRecord({
      evidence: summarizeEvidence([resolved.evidence, jobsResponse.evidence]),
      failureEntries,
      status: 'collected',
      target: resolved.target,
    });
  }

  async #collectPullRequestEvidence(context, resolved) {
    const failureEntries = [];
    if (resolved.required.evaluationMode === 'pipeline-discovery') {
      for (const workflowRun of resolved.workflowRuns) {
        if (classifyRun(workflowRun) === 'failed') {
          failureEntries.push(
            freezeRecord({
              classification: 'github-workflow-failed',
              memberId: `workflow-${workflowRun.id}-attempt-${workflowRun.runAttempt}`,
            }),
          );
        }
      }
    }
    for (const checkRun of resolved.checkRuns) {
      if (classifyCheckRun(checkRun, this.#scenario.success.allowedSkippedChecks) === 'failed') {
        failureEntries.push(freezeRecord({ classification: 'github-check-failed', memberId: `check-${checkRun.id}` }));
      }
    }
    for (const status of resolved.statuses) {
      if (classifyCommitStatus(status) === 'failed') {
        failureEntries.push(freezeRecord({ classification: 'github-status-failed', memberId: `status-${status.id}` }));
      }
    }
    return freezeRecord({
      evidence: summarizeEvidence(resolved.evidence),
      failureEntries: freezeArray(failureEntries),
      status: 'collected',
      target: resolved.target,
    });
  }

  async #dispatchWorkflow(context) {
    this.#assertDispatchPermitted();
    const commandDigest = digestNormalizedValue('gpt-voice/watch-process/github-dispatch-command/v1', {
      inputs: this.#dispatch.inputs,
      repository: this.#repository,
      workflow: this.#dispatch.workflow,
    });
    const fixedInputsDigest = createFixedInputsDigest({
      adapterName: GITHUB_ACTIONS_ADAPTER,
      attempt: context.attempt,
      commandDigest,
      inputDigest: context.inputDigest,
      sourceSha: context.sourceSha,
      watchId: this.#watchId,
    });
    const operation = freezeRecord({
      fixedInputsDigest,
      generation: context.generation,
      kind: 'dispatch',
      scenarioDigest: this.#scenarioDigest,
      sourceSha: context.sourceSha,
      watchId: this.#watchId,
    });
    const intentResult = await this.#receiptStore.recordIntent({ expectedGeneration: context.generation, operation });
    const operationKey = intentResult.intent.operationKey;
    try {
      const before = await this.#findDispatchMatches(context, operationKey);
      const reconciliation = await this.#receiptStore.reconcile({
        exactMatches: before.map((match) => match.target),
        expectedGeneration: context.generation,
        identityProven: true,
        operationKey,
      });
      if (reconciliation.kind === 'blocked') return this.#blocked(reconciliation.blocker);
      if (reconciliation.kind === 'attached') {
        if (before.length !== 1) return this.#blocked('target-lost');
        const receiptId = await this.#recordDispatchReceipt(context, operationKey, before[0]);
        return this.#attachmentResponse(before[0], receiptId);
      }
      const dispatch = await this.#runExitOnly(context, this.#dispatchArguments(context, operationKey));
      if (!dispatch.succeeded) return await this.#dispatchFailure(context);
      const after = await this.#findDispatchMatches(context, operationKey);
      const afterReconciliation = await this.#receiptStore.reconcile({
        exactMatches: after.map((match) => match.target),
        expectedGeneration: context.generation,
        identityProven: true,
        operationKey,
      });
      if (afterReconciliation.kind !== 'attached' || after.length !== 1) {
        return this.#blocked(afterReconciliation.blocker ?? 'dispatch-failed');
      }
      const receiptId = await this.#recordDispatchReceipt(context, operationKey, after[0]);
      return freezeRecord({ identity: after[0].identity, receiptId, status: 'started', target: after[0].target });
    } catch (error) {
      if (error === REMOTE_COMMAND_FAILED) return this.#dispatchFailure(context);
      throw error;
    }
  }

  async #findDispatchMatches(context, operationKey) {
    const response = await this.#requireJson(context, [
      'api',
      `repos/${this.#repository}/actions/workflows/${this.#dispatch.workflow}/runs?event=workflow_dispatch&head_sha=${context.sourceSha}&per_page=100`,
      '--jq',
      JSON_PROJECTIONS.workflowRuns,
    ]);
    const workflowRuns = normalizeGitHubWorkflowRuns(response.value);
    const matches = [];
    for (const run of workflowRuns) {
      if (
        run.headSha === context.sourceSha &&
        run.displayTitle === operationKey &&
        workflowFilenameForRun(run) === this.#dispatch.workflow
      ) {
        matches.push(
          await this.#queryRun(context, run.id, {
            expectedProviderAttempt: run.runAttempt,
            targetAttempt: context.attempt,
          }),
        );
      }
    }
    return freezeArray(matches);
  }

  #dispatchArguments(context, operationKey) {
    const args = ['workflow', 'run', this.#dispatch.workflow, '--repo', this.#repository, '--ref', context.sourceSha];
    for (const [name, input] of Object.entries(this.#dispatch.inputs)) {
      args.push('--field', `${name}=${String(input)}`);
    }
    args.push('--field', `${this.#dispatch.idempotencyInput}=${operationKey}`);
    return freezeArray(args);
  }

  async #recordDispatchReceipt(context, operationKey, match) {
    const receiptId = `receipt-github-actions-${operationKey.slice(0, 48)}`;
    try {
      await this.#receiptStore.recordReceipt({
        expectedGeneration: context.generation,
        receipt: { operationKey, receiptId, target: match.target, watchId: this.#watchId },
      });
    } catch {
      runtimeFail('github-dispatch-receipt-failed');
    }
    return receiptId;
  }

  async #dispatchFailure(context) {
    const authentication = await this.#readJson(context, ['api', 'user', '--jq', JSON_PROJECTIONS.user]);
    if (!authentication.succeeded) return this.#authenticationFailure();
    return this.#blocked('dispatch-failed');
  }

  async #remoteFailure(context, summaryCode) {
    const authentication = await this.#readJson(context, ['api', 'user', '--jq', JSON_PROJECTIONS.user]);
    if (!authentication.succeeded) return this.#authenticationFailure();
    return freezeRecord({ outcome: 'monitoring_failed', status: 'failed', summaryCode });
  }

  async #remoteBlocker(context) {
    const authentication = await this.#readJson(context, ['api', 'user', '--jq', JSON_PROJECTIONS.user]);
    return this.#blocked(authentication.succeeded ? 'watcher-lost' : 'authentication-failed');
  }

  #authenticationFailure() {
    return freezeRecord({
      outcome: 'authentication_failed',
      status: 'failed',
      summaryCode: 'github-authentication-failed',
    });
  }

  #attachmentResponse(resolved, receiptId = null) {
    const normalizedReceiptId =
      receiptId ?? `receipt-github-actions-attach-${resolved.target.identityDigest.slice(0, 32)}`;
    return freezeRecord({
      identity: resolved.identity,
      receiptId: normalizedReceiptId,
      status: 'attached',
      target: resolved.target,
    });
  }

  #blocked(blocker) {
    return freezeRecord({ blocker, status: 'blocked' });
  }

  #isTargetIdentityError(error) {
    return [
      'github-current-branch-pull-request-not-found',
      'github-pr-member-source-sha-mismatch',
      'github-run-attempt-mismatch',
      'github-source-sha-mismatch',
      'github-target-identity-mismatch',
      'github-workflow-not-allowed',
      'invalid-github-workflow-path',
    ].includes(error?.code);
  }

  #requirePreflight() {
    if (!this.#preflightCompleted) runtimeFail('adapter-preflight-required');
  }

  async #requireJson(context, args) {
    const response = await this.#readJson(context, args);
    if (!response.succeeded) throw REMOTE_COMMAND_FAILED;
    return response;
  }

  async #readJson(context, args) {
    const collector = new GitHubActionsJsonOutputCollector({
      maximumBytes: Math.min(MAX_JSON_OUTPUT_BYTES, this.#scenario.evidence.maxBytesPerAttempt),
    });
    try {
      const execution = await this.#runner.start({
        args,
        cwd: this.#workspaceRoot,
        env: {},
        environmentAllowlist: this.#environmentAllowlist,
        evidence: {
          maximumBytes: this.#scenario.evidence.maxBytesPerAttempt,
          maximumFailures: this.#scenario.evidence.maxFailures,
          maximumMilliseconds: Math.min(context.timeoutMilliseconds, this.#scenario.evidence.ttlSeconds * 1_000),
        },
        executable: GITHUB_CLI_EXECUTABLE,
        outputConsumer: (streamName, chunk) => collector.append(streamName, chunk),
        timeoutMilliseconds: context.timeoutMilliseconds,
      });
      const result = normalizeAdapterCommandResult(await execution.wait());
      if (!isSuccessfulCommandResult(result))
        return freezeRecord({ evidence: result.evidence, succeeded: false, value: null });
      return freezeRecord({ evidence: result.evidence, succeeded: true, value: collector.parse() });
    } finally {
      collector.dispose();
    }
  }

  async #runExitOnly(context, args) {
    const execution = await this.#runner.start({
      args,
      cwd: this.#workspaceRoot,
      env: {},
      environmentAllowlist: this.#environmentAllowlist,
      evidence: {
        maximumBytes: this.#scenario.evidence.maxBytesPerAttempt,
        maximumFailures: this.#scenario.evidence.maxFailures,
        maximumMilliseconds: Math.min(context.timeoutMilliseconds, this.#scenario.evidence.ttlSeconds * 1_000),
      },
      executable: GITHUB_CLI_EXECUTABLE,
      timeoutMilliseconds: context.timeoutMilliseconds,
    });
    const result = normalizeAdapterCommandResult(await execution.wait());
    return freezeRecord({ evidence: result.evidence, succeeded: isSuccessfulCommandResult(result) });
  }
}
