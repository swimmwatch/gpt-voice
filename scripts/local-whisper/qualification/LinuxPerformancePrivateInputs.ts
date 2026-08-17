import { createHash } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import * as path from 'node:path';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { hasSameVerifiedFileIdentity } from '../../security/verifiedRegularFile';
import type {
  LinuxQualificationEvidenceLoader,
  LoadedLinuxQualificationEvidence,
} from './LinuxQualificationEvidenceLoader';
import { qualificationCanonicalJson } from './QualificationContracts';

const MAXIMUM_CACHE_ENTRY_COUNT = 100_000;
const MAXIMUM_CACHE_BYTES = 100 * 1024 ** 3;
const HASH_BUFFER_BYTES = 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const FOCUSED_MODEL_FILE_NAME = 'ggml-base.bin';
const FOCUSED_FIXTURE_FILE_NAME = 'qualification-input.wav';
const MINIMUM_FOCUSED_FIXTURE_BYTES = 44;
const MAXIMUM_FOCUSED_FIXTURE_BYTES = 64 * 1024 * 1024;

export interface LinuxPerformanceCacheSnapshot {
  readonly schemaVersion: 1;
  readonly digest: string;
  readonly entryCount: number;
  readonly fileCount: number;
  readonly sizeBytes: number;
}

export interface LinuxPerformancePrivateInputProof {
  readonly cacheSnapshot: LinuxPerformanceCacheSnapshot;
  readonly evidenceIdentityDigest: string;
  readonly loaded: LoadedLinuxQualificationEvidence;
  readonly privateParent: string;
  readonly privateRunRoot: string;
}

/** Minimal read-only input graph for the Base-only representative performance path. */
export interface FocusedLinuxPerformancePrivateInputProof {
  readonly cacheSnapshot: LinuxPerformanceCacheSnapshot;
  readonly evidenceIdentityDigest: string;
  readonly loaded: Readonly<{
    readonly application: Pick<LoadedLinuxQualificationEvidence['application'], 'models' | 'performanceFixtures'>;
  }>;
  readonly privateParent: string;
  readonly privateRunRoot: string;
}

export class LinuxPerformancePrivateInputError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'LinuxPerformancePrivateInputError';
  }
}

function fail(code: string): never {
  throw new LinuxPerformancePrivateInputError(code);
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'ENOENT'
  );
}

function containedRelative(root: string, candidate: string): string {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('PRIVATE_INPUT_PATH_INVALID');
  return relative.split(path.sep).join('/');
}

async function hashDescriptor(filePath: string, expected: Stats): Promise<string> {
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() =>
    fail('PRIVATE_INPUT_CACHE_INVALID'),
  );
  try {
    const opened = await handle.stat().catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
    if (!opened.isFile() || !hasSameVerifiedFileIdentity(expected, opened) || opened.size !== expected.size) {
      fail('PRIVATE_INPUT_CACHE_INVALID');
    }
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(Math.min(HASH_BUFFER_BYTES, Math.max(1, opened.size)));
    let offset = 0;
    while (offset < opened.size) {
      const length = Math.min(buffer.byteLength, opened.size - offset);
      const { bytesRead } = await handle
        .read(buffer, 0, length, offset)
        .catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
      if (bytesRead !== length) fail('PRIVATE_INPUT_CACHE_INVALID');
      digest.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const finalOpened = await handle.stat().catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
    const finalLinked = await lstat(filePath).catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
    if (
      !hasSameVerifiedFileIdentity(opened, finalOpened) ||
      !hasSameVerifiedFileIdentity(opened, finalLinked) ||
      finalLinked.isSymbolicLink() ||
      finalOpened.size !== opened.size ||
      finalOpened.mtimeMs !== opened.mtimeMs
    ) {
      fail('PRIVATE_INPUT_CACHE_CHANGED');
    }
    return digest.digest('hex');
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/** Produces a path-private, deterministic manifest digest without following links. */
export async function snapshotLinuxPerformanceCache(cacheRoot: string): Promise<LinuxPerformanceCacheSnapshot> {
  if (!path.isAbsolute(cacheRoot)) fail('PRIVATE_INPUT_CACHE_INVALID');
  const resolved = path.resolve(cacheRoot);
  if (resolved === path.parse(resolved).root) fail('PRIVATE_INPUT_CACHE_INVALID');
  const rootMetadata = await lstat(resolved).catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) fail('PRIVATE_INPUT_CACHE_INVALID');
  const canonicalRoot = await realpath(resolved).catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
  if (canonicalRoot !== resolved) fail('PRIVATE_INPUT_CACHE_INVALID');
  const entries: Array<
    Readonly<{ relativePath: string; type: 'directory' | 'file'; sizeBytes: number; sha256: string }>
  > = [];
  const pending = [canonicalRoot];
  let totalBytes = 0;
  let fileCount = 0;
  while (pending.length > 0) {
    const directoryPath = pending.pop()!;
    const directory = await opendir(directoryPath).catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
    const names: string[] = [];
    try {
      for await (const entry of directory) names.push(entry.name);
    } finally {
      await directory.close().catch(() => undefined);
    }
    names.sort((left, right) => left.localeCompare(right, 'en'));
    for (const name of names) {
      const absolutePath = path.join(directoryPath, name);
      const relativePath = containedRelative(canonicalRoot, absolutePath);
      const metadata = await lstat(absolutePath).catch(() => fail('PRIVATE_INPUT_CACHE_INVALID'));
      if (metadata.isSymbolicLink()) fail('PRIVATE_INPUT_CACHE_LINK_REJECTED');
      if (metadata.isDirectory()) {
        entries.push(Object.freeze({ relativePath, type: 'directory', sizeBytes: 0, sha256: '0'.repeat(64) }));
        pending.push(absolutePath);
      } else if (metadata.isFile()) {
        totalBytes += metadata.size;
        fileCount += 1;
        if (!Number.isSafeInteger(totalBytes) || totalBytes > MAXIMUM_CACHE_BYTES) {
          fail('PRIVATE_INPUT_CACHE_LIMIT_EXCEEDED');
        }
        entries.push(
          Object.freeze({
            relativePath,
            type: 'file',
            sizeBytes: metadata.size,
            sha256: await hashDescriptor(absolutePath, metadata),
          }),
        );
      } else {
        fail('PRIVATE_INPUT_CACHE_SPECIAL_FILE_REJECTED');
      }
      if (entries.length > MAXIMUM_CACHE_ENTRY_COUNT) fail('PRIVATE_INPUT_CACHE_LIMIT_EXCEEDED');
    }
  }
  if (fileCount === 0 || totalBytes === 0) fail('PRIVATE_INPUT_CACHE_EMPTY');
  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'));
  return Object.freeze({
    schemaVersion: 1,
    digest: createHash('sha256').update(JSON.stringify(entries), 'utf8').digest('hex'),
    entryCount: entries.length,
    fileCount,
    sizeBytes: totalBytes,
  });
}

function evidenceDigest(loaded: LoadedLinuxQualificationEvidence): string {
  const identity = Object.freeze({
    models: loaded.cachedModels.map(({ sizeBytes, sha256 }) => Object.freeze({ sizeBytes, sha256 })),
    corpus: loaded.candidateCorpus,
    directEngines: loaded.directEngineArtifacts,
    modelNoticeDigest: loaded.modelNoticeDigest,
    modelSetManifestDigest: loaded.modelSetManifestDigest,
    runtimes: loaded.runtimes.map(
      ({ directEngineBinarySha256, directEngineManifestDigest, profileId, toolchainDigest }) =>
        Object.freeze({ directEngineBinarySha256, directEngineManifestDigest, profileId, toolchainDigest }),
    ),
  });
  return createHash('sha256').update(qualificationCanonicalJson(identity), 'utf8').digest('hex');
}

function focusedBaseModel() {
  const model = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
    (candidate) => candidate.family === 'base' && candidate.variant === 'full',
  );
  if (!model || model.sizeBytes !== 147_951_465 || !SHA256.test(model.sha256)) {
    fail('FOCUSED_PRIVATE_INPUT_MODEL_INVALID');
  }
  return model;
}

async function focusedFixture(
  filePath: string,
): Promise<LoadedLinuxQualificationEvidence['application']['performanceFixtures'][number]> {
  const metadata = await lstat(filePath).catch(() => fail('FOCUSED_PRIVATE_INPUT_FIXTURE_INVALID'));
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < MINIMUM_FOCUSED_FIXTURE_BYTES ||
    metadata.size > MAXIMUM_FOCUSED_FIXTURE_BYTES
  ) {
    fail('FOCUSED_PRIVATE_INPUT_FIXTURE_INVALID');
  }
  const header = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW)
    .then(async (handle) => {
      try {
        const bytes = Buffer.allocUnsafe(12);
        const { bytesRead } = await handle.read(bytes, 0, bytes.byteLength, 0);
        return bytesRead === bytes.byteLength ? bytes : null;
      } finally {
        await handle.close().catch(() => undefined);
      }
    })
    .catch(() => fail('FOCUSED_PRIVATE_INPUT_FIXTURE_INVALID'));
  if (
    !header ||
    header.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    header.subarray(8, 12).toString('ascii') !== 'WAVE'
  ) {
    fail('FOCUSED_PRIVATE_INPUT_FIXTURE_INVALID');
  }
  return Object.freeze({
    id: 'focused-linux-performance-input-v1',
    filePath,
    sizeBytes: metadata.size,
    sha256: await hashDescriptor(filePath, metadata),
    durationNanoseconds: 0,
    language: 'en',
    locale: 'en_us',
  });
}

function focusedEvidenceDigest(
  model: LoadedLinuxQualificationEvidence['application']['models'][number],
  fixture: LoadedLinuxQualificationEvidence['application']['performanceFixtures'][number],
): string {
  return createHash('sha256')
    .update(
      qualificationCanonicalJson({
        fixture: { sizeBytes: fixture.sizeBytes, sha256: fixture.sha256 },
        model: { sizeBytes: model.sizeBytes, sha256: model.sha256 },
      }),
      'utf8',
    )
    .digest('hex');
}

async function authenticatePrivateTarget(
  privateParent: string,
  privateRunRoot: string,
): Promise<{ readonly parent: string; readonly child: string }> {
  if (!path.isAbsolute(privateParent) || !path.isAbsolute(privateRunRoot)) fail('PRIVATE_RUN_ROOT_INVALID');
  const parent = path.resolve(privateParent);
  const child = path.resolve(privateRunRoot);
  if (parent === path.parse(parent).root || path.dirname(child) !== parent || child === parent) {
    fail('PRIVATE_RUN_ROOT_INVALID');
  }
  const metadata = await lstat(parent).catch(() => fail('PRIVATE_RUN_PARENT_INVALID'));
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || (metadata.mode & 0o777) !== 0o700) {
    fail('PRIVATE_RUN_PARENT_INVALID');
  }
  const canonicalParent = await realpath(parent).catch(() => fail('PRIVATE_RUN_PARENT_INVALID'));
  if (canonicalParent !== parent) fail('PRIVATE_RUN_PARENT_INVALID');
  try {
    await lstat(child);
    fail('PRIVATE_RUN_ROOT_EXISTS');
  } catch (error) {
    if (error instanceof LinuxPerformancePrivateInputError) throw error;
    if (!isMissing(error)) fail('PRIVATE_RUN_ROOT_INVALID');
  }
  return Object.freeze({ parent, child });
}

/** Authenticates immutable populated inputs and an orchestrator-owned absent child. */
export class LinuxPerformancePrivateInputPreflight {
  public constructor(private readonly evidenceLoader: Pick<LinuxQualificationEvidenceLoader, 'load'>) {}

  public async verify(
    input: Readonly<{
      readonly workspaceRoot: string;
      readonly cacheRoot: string;
      readonly privateParent: string;
      readonly privateRunRoot: string;
    }>,
  ): Promise<LinuxPerformancePrivateInputProof> {
    if (process.platform !== 'linux' || !path.isAbsolute(input.workspaceRoot)) fail('PRIVATE_INPUT_PLATFORM_INVALID');
    const target = await authenticatePrivateTarget(input.privateParent, input.privateRunRoot);
    const before = await snapshotLinuxPerformanceCache(input.cacheRoot);
    const loaded = await this.evidenceLoader
      .load(input.cacheRoot, input.workspaceRoot)
      .catch(() => fail('PRIVATE_INPUT_EVIDENCE_INVALID'));
    const after = await snapshotLinuxPerformanceCache(input.cacheRoot);
    if (
      before.digest !== after.digest ||
      before.entryCount !== after.entryCount ||
      before.fileCount !== after.fileCount ||
      before.sizeBytes !== after.sizeBytes
    ) {
      fail('PRIVATE_INPUT_CACHE_CHANGED');
    }
    const identity = evidenceDigest(loaded);
    if (!SHA256.test(identity)) fail('PRIVATE_INPUT_EVIDENCE_INVALID');
    await authenticatePrivateTarget(target.parent, target.child);
    return Object.freeze({
      cacheSnapshot: before,
      evidenceIdentityDigest: identity,
      loaded,
      privateParent: target.parent,
      privateRunRoot: target.child,
    });
  }
}

/** Authenticates only Base and one WAV fixture; it intentionally does not revive the retired multi-model qualification cache. */
export class FocusedLinuxPerformancePrivateInputPreflight {
  public async verify(
    input: Readonly<{
      readonly workspaceRoot: string;
      readonly cacheRoot: string;
      readonly privateParent: string;
      readonly privateRunRoot: string;
    }>,
  ): Promise<FocusedLinuxPerformancePrivateInputProof> {
    if (process.platform !== 'linux' || !path.isAbsolute(input.workspaceRoot)) {
      fail('FOCUSED_PRIVATE_INPUT_PLATFORM_INVALID');
    }
    const target = await authenticatePrivateTarget(input.privateParent, input.privateRunRoot);
    const before = await snapshotLinuxPerformanceCache(input.cacheRoot);
    const cacheRoot = path.resolve(input.cacheRoot);
    const expectedModel = focusedBaseModel();
    const modelPath = path.join(cacheRoot, FOCUSED_MODEL_FILE_NAME);
    const modelMetadata = await lstat(modelPath).catch(() => fail('FOCUSED_PRIVATE_INPUT_MODEL_INVALID'));
    if (
      !modelMetadata.isFile() ||
      modelMetadata.isSymbolicLink() ||
      modelMetadata.size !== expectedModel.sizeBytes ||
      (await hashDescriptor(modelPath, modelMetadata)) !== expectedModel.sha256
    ) {
      fail('FOCUSED_PRIVATE_INPUT_MODEL_INVALID');
    }
    const fixture = await focusedFixture(path.join(cacheRoot, FOCUSED_FIXTURE_FILE_NAME));
    const after = await snapshotLinuxPerformanceCache(input.cacheRoot);
    if (
      before.digest !== after.digest ||
      before.entryCount !== after.entryCount ||
      before.fileCount !== after.fileCount ||
      before.sizeBytes !== after.sizeBytes
    ) {
      fail('PRIVATE_INPUT_CACHE_CHANGED');
    }
    const model = Object.freeze({
      family: expectedModel.family,
      variant: expectedModel.variant,
      artifactRevision: 'whisper-cpp-base-full-v1',
      filePath: modelPath,
      sizeBytes: expectedModel.sizeBytes,
      sha256: expectedModel.sha256,
    }) as LoadedLinuxQualificationEvidence['application']['models'][number];
    const identity = focusedEvidenceDigest(model, fixture);
    if (!SHA256.test(identity)) fail('FOCUSED_PRIVATE_INPUT_EVIDENCE_INVALID');
    await authenticatePrivateTarget(target.parent, target.child);
    return Object.freeze({
      cacheSnapshot: before,
      evidenceIdentityDigest: identity,
      loaded: Object.freeze({
        application: Object.freeze({ models: Object.freeze([model]), performanceFixtures: Object.freeze([fixture]) }),
      }),
      privateParent: target.parent,
      privateRunRoot: target.child,
    });
  }
}
