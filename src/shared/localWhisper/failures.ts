import {
  isLocalWhisperFailureCode,
  type LocalWhisperActionId,
  type LocalWhisperArtifactId,
  type LocalWhisperFailureCode,
  type LocalWhisperFailureStage,
  type LocalWhisperOpaqueDeviceId,
  type LocalWhisperRecoveryActionId,
  type LocalWhisperRuntimeSnapshot,
  type LocalWhisperStateImpact,
} from './domain';

export interface LocalWhisperFailureDescriptor {
  readonly stage: LocalWhisperFailureStage;
  readonly retryable: boolean;
  readonly recoveryAction: LocalWhisperRecoveryActionId;
  readonly stateImpact: LocalWhisperStateImpact;
}

export interface LocalWhisperSafeFailureContext {
  readonly artifactId?: LocalWhisperArtifactId;
  readonly deviceId?: LocalWhisperOpaqueDeviceId;
}

export interface LocalWhisperRendererSafeFailure extends LocalWhisperFailureDescriptor {
  readonly code: LocalWhisperFailureCode;
  readonly artifactId?: LocalWhisperArtifactId;
  readonly deviceId?: LocalWhisperOpaqueDeviceId;
}

export interface LocalWhisperActionSuccess<T = undefined> {
  readonly success: true;
  readonly action: LocalWhisperActionId;
  readonly snapshot: LocalWhisperRuntimeSnapshot;
  readonly value: T;
}

export interface LocalWhisperActionFailure {
  readonly success: false;
  readonly action: LocalWhisperActionId;
  readonly snapshot: LocalWhisperRuntimeSnapshot;
  readonly error: LocalWhisperRendererSafeFailure;
}

export type LocalWhisperActionResult<T = undefined> = LocalWhisperActionSuccess<T> | LocalWhisperActionFailure;

function descriptor(
  stage: LocalWhisperFailureStage,
  retryable: boolean,
  recoveryAction: LocalWhisperRecoveryActionId,
  stateImpact: LocalWhisperStateImpact,
): LocalWhisperFailureDescriptor {
  return Object.freeze({ stage, retryable, recoveryAction, stateImpact });
}

export const LOCAL_WHISPER_FAILURE_DESCRIPTORS = Object.freeze({
  INVALID_SETTINGS: descriptor('validation', false, 'edit-settings', 'settingsInvalid'),
  SETTINGS_VERSION_UNSUPPORTED: descriptor('validation', false, 'upgrade-or-reset-settings', 'settingsInvalid'),
  STALE_CONFIGURATION: descriptor('validation', true, 'refresh-and-retry', 'capabilityNotReady'),
  UNSUPPORTED_PLATFORM: descriptor('support', false, 'select-supported-configuration', 'supportUnavailable'),
  UNSUPPORTED_ARCHITECTURE: descriptor('support', false, 'select-supported-configuration', 'supportUnavailable'),
  TARGET_UNSUPPORTED: descriptor('support', false, 'select-supported-configuration', 'supportUnavailable'),
  BACKEND_UNSUPPORTED: descriptor('support', false, 'select-supported-configuration', 'supportUnavailable'),
  PLANNED_UNAVAILABLE: descriptor('support', false, 'select-supported-configuration', 'supportUnavailable'),
  DEVICE_NOT_FOUND: descriptor('device', true, 'refresh-or-select-device', 'capabilityNotReady'),
  DEVICE_NOT_ALLOWLISTED: descriptor('device', false, 'select-allowlisted-backend', 'capabilityNotReady'),
  DRIVER_INCOMPATIBLE: descriptor('device', true, 'show-prerequisites', 'capabilityNotReady'),
  RUNTIME_PREREQUISITE_MISSING: descriptor('runtimeSetup', true, 'show-prerequisites', 'runtimeSetupFailed'),
  DEVICE_FEATURE_MISSING: descriptor('device', true, 'show-prerequisites', 'capabilityNotReady'),
  GPU_PERMISSION_DENIED: descriptor('device', true, 'show-prerequisites', 'capabilityNotReady'),
  CPU_FEATURE_MISSING: descriptor('device', true, 'show-prerequisites', 'capabilityNotReady'),
  INSUFFICIENT_DISK: descriptor('resources', true, 'free-resources', 'none'),
  INSUFFICIENT_RAM: descriptor('resources', true, 'free-resources', 'capabilityNotReady'),
  INSUFFICIENT_VRAM: descriptor('resources', true, 'free-resources', 'capabilityNotReady'),
  RUNTIME_MISSING: descriptor('runtimeSetup', true, 'download-selected-artifact', 'runtimeSetupMissing'),
  RUNTIME_INCOMPATIBLE: descriptor('runtimeSetup', true, 'select-compatible-artifact', 'runtimeSetupFailed'),
  RUNTIME_BLOCKED: descriptor('runtimeSetup', false, 'update-or-remove-artifact', 'runtimeSetupFailed'),
  RUNTIME_CORRUPT: descriptor('runtimeSetup', true, 'redownload-or-remove-artifact', 'runtimeSetupFailed'),
  MODEL_MISSING: descriptor('modelSetup', true, 'download-selected-artifact', 'modelSetupMissing'),
  MODEL_INCOMPATIBLE: descriptor('modelSetup', true, 'select-compatible-artifact', 'modelSetupFailed'),
  MODEL_BLOCKED: descriptor('modelSetup', false, 'update-or-remove-artifact', 'modelSetupFailed'),
  MODEL_CORRUPT: descriptor('modelSetup', true, 'redownload-or-remove-artifact', 'modelSetupFailed'),
  DOWNLOAD_OFFLINE: descriptor('download', true, 'retry-download', 'none'),
  DOWNLOAD_FAILED: descriptor('download', true, 'retry-download', 'none'),
  DOWNLOAD_CANCELLED: descriptor('cancellation', true, 'retry-operation', 'none'),
  UNSAFE_REDIRECT: descriptor('download', false, 'discard-and-fetch-trusted-revision', 'none'),
  RESUME_INVALID: descriptor('verification', false, 'discard-and-fetch-trusted-revision', 'none'),
  SIGNATURE_INVALID: descriptor('verification', false, 'discard-and-fetch-trusted-revision', 'runtimeSetupFailed'),
  HASH_MISMATCH: descriptor('verification', false, 'discard-and-fetch-trusted-revision', 'runtimeSetupFailed'),
  ARCHIVE_INVALID: descriptor('verification', false, 'discard-and-fetch-trusted-revision', 'runtimeSetupFailed'),
  INSTALL_FAILED: descriptor('installation', true, 'retry-download', 'runtimeSetupFailed'),
  DELETE_FAILED: descriptor('deletion', true, 'retry-operation', 'none'),
  WORKER_START_FAILED: descriptor('workerStart', true, 'retry-load-or-change-settings', 'residencyFailed'),
  WORKER_PROTOCOL_MISMATCH: descriptor('protocol', false, 'retry-load-or-change-settings', 'residencyFailed'),
  WORKER_PROTOCOL_VIOLATION: descriptor('protocol', false, 'retry-load-or-change-settings', 'residencyFailed'),
  WORKER_CRASHED: descriptor('workerStart', true, 'retry-load-or-change-settings', 'residencyFailed'),
  OPERATION_TIMEOUT: descriptor('cleanup', true, 'retry-load-or-change-settings', 'residencyFailed'),
  BACKEND_INIT_FAILED: descriptor('backendInitialization', true, 'retry-load-or-change-settings', 'capabilityNotReady'),
  ALLOCATION_FAILED: descriptor('allocation', true, 'retry-load-or-change-settings', 'capabilityNotReady'),
  MODEL_LOAD_FAILED: descriptor('modelLoad', true, 'retry-load-or-change-settings', 'residencyFailed'),
  WARMUP_FAILED: descriptor('warmup', true, 'retry-load-or-change-settings', 'residencyFailed'),
  CLEANUP_FAILED: descriptor('cleanup', false, 'restart-application', 'cleanupUncertain'),
  OPERATION_CONFLICT: descriptor('validation', true, 'refresh-and-retry', 'none'),
  AUDIO_FORMAT_UNSUPPORTED: descriptor('validation', true, 'record-again', 'activityIdle'),
  TRANSCRIPTION_FAILED: descriptor('transcription', true, 'retry-operation', 'activityIdle'),
  EMPTY_TRANSCRIPTION: descriptor('transcription', true, 'retry-operation', 'activityIdle'),
  CANCELLED: descriptor('cancellation', true, 'retry-operation', 'activityIdle'),
} as const satisfies Readonly<Record<LocalWhisperFailureCode, LocalWhisperFailureDescriptor>>);

export function getLocalWhisperFailureDescriptor(code: unknown): LocalWhisperFailureDescriptor | undefined {
  return isLocalWhisperFailureCode(code) ? LOCAL_WHISPER_FAILURE_DESCRIPTORS[code] : undefined;
}

export function createLocalWhisperRendererSafeFailure(
  code: LocalWhisperFailureCode,
  context: LocalWhisperSafeFailureContext = {},
): LocalWhisperRendererSafeFailure {
  return Object.freeze({ code, ...LOCAL_WHISPER_FAILURE_DESCRIPTORS[code], ...context });
}

export function createLocalWhisperActionFailure(
  action: LocalWhisperActionId,
  code: LocalWhisperFailureCode,
  snapshot: LocalWhisperRuntimeSnapshot,
  context: LocalWhisperSafeFailureContext = {},
): LocalWhisperActionFailure {
  return Object.freeze({
    success: false,
    action,
    snapshot,
    error: createLocalWhisperRendererSafeFailure(code, context),
  });
}

export function createLocalWhisperActionSuccess<T>(
  action: LocalWhisperActionId,
  snapshot: LocalWhisperRuntimeSnapshot,
  value: T,
): LocalWhisperActionSuccess<T> {
  return Object.freeze({ success: true, action, snapshot, value });
}
