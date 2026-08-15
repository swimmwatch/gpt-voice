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

const SOURCE_FILES: readonly SourceFileContract[] = Object.freeze([
  {
    path: 'src/main/localWhisper/filesystem/ManagedArtifactStore.ts',
    sha256: 'd04a84b6219d0d7b229f267fef9fb10aa3e9c3fe079539f6c19d172fb6816cdd',
  },
  {
    path: 'src/main/localWhisper/supervisor/NativeLauncherProcessOwner.ts',
    sha256: '3beffd3e6e4c53a3b8838cd15dd444fb06797ca78c1d85a382c5fb7124932bd9',
  },
  {
    path: 'src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts',
    sha256: 'e0f30b029902cc0dd51a3bc9ac962896ec4d2d896f287097a4551e64796caccf',
  },
  {
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp',
    sha256: '9ac4d2749e4ae0594d35bcbeb3002276930d2d86717223d2e03b9d8ee8fa07ca',
  },
  {
    path: 'runtime/local-whisper/fs-guard/src/platform/windows/windows_model_launch_application.cpp',
    sha256: '19b9156a76dd20f260d6b133e3c27cc84f34901d8edacb21c2bf600bb42ebc3a',
  },
  {
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp',
    sha256: 'f24c3cdffc2e8c466d99f71ce8b2599704793ca2d1ce459aaaa736d1ed487d88',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
    sha256: 'b82a16e04941dc10af0d327fc18fbe1ddfbebe98789cd289cceb7ad8a0f0d8b8',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/core/exact_model_reader.cpp',
    sha256: 'b260bca6ffbc164672dd5abbaab30a2dba6afba569a3a5bfa33b3bfbc3f5dd6d',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/core/model_format_preflight.cpp',
    sha256: '535f7af8865514c4e63573b6c0ce92a8fb5e0b2855d8996598fc4b4e323af85b',
  },
  {
    path: 'runtime/local-whisper/whisper-cpp/core/worker_application.cpp',
    sha256: 'aef50d73ca50d01115349183c4a30cca07fc37e6f98b7e8450a274adff86cce4',
  },
]);

const PROOF_POINTS: readonly SourceProofPoint[] = Object.freeze([
  {
    id: 'managed-acquisition-directory-proof',
    path: 'src/main/localWhisper/filesystem/ManagedArtifactStore.ts',
    marker: 'await this.dependencies.adapter.inspectDirectory(native.token, expectedDirectoryEntries(descriptor))',
    platforms: ['linux', 'win32'],
  },
  {
    id: 'native-launch-model-revalidation',
    path: 'src/main/localWhisper/supervisor/NativeLauncherProcessOwner.ts',
    marker: 'await authority.modelGuardAuthority?.revalidate();',
    platforms: ['linux', 'win32'],
  },
  {
    id: 'worker-load-model-revalidation',
    path: 'src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts',
    marker: 'await request.revalidate();',
    platforms: ['linux', 'win32'],
  },
  {
    id: 'linux-model-guard-digest',
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp',
    marker: 'hash_descriptor(model.file.get(), request.model_size_bytes) != request.model_sha256',
    platforms: ['linux'],
  },
  {
    id: 'windows-model-guard-digest',
    path: 'runtime/local-whisper/fs-guard/src/platform/windows/windows_model_launch_application.cpp',
    marker: 'hash_handle(model.file.get(), request.model_size_bytes) != request.model_sha256',
    platforms: ['win32'],
  },
  {
    id: 'linux-authority-server-digest',
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp',
    marker: 'digest.finish() != binding.artifact_content_sha256',
    platforms: ['linux'],
  },
  {
    id: 'worker-preflight-exact-read',
    path: 'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
    marker: 'reader.rewind_after_verified_pass();',
    platforms: ['linux', 'win32'],
  },
  {
    id: 'worker-loader-exact-read',
    path: 'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
    marker: 'whisper_model_loader loader{&reader, exact_loader_read, exact_loader_eof, exact_loader_close};',
    platforms: ['linux', 'win32'],
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

export interface QualificationSourceBaselineEvidence {
  readonly sourceRevision: string;
  readonly sourceProofDigest: string;
  readonly fullModelHashes: Readonly<{ readonly linux: number; readonly win32: number }>;
}

/** Fails closed when any source owning the post-directory-reuse 7/6 proof inventory drifts. */
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
    const counts = { linux: 0, win32: 0 };
    for (const proof of PROOF_POINTS) {
      const source = sources.get(proof.path);
      if (!source || countOccurrences(source, proof.marker) !== 1) {
        throw new Error(`QUALIFICATION_SOURCE_PROOF_DRIFT:${proof.id}`);
      }
      for (const platform of proof.platforms) counts[platform] += 1;
    }
    if (
      counts.linux !== LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE.afterDirectoryReuse.linux ||
      counts.win32 !== LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE.afterDirectoryReuse.win32
    ) {
      throw new Error('QUALIFICATION_SOURCE_HASH_COUNT_DRIFT');
    }
    const sourceProofDigest = digest(
      JSON.stringify({
        sourceRevision: LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
        files: SOURCE_FILES.map(({ path: filePath }) => ({ path: filePath, sha256: actualDigests.get(filePath) })),
        proofPoints: PROOF_POINTS.map(({ id, path: filePath, platforms }) => ({ id, path: filePath, platforms })),
        counts,
      }),
    );
    return Object.freeze({
      sourceRevision: LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
      sourceProofDigest,
      fullModelHashes: Object.freeze(counts),
    });
  }
}
