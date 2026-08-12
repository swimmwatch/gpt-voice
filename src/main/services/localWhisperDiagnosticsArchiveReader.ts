import {
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION,
  LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION,
  isDiagnosticsArchiveManifest,
  isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit,
  parseCanonicalLocalWhisperDiagnosticsSnapshot,
} from '@shared/diagnosticsArchive';

import type { DiagnosticsArchiveMember } from './diagnosticsArchiveFormat';

export type LocalWhisperDiagnosticsArchiveState = 'absent' | 'valid' | 'invalid';

export interface LocalWhisperDiagnosticsArchiveReaderDependencies {
  readonly hash: (payload: Buffer) => string;
}

/** Evaluates only the optional Local Whisper member without weakening the surrounding archive contract. */
export class LocalWhisperDiagnosticsArchiveReader {
  public constructor(private readonly dependencies: LocalWhisperDiagnosticsArchiveReaderDependencies) {}

  public inspect(
    manifestValue: unknown,
    members: readonly DiagnosticsArchiveMember[],
  ): LocalWhisperDiagnosticsArchiveState {
    if (!isDiagnosticsArchiveManifest(manifestValue)) return 'invalid';
    const snapshotName = DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot;
    const snapshotMembers = members.filter((member) => member.name === snapshotName);
    const snapshotSummaries = manifestValue.members.filter((member) => member.name === snapshotName);
    if (snapshotMembers.length === 0 && snapshotSummaries.length === 0) return 'absent';
    if (
      (manifestValue.schemaVersion !== DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION &&
        manifestValue.schemaVersion !== DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION) ||
      manifestValue.schemaVersions.localWhisperSnapshot !== LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION ||
      snapshotMembers.length !== 1 ||
      snapshotSummaries.length !== 1
    ) {
      return 'invalid';
    }

    const member = snapshotMembers[0];
    const summary = snapshotSummaries[0];
    if (
      !isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit(member.payload.byteLength) ||
      summary.byteLength !== member.payload.byteLength
    ) {
      return 'invalid';
    }
    try {
      if (this.dependencies.hash(member.payload) !== summary.sha256) return 'invalid';
    } catch {
      return 'invalid';
    }
    return parseCanonicalLocalWhisperDiagnosticsSnapshot(member.payload) === null ? 'invalid' : 'valid';
  }
}
