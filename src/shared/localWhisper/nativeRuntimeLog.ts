import { LOCAL_WHISPER_MAX_REQUEST_ID_BYTES } from './protocol';

export const NATIVE_RUNTIME_LOG_SCHEMA_VERSION = 1 as const;
export const NATIVE_RUNTIME_LOG_MAXIMUM_LINE_BYTES = 4_096 as const;
export const NATIVE_RUNTIME_LOG_COMPONENTS = ['filesystemGuard', 'launcher', 'modelLauncher', 'whisperWorker'] as const;
export const NATIVE_RUNTIME_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export const NATIVE_RUNTIME_LOG_EVENTS = [
  'processStarted',
  'processReady',
  'processStopping',
  'processStopped',
  'handshakeAccepted',
  'handshakeRejected',
  'stateCold',
  'stateWarming',
  'stateWarmed',
  'stateBusy',
  'stateStopping',
  'requestAccepted',
  'requestCompleted',
  'requestCancelled',
  'requestCancelTooLate',
  'controlEof',
  'protocolRejected',
  'modelLoadStarted',
  'modelLoadCompleted',
  'modelLoadFailed',
  'inferenceStarted',
  'inferenceCompleted',
  'inferenceFailed',
  'resourceCleanupStarted',
  'resourceCleanupCompleted',
  'nativeFailure',
] as const;
export const NATIVE_RUNTIME_LOG_ERROR_CODES = [
  'cancelConflict',
  'controlClosed',
  'invalidConfiguration',
  'invalidInput',
  'ioFailure',
  'modelLoadFailure',
  'protocolMismatch',
  'resourceLimit',
  'runtimeFailure',
  'unsupported',
] as const;

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type NativeRuntimeLogComponent = (typeof NATIVE_RUNTIME_LOG_COMPONENTS)[number];
export type NativeRuntimeLogLevel = (typeof NATIVE_RUNTIME_LOG_LEVELS)[number];
export type NativeRuntimeLogEvent = (typeof NATIVE_RUNTIME_LOG_EVENTS)[number];
export type NativeRuntimeLogErrorCode = (typeof NATIVE_RUNTIME_LOG_ERROR_CODES)[number];

export interface NativeRuntimeLogRecord {
  readonly component: NativeRuntimeLogComponent;
  readonly elapsedMs?: number;
  readonly errorCode?: NativeRuntimeLogErrorCode;
  readonly event: NativeRuntimeLogEvent;
  readonly level: NativeRuntimeLogLevel;
  readonly processInstanceId: string;
  readonly requestId?: string;
  readonly schemaVersion: typeof NATIVE_RUNTIME_LOG_SCHEMA_VERSION;
  readonly sequence: number;
  readonly suppressedCount?: number;
}

export interface NativeRuntimeArchiveRecord {
  readonly native: NativeRuntimeLogRecord;
  readonly observedAt: string;
}

export function getNativeRuntimeLogEventLevel(event: NativeRuntimeLogEvent): NativeRuntimeLogLevel {
  if (
    [
      'handshakeAccepted',
      'handshakeRejected',
      'stateCold',
      'stateWarming',
      'stateWarmed',
      'stateBusy',
      'stateStopping',
      'requestAccepted',
      'inferenceStarted',
      'resourceCleanupStarted',
      'resourceCleanupCompleted',
    ].includes(event)
  ) {
    return 'debug';
  }
  if (event === 'controlEof' || event === 'protocolRejected') return 'warn';
  if (event === 'modelLoadFailed' || event === 'inferenceFailed' || event === 'nativeFailure') return 'error';
  return 'info';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isOneOf<const Value extends string>(values: readonly Value[], value: unknown): value is Value {
  return typeof value === 'string' && values.includes(value as Value);
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Buffer.byteLength(value, 'utf8') <= LOCAL_WHISPER_MAX_REQUEST_ID_BYTES &&
    Buffer.from(value, 'utf8').toString('utf8') === value &&
    [...value].every((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint >= 0x20 && codePoint !== 0x7f;
    })
  );
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

/** Validates the closed, canonical native process diagnostic event schema. */
export function isNativeRuntimeLogRecord(value: unknown): value is NativeRuntimeLogRecord {
  if (!isRecord(value)) return false;
  const optionalKeys = ['elapsedMs', 'errorCode', 'requestId', 'suppressedCount'];
  const allowedKeys = new Set([
    'component',
    'event',
    'level',
    'processInstanceId',
    'schemaVersion',
    'sequence',
    ...optionalKeys,
  ]);
  if (
    Object.keys(value).some((key) => !allowedKeys.has(key)) ||
    !['component', 'event', 'level', 'processInstanceId', 'schemaVersion', 'sequence'].every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ) ||
    value.schemaVersion !== NATIVE_RUNTIME_LOG_SCHEMA_VERSION ||
    !isOneOf(NATIVE_RUNTIME_LOG_COMPONENTS, value.component) ||
    !isOneOf(NATIVE_RUNTIME_LOG_EVENTS, value.event) ||
    !isOneOf(NATIVE_RUNTIME_LOG_LEVELS, value.level) ||
    value.level !== getNativeRuntimeLogEventLevel(value.event) ||
    typeof value.processInstanceId !== 'string' ||
    !CANONICAL_UUID_PATTERN.test(value.processInstanceId) ||
    !isSafeNonnegativeInteger(value.sequence) ||
    value.sequence === 0
  ) {
    return false;
  }
  if (value.elapsedMs !== undefined && !isSafeNonnegativeInteger(value.elapsedMs)) return false;
  if (
    value.suppressedCount !== undefined &&
    (!isSafeNonnegativeInteger(value.suppressedCount) || value.suppressedCount === 0)
  ) {
    return false;
  }
  if (value.errorCode !== undefined && !isOneOf(NATIVE_RUNTIME_LOG_ERROR_CODES, value.errorCode)) return false;
  if (value.requestId !== undefined && !isRequestId(value.requestId)) return false;
  return true;
}

/** Serializes exact lexical key order so a receiver can reject semantically equivalent alternate records. */
export function serializeCanonicalNativeRuntimeLogRecord(record: NativeRuntimeLogRecord): string | null {
  if (!isNativeRuntimeLogRecord(record)) return null;
  const canonical: Record<string, unknown> = { component: record.component };
  if (record.elapsedMs !== undefined) canonical.elapsedMs = record.elapsedMs;
  if (record.errorCode !== undefined) canonical.errorCode = record.errorCode;
  canonical.event = record.event;
  canonical.level = record.level;
  canonical.processInstanceId = record.processInstanceId;
  if (record.requestId !== undefined) canonical.requestId = record.requestId;
  canonical.schemaVersion = record.schemaVersion;
  canonical.sequence = record.sequence;
  if (record.suppressedCount !== undefined) canonical.suppressedCount = record.suppressedCount;
  const serialized = JSON.stringify(canonical);
  return Buffer.byteLength(serialized, 'utf8') + 1 <= NATIVE_RUNTIME_LOG_MAXIMUM_LINE_BYTES ? serialized : null;
}

export function parseCanonicalNativeRuntimeLogRecord(value: string): NativeRuntimeLogRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isNativeRuntimeLogRecord(parsed)) return null;
    return serializeCanonicalNativeRuntimeLogRecord(parsed) === value ? parsed : null;
  } catch {
    return null;
  }
}

export function isNativeRuntimeArchiveRecord(value: unknown): value is NativeRuntimeArchiveRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['native', 'observedAt']) &&
    isNativeRuntimeLogRecord(value.native) &&
    isCanonicalTimestamp(value.observedAt)
  );
}

export function serializeCanonicalNativeRuntimeArchiveRecord(record: NativeRuntimeArchiveRecord): string | null {
  if (!isNativeRuntimeArchiveRecord(record)) return null;
  const native = serializeCanonicalNativeRuntimeLogRecord(record.native);
  if (!native) return null;
  return `{"native":${native},"observedAt":${JSON.stringify(record.observedAt)}}`;
}

export function parseCanonicalNativeRuntimeArchiveRecord(value: string): NativeRuntimeArchiveRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isNativeRuntimeArchiveRecord(parsed)) return null;
    return serializeCanonicalNativeRuntimeArchiveRecord(parsed) === value ? parsed : null;
  } catch {
    return null;
  }
}
