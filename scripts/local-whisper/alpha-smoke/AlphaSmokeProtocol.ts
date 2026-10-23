import { createHash } from 'node:crypto';
import path from 'node:path';
import { isLinuxAlphaSmokeDeadline, type AlphaSmokeDeadline } from './LinuxAlphaSmokeClock';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

export const ALPHA_SMOKE_TARGET = 'v2.4.0-alpha.1' as const;
export const ALPHA_SMOKE_MODEL_SELECTION = Object.freeze({ family: 'base', variant: 'full' } as const);
export const ALPHA_SMOKE_VERIFIED_STAGES = Object.freeze(['cpu', 'cuda', 'offline-cuda', 'cleanup'] as const);
export type AlphaSmokeVerifiedStage = (typeof ALPHA_SMOKE_VERIFIED_STAGES)[number];
export const ALPHA_SMOKE_OUTCOMES = Object.freeze([
  'qualified',
  'verification_evidence_missing',
  'deadline_exhausted',
  'functional_failure',
  'functional_failure_and_finalization_failure',
  'interrupted_attempt',
  'interrupted_attempt_and_finalization_failure',
] as const);
export type AlphaSmokeOutcome = (typeof ALPHA_SMOKE_OUTCOMES)[number];

export function isAlphaSmokeOutcome(value: unknown): value is AlphaSmokeOutcome {
  return ALPHA_SMOKE_OUTCOMES.some((outcome) => outcome === value);
}
export const ALPHA_SMOKE_INTERRUPTED_STATES: readonly AlphaSmokeStateName[] = Object.freeze([
  'AwaitingPackageReady',
  'PackageReady',
  'CpuExercise',
  'CudaExercise',
  'OfflineExercise',
  'Finalizing',
]);
export const ALPHA_SMOKE_REPOSITORY = 'swimmwatch/gpt-voice' as const;
export const ALPHA_SMOKE_SOURCE_SHA = 'b651f3a4a309f2c21f83a81869f1ae666f7aa9b2' as const;
export const ALPHA_SMOKE_CANDIDATE_INPUT_DIGEST =
  'f6121a6bbf7c771978f8925f4f7fe41dc06e95c060f39e9377908042c04b469f' as const;

export const ALPHA_SMOKE_FIXTURE = Object.freeze({
  fileName: 'smoke.wav',
  length: 404_524,
  sha256: '90a8eba6c057eb30b573922d95c303f2d276ba8f7501bbb1f64711a5f00946b6',
});

export const ALPHA_SMOKE_MODEL = Object.freeze({
  fileName: 'ggml-base.bin',
  length: 147_951_465,
  sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  sourceCommit: '5359861c739e955e79d9a303bcbc70fb988958b1',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin',
});

export const ALPHA_SMOKE_PRIMARY_ASSET_NAMES = Object.freeze([
  'GPT-Voice-2.4.0-alpha.1.AppImage',
  'gpt-voice_2.4.0-alpha.1_amd64.deb',
  'gpt-voice-2.4.0-alpha.1.x86_64.rpm',
  'GPT-Voice.Setup.2.4.0-alpha.1.exe',
  'linux-gpt-voice-local-whisper-linux-x64-cpu.tar.gz',
  'linux-gpt-voice-local-whisper-linux-x64-sm_120a-real.tar.gz',
  'win32-gpt-voice-local-whisper-win32-x64-cpu.tar.gz',
  'win32-gpt-voice-local-whisper-win32-x64-sm_120a-real.tar.gz',
  'local-whisper-catalogs.json',
  'local-whisper-keyring.json',
  'local-whisper-compatibility.json',
  'release-manifest.json',
  'release-provenance.json',
  'release-sbom.spdx.json',
  'SHA256SUMS.txt',
  'THIRD_PARTY_NOTICES.txt',
] as const);

const PLATFORM_PACKAGE_NAMES = Object.freeze({
  linux: 'gpt-voice_2.4.0-alpha.1_amd64.deb',
  win32: 'GPT-Voice.Setup.2.4.0-alpha.1.exe',
});
const SHA256_PATTERN = /^[a-f\d]{64}$/u;
const SAFE_ATTEMPT_ID_PATTERN = /^[a-z\d][a-z\d-]{0,63}$/u;
const ALLOWED_KEYS = new Set([
  'platform',
  'target',
  'mode',
  'phase',
  'work-root',
  'evidence-root',
  'settings-backup-root',
  'attempt-id',
]);

export type AlphaSmokePlatform = 'linux' | 'win32';
export type AlphaSmokeMode = 'contract' | 'physical';
export type AlphaSmokePhase = 'prepare' | 'exercise' | 'seal';
export type AlphaSmokeStatus = 'Pass' | 'Fail' | 'Pending';
export type AlphaSmokePackageDisposition = 'clean-host' | 'exact-alpha';
export type AlphaSmokePackageStatus = 'absent' | 'different-package' | 'retained-alpha' | 'unverified';
export type AlphaSmokeSettingsBackupStatus = 'integrity-failed' | 'retained-private' | 'unverified';
export type AlphaSmokeStateName =
  | 'Preparing'
  | 'SettingsBackedUp'
  | 'AwaitingPackageReady'
  | 'PackageReady'
  | 'CpuExercise'
  | 'CudaExercise'
  | 'OfflineExercise'
  | 'Finalizing'
  | 'ReadyToSeal'
  | 'Sealing'
  | 'SealedPass'
  | 'SealedFail';

export interface AlphaSmokeCommand {
  readonly attemptId: string | null;
  readonly evidenceRoot: string | null;
  readonly mode: AlphaSmokeMode;
  readonly phase: AlphaSmokePhase | null;
  readonly platform: AlphaSmokePlatform;
  readonly settingsBackupRoot: string | null;
  readonly target: typeof ALPHA_SMOKE_TARGET;
  readonly workRoot: string | null;
}

export interface AlphaSmokeAssetIdentity {
  readonly fileName: string;
  readonly length: number;
  readonly sha256: string;
}

export interface AlphaSmokePublicInput {
  readonly candidateInputDigest: string;
  readonly deploymentDigest: string;
  readonly packageAsset: AlphaSmokeAssetIdentity;
  readonly platform: AlphaSmokePlatform;
  readonly platformSmokeInputDigest: string;
  readonly sourceSha: string;
  readonly target: typeof ALPHA_SMOKE_TARGET;
}

export interface AlphaSmokeAttempt {
  readonly schemaVersion: 2;
  readonly monotonicDeadline: AlphaSmokeDeadline | null;
  readonly completion: AlphaSmokeCompletionEvidence | null;
  readonly terminalOutcome: AlphaSmokeOutcome | null;
  readonly attemptId: string;
  readonly deadlineEpochMilliseconds: number;
  readonly input: AlphaSmokePublicInput;
  readonly packageDisposition: AlphaSmokePackageDisposition | null;
  readonly settingsBackupStatus: 'pending' | 'retained-private';
  readonly startedAtEpochMilliseconds: number | null;
  readonly state: AlphaSmokeStateName;
}

export interface AlphaSmokeCompletionEvidence {
  readonly packageStatus: AlphaSmokePackageStatus;
  readonly settingsBackupStatus: AlphaSmokeSettingsBackupStatus;
}

export interface AlphaSmokeResult extends AlphaSmokeCompletionEvidence {
  readonly schemaVersion: 2;
  readonly deploymentDigest: string;
  readonly attemptId: string;
  readonly inputDigest: string;
  readonly outcome: AlphaSmokeOutcome;
  readonly platform: AlphaSmokePlatform;
  readonly resultDigest: string;
  readonly status: AlphaSmokeStatus;
  readonly target: typeof ALPHA_SMOKE_TARGET;
}

function commandError(code: string): never {
  throw new Error(`ALPHA_SMOKE_COMMAND_${code}`);
}

function requiredValue(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) commandError(`MISSING_${key.toUpperCase().replace(/-/gu, '_')}`);
  return value;
}

function parseAbsolutePath(value: string, key: string): string {
  const resolved = path.resolve(value);
  const hasControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (hasControlCharacter || !path.isAbsolute(value) || resolved === path.parse(resolved).root) {
    commandError(`INVALID_${key.toUpperCase().replace(/-/gu, '_')}`);
  }
  return resolved;
}

function pathsOverlap(left: string, right: string): boolean {
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  return (
    leftToRight === '' ||
    (!leftToRight.startsWith('..') && !path.isAbsolute(leftToRight)) ||
    (!rightToLeft.startsWith('..') && !path.isAbsolute(rightToLeft))
  );
}

/** Parses the closed alpha-smoke CLI surface before any network or filesystem operation. */
export function parseAlphaSmokeCommand(arguments_: readonly string[]): AlphaSmokeCommand {
  const values = new Map<string, string>();
  for (const argument of arguments_) {
    if (!argument.startsWith('--')) commandError('UNKNOWN_ARGUMENT');
    const separator = argument.indexOf('=');
    if (separator <= 2) commandError('INVALID_ARGUMENT');
    const key = argument.slice(2, separator);
    const value = argument.slice(separator + 1);
    if (!ALLOWED_KEYS.has(key)) commandError('UNKNOWN_ARGUMENT');
    if (value.length === 0 || values.has(key)) commandError('DUPLICATE_OR_EMPTY_ARGUMENT');
    values.set(key, value);
  }

  const platform = requiredValue(values, 'platform');
  const target = requiredValue(values, 'target');
  const mode = requiredValue(values, 'mode');
  if (platform !== 'linux' && platform !== 'win32') commandError('INVALID_PLATFORM');
  if (target !== ALPHA_SMOKE_TARGET) commandError('INVALID_TARGET');
  if (mode !== 'contract' && mode !== 'physical') commandError('INVALID_MODE');

  const phaseValue = values.get('phase');
  const phase: AlphaSmokePhase | null =
    phaseValue === 'prepare' || phaseValue === 'exercise' || phaseValue === 'seal' ? phaseValue : null;
  const attemptId = values.get('attempt-id');
  const workRoot = values.has('work-root') ? parseAbsolutePath(requiredValue(values, 'work-root'), 'work-root') : null;
  const evidenceRoot = values.has('evidence-root')
    ? parseAbsolutePath(requiredValue(values, 'evidence-root'), 'evidence-root')
    : null;
  const settingsBackupRoot = values.has('settings-backup-root')
    ? parseAbsolutePath(requiredValue(values, 'settings-backup-root'), 'settings-backup-root')
    : null;

  const command = Object.freeze({
    attemptId: attemptId ?? null,
    evidenceRoot,
    mode,
    phase,
    platform,
    settingsBackupRoot,
    target,
    workRoot,
  });
  if (mode === 'contract') {
    if (phaseValue || attemptId || workRoot || evidenceRoot || settingsBackupRoot)
      commandError('CONTRACT_ARGUMENT_CONFLICT');
  } else assertPhysicalCommand(command);
  return command;
}

function assertPhysicalCommand(command: AlphaSmokeCommand): void {
  const { phase, workRoot, evidenceRoot, settingsBackupRoot, platform, attemptId } = command;
  if (phase === null) commandError('MISSING_OR_INVALID_PHASE');
  if (!workRoot || !evidenceRoot) commandError('MISSING_PHYSICAL_ROOT');
  if (platform === 'linux' && !settingsBackupRoot) commandError('MISSING_SETTINGS_BACKUP_ROOT');
  if (platform === 'win32' && settingsBackupRoot) commandError('SETTINGS_BACKUP_ROOT_PLATFORM');
  if (phase === 'prepare' && attemptId !== null) commandError('PREPARE_ATTEMPT_ID');
  if (phase !== 'prepare' && attemptId === null) commandError('ATTEMPT_ID_REQUIRED');
  if (attemptId !== null && !SAFE_ATTEMPT_ID_PATTERN.test(attemptId)) commandError('INVALID_ATTEMPT_ID');

  const roots = [workRoot, evidenceRoot, settingsBackupRoot].filter((value): value is string => value !== null);
  if (roots.some((root, index) => roots.slice(index + 1).some((candidate) => pathsOverlap(root, candidate)))) {
    commandError('ROOTS_OVERLAP');
  }
}

export function alphaSmokeDigest(value: unknown): string {
  return createHash('sha256').update(serializeCanonicalLocalWhisperCatalogJson(value)).digest('hex');
}

export function assertAlphaSmokeDigest(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) throw new Error(code);
}

function isAssetIdentity(value: unknown): value is AlphaSmokeAssetIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join(',') === 'fileName,length,sha256' &&
    typeof record.fileName === 'string' &&
    /^[\w.-]{1,256}$/u.test(record.fileName) &&
    typeof record.length === 'number' &&
    Number.isSafeInteger(record.length) &&
    record.length > 0 &&
    typeof record.sha256 === 'string' &&
    SHA256_PATTERN.test(record.sha256)
  );
}

export function createPlatformSmokeInput(
  platform: AlphaSmokePlatform,
  identities: readonly AlphaSmokeAssetIdentity[],
  deploymentDigest: string,
  candidateInputDigest: string = ALPHA_SMOKE_CANDIDATE_INPUT_DIGEST,
): AlphaSmokePublicInput {
  assertAlphaSmokeDigest(deploymentDigest, 'ALPHA_SMOKE_DEPLOYMENT_INVALID');
  assertAlphaSmokeDigest(candidateInputDigest, 'ALPHA_SMOKE_PUBLIC_INPUT_INVALID');
  const sortedAssets = [...identities].sort((left, right) => left.fileName.localeCompare(right.fileName, 'en'));
  if (
    sortedAssets.length === 0 ||
    sortedAssets.some((asset, index) => !isAssetIdentity(asset) || asset.fileName === sortedAssets[index - 1]?.fileName)
  ) {
    throw new Error('ALPHA_SMOKE_PUBLIC_INPUT_INVALID');
  }
  const packageAsset = sortedAssets.find((asset) => asset.fileName === PLATFORM_PACKAGE_NAMES[platform]);
  if (!packageAsset) throw new Error('ALPHA_SMOKE_PUBLIC_INPUT_PACKAGE_MISSING');

  const platformSmokeInputDigest = alphaSmokeDigest({
    deploymentDigest,
    assets: sortedAssets,
    candidateInputDigest,
    model: ALPHA_SMOKE_MODEL,
    platform,
    sourceSha: ALPHA_SMOKE_SOURCE_SHA,
    target: ALPHA_SMOKE_TARGET,
  });
  return Object.freeze({
    candidateInputDigest,
    deploymentDigest,
    packageAsset: Object.freeze({ ...packageAsset }),
    platform,
    platformSmokeInputDigest,
    sourceSha: ALPHA_SMOKE_SOURCE_SHA,
    target: ALPHA_SMOKE_TARGET,
  });
}

function isAlphaSmokePublicInput(value: unknown): value is AlphaSmokePublicInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = [
    'candidateInputDigest',
    'deploymentDigest',
    'packageAsset',
    'platform',
    'platformSmokeInputDigest',
    'sourceSha',
    'target',
  ];
  if (
    Object.keys(input).sort().join(',') !== keys.join(',') ||
    input.target !== ALPHA_SMOKE_TARGET ||
    (input.platform !== 'linux' && input.platform !== 'win32') ||
    input.sourceSha !== ALPHA_SMOKE_SOURCE_SHA ||
    input.candidateInputDigest !== ALPHA_SMOKE_CANDIDATE_INPUT_DIGEST ||
    typeof input.deploymentDigest !== 'string' ||
    !SHA256_PATTERN.test(input.deploymentDigest) ||
    typeof input.platformSmokeInputDigest !== 'string' ||
    !SHA256_PATTERN.test(input.platformSmokeInputDigest) ||
    !isAssetIdentity(input.packageAsset)
  )
    return false;
  return input.packageAsset.fileName === PLATFORM_PACKAGE_NAMES[input.platform];
}

function isCompletionEvidence(value: unknown): value is AlphaSmokeCompletionEvidence | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const completion = value as Record<string, unknown>;
  return (
    Object.keys(completion).sort().join(',') === 'packageStatus,settingsBackupStatus' &&
    ['absent', 'different-package', 'retained-alpha', 'unverified'].includes(String(completion.packageStatus)) &&
    ['integrity-failed', 'retained-private', 'unverified'].includes(String(completion.settingsBackupStatus))
  );
}

function assertAttemptCompletion(record: Record<string, unknown>): void {
  if (!isCompletionEvidence(record.completion)) throw new Error('ALPHA_SMOKE_STATE_INVALID');
  if (
    ['ReadyToSeal', 'Sealing', 'SealedPass', 'SealedFail'].includes(String(record.state)) &&
    (record.startedAtEpochMilliseconds === null ||
      record.completion === null ||
      typeof record.terminalOutcome !== 'string')
  )
    throw new Error('ALPHA_SMOKE_STATE_INVALID');
  if (
    record.state === 'SealedPass' &&
    (record.terminalOutcome !== 'qualified' ||
      !record.completion ||
      record.completion.packageStatus !== 'retained-alpha' ||
      record.completion.settingsBackupStatus !== 'retained-private')
  )
    throw new Error('ALPHA_SMOKE_STATE_INVALID');
}

/** Validates persisted resume state independently of JSON parsing before it controls native operations. */
export function parseAlphaSmokeAttempt(value: unknown): AlphaSmokeAttempt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ALPHA_SMOKE_STATE_INVALID');
  const record = value as Record<string, unknown>;
  const expectedKeys = [
    'attemptId',
    'completion',
    'deadlineEpochMilliseconds',
    'input',
    'monotonicDeadline',
    'packageDisposition',
    'schemaVersion',
    'settingsBackupStatus',
    'startedAtEpochMilliseconds',
    'state',
    'terminalOutcome',
  ];
  const keys = Object.keys(record).sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('ALPHA_SMOKE_STATE_INVALID');
  }

  if (!isAlphaSmokePublicInput(record.input)) throw new Error('ALPHA_SMOKE_STATE_INVALID');
  assertAttemptCompletion(record);
  const deadline = record.deadlineEpochMilliseconds;
  const started = record.startedAtEpochMilliseconds;
  const validStates = new Set<AlphaSmokeStateName>([
    'Preparing',
    'SettingsBackedUp',
    'AwaitingPackageReady',
    'PackageReady',
    'CpuExercise',
    'CudaExercise',
    'OfflineExercise',
    'Finalizing',
    'ReadyToSeal',
    'Sealing',
    'SealedPass',
    'SealedFail',
  ]);
  if (
    record.schemaVersion !== 2 ||
    (record.monotonicDeadline !== null && !isLinuxAlphaSmokeDeadline(record.monotonicDeadline)) ||
    (record.terminalOutcome !== null && !isAlphaSmokeOutcome(record.terminalOutcome)) ||
    typeof record.attemptId !== 'string' ||
    !SAFE_ATTEMPT_ID_PATTERN.test(record.attemptId) ||
    typeof deadline !== 'number' ||
    !Number.isSafeInteger(deadline) ||
    deadline <= 0 ||
    (started !== null && (typeof started !== 'number' || !Number.isSafeInteger(started) || started <= 0)) ||
    typeof record.state !== 'string' ||
    !validStates.has(record.state as AlphaSmokeStateName) ||
    (record.packageDisposition !== null &&
      record.packageDisposition !== 'clean-host' &&
      record.packageDisposition !== 'exact-alpha') ||
    (record.settingsBackupStatus !== 'pending' && record.settingsBackupStatus !== 'retained-private')
  ) {
    throw new Error('ALPHA_SMOKE_STATE_INVALID');
  }
  return value as AlphaSmokeAttempt;
}
