import {
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION,
  NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_BYTES,
  NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_RECORDS,
  isDiagnosticsArchiveManifest,
} from '@shared/diagnosticsArchive';
import { parseCanonicalNativeRuntimeArchiveRecord } from '@shared/localWhisper';

import type { DiagnosticsArchiveMember } from './diagnosticsArchiveFormat';

export type NativeRuntimeLogArchiveState = 'absent' | 'valid' | 'invalid';

export interface NativeRuntimeLogArchiveReaderDependencies {
  readonly hash: (payload: Buffer) => string;
}

/** Validates the bounded optional native-runtime JSONL member without accepting arbitrary retained logs. */
export class NativeRuntimeLogArchiveReader {
  public constructor(private readonly dependencies: NativeRuntimeLogArchiveReaderDependencies) {}

  public inspect(manifestValue: unknown, members: readonly DiagnosticsArchiveMember[]): NativeRuntimeLogArchiveState {
    if (!isDiagnosticsArchiveManifest(manifestValue)) return 'invalid';
    if (manifestValue.schemaVersion !== DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION || !manifestValue.nativeRuntime) {
      return members.some((member) => member.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime)
        ? 'invalid'
        : 'absent';
    }
    const name = DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime;
    const selected = members.filter((member) => member.name === name);
    const summaries = manifestValue.members.filter((member) => member.name === name);
    if (selected.length === 0 && summaries.length === 0) {
      return manifestValue.nativeRuntime.includedRecordCount === 0 ? 'absent' : 'invalid';
    }
    if (selected.length !== 1 || summaries.length !== 1) return 'invalid';
    const member = selected[0];
    const summary = summaries[0];
    if (
      member.payload.byteLength !== summary.byteLength ||
      member.payload.byteLength !== manifestValue.nativeRuntime.byteLength ||
      member.payload.byteLength > NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_BYTES
    ) {
      return 'invalid';
    }
    try {
      if (this.dependencies.hash(member.payload) !== summary.sha256) return 'invalid';
    } catch {
      return 'invalid';
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(member.payload);
    } catch {
      return 'invalid';
    }
    const lines = text.split('\n');
    if (lines[lines.length - 1] !== '') return 'invalid';
    const records = lines.slice(0, -1).map((line) => parseCanonicalNativeRuntimeArchiveRecord(line));
    if (
      records.some((record) => record === null) ||
      records.length !== manifestValue.nativeRuntime.includedRecordCount ||
      records.length > NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_RECORDS
    ) {
      return 'invalid';
    }
    const deduplicationKeys = new Set<string>();
    for (const record of records) {
      if (!record) return 'invalid';
      const key = `${record.native.processInstanceId}\0${record.native.sequence}`;
      if (deduplicationKeys.has(key)) return 'invalid';
      deduplicationKeys.add(key);
    }
    const first = records[0]?.observedAt ?? null;
    const last = records[records.length - 1]?.observedAt ?? null;
    return first === manifestValue.nativeRuntime.firstObservedAt && last === manifestValue.nativeRuntime.lastObservedAt
      ? 'valid'
      : 'invalid';
  }
}
