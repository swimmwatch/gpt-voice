import * as path from 'node:path';

import { OperationReceiptStore } from '../operation-receipt-store.mjs';
import { resolveCommandArguments } from '../scenario-command-arguments.mjs';
import { PROCESS_TERMINAL_CLASSIFICATIONS, normalizeProcessTerminal } from '../runtime-contracts.mjs';
import {
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireString,
  runtimeFail,
} from '../runtime-core-support.mjs';
import {
  resolveValidatedWorkingDirectory,
  validateProcessCommand,
  validateRuntimeCode,
} from '../runtime-preflight.mjs';
import {
  validateDigest,
  validateProcessStartToken,
  validateSourceSha,
  validateTargetId,
  validateWatchId,
} from '../runtime-state-contracts.mjs';

const MAX_ATTEMPT = 1_000_000;
const MAX_TIMEOUT_SECONDS = 604_800;
const TARGET_ID_PREFIX_SEPARATOR = ':';
const DEFAULT_TARGET_ID = 'local-target';
const DEFAULT_TARGET_SELECTOR = 'local';
const DEFAULT_EVIDENCE_SUMMARY = Object.freeze({
  capturedBytes: 0,
  failureCodes: Object.freeze([]),
  failureLimitReached: false,
  receivedBytes: 0,
  stderr: Object.freeze({ capturedBytes: 0, receivedBytes: 0, truncated: false }),
  stdout: Object.freeze({ capturedBytes: 0, receivedBytes: 0, truncated: false }),
  timeLimitReached: false,
  truncated: false,
});

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
  return value === null ? null : validateSourceSha(value, code);
}

function normalizeTarget(value, code) {
  const target = assertClosedRecord(value, new Set(['attempt', 'identityDigest', 'sourceSha', 'targetId']), code);
  assertRequiredFields(target, ['attempt', 'identityDigest', 'sourceSha', 'targetId'], code);
  return freezeRecord({
    attempt: requirePositiveInteger(target.attempt, code, MAX_ATTEMPT),
    identityDigest: validateDigest(target.identityDigest, code),
    sourceSha: normalizeNullableSourceSha(target.sourceSha, code),
    targetId: validateTargetId(target.targetId, code),
  });
}

function normalizeNullableTarget(value, code) {
  return value === undefined ? null : normalizeTarget(value, code);
}

function normalizeOptionalText(value, fallback, code) {
  const text = value ?? fallback;
  const result = requireString(text, code, { minimum: 1, maximum: 512 });
  if (/\{\{|\}\}/u.test(result) || containsControlCharacter(result)) runtimeFail(code);
  return result;
}

function containsControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function normalizeTimeout(context, timing) {
  const hasSeconds = Object.hasOwn(context, 'timeoutSeconds');
  const hasMilliseconds = Object.hasOwn(context, 'timeoutMilliseconds');
  if (!hasSeconds && !hasMilliseconds) runtimeFail('adapter-timeout-required');

  const fromSeconds = hasSeconds
    ? requirePositiveInteger(context.timeoutSeconds, 'invalid-adapter-timeout', MAX_TIMEOUT_SECONDS)
    : null;
  const fromMilliseconds = hasMilliseconds
    ? requirePositiveInteger(context.timeoutMilliseconds, 'invalid-adapter-timeout', MAX_TIMEOUT_SECONDS * 1_000)
    : null;
  if (fromSeconds !== null && fromMilliseconds !== null && fromSeconds * 1_000 !== fromMilliseconds) {
    runtimeFail('adapter-timeout-mismatch');
  }
  if (fromMilliseconds !== null && fromMilliseconds % 1_000 !== 0) runtimeFail('invalid-adapter-timeout');
  const timeoutSeconds = fromSeconds ?? fromMilliseconds / 1_000;
  const minimum = requirePositiveInteger(timing?.minTimeoutSeconds, 'invalid-adapter-timing', MAX_TIMEOUT_SECONDS);
  const maximum = requirePositiveInteger(timing?.maxTimeoutSeconds, 'invalid-adapter-timing', MAX_TIMEOUT_SECONDS);
  if (minimum > maximum || timeoutSeconds < minimum || timeoutSeconds > maximum)
    runtimeFail('adapter-timeout-outside-scenario');
  return freezeRecord({ timeoutMilliseconds: timeoutSeconds * 1_000, timeoutSeconds });
}

/** Validates the closed attempt context shared by every local owned-process adapter call. */
export function normalizeAdapterAttemptContext(value, { timing } = {}) {
  const code = 'invalid-adapter-attempt-context';
  const context = assertClosedRecord(
    value,
    new Set([
      'attempt',
      'cancellationOutcome',
      'generation',
      'inputDigest',
      'sourceSha',
      'target',
      'targetId',
      'targetSelector',
      'timeoutMilliseconds',
      'timeoutSeconds',
    ]),
    code,
  );
  assertRequiredFields(context, ['attempt', 'generation', 'inputDigest', 'sourceSha'], code);
  const timeout = normalizeTimeout(context, timing);
  const target = normalizeNullableTarget(context.target, code);
  const attempt = requirePositiveInteger(context.attempt, code, MAX_ATTEMPT);
  const sourceSha = normalizeNullableSourceSha(context.sourceSha, code);
  if (target !== null && (target.attempt !== attempt || target.sourceSha !== sourceSha)) {
    runtimeFail('adapter-identity-mismatch');
  }
  const cancellationOutcome = context.cancellationOutcome ?? null;
  if (cancellationOutcome !== null && !['user_cancelled', 'target_cancelled'].includes(cancellationOutcome)) {
    runtimeFail(code);
  }
  return freezeRecord({
    attempt,
    cancellationOutcome,
    generation: requireNonNegativeInteger(context.generation, code, 1_000_000_000),
    inputDigest: validateDigest(context.inputDigest, code),
    sourceSha,
    target,
    targetId: normalizeOptionalText(context.targetId, target?.targetId ?? DEFAULT_TARGET_ID, code),
    targetSelector: normalizeOptionalText(context.targetSelector, DEFAULT_TARGET_SELECTOR, code),
    timeoutMilliseconds: timeout.timeoutMilliseconds,
    timeoutSeconds: timeout.timeoutSeconds,
  });
}

/** Resolves scenario substitutions exactly once and validates the final spawn request. */
export async function resolveAdapterCommand({ command, context, environmentAllowlist, watchId, workspaceRoot }) {
  const substitutions = {
    attempt: { number: context.attempt },
    invocation: { timeout_seconds: context.timeoutSeconds },
    target: { id: context.targetId, selector: context.targetSelector, source_sha: context.sourceSha },
    watch: { id: watchId },
    workspace: { root: workspaceRoot },
  };
  const validated = validateProcessCommand({
    args: resolveCommandArguments(command.args, substitutions),
    cwd: command.cwd,
    env: command.env,
    environmentAllowlist,
    executable: command.executable,
    timeoutMilliseconds: context.timeoutMilliseconds,
  });
  const cwd = await resolveValidatedWorkingDirectory({ cwd: validated.cwd, workspaceRoot });
  return freezeRecord({ ...validated, cwd });
}

/** Digests a resolved command without returning its path, environment, or arguments to state callers. */
export function digestAdapterCommand(command) {
  return digestNormalizedValue('gpt-voice/watch-process/adapter-command/v1', command);
}

export function createFixedInputsDigest({ adapterName, attempt, commandDigest, inputDigest, sourceSha, watchId }) {
  return digestNormalizedValue('gpt-voice/watch-process/owned-process-inputs/v1', {
    adapterName,
    attempt,
    commandDigest,
    inputDigest,
    sourceSha,
    watchId,
  });
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Builds the safe receipt target identity; it intentionally contains no PID or filesystem path. */
export function createOwnedProcessIdentity({
  adapterName,
  attempt,
  commandDigest,
  fixedInputsDigest,
  generation,
  inputDigest,
  sourceSha,
  startToken,
  watchId,
}) {
  const token = validateProcessStartToken(startToken, 'invalid-owned-process-identity');
  const targetId = `${adapterName}${TARGET_ID_PREFIX_SEPARATOR}${watchId}${TARGET_ID_PREFIX_SEPARATOR}attempt=${attempt}${TARGET_ID_PREFIX_SEPARATOR}token=${token}`;
  const identityDigest = digestNormalizedValue('gpt-voice/watch-process/owned-process-identity/v1', {
    adapterName,
    attempt,
    commandDigest,
    fixedInputsDigest,
    generation,
    inputDigest,
    sourceSha,
    startToken: token,
    watchId,
  });
  return freezeRecord({
    attempt,
    commandDigest,
    fixedInputsDigest,
    generation,
    identityDigest,
    inputDigest,
    sourceSha,
    startToken: token,
    target: freezeRecord({ attempt, identityDigest, sourceSha, targetId }),
    watchId,
  });
}

/** Extracts a start token only from the exact adapter-owned target identifier format. */
export function parseOwnedProcessTargetId({ adapterName, attempt, targetId, watchId }) {
  const expression = new RegExp(
    `^${escapeRegularExpression(adapterName)}${TARGET_ID_PREFIX_SEPARATOR}${escapeRegularExpression(watchId)}${TARGET_ID_PREFIX_SEPARATOR}attempt=([1-9]\\d*)${TARGET_ID_PREFIX_SEPARATOR}token=([a-f0-9]{32})$`,
    'u',
  );
  const match = expression.exec(targetId);
  if (match === null || Number(match[1]) !== attempt) runtimeFail('owned-process-identity-unproven');
  return validateProcessStartToken(match[2], 'owned-process-identity-unproven');
}

function normalizeEvidenceStream(value, code) {
  const stream = assertClosedRecord(value, new Set(['capturedBytes', 'receivedBytes', 'truncated']), code);
  assertRequiredFields(stream, ['capturedBytes', 'receivedBytes', 'truncated'], code);
  return freezeRecord({
    capturedBytes: requireNonNegativeInteger(stream.capturedBytes, code),
    receivedBytes: requireNonNegativeInteger(stream.receivedBytes, code),
    truncated: typeof stream.truncated === 'boolean' ? stream.truncated : runtimeFail(code),
  });
}

/** Keeps only BoundedEvidenceBuffer's public shape even when a test driver is injected. */
export function normalizeAdapterEvidence(value) {
  if (value === undefined) return DEFAULT_EVIDENCE_SUMMARY;
  const code = 'invalid-command-driver-result';
  const evidence = assertClosedRecord(
    value,
    new Set([
      'capturedBytes',
      'failureCodes',
      'failureLimitReached',
      'receivedBytes',
      'stderr',
      'stdout',
      'timeLimitReached',
      'truncated',
    ]),
    code,
  );
  assertRequiredFields(
    evidence,
    [
      'capturedBytes',
      'failureCodes',
      'failureLimitReached',
      'receivedBytes',
      'stderr',
      'stdout',
      'timeLimitReached',
      'truncated',
    ],
    code,
  );
  if (!Array.isArray(evidence.failureCodes) || evidence.failureCodes.length > 100) runtimeFail(code);
  return freezeRecord({
    capturedBytes: requireNonNegativeInteger(evidence.capturedBytes, code),
    failureCodes: freezeArray(evidence.failureCodes.map((failureCode) => validateRuntimeCode(failureCode, code))),
    failureLimitReached:
      typeof evidence.failureLimitReached === 'boolean' ? evidence.failureLimitReached : runtimeFail(code),
    receivedBytes: requireNonNegativeInteger(evidence.receivedBytes, code),
    stderr: normalizeEvidenceStream(evidence.stderr, code),
    stdout: normalizeEvidenceStream(evidence.stdout, code),
    timeLimitReached: typeof evidence.timeLimitReached === 'boolean' ? evidence.timeLimitReached : runtimeFail(code),
    truncated: typeof evidence.truncated === 'boolean' ? evidence.truncated : runtimeFail(code),
  });
}

/** Removes child PID, cleanup implementation data, and any injected-driver extras from a terminal result. */
export function normalizeAdapterCommandResult(value) {
  const code = 'invalid-command-driver-result';
  if (!isRecord(value)) runtimeFail(code);
  const terminal = assertClosedRecord(
    value.terminal,
    new Set(['classification', 'exitCode', 'signal', 'succeeded']),
    code,
  );
  assertRequiredFields(terminal, ['classification', 'exitCode', 'signal', 'succeeded'], code);
  if (!PROCESS_TERMINAL_CLASSIFICATIONS.includes(terminal.classification)) runtimeFail(code);
  const exitCode = terminal.exitCode === null ? null : requireNonNegativeInteger(terminal.exitCode, code, 255);
  const signal = terminal.signal === null ? null : requireString(terminal.signal, code, { minimum: 4, maximum: 32 });
  const expected = normalizeProcessTerminal({
    aborted: terminal.classification === 'aborted',
    cleanupUnconfirmed: terminal.classification === 'cleanup_unconfirmed',
    exitCode,
    signal,
    startFailed: terminal.classification === 'spawn_failed',
    timedOut: terminal.classification === 'timed_out',
  });
  if (
    expected.classification !== terminal.classification ||
    expected.exitCode !== exitCode ||
    expected.signal !== signal ||
    expected.succeeded !== terminal.succeeded
  ) {
    runtimeFail(code);
  }
  return freezeRecord({ evidence: normalizeAdapterEvidence(value.evidence), terminal: expected });
}

export function isSuccessfulCommandResult(result) {
  return result.terminal.classification === 'succeeded' && result.terminal.exitCode === 0;
}

/** Executes declared commands through the only shell-free process runner and returns sanitized summaries. */
export class ManagedProcessCommandDriver {
  #runner;

  constructor({ runner } = {}) {
    if (runner === null || runner === undefined || typeof runner.run !== 'function') {
      runtimeFail('invalid-command-driver-dependency');
    }
    this.#runner = runner;
  }

  async run(request) {
    return normalizeAdapterCommandResult(await this.#runner.run(request));
  }
}

export function assertAdapterDependencies({ receiptStore, watchId }) {
  if (!(receiptStore instanceof OperationReceiptStore)) {
    runtimeFail('invalid-owned-process-adapter-dependency');
  }
  if (receiptStore.watchId !== validateWatchId(watchId, 'invalid-owned-process-adapter-dependency')) {
    runtimeFail('owned-process-adapter-watch-mismatch');
  }
}

export function resolveDockerExecutableName(executable) {
  const names = [path.basename(executable), path.win32.basename(executable)].map((name) => name.toLowerCase());
  const name = names.find((candidate) => candidate === 'docker' || candidate === 'docker.exe');
  if (name === undefined) runtimeFail('docker-executable-required');
  return name;
}
