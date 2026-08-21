import { isSecurityRecord as isRecord } from './securityEvidenceFields';

export const HADOLINT_IMAGE =
  'hadolint/hadolint:v2.12.0@sha256:30a8fd2e785ab6176eed53f74769e04f125afb2f74a6c52aef7d463583b6d45e';
export const TRIVY_IMAGE =
  'aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969';
export const TRIVY_DATABASE_REPOSITORY = 'ghcr.io/aquasecurity/trivy-db:2';
export const TRIVY_DATABASE_ARGUMENTS = Object.freeze(['--db-repository', TRIVY_DATABASE_REPOSITORY] as const);
export const FEDORA_BUILDER_IMAGE = 'fedora:44@sha256:6c75d5bf57cb0fa5aa4b92c6a83c86c791644496d9ac230de7711f5b8ec3b898';
export const SECURITY_BUILDER_TAG = 'gpt-voice-fedora-release:security';

interface ScannerDatabase {
  readonly DownloadedAt: string;
  readonly NextUpdate: string;
  readonly UpdatedAt: string;
  readonly Version: number;
}

const MAXIMUM_DATABASE_AGE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const HADOLINT_SUPPRESSION = /^\s*#\s*hadolint\s+ignore=/imu;
const UNSAFE_DOCKERFILE_INSTRUCTION = /^\s*(?:ADD|USER\s+root\b)|--nogpgcheck\b|\b(?:curl|wget)\b/imu;
const FEDORA_BUILDER_OS_FAMILY = 'fedora';
const FEDORA_BUILDER_OS_NAME = '44';

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Applies deterministic Dockerfile and builder-vulnerability evidence policy without calling a scanner. */
export class DockerBuilderPolicy {
  public verifyDockerfile(dockerfile: string): void {
    const image = dockerfile
      .split(/\r?\n/u)
      .find((line) => line.startsWith('FROM '))
      ?.slice('FROM '.length)
      .trim();
    if (image !== FEDORA_BUILDER_IMAGE) {
      throw new Error('Docker builder policy violation: reviewed Fedora builder identity mismatch');
    }
    if (HADOLINT_SUPPRESSION.test(dockerfile)) {
      throw new Error('Docker builder policy violation: Hadolint suppression is forbidden');
    }
    if (UNSAFE_DOCKERFILE_INSTRUCTION.test(dockerfile)) {
      throw new Error('Docker builder policy violation: unsafe Dockerfile instruction');
    }
  }

  public verifyScanEvidence(input: {
    readonly builderImage: string;
    readonly database: unknown;
    readonly databaseSha256: string;
    readonly now: Date;
    readonly report: unknown;
    readonly scannerImage: string;
  }): void {
    if (input.builderImage !== SECURITY_BUILDER_TAG || input.scannerImage !== TRIVY_IMAGE) {
      throw new Error('Docker builder policy violation: scanner or builder identity mismatch');
    }
    if (!/^[a-f\d]{64}$/u.test(input.databaseSha256)) {
      throw new Error('Docker builder policy violation: scanner database identity malformed');
    }
    this.verifyDatabase(input.database, input.now);
    this.verifyReport(input.report, input.builderImage);
  }

  private verifyDatabase(value: unknown, now: Date): void {
    if (
      !isRecord(value) ||
      typeof value.Version !== 'number' ||
      !Number.isSafeInteger(value.Version) ||
      value.Version < 1
    ) {
      throw new Error('Docker builder policy violation: scanner database evidence malformed');
    }
    const database = value as unknown as ScannerDatabase;
    const downloadedAt = parseTimestamp(database.DownloadedAt);
    const updatedAt = parseTimestamp(database.UpdatedAt);
    const nextUpdate = parseTimestamp(database.NextUpdate);
    if (
      downloadedAt === null ||
      updatedAt === null ||
      nextUpdate === null ||
      now.getTime() - updatedAt > MAXIMUM_DATABASE_AGE_MILLISECONDS ||
      nextUpdate <= now.getTime()
    ) {
      throw new Error('Docker builder policy violation: scanner database evidence unavailable or stale');
    }
  }

  private verifyReport(value: unknown, builderImage: string): void {
    if (
      !isRecord(value) ||
      value.SchemaVersion !== 2 ||
      value.ArtifactName !== builderImage ||
      value.ArtifactType !== 'container_image' ||
      !isRecord(value.Metadata)
    ) {
      throw new Error('Docker builder policy violation: scanner report malformed');
    }
    const operatingSystem = isRecord(value.Metadata.OS) ? value.Metadata.OS : null;
    if (
      operatingSystem === null ||
      operatingSystem.Family !== FEDORA_BUILDER_OS_FAMILY ||
      operatingSystem.Name !== FEDORA_BUILDER_OS_NAME
    ) {
      throw new Error('Docker builder policy violation: scanner report malformed');
    }
    if (value.Results === undefined) return;
    if (!Array.isArray(value.Results) || value.Results.length === 0) {
      throw new Error('Docker builder policy violation: scanner report malformed');
    }
    for (const result of value.Results) {
      if (
        !isRecord(result) ||
        typeof result.Target !== 'string' ||
        result.Target.length === 0 ||
        typeof result.Class !== 'string' ||
        result.Class.length === 0 ||
        typeof result.Type !== 'string' ||
        result.Type.length === 0
      ) {
        throw new Error('Docker builder policy violation: scanner report malformed');
      }
      if (result.Vulnerabilities === undefined || result.Vulnerabilities === null) continue;
      if (!Array.isArray(result.Vulnerabilities))
        throw new Error('Docker builder policy violation: scanner report malformed');
      for (const vulnerability of result.Vulnerabilities) {
        if (!isRecord(vulnerability) || typeof vulnerability.Severity !== 'string') {
          throw new Error('Docker builder policy violation: scanner report malformed');
        }
        if (vulnerability.Severity !== 'HIGH' && vulnerability.Severity !== 'CRITICAL')
          throw new Error('Docker builder policy violation: scanner report malformed');
        throw new Error('Docker builder policy violation: high or critical builder finding');
      }
    }
  }
}
