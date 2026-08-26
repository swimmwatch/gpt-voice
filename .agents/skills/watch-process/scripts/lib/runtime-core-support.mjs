import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export const SUPPORTED_NODE_MAJORS = Object.freeze([22, 24]);
export const RUNTIME_CODE_PATTERN = /^[a-z][a-z0-9-]{2,63}$/u;
export const SHA_256_PATTERN = /^[a-f0-9]{64}$/u;
export const PROCESS_START_TOKEN_PATTERN = /^[a-f0-9]{32}$/u;

/** Carries a bounded public code without command, environment, path, or log text. */
export class RuntimeCoreError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RuntimeCoreError';
    this.code = code;
  }
}

export function runtimeFail(code) {
  throw new RuntimeCoreError(code);
}

export function assertAbortSignal(signal) {
  if (
    signal !== undefined &&
    (signal === null || typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function')
  ) {
    runtimeFail('invalid-abort-signal');
  }
  return signal;
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireRecord(value, code) {
  if (!isRecord(value)) runtimeFail(code);
  return value;
}

export function requireString(value, code, { minimum = 0, maximum = Number.POSITIVE_INFINITY } = {}) {
  if (typeof value !== 'string') runtimeFail(code);
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes < minimum || bytes > maximum) runtimeFail(code);
  return value;
}

export function requirePositiveInteger(value, code, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) runtimeFail(code);
  return value;
}

export function requireNonNegativeInteger(value, code, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) runtimeFail(code);
  return value;
}

export function freezeArray(values) {
  return Object.freeze([...values]);
}

export function freezeRecord(record) {
  return Object.freeze({ ...record });
}

/** Hashes an already-normalized, fixed-shape value without retaining its source text. */
export function digestNormalizedValue(domain, value) {
  const digest = createHash('sha256');
  digest.update(domain, 'utf8');
  digest.update('\0', 'utf8');
  digest.update(JSON.stringify(value), 'utf8');
  return digest.digest('hex');
}
