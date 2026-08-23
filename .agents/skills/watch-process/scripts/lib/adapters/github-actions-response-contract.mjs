import { URL } from 'node:url';

import { freezeArray, freezeRecord, isRecord, requirePositiveInteger, requireString, runtimeFail } from '../runtime-core-support.mjs';
import { validateSourceSha } from '../runtime-state-contracts.mjs';

const MAX_COLLECTION_ITEMS = 100;
const MAX_SAFE_TEXT_LENGTH = 512;
const REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/u;
const WORKFLOW_FILE_PATTERN = /^[A-Za-z0-9][\w.-]*\.ya?ml$/u;

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

function containsControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function normalizeSafeText(value, code, { maximum = MAX_SAFE_TEXT_LENGTH, minimum = 1 } = {}) {
  const text = requireString(value, code, { maximum, minimum });
  if (containsControlCharacter(text)) runtimeFail(code);
  return text;
}

function normalizeNullableSafeText(value, code, options) {
  return value === null ? null : normalizeSafeText(value, code, options);
}

function normalizeIdentifier(value, code) {
  return String(requirePositiveInteger(value, code, Number.MAX_SAFE_INTEGER));
}

function normalizeNullableIdentifier(value, code) {
  return value === null ? null : normalizeIdentifier(value, code);
}

function normalizeRepository(value, code) {
  const repository = normalizeSafeText(value, code, { maximum: 200 });
  if (!REPOSITORY_PATTERN.test(repository)) runtimeFail(code);
  return repository;
}

function normalizeArray(value, code, normalizeItem) {
  if (!Array.isArray(value) || value.length > MAX_COLLECTION_ITEMS) runtimeFail(code);
  return freezeArray(value.map((item) => normalizeItem(item, code)));
}

function normalizeRun(value, code) {
  const run = assertClosedRecord(
    value,
    new Set(['conclusion', 'displayTitle', 'event', 'headSha', 'htmlUrl', 'id', 'path', 'runAttempt', 'status']),
    code,
  );
  assertRequiredFields(
    run,
    ['conclusion', 'displayTitle', 'event', 'headSha', 'htmlUrl', 'id', 'path', 'runAttempt', 'status'],
    code,
  );
  return freezeRecord({
    conclusion: normalizeNullableSafeText(run.conclusion, code, { maximum: 64 }),
    displayTitle: normalizeNullableSafeText(run.displayTitle, code, { maximum: 256 }),
    event: normalizeSafeText(run.event, code, { maximum: 64 }),
    headSha: validateSourceSha(run.headSha, code),
    htmlUrl: normalizeSafeText(run.htmlUrl, code, { maximum: 2_048 }),
    id: normalizeIdentifier(run.id, code),
    path: normalizeSafeText(run.path, code, { maximum: 512 }),
    runAttempt: requirePositiveInteger(run.runAttempt, code, MAX_COLLECTION_ITEMS * 10_000),
    status: normalizeSafeText(run.status, code, { maximum: 64 }),
  });
}

function normalizeRequiredCheck(value, code) {
  const check = assertClosedRecord(value, new Set(['appId', 'context']), code);
  assertRequiredFields(check, ['appId', 'context'], code);
  return freezeRecord({
    appId: normalizeNullableIdentifier(check.appId, code),
    context: normalizeSafeText(check.context, code, { maximum: 256 }),
  });
}

function normalizeCheckRun(value, code) {
  const checkRun = assertClosedRecord(
    value,
    new Set(['appId', 'conclusion', 'detailsUrl', 'headSha', 'id', 'name', 'status']),
    code,
  );
  assertRequiredFields(checkRun, ['appId', 'conclusion', 'detailsUrl', 'headSha', 'id', 'name', 'status'], code);
  return freezeRecord({
    appId: normalizeNullableIdentifier(checkRun.appId, code),
    conclusion: normalizeNullableSafeText(checkRun.conclusion, code, { maximum: 64 }),
    detailsUrl: normalizeNullableSafeText(checkRun.detailsUrl, code, { maximum: 2_048 }),
    headSha: validateSourceSha(checkRun.headSha, code),
    id: normalizeIdentifier(checkRun.id, code),
    name: normalizeSafeText(checkRun.name, code, { maximum: 256 }),
    status: normalizeSafeText(checkRun.status, code, { maximum: 64 }),
  });
}

function normalizeCommitStatus(value, code) {
  const status = assertClosedRecord(value, new Set(['context', 'id', 'sha', 'state']), code);
  assertRequiredFields(status, ['context', 'id', 'sha', 'state'], code);
  return freezeRecord({
    context: normalizeSafeText(status.context, code, { maximum: 256 }),
    id: normalizeIdentifier(status.id, code),
    sha: validateSourceSha(status.sha, code),
    state: normalizeSafeText(status.state, code, { maximum: 64 }),
  });
}

function normalizeJob(value, code) {
  const job = assertClosedRecord(value, new Set(['conclusion', 'id', 'name', 'status']), code);
  assertRequiredFields(job, ['conclusion', 'id', 'name', 'status'], code);
  return freezeRecord({
    conclusion: normalizeNullableSafeText(job.conclusion, code, { maximum: 64 }),
    id: normalizeIdentifier(job.id, code),
    name: normalizeSafeText(job.name, code, { maximum: 256 }),
    status: normalizeSafeText(job.status, code, { maximum: 64 }),
  });
}

function selectorUrl(value, code) {
  const selector = normalizeSafeText(value, code, { maximum: 2_048 });
  let url;
  try {
    url = new URL(selector);
  } catch {
    runtimeFail(code);
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    runtimeFail(code);
  }
  return url;
}

function selectorSegments(url, code) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 4 || url.search !== '' || url.hash !== '') runtimeFail(code);
  return segments;
}

export function normalizeGitHubUser(value) {
  const code = 'invalid-github-user-response';
  const user = assertClosedRecord(value, new Set(['login']), code);
  assertRequiredFields(user, ['login'], code);
  return freezeRecord({ login: normalizeSafeText(user.login, code, { maximum: 256 }) });
}

export function normalizeGitHubWorkspaceRepository(value) {
  const code = 'invalid-github-workspace-repository-response';
  const workspace = assertClosedRecord(value, new Set(['nameWithOwner']), code);
  assertRequiredFields(workspace, ['nameWithOwner'], code);
  return freezeRecord({ nameWithOwner: normalizeRepository(workspace.nameWithOwner, code) });
}

export function normalizeGitHubRepository(value) {
  const code = 'invalid-github-repository-response';
  const repository = assertClosedRecord(value, new Set(['fullName']), code);
  assertRequiredFields(repository, ['fullName'], code);
  return freezeRecord({ fullName: normalizeRepository(repository.fullName, code) });
}

export function normalizeGitHubRun(value) {
  return normalizeRun(value, 'invalid-github-run-response');
}

export function normalizeGitHubWorkflowRuns(value) {
  return normalizeArray(value, 'invalid-github-workflow-runs-response', normalizeRun);
}

export function normalizeGitHubJobs(value) {
  return normalizeArray(value, 'invalid-github-jobs-response', normalizeJob);
}

export function normalizeGitHubPullRequest(value) {
  const code = 'invalid-github-pull-request-response';
  const pullRequest = assertClosedRecord(value, new Set(['baseRef', 'headSha', 'number']), code);
  assertRequiredFields(pullRequest, ['baseRef', 'headSha', 'number'], code);
  return freezeRecord({
    baseRef: normalizeSafeText(pullRequest.baseRef, code, { maximum: 512 }),
    headSha: validateSourceSha(pullRequest.headSha, code),
    number: requirePositiveInteger(pullRequest.number, code, Number.MAX_SAFE_INTEGER),
  });
}

export function normalizeGitHubBranchRequiredChecks(value) {
  const code = 'invalid-github-branch-required-checks-response';
  const required = assertClosedRecord(value, new Set(['checks', 'contexts']), code);
  assertRequiredFields(required, ['checks', 'contexts'], code);
  if (!Array.isArray(required.contexts) || required.contexts.length > MAX_COLLECTION_ITEMS) runtimeFail(code);
  return freezeRecord({
    checks: normalizeArray(required.checks, code, normalizeRequiredCheck),
    contexts: freezeArray(
      required.contexts.map((context) => normalizeSafeText(context, code, { maximum: 256 })),
    ),
  });
}

export function normalizeGitHubRuleRequiredChecks(value) {
  return normalizeArray(value, 'invalid-github-rule-required-checks-response', normalizeRequiredCheck);
}

export function normalizeGitHubCheckRuns(value) {
  return normalizeArray(value, 'invalid-github-check-runs-response', normalizeCheckRun);
}

export function normalizeGitHubCommitStatuses(value) {
  return normalizeArray(value, 'invalid-github-commit-statuses-response', normalizeCommitStatus);
}

export function parseGitHubPullRequestSelector(value, expectedRepository) {
  const code = 'invalid-github-pull-request-selector';
  const url = selectorUrl(value, code);
  const segments = selectorSegments(url, code);
  if (segments.length !== 4 || segments[2] !== 'pull') runtimeFail(code);
  const repository = normalizeRepository(`${segments[0]}/${segments[1]}`, code);
  if (repository.toLowerCase() !== expectedRepository.toLowerCase()) runtimeFail('github-selector-repository-mismatch');
  const number = Number(segments[3]);
  if (!Number.isSafeInteger(number) || number <= 0 || !/^\d+$/u.test(segments[3])) runtimeFail(code);
  return freezeRecord({ number, repository });
}

export function parseGitHubRunSelector(value, expectedRepository) {
  const code = 'invalid-github-run-selector';
  const url = selectorUrl(value, code);
  const segments = selectorSegments(url, code);
  if (segments.length !== 5 || segments[2] !== 'actions' || segments[3] !== 'runs') runtimeFail(code);
  const repository = normalizeRepository(`${segments[0]}/${segments[1]}`, code);
  if (repository.toLowerCase() !== expectedRepository.toLowerCase()) runtimeFail('github-selector-repository-mismatch');
  if (!/^\d+$/u.test(segments[4])) runtimeFail(code);
  const runId = normalizeIdentifier(Number(segments[4]), code);
  return freezeRecord({ repository, runId });
}

export function workflowFilenameForRun(run) {
  const code = 'invalid-github-workflow-path';
  const path = normalizeSafeText(run?.path, code, { maximum: 512 });
  const workflowPath = path.split('@', 1)[0];
  const prefix = '.github/workflows/';
  if (!workflowPath.startsWith(prefix)) runtimeFail(code);
  const filename = workflowPath.slice(prefix.length);
  if (filename.includes('/') || !WORKFLOW_FILE_PATTERN.test(filename)) runtimeFail(code);
  return filename;
}

export function normalizeGitHubWorkflowAllowlist(value) {
  const code = 'invalid-github-workflow-allowlist';
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COLLECTION_ITEMS) runtimeFail(code);
  const workflows = value.map((workflow) => {
    const filename = normalizeSafeText(workflow, code, { maximum: 256 });
    if (!WORKFLOW_FILE_PATTERN.test(filename)) runtimeFail(code);
    return filename;
  });
  if (new Set(workflows).size !== workflows.length) runtimeFail(code);
  return freezeArray(workflows);
}

export function isAllowedGitHubWorkflow(run, allowlist) {
  return allowlist.includes(workflowFilenameForRun(run));
}
