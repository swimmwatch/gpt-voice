import type { ScopedLogger } from '../../logger';
import {
  NATIVE_RUNTIME_LOG_MAXIMUM_LINE_BYTES,
  parseCanonicalNativeRuntimeLogRecord,
  serializeCanonicalNativeRuntimeArchiveRecord,
  type NativeRuntimeLogRecord,
} from '@shared/localWhisper';

import { isNativeRuntimeProcessInstanceId } from './NativeRuntimeLogLaunchEnvironment';

export interface NativeRuntimeLogDecoderCounters {
  readonly invalidRecordCount: number;
  readonly overlongLineCount: number;
  readonly schemaFailureCount: number;
  readonly utf8FailureCount: number;
}

export interface NativeRuntimeLogStreamDecoderDependencies {
  /** Binds accepted stderr records to every exact private process in one owned launch tree. */
  readonly expectedProcessInstanceIds?: readonly string[];
  readonly onRecord: (record: NativeRuntimeLogRecord) => void;
}

const EMPTY_COUNTERS: NativeRuntimeLogDecoderCounters = Object.freeze({
  invalidRecordCount: 0,
  overlongLineCount: 0,
  schemaFailureCount: 0,
  utf8FailureCount: 0,
});

/** Decodes untrusted native stderr incrementally without ever retaining rejected raw bytes. */
export class NativeRuntimeLogStreamDecoder {
  private discardingOverlongLine = false;
  private invalidRecordCount = 0;
  private overlongLineCount = 0;
  private pending = Buffer.alloc(0);
  private schemaFailureCount = 0;
  private utf8FailureCount = 0;
  private readonly expectedProcessInstanceIds: ReadonlySet<string> | null;

  public constructor(private readonly dependencies: NativeRuntimeLogStreamDecoderDependencies) {
    const expected = dependencies.expectedProcessInstanceIds;
    if (
      expected &&
      (expected.length === 0 ||
        expected.some((identity) => !isNativeRuntimeProcessInstanceId(identity)) ||
        new Set(expected).size !== expected.length)
    ) {
      throw new TypeError('Invalid native runtime process identity set');
    }
    this.expectedProcessInstanceIds = expected ? new Set(expected) : null;
  }

  public append(chunk: Uint8Array): void {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) return;
    let remaining = Buffer.from(chunk);
    if (this.discardingOverlongLine) {
      const newline = remaining.indexOf(0x0a);
      if (newline < 0) return;
      this.discardingOverlongLine = false;
      remaining = remaining.subarray(newline + 1);
    }
    while (remaining.byteLength > 0) {
      const newline = remaining.indexOf(0x0a);
      if (newline < 0) {
        this.appendPartial(remaining);
        return;
      }
      const line = Buffer.concat([this.pending, remaining.subarray(0, newline)]);
      this.pending = Buffer.alloc(0);
      remaining = remaining.subarray(newline + 1);
      this.consumeLine(line);
    }
  }

  public finish(): void {
    if (this.pending.byteLength > 0 || this.discardingOverlongLine) this.invalidRecordCount += 1;
    this.pending = Buffer.alloc(0);
    this.discardingOverlongLine = false;
  }

  public clear(): void {
    this.pending = Buffer.alloc(0);
    this.discardingOverlongLine = false;
  }

  public get counters(): NativeRuntimeLogDecoderCounters {
    if (
      this.invalidRecordCount === 0 &&
      this.overlongLineCount === 0 &&
      this.schemaFailureCount === 0 &&
      this.utf8FailureCount === 0
    ) {
      return EMPTY_COUNTERS;
    }
    return Object.freeze({
      invalidRecordCount: this.invalidRecordCount,
      overlongLineCount: this.overlongLineCount,
      schemaFailureCount: this.schemaFailureCount,
      utf8FailureCount: this.utf8FailureCount,
    });
  }

  private appendPartial(chunk: Buffer): void {
    if (this.pending.byteLength + chunk.byteLength < NATIVE_RUNTIME_LOG_MAXIMUM_LINE_BYTES) {
      this.pending = Buffer.concat([this.pending, chunk]);
      return;
    }
    this.pending = Buffer.alloc(0);
    this.discardingOverlongLine = true;
    this.overlongLineCount += 1;
    this.invalidRecordCount += 1;
  }

  private consumeLine(rawLine: Buffer): void {
    const line = rawLine.byteLength > 0 && rawLine[rawLine.byteLength - 1] === 0x0d ? rawLine.subarray(0, -1) : rawLine;
    if (line.byteLength + 1 > NATIVE_RUNTIME_LOG_MAXIMUM_LINE_BYTES) {
      this.overlongLineCount += 1;
      this.invalidRecordCount += 1;
      return;
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(line);
    } catch {
      this.utf8FailureCount += 1;
      this.invalidRecordCount += 1;
      return;
    }
    const record = parseCanonicalNativeRuntimeLogRecord(text);
    if (
      !record ||
      (this.expectedProcessInstanceIds && !this.expectedProcessInstanceIds.has(record.processInstanceId))
    ) {
      this.schemaFailureCount += 1;
      this.invalidRecordCount += 1;
      return;
    }
    try {
      this.dependencies.onRecord(record);
    } catch {
      // A diagnostic forwarder cannot affect native process ownership or protocol handling.
    }
  }
}

export interface NativeRuntimeLogForwarderDependencies {
  readonly logger: ScopedLogger;
  readonly now: () => Date;
}

/** Writes one validated event to the retained main-process log at its fixed native severity. */
export class NativeRuntimeLogForwarder {
  public constructor(private readonly dependencies: NativeRuntimeLogForwarderDependencies) {}

  public forward(record: NativeRuntimeLogRecord): void {
    try {
      const observedAt = this.dependencies.now();
      if (!(observedAt instanceof Date) || !Number.isFinite(observedAt.getTime())) return;
      const serialized = serializeCanonicalNativeRuntimeArchiveRecord({
        native: record,
        observedAt: observedAt.toISOString(),
      });
      if (!serialized) return;
      this.dependencies.logger[record.level](`[native-runtime] ${serialized}`);
    } catch {
      // A diagnostic clock or logger failure cannot affect native process ownership or application startup.
    }
  }
}

/** Buffers only validated records until the main-process composition root attaches its scoped logger. */
export class NativeRuntimeLogRelay {
  private forwarder: NativeRuntimeLogForwarder | null = null;
  private readonly pending: NativeRuntimeLogRecord[] = [];

  public accept(record: NativeRuntimeLogRecord): void {
    const forwarder = this.forwarder;
    if (forwarder) {
      try {
        forwarder.forward(record);
      } catch {
        // Relay callers remain isolated even if a future forwarder implementation regresses containment.
      }
      return;
    }
    if (this.pending.length >= 64) this.pending.shift();
    this.pending.push(record);
  }

  public attach(forwarder: NativeRuntimeLogForwarder): void {
    if (this.forwarder) return;
    this.forwarder = forwarder;
    const pending = this.pending.splice(0);
    for (const record of pending) {
      try {
        forwarder.forward(record);
      } catch {
        // One failed buffered diagnostic cannot prevent later records or application composition.
      }
    }
  }
}
