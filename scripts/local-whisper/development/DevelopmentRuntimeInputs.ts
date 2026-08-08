import { lstat } from 'node:fs/promises';
import * as path from 'node:path';

import type { LocalWhisperRuntimeIdentity } from '@shared/localWhisper';

import { readCanonicalJson, sha256File } from '../packaging/fileIntegrity';
import type { QualificationRuntimeCatalogSeed } from '../qualification/QualificationCatalogProducer';

const SHA256_PATTERN = /^[a-f\d]{64}$/u;

export type DevelopmentRuntimePlatform = 'linux' | 'win32';
export type DevelopmentRuntimePlatformSelector = DevelopmentRuntimePlatform | 'current';

const RUNTIME_PROFILES = Object.freeze({
  linux: Object.freeze({
    cpu: Object.freeze({
      profileId: 'linux-x64-cpu-baseline-v1',
      packRevision: 'whisper-cpp-linux-x64-cpu-baseline-v1',
      prerequisites: Object.freeze(['glibc-2.39']),
    }),
    cuda: Object.freeze({
      profileId: 'linux-x64-cuda-12.8.1-sm120a-v1',
      packRevision: 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
      prerequisites: Object.freeze(['cuda-runtime-12.8.1', 'cublas-12.8.1', 'cublas-lt-12.8.1']),
    }),
  }),
  win32: Object.freeze({
    cpu: Object.freeze({
      profileId: 'windows-x64-cpu-msvc-19.39-v1',
      packRevision: 'whisper-cpp-windows-x64-cpu-v1',
      prerequisites: Object.freeze(['cpu-x86-64-sse2']),
    }),
    cuda: Object.freeze({
      profileId: 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1',
      packRevision: 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1',
      prerequisites: Object.freeze(['nvidia-driver-570-65-or-newer']),
    }),
  }),
});

interface RuntimePackRecord {
  readonly schemaVersion: 1;
  readonly profileId: string;
  readonly transferProfile: 'restricted-tar-gzip-v1';
  readonly archive: {
    readonly file: string;
    readonly sizeBytes: number;
    readonly sha256: string;
    readonly signatureInputSha256: string;
  };
  readonly expectedFiles: LocalWhisperRuntimeIdentity['expectedFiles'];
  readonly evidence: {
    readonly runtimeManifestSha256: string;
    readonly provenanceSha256: string;
    readonly sbomSha256: string;
    readonly noticesSha256: string;
  };
}

interface RuntimeManifestIdentity {
  readonly runtimeBuildDigest: string;
}

export interface DevelopmentRuntimeInput {
  readonly backend: 'cpu' | 'cuda';
  readonly archivePath: string;
  readonly archiveSizeBytes: number;
  readonly archiveSha256: string;
  readonly catalog: Omit<
    QualificationRuntimeCatalogSeed,
    'archiveFileName' | 'archiveSizeBytes' | 'archiveSha256' | 'archiveSignature'
  >;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function parseExpectedFiles(value: unknown): LocalWhisperRuntimeIdentity['expectedFiles'] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const files: LocalWhisperRuntimeIdentity['expectedFiles'][number][] = [];
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ['fileId', 'kind', 'mode', 'sizeBytes', 'sha256']) ||
      typeof candidate.fileId !== 'string' ||
      !['data', 'executable', 'library', 'license', 'notice'].includes(String(candidate.kind)) ||
      !Number.isSafeInteger(candidate.mode) ||
      (candidate.mode as number) < 0 ||
      (candidate.mode as number) > 0o777 ||
      !Number.isSafeInteger(candidate.sizeBytes) ||
      (candidate.sizeBytes as number) <= 0 ||
      !isDigest(candidate.sha256)
    ) {
      return null;
    }
    files.push(candidate as unknown as LocalWhisperRuntimeIdentity['expectedFiles'][number]);
  }
  return new Set(files.map(({ fileId }) => fileId)).size === files.length ? Object.freeze(files) : null;
}

function parseRecord(value: unknown, expectedProfile: string): RuntimePackRecord {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['archive', 'evidence', 'expectedFiles', 'profileId', 'schemaVersion', 'transferProfile']) ||
    value.schemaVersion !== 1 ||
    value.profileId !== expectedProfile ||
    value.transferProfile !== 'restricted-tar-gzip-v1' ||
    !isRecord(value.archive) ||
    !hasExactKeys(value.archive, ['file', 'sha256', 'signatureInputSha256', 'sizeBytes']) ||
    typeof value.archive.file !== 'string' ||
    path.basename(value.archive.file) !== value.archive.file ||
    !Number.isSafeInteger(value.archive.sizeBytes) ||
    (value.archive.sizeBytes as number) <= 0 ||
    !isDigest(value.archive.sha256) ||
    value.archive.signatureInputSha256 !== value.archive.sha256 ||
    !isRecord(value.evidence) ||
    !hasExactKeys(value.evidence, ['noticesSha256', 'provenanceSha256', 'runtimeManifestSha256', 'sbomSha256']) ||
    !Object.values(value.evidence).every(isDigest)
  ) {
    throw new Error('Local Whisper development runtime record invalid');
  }
  const expectedFiles = parseExpectedFiles(value.expectedFiles);
  if (!expectedFiles) throw new Error('Local Whisper development runtime files invalid');
  return Object.freeze({ ...value, expectedFiles }) as unknown as RuntimePackRecord;
}

function parseRuntimeManifestIdentity(
  value: unknown,
  backend: DevelopmentRuntimeInput['backend'],
  profile: (typeof RUNTIME_PROFILES)[DevelopmentRuntimePlatform][DevelopmentRuntimeInput['backend']],
): RuntimeManifestIdentity {
  if (
    !isRecord(value) ||
    value.schemaId !== 'local-whisper-runtime-manifest-v1' ||
    value.engine !== 'whisperCpp' ||
    value.backend !== backend ||
    value.profileId !== profile.profileId ||
    value.runtimeRevision !== profile.packRevision ||
    !isDigest(value.runtimeBuildDigest) ||
    value.modelIncluded !== false ||
    value.signed !== false ||
    value.productionOrigin !== false
  ) {
    throw new Error('Local Whisper development runtime manifest invalid');
  }
  return Object.freeze({ runtimeBuildDigest: value.runtimeBuildDigest });
}

export function resolveDevelopmentRuntimePlatform(
  selector: DevelopmentRuntimePlatformSelector,
  hostPlatform: NodeJS.Platform = process.platform,
): DevelopmentRuntimePlatform {
  const platform = selector === 'current' ? hostPlatform : selector;
  if ((platform !== 'linux' && platform !== 'win32') || hostPlatform !== platform) {
    throw new Error('Local Whisper development runtime host invalid');
  }
  return platform;
}

/** Authenticates the deterministic CPU/CUDA runtime-pack outputs consumed by one development session. */
export class DevelopmentRuntimeInputLoader {
  public constructor(private readonly hostPlatform: NodeJS.Platform = process.platform) {}

  public async load(
    workspaceRoot: string,
    requestedPlatform: DevelopmentRuntimePlatformSelector,
  ): Promise<readonly DevelopmentRuntimeInput[]> {
    const platform = resolveDevelopmentRuntimePlatform(requestedPlatform, this.hostPlatform);
    if (!path.isAbsolute(workspaceRoot)) {
      throw new Error('Local Whisper development runtime host invalid');
    }
    const inputs: DevelopmentRuntimeInput[] = [];
    for (const backend of ['cpu', 'cuda'] as const) {
      const profile = RUNTIME_PROFILES[platform][backend];
      const packRoot = path.join(
        workspaceRoot,
        '.cache',
        'local-whisper',
        'qualification',
        'runtime-packs',
        backend,
        'build-a',
      );
      const record = parseRecord(await readCanonicalJson(path.join(packRoot, 'runtime-pack.json')), profile.profileId);
      const archivePath = path.join(packRoot, record.archive.file);
      const runtimeManifestPath = path.join(
        workspaceRoot,
        '.cache',
        'local-whisper',
        'whisper-cpp',
        'stage',
        profile.profileId,
        'runtime-manifest.json',
      );
      const runtimeManifest = parseRuntimeManifestIdentity(
        await readCanonicalJson(runtimeManifestPath),
        backend,
        profile,
      );
      if ((await sha256File(runtimeManifestPath)) !== record.evidence.runtimeManifestSha256) {
        throw new Error('Local Whisper development runtime manifest identity changed');
      }
      const metadata = await lstat(archivePath);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.size !== record.archive.sizeBytes ||
        (await sha256File(archivePath)) !== record.archive.sha256
      ) {
        throw new Error('Local Whisper development runtime archive identity changed');
      }
      inputs.push(
        Object.freeze({
          backend,
          archivePath,
          archiveSizeBytes: record.archive.sizeBytes,
          archiveSha256: record.archive.sha256,
          catalog: Object.freeze({
            backend,
            platform,
            architecture: 'x64',
            buildRevision: runtimeManifest.runtimeBuildDigest,
            packRevision: profile.packRevision,
            expectedFiles: record.expectedFiles,
            prerequisites: profile.prerequisites,
            provenanceId: `development-${backend}-runtime-provenance`,
            sbomRevision: `development-${backend}-runtime-sbom-v1`,
            noticeIds: Object.freeze([`development-${backend}-runtime-notice`]),
            licenseIds: Object.freeze(['mit-license']),
          }),
        }),
      );
    }
    return Object.freeze(inputs);
  }
}
