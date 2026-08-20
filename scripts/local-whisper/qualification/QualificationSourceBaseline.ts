import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import {
  LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
} from './QualificationContracts';

interface SourceFileContract {
  readonly path: string;
  readonly sha256: string;
}

interface SourceProofPoint {
  readonly id: string;
  readonly path: string;
  readonly marker: string;
  readonly platforms: readonly ('linux' | 'win32')[];
}

interface ActivePathPoint {
  readonly id: string;
  readonly path: string;
  readonly marker: string;
  readonly expectedOccurrences: number;
}

const SOURCE_FILES: readonly SourceFileContract[] = Object.freeze([
  {
    path: 'src/main/localWhisper/filesystem/ManagedArtifactStore.ts',
    sha256: '3cd7f462f4f5d7eec7fb907bf8d479b66bac3bc8d77c6822d80df3a388c2e2b3',
  },
  {
    path: 'src/main/localWhisper/composition/LocalWhisperModelPathLoadAuthorityFactory.ts',
    sha256: 'fc47576c6c8632b97114ca4dbb1254d44967815c7b954007d5e7073316272ae0',
  },
  {
    path: 'src/main/localWhisper/composition/LocalWhisperProductionWorkerPort.ts',
    sha256: 'a5268ec7406fca614422423dd67591cbe83f3e028751ee1e735e9d5eaea92dc6',
  },
  {
    path: 'src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts',
    sha256: '0ab9a3d1d5e099e6bab1fa8a7e1942435113e0d7547f086829e49f0c9b3bd58f',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
    sha256: '0ac520da531e98e3c125ec92f77004e02aa6d60ef16117589a8dfd692dafd3f9',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/core/worker_application.cpp',
    sha256: 'de2fc5208cdd13b16808d6a181675045a35bcd398fa45e46f0dab39ff918de8f',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/core/model_file_validator_linux.cpp',
    sha256: 'ccf85cb47d4eed82cca8dc6b8278db63db50874a5ace3ae065ef613ad770adcd',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/patches/core/0003-standard-file-eof.patch',
    sha256: '02a9cc84d686ee8ac8e24130ffd730c1ec2275c46617fbd9248be6fe579b7dfe',
  },
]);

const MODEL_CONTENT_PROOF_POINTS: readonly SourceProofPoint[] = Object.freeze([]);

const ACTIVE_PATH_POINTS: readonly ActivePathPoint[] = Object.freeze([
  {
    id: 'metadata-only-installation',
    path: 'src/main/localWhisper/filesystem/ManagedArtifactStore.ts',
    marker: "validation: descriptor.kind === 'model' ? 'metadataOnly' : 'authenticated',",
    expectedOccurrences: 2,
  },
  {
    id: 'catalog-model-path-lease',
    path: 'src/main/localWhisper/composition/LocalWhisperModelPathLoadAuthorityFactory.ts',
    marker: 'const leased = await this.dependencies.store.leaseInstalledModelPathForLoad(',
    expectedOccurrences: 1,
  },
  {
    id: 'production-private-model-path-transfer',
    path: 'src/main/localWhisper/composition/LocalWhisperProductionWorkerPort.ts',
    marker: 'modelPath: modelAuthority.modelFilePath,',
    expectedOccurrences: 2,
  },
  {
    id: 'supervisor-metadata-only-evidence',
    path: 'src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts',
    marker: '!message.metadataOnly ||',
    expectedOccurrences: 1,
  },
  {
    id: 'worker-standard-engine-load',
    path: 'runtime/local-whisper/whisper-cpp/core/worker_application.cpp',
    marker: 'engine_.load(load.model_path, load.expected_model_bytes, load.device_authority, cancellation_);',
    expectedOccurrences: 1,
  },
  {
    id: 'engine-standard-path-api',
    path: 'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
    marker: 'whisper_context* loaded = whisper_init_from_file_with_params(model_path.c_str(), parameters);',
    expectedOccurrences: 1,
  },
  {
    id: 'linux-final-component-no-follow',
    path: 'runtime/local-whisper/whisper-cpp/core/model_file_validator_linux.cpp',
    marker: 'O_PATH | O_CLOEXEC | O_NOFOLLOW',
    expectedOccurrences: 1,
  },
  {
    id: 'standard-file-exact-eof',
    path: 'runtime/local-whisper/whisper-cpp/patches/core/0003-standard-file-eof.patch',
    marker: 'return fin->peek() == std::ifstream::traits_type::eof();',
    expectedOccurrences: 2,
  },
]);

function normalizedSource(value: string): string {
  return value.replace(/\r\n/gu, '\n');
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

function stripCppComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
}

function sourceBetween(value: string, start: string, end: string): string {
  const startOffset = value.indexOf(start);
  const endOffset = value.indexOf(end, startOffset + start.length);
  if (startOffset === -1 || endOffset === -1) throw new Error('QUALIFICATION_STANDARD_LOAD_SOURCE_DRIFT');
  return value.slice(startOffset, endOffset);
}

export interface QualificationSourceBaselineEvidence {
  readonly sourceRevision: string;
  readonly sourceProofDigest: string;
  readonly sourceProofBytes: Buffer;
  readonly fullModelHashes: Readonly<{ readonly linux: number; readonly win32: number }>;
}

/** Fails closed when the candidate standard loader or its zero-content-proof inventory drifts. */
export class LocalWhisperQualificationSourceBaselineVerifier {
  public constructor(
    private readonly workspaceRoot: string,
    private readonly readSource: (filePath: string) => string = (filePath) => readFileSync(filePath, 'utf8'),
  ) {}

  public verify(): QualificationSourceBaselineEvidence {
    const sources = new Map<string, string>();
    const actualDigests = new Map<string, string>();
    for (const contract of SOURCE_FILES) {
      const source = normalizedSource(this.readSource(path.resolve(this.workspaceRoot, contract.path)));
      const actual = digest(source);
      sources.set(contract.path, source);
      actualDigests.set(contract.path, actual);
      if (actual !== contract.sha256) throw new Error(`QUALIFICATION_SOURCE_BASIS_DRIFT:${contract.path}`);
    }
    for (const point of ACTIVE_PATH_POINTS) {
      const source = sources.get(point.path);
      if (!source || countOccurrences(source, point.marker) !== point.expectedOccurrences) {
        throw new Error(`QUALIFICATION_ACTIVE_PATH_DRIFT:${point.id}`);
      }
    }
    const productionPort = sources.get('src/main/localWhisper/composition/LocalWhisperProductionWorkerPort.ts');
    const application = sources.get('runtime/local-whisper/whisper-cpp/core/worker_application.cpp');
    const engine = sources.get('runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp');
    if (!productionPort || !application || !engine) throw new Error('QUALIFICATION_STANDARD_LOAD_SOURCE_DRIFT');
    if (/modelGuardAuthority|LocalWhisperModelLaunchAuthorityFactory/u.test(productionPort)) {
      throw new Error('QUALIFICATION_LEGACY_MODEL_AUTHORITY_ACTIVE');
    }
    if (
      /ExactModelReader reader|engine_\.load_legacy_authenticated|artifact_content_sha256/u.test(
        stripCppComments(application),
      )
    ) {
      throw new Error('QUALIFICATION_LEGACY_WORKER_LOAD_ACTIVE');
    }
    const standardEngineLoad = stripCppComments(
      sourceBetween(
        engine,
        'void load(const std::string& model_path',
        'void load_legacy_authenticated(ExactModelReader& reader',
      ),
    );
    if (
      countOccurrences(standardEngineLoad, 'whisper_init_from_file_with_params(') !== 1 ||
      /ExactModelReader|ModelFormatPreflight|whisper_model_loader|whisper_init_with_params/u.test(standardEngineLoad)
    ) {
      throw new Error('QUALIFICATION_STANDARD_LOAD_SOURCE_DRIFT');
    }
    if (
      !engine.includes(
        'Deprecated authenticated custom-loader callbacks retained for rollback/reference tests only.',
      ) ||
      !engine.includes('void load_legacy_authenticated(ExactModelReader& reader')
    ) {
      throw new Error('QUALIFICATION_LEGACY_REFERENCE_MISSING');
    }
    const counts = { linux: 0, win32: 0 };
    for (const proof of MODEL_CONTENT_PROOF_POINTS) {
      const source = sources.get(proof.path);
      if (!source || countOccurrences(source, proof.marker) !== 1) {
        throw new Error(`QUALIFICATION_SOURCE_PROOF_DRIFT:${proof.id}`);
      }
      for (const platform of proof.platforms) counts[platform] += 1;
    }
    if (
      counts.linux !== LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE.standardPathLoader.linux ||
      counts.win32 !== LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE.standardPathLoader.win32
    ) {
      throw new Error('QUALIFICATION_SOURCE_HASH_COUNT_DRIFT');
    }
    const sourceProofBytes = Buffer.from(
      JSON.stringify({
        sourceRevision: LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
        files: SOURCE_FILES.map(({ path: filePath }) => ({ path: filePath, sha256: actualDigests.get(filePath) })),
        activePathPoints: ACTIVE_PATH_POINTS.map(({ id, path: filePath, expectedOccurrences }) => ({
          id,
          path: filePath,
          expectedOccurrences,
        })),
        modelContentProofPoints: MODEL_CONTENT_PROOF_POINTS.map(({ id, path: filePath, platforms }) => ({
          id,
          path: filePath,
          platforms,
        })),
        counts,
      }),
      'utf8',
    );
    const sourceProofDigest = createHash('sha256').update(sourceProofBytes).digest('hex');
    return Object.freeze({
      sourceRevision: LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
      sourceProofDigest,
      sourceProofBytes,
      fullModelHashes: Object.freeze(counts),
    });
  }
}
