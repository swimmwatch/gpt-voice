import {
  LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION,
  isLocalWhisperDiagnosticsSnapshot,
  isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit,
  serializeCanonicalDiagnosticsJson,
  type LocalWhisperDiagnosticsSnapshot,
} from '@shared/diagnosticsArchive';

import type { LocalWhisperSnapshotService } from '../ipc/LocalWhisperSnapshotService';

export interface LocalWhisperDiagnosticsSnapshotProviderDependencies {
  readonly now: () => Date;
  readonly snapshots: Pick<LocalWhisperSnapshotService, 'snapshot'>;
}

export interface LocalWhisperDiagnosticsSnapshotPort {
  capture(): Buffer | null;
}

/** Creates one bounded prompt-free, device-identity-free Local Whisper diagnostics member. */
export class LocalWhisperDiagnosticsSnapshotProvider implements LocalWhisperDiagnosticsSnapshotPort {
  public constructor(private readonly dependencies: LocalWhisperDiagnosticsSnapshotProviderDependencies) {}

  public capture(): Buffer | null {
    try {
      const capturedAt = this.dependencies.now();
      if (!(capturedAt instanceof Date) || !Number.isFinite(capturedAt.getTime())) {
        throw new TypeError('Invalid Local Whisper diagnostics capture time');
      }
      const snapshot = this.dependencies.snapshots.snapshot;
      const candidate: LocalWhisperDiagnosticsSnapshot = {
        activityState: snapshot.runtime.activity,
        artifactCount: snapshot.artifacts.length,
        backend: snapshot.settings.execution.backend,
        capabilityState: snapshot.runtime.capability,
        capturedAt: capturedAt.toISOString(),
        deviceDisplayLabel: null,
        deviceProductId: null,
        deviceVendorId: null,
        driverVersionLabel: null,
        engineId: 'whisperCpp',
        failureCode: snapshot.failure?.code ?? snapshot.runtime.blockingCode,
        installedArtifactCount: snapshot.storage.installedArtifactCount,
        modelFamily: snapshot.settings.model.family,
        modelRevision: snapshot.settings.model.revision,
        modelSetupState: snapshot.runtime.modelSetup,
        modelVariant: snapshot.settings.model.variant,
        operationalStatus: snapshot.runtime.operationalStatus,
        residencyState: snapshot.runtime.residency,
        runtimeRevision: snapshot.settings.runtimeRevision,
        runtimeSetupState: snapshot.runtime.runtimeSetup,
        runtimeVersionLabel: null,
        schemaVersion: LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION,
        supportTier: snapshot.runtime.supportTier,
        target: snapshot.settings.execution.target,
      };
      if (!isLocalWhisperDiagnosticsSnapshot(candidate)) {
        throw new TypeError('Invalid Local Whisper diagnostics snapshot');
      }
      const serialized = serializeCanonicalDiagnosticsJson(candidate);
      if (serialized === null) throw new TypeError('Local Whisper diagnostics serialization failed');
      const payload = Buffer.from(serialized, 'utf8');
      if (!isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit(payload.byteLength)) {
        throw new TypeError('Local Whisper diagnostics snapshot limit exceeded');
      }
      return payload;
    } catch {
      throw new TypeError('Local Whisper diagnostics snapshot capture failed');
    }
  }
}
