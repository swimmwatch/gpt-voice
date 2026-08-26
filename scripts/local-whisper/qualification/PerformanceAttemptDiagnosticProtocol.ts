import {
  ARTIFACT_INSTALLATION_DIAGNOSTIC_STAGES,
  type ArtifactInstallationDiagnosticStage,
} from '@main/localWhisper/artifacts/StreamingArtifactExtractor';

export const PERFORMANCE_ATTEMPT_DIAGNOSTIC_DESCRIPTOR = 4;

const FRAME_PREFIX = 'LWQD1';
const ARTIFACT_KINDS = ['model', 'runtime'] as const;

export type PerformanceAttemptDiagnosticArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface PerformanceAttemptArtifactInstallationDiagnostic {
  readonly artifactKind: PerformanceAttemptDiagnosticArtifactKind;
  readonly stage: ArtifactInstallationDiagnosticStage;
}

/** Serializes one fixed, content-free diagnostic frame for the private qualification parent. */
export function performanceAttemptArtifactInstallationDiagnosticFrame(
  diagnostic: PerformanceAttemptArtifactInstallationDiagnostic,
): Buffer {
  return Buffer.from(`${FRAME_PREFIX}\t${diagnostic.artifactKind}\t${diagnostic.stage}\n`, 'ascii');
}

/** Parses only the fixed diagnostic vocabulary; arbitrary child stderr is intentionally rejected. */
export function parsePerformanceAttemptArtifactInstallationDiagnostic(
  bytes: Buffer,
): PerformanceAttemptArtifactInstallationDiagnostic | null {
  if (bytes.byteLength === 0 || bytes[bytes.byteLength - 1] !== 0x0a || bytes.subarray(0, -1).includes(0x0d)) {
    return null;
  }
  const fields = bytes.subarray(0, -1).toString('ascii').split('\t');
  const [prefix, artifactKind, stage] = fields;
  if (
    fields.length !== 3 ||
    prefix !== FRAME_PREFIX ||
    !ARTIFACT_KINDS.includes(artifactKind as PerformanceAttemptDiagnosticArtifactKind) ||
    !ARTIFACT_INSTALLATION_DIAGNOSTIC_STAGES.includes(stage as ArtifactInstallationDiagnosticStage)
  ) {
    return null;
  }
  return Object.freeze({
    artifactKind: artifactKind as PerformanceAttemptDiagnosticArtifactKind,
    stage: stage as ArtifactInstallationDiagnosticStage,
  });
}
