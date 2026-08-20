import { access, chmod, copyFile, lstat, mkdir, mkdtemp, rm } from 'node:fs/promises';
import * as path from 'node:path';

import type { ArtifactClock } from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { CatalogHttpTransport } from '@main/localWhisper/artifacts/CatalogHttpTransport';
import { FileBackedArtifactStreamingWorker } from '@main/localWhisper/artifacts/FileBackedArtifactStreamingWorker';
import { NodeArtifactHttpClient } from '@main/localWhisper/artifacts/NodeArtifactHttpClient';
import {
  LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
  LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
  LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
  localWhisperUpstreamModelUrl,
  type LocalWhisperReleaseModelIdentity,
} from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { sha256Bytes, sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';
import {
  createPublicModelDownloadSpec,
  hashQualificationArtifactEntry,
  installVerifiedQualificationModel,
} from './PublicModelTransportQualification';

const clock: ArtifactClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface PinnedModelSetManifest {
  readonly schemaVersion: 1;
  readonly repository: typeof LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY;
  readonly commit: typeof LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT;
  readonly transferProfile: 'pinned-raw-model-v1';
  readonly models: readonly (LocalWhisperReleaseModelIdentity & {
    readonly sourceUrl: string;
    readonly verification: 'exact-local-import' | 'production-public-https';
  })[];
  readonly manifestDigest: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function verifiedFile(filePath: string, model: LocalWhisperReleaseModelIdentity): Promise<boolean> {
  try {
    const metadata = await lstat(filePath);
    return (
      metadata.isFile() &&
      !metadata.isSymbolicLink() &&
      metadata.size === model.sizeBytes &&
      (await sha256File(filePath)) === model.sha256
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Materializes the closed six-model set without conversion, quantization, or path-derived authority. */
export class PinnedModelSetMaterializer {
  public async materialize(input: {
    readonly cacheRoot: string;
    readonly workRoot: string;
    readonly importRoot?: string;
  }): Promise<PinnedModelSetManifest> {
    await mkdir(input.cacheRoot, { recursive: true, mode: 0o700 });
    await mkdir(input.workRoot, { recursive: true, mode: 0o700 });
    const records = [];
    for (const model of LOCAL_WHISPER_RELEASE_MODEL_MATRIX) {
      const destination = path.join(input.cacheRoot, model.file);
      let verification: 'exact-local-import' | 'production-public-https';
      if (await verifiedFile(destination, model)) {
        verification = 'exact-local-import';
      } else if (input.importRoot && (await this.import(model, input.importRoot, destination))) {
        verification = 'exact-local-import';
      } else {
        await this.download(model, input.workRoot, destination);
        verification = 'production-public-https';
      }
      records.push({ ...model, sourceUrl: localWhisperUpstreamModelUrl(model.file), verification });
    }
    const unsigned = {
      schemaVersion: 1 as const,
      repository: LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
      commit: LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
      transferProfile: 'pinned-raw-model-v1' as const,
      models: records,
    };
    const manifest: PinnedModelSetManifest = {
      ...unsigned,
      manifestDigest: sha256Bytes(serializeCanonicalLocalWhisperCatalogJson(unsigned)),
    };
    await writeCanonicalJson(path.join(input.cacheRoot, 'model-set-manifest.json'), manifest);
    return Object.freeze(manifest);
  }

  private async import(
    model: LocalWhisperReleaseModelIdentity,
    importRoot: string,
    destination: string,
  ): Promise<boolean> {
    const source = path.resolve(importRoot, model.file);
    if (!(await exists(source))) return false;
    if (!(await verifiedFile(source, model)))
      throw new Error(`Imported Local Whisper model identity mismatch: ${model.file}`);
    const temporary = `${destination}.importing`;
    await rm(temporary, { force: true });
    await copyFile(source, temporary);
    await chmod(temporary, 0o400);
    await installVerifiedQualificationModel(temporary, destination, model.sha256);
    await rm(temporary, { force: true });
    return true;
  }

  private async download(
    model: LocalWhisperReleaseModelIdentity,
    workRoot: string,
    destination: string,
  ): Promise<void> {
    const modelWorkRoot = await mkdtemp(path.join(workRoot, `model-${model.family}-`));
    const worker = new FileBackedArtifactStreamingWorker(modelWorkRoot);
    const spec = createPublicModelDownloadSpec(model);
    const controller = new AbortController();
    let transport: Awaited<ReturnType<CatalogHttpTransport['open']>> | null = null;
    try {
      transport = await new CatalogHttpTransport({ client: new NodeArtifactHttpClient(), clock }).open(
        spec,
        null,
        controller.signal,
      );
      const result = await worker.process({
        artifactId: spec.artifactId,
        expectedFiles: spec.expectedFiles,
        expectedTransferSha256: spec.expectedTransferSha256,
        expectedTransferSizeBytes: spec.expectedTransferSizeBytes,
        operationId: `download-${model.family}-${model.variant}`,
        resume: null,
        signal: controller.signal,
        stream: transport.body,
        transferProfile: spec.transferProfile,
        validationMode: 'authenticated',
        onProgress: () => Promise.resolve(),
      });
      const entry = result.entries[0];
      if (!entry || result.entries.length !== 1 || (await hashQualificationArtifactEntry(entry)) !== model.sha256) {
        throw new Error(`Downloaded Local Whisper model identity mismatch: ${model.file}`);
      }
      const spoolPath = path.join(modelWorkRoot, `spool-download-${model.family}-${model.variant}.partial`);
      await installVerifiedQualificationModel(spoolPath, destination, model.sha256);
    } finally {
      if (transport) await transport.dispose().catch(() => undefined);
      controller.abort();
      await rm(modelWorkRoot, { recursive: true, force: true });
    }
  }
}
