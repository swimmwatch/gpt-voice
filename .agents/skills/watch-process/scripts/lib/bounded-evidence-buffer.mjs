import { Buffer } from 'node:buffer';
import { performance } from 'node:perf_hooks';

import { freezeArray, freezeRecord, requirePositiveInteger, runtimeFail } from './runtime-core-support.mjs';
import { validateRuntimeCode } from './runtime-preflight.mjs';

const STREAM_NAMES = new Set(['stderr', 'stdout']);

function bufferFrom(value) {
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  runtimeFail('invalid-evidence-chunk');
}

function createStreamState() {
  return {
    capturedBytes: 0,
    chunks: [],
    receivedBytes: 0,
    truncated: false,
  };
}

function freezeStreamSummary(stream) {
  return freezeRecord({
    capturedBytes: stream.capturedBytes,
    receivedBytes: stream.receivedBytes,
    truncated: stream.truncated,
  });
}

/**
 * Owns a private, bounded raw-output sink. Its public API intentionally exposes
 * only byte counts, safe codes, and truncation metadata—not output text.
 */
export class BoundedEvidenceBuffer {
  #clock;
  #failureCodes = [];
  #failureLimitReached = false;
  #maximumBytes;
  #maximumFailures;
  #maximumMilliseconds;
  #previousTime = Number.NEGATIVE_INFINITY;
  #startedAt;
  #streams = new Map([
    ['stdout', createStreamState()],
    ['stderr', createStreamState()],
  ]);
  #timeLimitReached = false;
  #totalCapturedBytes = 0;
  #totalReceivedBytes = 0;

  constructor({
    clock = () => performance.now(),
    maximumBytes = 65_536,
    maximumFailures = 20,
    maximumMilliseconds = 300_000,
  } = {}) {
    if (typeof clock !== 'function') runtimeFail('invalid-evidence-clock');
    this.#clock = clock;
    this.#maximumBytes = requirePositiveInteger(maximumBytes, 'invalid-evidence-byte-limit', 10_485_760);
    this.#maximumFailures = requirePositiveInteger(maximumFailures, 'invalid-evidence-failure-limit', 100);
    this.#maximumMilliseconds = requirePositiveInteger(maximumMilliseconds, 'invalid-evidence-time-limit', 604_800_000);
    this.#startedAt = this.#now();
  }

  append(streamName, value) {
    if (!STREAM_NAMES.has(streamName)) runtimeFail('invalid-evidence-stream');
    const bytes = bufferFrom(value);
    const stream = this.#streams.get(streamName);
    stream.receivedBytes += bytes.byteLength;
    this.#totalReceivedBytes += bytes.byteLength;
    if (this.#hasExceededTimeLimit()) {
      stream.truncated = true;
      return freezeRecord({ capturedBytes: 0, truncated: true });
    }

    const remainingBytes = Math.max(0, this.#maximumBytes - this.#totalCapturedBytes);
    const capturedBytes = Math.min(remainingBytes, bytes.byteLength);
    if (capturedBytes > 0) {
      stream.chunks.push(Buffer.from(bytes.subarray(0, capturedBytes)));
      stream.capturedBytes += capturedBytes;
      this.#totalCapturedBytes += capturedBytes;
    }
    if (capturedBytes !== bytes.byteLength) stream.truncated = true;
    return freezeRecord({ capturedBytes, truncated: stream.truncated });
  }

  recordFailure(code) {
    const value = validateRuntimeCode(code);
    if (this.#failureCodes.length === this.#maximumFailures) {
      this.#failureLimitReached = true;
      return false;
    }
    this.#failureCodes.push(value);
    return true;
  }

  /** Returns a safe value suitable for state, prompts, notifications, and journals. */
  summary() {
    this.#hasExceededTimeLimit();
    const stdout = this.#streams.get('stdout');
    const stderr = this.#streams.get('stderr');
    return freezeRecord({
      capturedBytes: this.#totalCapturedBytes,
      failureCodes: freezeArray(this.#failureCodes),
      failureLimitReached: this.#failureLimitReached,
      receivedBytes: this.#totalReceivedBytes,
      stderr: freezeStreamSummary(stderr),
      stdout: freezeStreamSummary(stdout),
      timeLimitReached: this.#timeLimitReached,
      truncated: stdout.truncated || stderr.truncated || this.#timeLimitReached,
    });
  }

  /** Drops retained raw chunks while preserving only the already-sanitized accounting data. */
  dispose() {
    for (const stream of this.#streams.values()) stream.chunks.length = 0;
  }

  #hasExceededTimeLimit() {
    if (this.#timeLimitReached) return true;
    if (this.#now() - this.#startedAt >= this.#maximumMilliseconds) this.#timeLimitReached = true;
    return this.#timeLimitReached;
  }

  #now() {
    const value = this.#clock();
    if (!Number.isFinite(value)) runtimeFail('invalid-evidence-clock');
    this.#previousTime = Math.max(this.#previousTime, value);
    return this.#previousTime;
  }
}
