import { lstat } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import * as path from 'node:path';

import {
  LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
  LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
  localWhisperUpstreamModelUrl,
} from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperRevisionId,
  type LocalWhisperRuntimeIdentity,
} from '@shared/localWhisper';

import { readCanonicalJson, sha256Bytes, sha256File } from '../packaging/fileIntegrity';
import type { QualificationRuntimeBundleInput } from './QualificationBundleProducer';
import type {
  ProductionApplicationQualificationInput,
  QualificationApplicationModel,
  QualificationApplicationRuntime,
  QualificationAudioFixture,
  QualificationDirectEngine,
} from './ProductionApplicationQualificationRunner';
import type { QualificationCachedArtifact } from './QualificationArtifactHttpClient';
import type { QualificationCandidateSeed, QualificationLinuxPlatformSeed } from './QualificationInputProducer';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SOURCE_COMMIT = 'f049fff95a089aa9969deb009cdd4892b3e74916';
const FLEURS_COMMIT = '70bb2e84b976b7e960aa89f1c648e09c59f894dd';
const WAV_SAMPLE_RATE = 16_000;
const RUNTIME_PROFILE_IDS = Object.freeze({
  cpu: 'linux-x64-cpu-baseline-v1',
  cuda: 'linux-x64-cuda-12.8.1-sm120a-v1',
} as const);

export interface LoadedRuntime {
  readonly application: QualificationApplicationRuntime;
  readonly bundle: QualificationRuntimeBundleInput;
  readonly directEngine: QualificationDirectEngine;
  readonly directEngineBinarySha256: string;
  readonly directEngineManifestDigest: string;
  readonly platformArtifact: LoadedRuntimePlatformArtifact;
  readonly profileId: string;
  readonly toolchainDigest: string;
}

export interface LoadedRuntimePlatformArtifact extends Readonly<Record<string, unknown>> {
  readonly artifactId: string;
  readonly revision: LocalWhisperRevisionId;
  readonly backend: 'cpu' | 'cuda';
  readonly transferProfile: 'restricted-tar-gzip-v1';
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly manifestDigest: string;
  readonly signatureInputDigest: string;
  readonly reproducibilityDigest: string;
}

export interface LoadedLinuxQualificationEvidence {
  readonly application: Omit<ProductionApplicationQualificationInput, 'predecessorPassed' | 'stopArtifactServer'>;
  readonly cachedModels: readonly QualificationCachedArtifact[];
  readonly candidateCorpus: QualificationCandidateSeed['corpus'];
  readonly directEngineArtifacts: QualificationLinuxPlatformSeed['directEngineArtifacts'];
  readonly modelNoticeDigest: string;
  readonly modelSetManifestDigest: string;
  readonly runtimes: readonly LoadedRuntime[];
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function stringField(value: Readonly<Record<string, unknown>>, field: string, code: string): string {
  const result = value[field];
  if (typeof result !== 'string') throw new Error(code);
  return result;
}

function digestField(value: Readonly<Record<string, unknown>>, field: string, code: string): string {
  const result = stringField(value, field, code);
  if (!SHA256_PATTERN.test(result)) throw new Error(code);
  return result;
}

function integerField(value: Readonly<Record<string, unknown>>, field: string, code: string): number {
  const result = value[field];
  if (!Number.isSafeInteger(result) || (result as number) <= 0) throw new Error(code);
  return result as number;
}

function arrayField(value: Readonly<Record<string, unknown>>, field: string, code: string): readonly unknown[] {
  const result = value[field];
  if (!Array.isArray(result)) throw new Error(code);
  return result;
}

async function exactFile(filePath: string, sizeBytes: number, sha256: string, code: string): Promise<void> {
  const metadata = await lstat(filePath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size !== sizeBytes ||
    (await sha256File(filePath)) !== sha256
  ) {
    throw new Error(code);
  }
}

function expectedRuntimeFiles(value: readonly unknown[]): LocalWhisperRuntimeIdentity['expectedFiles'] {
  return Object.freeze(
    value.map((entry) => {
      const item = record(entry, 'Qualification runtime expected-file invalid');
      const fileId = toLocalWhisperArtifactId(stringField(item, 'fileId', 'Qualification runtime file ID invalid'));
      const kind = stringField(item, 'kind', 'Qualification runtime file kind invalid');
      const mode = item.mode;
      if (
        !fileId ||
        !['executable', 'library', 'data', 'license', 'notice'].includes(kind) ||
        !Number.isSafeInteger(mode) ||
        (mode as number) < 0 ||
        (mode as number) > 0o777
      ) {
        throw new Error('Qualification runtime expected-file invalid');
      }
      return Object.freeze({
        fileId,
        kind: kind as 'executable' | 'library' | 'data' | 'license' | 'notice',
        mode: mode as number,
        sizeBytes: integerField(item, 'sizeBytes', 'Qualification runtime file size invalid'),
        sha256: digestField(item, 'sha256', 'Qualification runtime file digest invalid'),
      });
    }),
  );
}

async function loadModels(cacheRoot: string): Promise<{
  readonly application: readonly QualificationApplicationModel[];
  readonly cached: readonly QualificationCachedArtifact[];
  readonly manifestDigest: string;
}> {
  const modelsRoot = path.join(cacheRoot, 'models');
  const manifest = record(
    await readCanonicalJson(path.join(modelsRoot, 'model-set-manifest.json')),
    'Qualification model manifest invalid',
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.commit !== LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT ||
    manifest.transferProfile !== 'pinned-raw-model-v1'
  ) {
    throw new Error('Qualification model manifest invalid');
  }
  const entries = arrayField(manifest, 'models', 'Qualification model manifest invalid');
  if (entries.length !== LOCAL_WHISPER_RELEASE_MODEL_MATRIX.length) {
    throw new Error('Qualification model matrix incomplete');
  }
  const application: QualificationApplicationModel[] = [];
  const cached: QualificationCachedArtifact[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = record(entries[index], 'Qualification model entry invalid');
    const expected = LOCAL_WHISPER_RELEASE_MODEL_MATRIX[index];
    if (
      !expected ||
      entry.family !== expected.family ||
      entry.variant !== expected.variant ||
      entry.file !== expected.file ||
      entry.sizeBytes !== expected.sizeBytes ||
      entry.sha256 !== expected.sha256 ||
      entry.sourceUrl !== localWhisperUpstreamModelUrl(expected.file)
    ) {
      throw new Error('Qualification model identity changed');
    }
    const filePath = path.join(modelsRoot, expected.file);
    await exactFile(filePath, expected.sizeBytes, expected.sha256, 'Qualification cached model identity changed');
    const artifactRevision = toLocalWhisperRevisionId(`whisper-cpp-${expected.family}-${expected.variant}-v1`);
    if (!artifactRevision) throw new Error('Qualification model revision invalid');
    application.push(
      Object.freeze({
        family: expected.family,
        variant: expected.variant,
        artifactRevision,
        filePath,
        sizeBytes: expected.sizeBytes,
        sha256: expected.sha256,
      }),
    );
    cached.push(
      Object.freeze({
        url: localWhisperUpstreamModelUrl(expected.file),
        filePath,
        sizeBytes: expected.sizeBytes,
        sha256: expected.sha256,
      }),
    );
  }
  return Object.freeze({
    application: Object.freeze(application),
    cached: Object.freeze(cached),
    manifestDigest: digestField(manifest, 'manifestDigest', 'Qualification model manifest digest invalid'),
  });
}

interface QualificationAudioFixtureSeed {
  readonly durationNanoseconds: number;
  readonly filePath: string;
  readonly id: string;
  readonly language: 'en' | 'ru';
  readonly locale: 'en_us' | 'ru_ru';
  readonly referenceText?: string;
  readonly sha256: string;
}

async function audioFixture(input: QualificationAudioFixtureSeed): Promise<QualificationAudioFixture> {
  const metadata = await lstat(input.filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (await sha256File(input.filePath)) !== input.sha256) {
    throw new Error('Qualification corpus WAV identity changed');
  }
  return Object.freeze({
    id: input.id,
    filePath: input.filePath,
    sizeBytes: metadata.size,
    sha256: input.sha256,
    durationNanoseconds: input.durationNanoseconds,
    language: input.language,
    locale: input.locale,
    ...(input.referenceText === undefined ? {} : { referenceText: input.referenceText }),
  });
}

async function loadCorpus(
  cacheRoot: string,
  workspaceRoot: string,
): Promise<{
  readonly corpus: QualificationCandidateSeed['corpus'];
  readonly performance: readonly QualificationAudioFixture[];
  readonly wer: readonly QualificationAudioFixture[];
}> {
  const fleursRoot = path.join(cacheRoot, 'fleurs');
  const corpusRoot = path.join(fleursRoot, 'corpus-v1');
  const manifest = record(
    await readCanonicalJson(path.join(corpusRoot, 'corpus-manifest.json')),
    'Qualification corpus manifest invalid',
  );
  if (manifest.schemaVersion !== 1 || manifest.commit !== FLEURS_COMMIT) {
    throw new Error('Qualification corpus source changed');
  }
  const wer: QualificationAudioFixture[] = [];
  for (const value of arrayField(manifest, 'clips', 'Qualification corpus clips invalid')) {
    const clip = record(value, 'Qualification corpus clip invalid');
    const id = stringField(clip, 'clipId', 'Qualification corpus clip ID invalid');
    const locale = stringField(clip, 'locale', 'Qualification corpus locale invalid');
    if (locale !== 'en_us' && locale !== 'ru_ru') throw new Error('Qualification corpus locale invalid');
    const sampleCount = integerField(clip, 'sampleCount', 'Qualification corpus sample count invalid');
    wer.push(
      await audioFixture({
        filePath: path.join(corpusRoot, 'clips', `${id}.wav`),
        id,
        sha256: digestField(clip, 'wavSha256', 'Qualification corpus clip digest invalid'),
        durationNanoseconds: (sampleCount * 1_000_000_000) / WAV_SAMPLE_RATE,
        language: locale === 'en_us' ? 'en' : 'ru',
        locale,
        referenceText: stringField(clip, 'referenceText', 'Qualification corpus reference invalid'),
      }),
    );
  }
  const performanceRecords = arrayField(manifest, 'performanceFixtures', 'Qualification performance corpus invalid');
  if (performanceRecords.length !== 5) throw new Error('Qualification performance corpus incomplete');
  const performance: QualificationAudioFixture[] = [];
  for (const value of performanceRecords) {
    const fixture = record(value, 'Qualification performance fixture invalid');
    const id = stringField(fixture, 'fixtureId', 'Qualification performance fixture ID invalid');
    performance.push(
      await audioFixture({
        filePath: path.join(corpusRoot, 'performance', `${id}.wav`),
        id,
        sha256: digestField(fixture, 'wavSha256', 'Qualification performance fixture digest invalid'),
        durationNanoseconds: integerField(fixture, 'durationNanoseconds', 'Qualification performance duration invalid'),
        language: 'en',
        locale: 'en_us',
      }),
    );
  }
  const license = record(manifest.license, 'Qualification corpus license invalid');
  return Object.freeze({
    corpus: Object.freeze({
      manifestDigest: digestField(manifest, 'corpusManifestDigest', 'Qualification corpus digest invalid'),
      noticeDigest: digestField(license, 'datasetCardSha256', 'Qualification corpus notice invalid'),
      materializerDigest: await sha256File(
        path.join(workspaceRoot, 'scripts/local-whisper/qualification/fleurs_materializer.py'),
      ),
      performanceFixtureDigest: sha256Bytes(serializeCanonicalLocalWhisperCatalogJson(performanceRecords)),
    }),
    performance: Object.freeze(performance),
    wer: Object.freeze(wer),
  });
}

async function loadRuntime(cacheRoot: string, backend: 'cpu' | 'cuda'): Promise<LoadedRuntime> {
  const runtimeRoot = path.join(cacheRoot, 'runtime-packs', backend);
  const pack = record(
    await readCanonicalJson(path.join(runtimeRoot, 'build-a', 'runtime-pack.json')),
    'Qualification runtime pack record invalid',
  );
  const archive = record(pack.archive, 'Qualification runtime archive invalid');
  const evidence = record(pack.evidence, 'Qualification runtime evidence invalid');
  const reproducibility = record(
    await readCanonicalJson(path.join(runtimeRoot, 'runtime-reproducibility.json')),
    'Qualification runtime reproducibility invalid',
  );
  const directRoot = path.join(cacheRoot, 'direct-engine', backend);
  const direct = record(
    await readCanonicalJson(path.join(directRoot, 'direct-engine-manifest.json')),
    'Qualification direct-engine manifest invalid',
  );
  if (
    direct.backend !== backend ||
    reproducibility.backend !== backend ||
    reproducibility.reproducible !== true ||
    reproducibility.cleanRootCount !== 2 ||
    direct.source === undefined
  ) {
    throw new Error('Qualification runtime evidence mismatch');
  }
  const archiveFile = stringField(archive, 'file', 'Qualification runtime archive file invalid');
  const archivePath = path.join(runtimeRoot, 'build-a', archiveFile);
  const archiveSizeBytes = integerField(archive, 'sizeBytes', 'Qualification runtime archive size invalid');
  const archiveSha256 = digestField(archive, 'sha256', 'Qualification runtime archive digest invalid');
  await exactFile(archivePath, archiveSizeBytes, archiveSha256, 'Qualification runtime archive changed');
  if (reproducibility.archiveSha256 !== archiveSha256) throw new Error('Qualification runtime digest mismatch');
  const profileId = stringField(pack, 'profileId', 'Qualification runtime profile invalid');
  if (direct.profileId !== profileId) throw new Error('Qualification direct-engine profile mismatch');
  const expectedFiles = expectedRuntimeFiles(
    arrayField(pack, 'expectedFiles', 'Qualification runtime file matrix invalid'),
  );
  const packRevision = qualificationRuntimeRevision(backend, profileId);
  const runtimeBuildDigest = digestField(direct, 'runtimeBuildDigest', 'Qualification runtime build invalid');
  const directBinary = record(direct.binary, 'Qualification direct-engine binary invalid');
  const directEngine: QualificationDirectEngine = Object.freeze({
    backend,
    executablePath: path.join(directRoot, 'bin', stringField(directBinary, 'fileName', 'Direct engine file invalid')),
    ...(backend === 'cuda' ? { runtimeLibraryPath: path.join(directRoot, 'lib') } : {}),
  });
  await exactFile(
    directEngine.executablePath,
    integerField(directBinary, 'sizeBytes', 'Direct engine size invalid'),
    digestField(directBinary, 'sha256', 'Direct engine digest invalid'),
    'Qualification direct engine changed',
  );
  const source = record(direct.source, 'Qualification direct-engine source invalid');
  if (source.commit !== SOURCE_COMMIT) throw new Error('Qualification direct-engine source changed');
  const directEngineManifestDigest = digestField(direct, 'manifestDigest', 'Direct engine manifest invalid');
  const directEngineBinarySha256 = digestField(directBinary, 'sha256', 'Direct engine digest invalid');
  const toolchainDigest = digestField(direct, 'toolchainDigest', 'Direct engine toolchain invalid');
  return Object.freeze({
    application: Object.freeze({ backend, packRevision }),
    bundle: Object.freeze({
      archivePath,
      catalog: Object.freeze({
        backend,
        buildRevision: runtimeBuildDigest,
        packRevision,
        expectedFiles,
        prerequisites:
          backend === 'cpu'
            ? Object.freeze(['glibc-2.31'])
            : Object.freeze(['nvidia-driver-r570', 'cuda-runtime-12.8.1']),
        provenanceId: `qualification-${backend}-runtime-provenance`,
        sbomRevision: `qualification-${backend}-runtime-sbom-v1`,
        noticeIds: Object.freeze([`qualification-${backend}-runtime-notice`]),
        licenseIds: Object.freeze(['mit-license']),
      }),
    }),
    directEngine,
    directEngineBinarySha256,
    directEngineManifestDigest,
    platformArtifact: Object.freeze({
      artifactId: `qualification-runtime-${backend}`,
      revision: packRevision,
      backend,
      transferProfile: 'restricted-tar-gzip-v1',
      sizeBytes: archiveSizeBytes,
      sha256: archiveSha256,
      manifestDigest: digestField(evidence, 'runtimeManifestSha256', 'Runtime manifest digest invalid'),
      signatureInputDigest: digestField(archive, 'signatureInputSha256', 'Runtime signature input invalid'),
      reproducibilityDigest: digestField(
        reproducibility,
        'reproducibilityDigest',
        'Runtime reproducibility digest invalid',
      ),
    }),
    profileId,
    toolchainDigest,
  });
}

export function qualificationRuntimeRevision(backend: 'cpu' | 'cuda', profileId: string): LocalWhisperRevisionId {
  if (profileId !== RUNTIME_PROFILE_IDS[backend]) {
    throw new Error('Qualification runtime profile invalid');
  }
  const revision = toLocalWhisperRevisionId(`whisper-cpp-${profileId}`);
  if (!revision) throw new Error('Qualification runtime revision invalid');
  return revision;
}

/** Loads only exact, previously materialized private qualification inputs. */
export class LinuxQualificationEvidenceLoader {
  public async load(cacheRoot: string, workspaceRoot: string): Promise<LoadedLinuxQualificationEvidence> {
    if (!path.isAbsolute(cacheRoot) || !path.isAbsolute(workspaceRoot)) {
      throw new Error('Qualification evidence roots must be absolute');
    }
    const [models, corpus, cpu, cuda] = await Promise.all([
      loadModels(cacheRoot),
      loadCorpus(cacheRoot, workspaceRoot),
      loadRuntime(cacheRoot, 'cpu'),
      loadRuntime(cacheRoot, 'cuda'),
    ]);
    const runtimes = Object.freeze([cpu, cuda]);
    const directEngineArtifacts = Object.freeze(
      runtimes.map((runtime) => ({
        backend: runtime.application.backend,
        binarySha256: runtime.directEngineBinarySha256,
        manifestDigest: runtime.directEngineManifestDigest,
        sourceCommit: SOURCE_COMMIT,
        toolchainDigest: runtime.toolchainDigest,
      })),
    );
    return Object.freeze({
      application: Object.freeze({
        models: models.application,
        runtimes: Object.freeze(runtimes.map(({ application }) => application)),
        directEngines: Object.freeze(runtimes.map(({ directEngine }) => directEngine)),
        werFixtures: corpus.wer,
        performanceFixtures: corpus.performance,
        cpuThreads: Math.max(1, Math.trunc(availableParallelism())),
      }),
      cachedModels: models.cached,
      candidateCorpus: corpus.corpus,
      directEngineArtifacts,
      modelNoticeDigest: await sha256File(
        path.resolve(
          cacheRoot,
          '..',
          'native-sources/sha256/aeaed8ce38467815c0b3ee64f05bd7989bba42bb0baccd5dba853247a7f680de/LICENSE',
        ),
      ),
      modelSetManifestDigest: models.manifestDigest,
      runtimes,
    });
  }
}
