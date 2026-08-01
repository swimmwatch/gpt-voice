export const LOCAL_WHISPER_PROVIDER_ID = 'local-whisper' as const;

export const LOCAL_WHISPER_ENGINES = ['whisperCpp', 'fasterWhisper'] as const;
export const LOCAL_WHISPER_TARGETS = ['gpu', 'cpu'] as const;
export const LOCAL_WHISPER_BACKENDS = ['cuda', 'hip', 'vulkan', 'metal', 'cpu'] as const;
export const LOCAL_WHISPER_GPU_BACKENDS = ['cuda', 'hip', 'vulkan', 'metal'] as const;
export const LOCAL_WHISPER_MODEL_FAMILIES = ['tiny', 'base', 'small', 'medium', 'large-v3', 'large-v3-turbo'] as const;
export const LOCAL_WHISPER_DECODING_STRATEGIES = ['greedy', 'beamSearch', 'bestOfSampling'] as const;
export const LOCAL_WHISPER_SUPPORT_TIERS = ['Production', 'Preview', 'Planned', 'Unsupported'] as const;
export const LOCAL_WHISPER_ARTIFACT_SETUP_STATES = [
  'Missing',
  'Downloading',
  'Resumable',
  'Verifying',
  'Installing',
  'Installed',
  'Deleting',
  'Failed',
  'Corrupt',
  'Blocked',
] as const;
export const LOCAL_WHISPER_CAPABILITY_STATES = [
  'Unchecked',
  'Checking',
  'EstimateOnly',
  'Validated',
  'Stale',
  'NotReady',
] as const;
export const LOCAL_WHISPER_RESIDENCY_STATES = ['Unloaded', 'Loading', 'Loaded', 'Unloading', 'Failed'] as const;
export const LOCAL_WHISPER_ACTIVITY_STATES = ['Idle', 'Transcribing'] as const;
export const LOCAL_WHISPER_CAPABILITY_STALE_CAUSES = [
  'driverChanged',
  'deviceTopologyChanged',
  'suspendResume',
  'externalGpuChanged',
  'runtimeFileIdentityChanged',
  'modelFileIdentityChanged',
  'catalogDenylisted',
  'appRevisionChanged',
  'protocolRevisionChanged',
  'loadAffectingSettingsChanged',
] as const;
export const LOCAL_WHISPER_OPERATIONAL_STATUSES = [
  'Ready',
  'Busy',
  'ValidatedUnloaded',
  'NotReady',
  'Planned',
  'Unsupported',
] as const;
export const LOCAL_WHISPER_ACTION_IDS = [
  'checkCompatibility',
  'downloadRuntime',
  'removeRuntime',
  'downloadModel',
  'deleteModel',
  'load',
  'unload',
  'transcribe',
  'cancel',
  'shutdown',
] as const;
export const LOCAL_WHISPER_FAILURE_STAGES = [
  'validation',
  'support',
  'device',
  'resources',
  'runtimeSetup',
  'modelSetup',
  'download',
  'verification',
  'installation',
  'deletion',
  'workerStart',
  'protocol',
  'backendInitialization',
  'allocation',
  'modelLoad',
  'warmup',
  'transcription',
  'cancellation',
  'cleanup',
] as const;
export const LOCAL_WHISPER_RECOVERY_ACTION_IDS = [
  'edit-settings',
  'upgrade-or-reset-settings',
  'select-supported-configuration',
  'refresh-or-select-device',
  'select-allowlisted-backend',
  'show-prerequisites',
  'free-resources',
  'download-selected-artifact',
  'select-compatible-artifact',
  'update-or-remove-artifact',
  'redownload-or-remove-artifact',
  'retry-download',
  'discard-and-fetch-trusted-revision',
  'refresh-and-retry',
  'retry-load-or-change-settings',
  'restart-application',
  'record-again',
  'retry-operation',
] as const;
export const LOCAL_WHISPER_STATE_IMPACTS = [
  'none',
  'settingsInvalid',
  'supportUnavailable',
  'runtimeSetupMissing',
  'runtimeSetupFailed',
  'modelSetupMissing',
  'modelSetupFailed',
  'capabilityNotReady',
  'residencyFailed',
  'activityIdle',
  'cleanupUncertain',
] as const;

export const LOCAL_WHISPER_FAILURE_CODES = [
  'INVALID_SETTINGS',
  'SETTINGS_VERSION_UNSUPPORTED',
  'STALE_CONFIGURATION',
  'UNSUPPORTED_PLATFORM',
  'UNSUPPORTED_ARCHITECTURE',
  'TARGET_UNSUPPORTED',
  'BACKEND_UNSUPPORTED',
  'PLANNED_UNAVAILABLE',
  'DEVICE_NOT_FOUND',
  'DEVICE_NOT_ALLOWLISTED',
  'DRIVER_INCOMPATIBLE',
  'RUNTIME_PREREQUISITE_MISSING',
  'DEVICE_FEATURE_MISSING',
  'GPU_PERMISSION_DENIED',
  'CPU_FEATURE_MISSING',
  'INSUFFICIENT_DISK',
  'INSUFFICIENT_RAM',
  'INSUFFICIENT_VRAM',
  'RUNTIME_MISSING',
  'RUNTIME_INCOMPATIBLE',
  'RUNTIME_BLOCKED',
  'RUNTIME_CORRUPT',
  'MODEL_MISSING',
  'MODEL_INCOMPATIBLE',
  'MODEL_BLOCKED',
  'MODEL_CORRUPT',
  'DOWNLOAD_OFFLINE',
  'DOWNLOAD_FAILED',
  'DOWNLOAD_CANCELLED',
  'UNSAFE_REDIRECT',
  'RESUME_INVALID',
  'SIGNATURE_INVALID',
  'HASH_MISMATCH',
  'ARCHIVE_INVALID',
  'INSTALL_FAILED',
  'DELETE_FAILED',
  'WORKER_START_FAILED',
  'WORKER_PROTOCOL_MISMATCH',
  'WORKER_PROTOCOL_VIOLATION',
  'WORKER_CRASHED',
  'OPERATION_TIMEOUT',
  'BACKEND_INIT_FAILED',
  'ALLOCATION_FAILED',
  'MODEL_LOAD_FAILED',
  'WARMUP_FAILED',
  'CLEANUP_FAILED',
  'OPERATION_CONFLICT',
  'AUDIO_FORMAT_UNSUPPORTED',
  'TRANSCRIPTION_FAILED',
  'EMPTY_TRANSCRIPTION',
  'CANCELLED',
] as const;

export type LocalWhisperEngine = (typeof LOCAL_WHISPER_ENGINES)[number];
export type LocalWhisperTarget = (typeof LOCAL_WHISPER_TARGETS)[number];
export type LocalWhisperBackend = (typeof LOCAL_WHISPER_BACKENDS)[number];
export type LocalWhisperGpuBackend = (typeof LOCAL_WHISPER_GPU_BACKENDS)[number];
export type LocalWhisperModelFamily = (typeof LOCAL_WHISPER_MODEL_FAMILIES)[number];
export type LocalWhisperDecodingStrategy = (typeof LOCAL_WHISPER_DECODING_STRATEGIES)[number];
export type LocalWhisperSupportTier = (typeof LOCAL_WHISPER_SUPPORT_TIERS)[number];
export type LocalWhisperArtifactSetupState = (typeof LOCAL_WHISPER_ARTIFACT_SETUP_STATES)[number];
export type LocalWhisperCapabilityState = (typeof LOCAL_WHISPER_CAPABILITY_STATES)[number];
export type LocalWhisperResidencyState = (typeof LOCAL_WHISPER_RESIDENCY_STATES)[number];
export type LocalWhisperActivityState = (typeof LOCAL_WHISPER_ACTIVITY_STATES)[number];
export type LocalWhisperCapabilityStaleCause = (typeof LOCAL_WHISPER_CAPABILITY_STALE_CAUSES)[number];
export type LocalWhisperOperationalStatus = (typeof LOCAL_WHISPER_OPERATIONAL_STATUSES)[number];
export type LocalWhisperActionId = (typeof LOCAL_WHISPER_ACTION_IDS)[number];
export type LocalWhisperFailureCode = (typeof LOCAL_WHISPER_FAILURE_CODES)[number];
export type LocalWhisperFailureStage = (typeof LOCAL_WHISPER_FAILURE_STAGES)[number];
export type LocalWhisperRecoveryActionId = (typeof LOCAL_WHISPER_RECOVERY_ACTION_IDS)[number];
export type LocalWhisperStateImpact = (typeof LOCAL_WHISPER_STATE_IMPACTS)[number];
export type LocalWhisperGpuVendor = 'nvidia' | 'amd' | 'apple';
export type LocalWhisperPlatform = 'win32' | 'linux' | 'darwin' | 'other';

declare const opaqueDeviceIdBrand: unique symbol;
declare const immutableArtifactIdBrand: unique symbol;
declare const immutableRevisionIdBrand: unique symbol;

export type LocalWhisperOpaqueDeviceId = string & { readonly [opaqueDeviceIdBrand]: true };
export type LocalWhisperArtifactId = string & { readonly [immutableArtifactIdBrand]: true };
export type LocalWhisperRevisionId = string & { readonly [immutableRevisionIdBrand]: true };

export interface LocalWhisperDeviceDescriptor {
  readonly id: LocalWhisperOpaqueDeviceId;
  readonly label: string;
  readonly vendor: LocalWhisperGpuVendor;
  readonly available: boolean;
  readonly eligibleBackends: readonly LocalWhisperGpuBackend[];
}

export interface LocalWhisperRuntimeSnapshot {
  readonly supportTier: LocalWhisperSupportTier;
  readonly runtimeSetup: LocalWhisperArtifactSetupState;
  readonly modelSetup: LocalWhisperArtifactSetupState;
  readonly capability: LocalWhisperCapabilityState;
  readonly residency: LocalWhisperResidencyState;
  readonly activity: LocalWhisperActivityState;
  readonly operationalStatus: LocalWhisperOperationalStatus;
  readonly canAttempt: boolean;
  readonly blockingCode: LocalWhisperFailureCode | null;
}

export interface LocalWhisperArtifactSetupSnapshot {
  readonly state: LocalWhisperArtifactSetupState;
  readonly updateAvailable: boolean;
}

export const INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT: LocalWhisperRuntimeSnapshot = Object.freeze({
  supportTier: 'Unsupported',
  runtimeSetup: 'Missing',
  modelSetup: 'Missing',
  capability: 'Unchecked',
  residency: 'Unloaded',
  activity: 'Idle',
  operationalStatus: 'NotReady',
  canAttempt: false,
  blockingCode: null,
});

function isMember<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

export function hasLocalWhisperControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function isBoundedSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 256 && !hasLocalWhisperControlCharacter(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toLocalWhisperOpaqueDeviceId(value: unknown): LocalWhisperOpaqueDeviceId | null {
  return isBoundedSafeIdentifier(value) ? (value as LocalWhisperOpaqueDeviceId) : null;
}

export function toLocalWhisperArtifactId(value: unknown): LocalWhisperArtifactId | null {
  return isBoundedSafeIdentifier(value) ? (value as LocalWhisperArtifactId) : null;
}

export function toLocalWhisperRevisionId(value: unknown): LocalWhisperRevisionId | null {
  return isBoundedSafeIdentifier(value) ? (value as LocalWhisperRevisionId) : null;
}

export function isLocalWhisperRendererSafeLabel(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 160 && !hasLocalWhisperControlCharacter(value)
  );
}

export const isLocalWhisperEngine = (value: unknown): value is LocalWhisperEngine =>
  isMember(LOCAL_WHISPER_ENGINES, value);
export const isLocalWhisperTarget = (value: unknown): value is LocalWhisperTarget =>
  isMember(LOCAL_WHISPER_TARGETS, value);
export const isLocalWhisperBackend = (value: unknown): value is LocalWhisperBackend =>
  isMember(LOCAL_WHISPER_BACKENDS, value);
export const isLocalWhisperGpuBackend = (value: unknown): value is LocalWhisperGpuBackend =>
  isMember(LOCAL_WHISPER_GPU_BACKENDS, value);
export const isLocalWhisperModelFamily = (value: unknown): value is LocalWhisperModelFamily =>
  isMember(LOCAL_WHISPER_MODEL_FAMILIES, value);
export const isLocalWhisperDecodingStrategy = (value: unknown): value is LocalWhisperDecodingStrategy =>
  isMember(LOCAL_WHISPER_DECODING_STRATEGIES, value);
export const isLocalWhisperFailureCode = (value: unknown): value is LocalWhisperFailureCode =>
  isMember(LOCAL_WHISPER_FAILURE_CODES, value);

export function isLocalWhisperRuntimeSnapshot(value: unknown): value is LocalWhisperRuntimeSnapshot {
  if (!isRecord(value)) return false;
  const keys = [
    'supportTier',
    'runtimeSetup',
    'modelSetup',
    'capability',
    'residency',
    'activity',
    'operationalStatus',
    'canAttempt',
    'blockingCode',
  ];
  if (Object.keys(value).length !== keys.length || !Object.keys(value).every((key) => keys.includes(key))) {
    return false;
  }
  return (
    isMember(LOCAL_WHISPER_SUPPORT_TIERS, value.supportTier) &&
    isMember(LOCAL_WHISPER_ARTIFACT_SETUP_STATES, value.runtimeSetup) &&
    isMember(LOCAL_WHISPER_ARTIFACT_SETUP_STATES, value.modelSetup) &&
    isMember(LOCAL_WHISPER_CAPABILITY_STATES, value.capability) &&
    isMember(LOCAL_WHISPER_RESIDENCY_STATES, value.residency) &&
    isMember(LOCAL_WHISPER_ACTIVITY_STATES, value.activity) &&
    isMember(LOCAL_WHISPER_OPERATIONAL_STATUSES, value.operationalStatus) &&
    typeof value.canAttempt === 'boolean' &&
    (value.blockingCode === null || isLocalWhisperFailureCode(value.blockingCode))
  );
}
