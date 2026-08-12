import type { MainLogFileAccessor } from '../logger';
import {
  NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_BYTES,
  NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_RECORDS,
} from '@shared/diagnosticsArchive';
import {
  serializeCanonicalNativeRuntimeArchiveRecord,
  parseCanonicalNativeRuntimeArchiveRecord,
  type NativeRuntimeArchiveRecord,
} from '@shared/localWhisper';

export const NATIVE_RUNTIME_ARCHIVE_MAXIMUM_BYTES = NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_BYTES;
export const NATIVE_RUNTIME_ARCHIVE_MAXIMUM_RECORDS = NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_RECORDS;

export interface NativeRuntimeLogArchiveSummary {
  readonly byteLength: number;
  readonly duplicateRecordCount: number;
  readonly firstObservedAt: string | null;
  readonly includedRecordCount: number;
  readonly invalidRecordCount: number;
  readonly lastObservedAt: string | null;
  readonly truncated: boolean;
  readonly validRecordCount: number;
}

export interface NativeRuntimeLogArchiveExtraction {
  readonly records: readonly NativeRuntimeArchiveRecord[];
  readonly summary: NativeRuntimeLogArchiveSummary;
}

const NATIVE_RUNTIME_LOG_LINE_PATTERN =
  // electron-log records retain only approved source-controlled payloads after this fixed prefix.
  /^\[[^\]\r\n]+\] \[(?:debug|info|warn|error)\] \(local-whisper-native-runtime\) +\[native-runtime\] (?<payload>.+)$/u;

/** Extracts canonical native runtime records in rotated-before-current retained-log order. */
export class NativeRuntimeLogArchiveExtractor {
  public constructor(private readonly logs: MainLogFileAccessor) {}

  public extract(): NativeRuntimeLogArchiveExtraction {
    const records: NativeRuntimeArchiveRecord[] = [];
    const seen = new Set<string>();
    let duplicateRecordCount = 0;
    let invalidRecordCount = 0;
    for (const retainedLog of this.logs.readRetainedLogs()) {
      for (const line of retainedLog.contents.split(/\r?\n/u)) {
        const payload = NATIVE_RUNTIME_LOG_LINE_PATTERN.exec(line)?.groups?.payload;
        if (!payload) continue;
        const record = parseCanonicalNativeRuntimeArchiveRecord(payload);
        if (!record) {
          invalidRecordCount += 1;
          continue;
        }
        const key = `${record.native.processInstanceId}\0${record.native.sequence}`;
        if (seen.has(key)) {
          duplicateRecordCount += 1;
          continue;
        }
        seen.add(key);
        records.push(record);
      }
    }

    const retained: NativeRuntimeArchiveRecord[] = [];
    let byteLength = 0;
    let truncated = false;
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index];
      const serialized = serializeCanonicalNativeRuntimeArchiveRecord(record);
      if (!serialized) {
        invalidRecordCount += 1;
        continue;
      }
      const lineBytes = Buffer.byteLength(serialized, 'utf8') + 1;
      if (
        retained.length >= NATIVE_RUNTIME_ARCHIVE_MAXIMUM_RECORDS ||
        byteLength + lineBytes > NATIVE_RUNTIME_ARCHIVE_MAXIMUM_BYTES
      ) {
        truncated = true;
        continue;
      }
      retained.unshift(record);
      byteLength += lineBytes;
    }
    return Object.freeze({
      records: Object.freeze(retained),
      summary: Object.freeze({
        byteLength,
        duplicateRecordCount,
        firstObservedAt: retained[0]?.observedAt ?? null,
        includedRecordCount: retained.length,
        invalidRecordCount,
        lastObservedAt: retained[retained.length - 1]?.observedAt ?? null,
        truncated,
        validRecordCount: records.length,
      }),
    });
  }
}
