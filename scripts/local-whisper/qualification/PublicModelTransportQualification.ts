import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, rename, stat, unlink } from 'node:fs/promises';
import * as path from 'node:path';

import {
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactHttpClient,
  type ArtifactHttpClientRequest,
  type ArtifactHttpClientResponse,
  type LocalWhisperArtifactDownloadSpec,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { CatalogHttpTransport } from '@main/localWhisper/artifacts/CatalogHttpTransport';
import { FileBackedArtifactStreamingWorker } from '@main/localWhisper/artifacts/FileBackedArtifactStreamingWorker';
import { NodeArtifactHttpClient } from '@main/localWhisper/artifacts/NodeArtifactHttpClient';
import {
  LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
  LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
  localWhisperUpstreamModelUrl,
  type LocalWhisperReleaseModelIdentity,
} from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { toLocalWhisperArtifactId, toLocalWhisperRevisionId } from '@shared/localWhisper';

import { sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';

const CANCEL_AFTER_BYTES = 4 * 1024 * 1024;
const MODEL_POLICY_ID = toLocalWhisperArtifactId('public-hugging-face-model-policy-v1')!;
const MODEL_ORIGIN_ID = toLocalWhisperArtifactId('public-hugging-face-model-origin')!;
const MODEL_ORIGIN = 'https://huggingface.co';

const clock: ArtifactClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

class RecordingArtifactHttpClient implements ArtifactHttpClient {
  public readonly hosts: string[] = [];
  public rangeRequestCount = 0;

  public constructor(private readonly client: ArtifactHttpClient) {}

  public async open(input: ArtifactHttpClientRequest): Promise<ArtifactHttpClientResponse> {
    const url = new URL(input.url);
    this.hosts.push(url.hostname);
    if (input.rangeStart !== null) this.rangeRequestCount += 1;
    return await this.client.open(input);
  }
}

export function createPublicModelDownloadSpec(
  model: LocalWhisperReleaseModelIdentity,
): LocalWhisperArtifactDownloadSpec {
  const artifactId = toLocalWhisperArtifactId(`model-${model.family}-${model.variant}`)!;
  const fileId = toLocalWhisperArtifactId(`model-data-${model.family}-${model.variant}`)!;
  const expectedFiles = [
    {
      fileId,
      kind: 'data' as const,
      mode: 0o600,
      sizeBytes: model.sizeBytes,
      sha256: model.sha256,
    },
  ];
  const identityKey = [model.family, model.variant, LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT].join('|');
  return {
    artifactId,
    catalogRevision: toLocalWhisperRevisionId('qualification-catalog-v2.4.0')!,
    descriptor: {
      artifactId,
      canonicalName: `model-${createHash('sha256').update(identityKey).digest('hex')}`,
      catalogDigest: 'a'.repeat(64),
      expectedFiles,
      identityKey,
      kind: 'model',
      namespace: 'models',
    },
    expandedSizeBytes: model.sizeBytes,
    expectedFiles,
    expectedTransferSha256: model.sha256,
    expectedTransferSizeBytes: model.sizeBytes,
    originId: MODEL_ORIGIN_ID,
    origin: MODEL_ORIGIN,
    requestUrl: localWhisperUpstreamModelUrl(model.file),
    redirectPolicy: {
      id: MODEL_POLICY_ID,
      initialScheme: 'https',
      initialHost: 'huggingface.co',
      initialPort: 443,
      initialPathPrefix: `/${LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY}/resolve/${LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT}/`,
      maxRedirects: 5,
      allowedTargets: [{ host: 'us.aws.cdn.hf.co', port: 443, pathPrefix: '/xet-bridge-us/' }],
      forwardRangeHeaders: true,
      credentialForwarding: false,
    },
    transferProfile: 'pinned-raw-model-v1',
    artifactSignature: null,
  };
}

export async function hashQualificationArtifactEntry(entry: {
  readonly chunks: AsyncIterable<Uint8Array>;
}): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of entry.chunks) digest.update(chunk);
  return digest.digest('hex');
}

export async function installVerifiedQualificationModel(
  spoolPath: string,
  destination: string,
  expectedSha256: string,
): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  try {
    const current = await lstat(destination);
    if (current.isFile() && !current.isSymbolicLink() && (await sha256File(destination)) === expectedSha256) return;
    throw new Error('Existing Local Whisper qualification model identity mismatch');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = `${destination}.partial`;
  await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await copyFile(spoolPath, temporary, 0);
  await chmod(temporary, 0o400);
  if ((await sha256File(temporary)) !== expectedSha256) {
    await unlink(temporary);
    throw new Error('Copied Local Whisper qualification model identity mismatch');
  }
  await rename(temporary, destination);
}

export interface PublicModelTransportEvidence {
  readonly schemaVersion: 1;
  readonly repository: typeof LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY;
  readonly commit: typeof LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT;
  readonly file: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly redirectHosts: readonly string[];
  readonly cancellationObserved: true;
  readonly cancelledAtBytes: number;
  readonly resumeObserved: true;
  readonly rangeRequestCount: number;
  readonly validatorSha256: string;
  readonly credentialsUsed: false;
  readonly privateHeadersUsed: false;
}

/** Exercises public redirect, cancellation, resume, and whole-object verification using production adapters. */
export class PublicModelTransportQualification {
  public async run(input: {
    readonly model: LocalWhisperReleaseModelIdentity;
    readonly workRoot: string;
    readonly modelCacheRoot: string;
  }): Promise<PublicModelTransportEvidence> {
    const spec = createPublicModelDownloadSpec(input.model);
    const spoolRoot = path.join(input.workRoot, 'spool');
    await mkdir(spoolRoot, { recursive: true, mode: 0o700 });
    const client = new RecordingArtifactHttpClient(new NodeArtifactHttpClient());
    const transport = new CatalogHttpTransport({ client, clock });
    const worker = new FileBackedArtifactStreamingWorker(spoolRoot);
    const spoolId = 'public-model-resume-v1';
    const firstController = new AbortController();
    const first = await transport.open(spec, null, firstController.signal);
    let firstValidator: string;
    let partialSize: number;
    let cancelledAtBytes = 0;
    const spoolPath = path.join(spoolRoot, `spool-${spoolId}.partial`);
    try {
      if (!first.validator) throw new Error('Public model transport did not provide an immutable validator');
      firstValidator = first.validator;
      await assertCancelled(
        worker.process({
          artifactId: spec.artifactId,
          expectedFiles: spec.expectedFiles,
          expectedTransferSha256: spec.expectedTransferSha256,
          expectedTransferSizeBytes: spec.expectedTransferSizeBytes,
          operationId: spoolId,
          resume: null,
          signal: firstController.signal,
          stream: first.body,
          transferProfile: spec.transferProfile,
          validationMode: 'authenticated',
          onProgress: (receivedBytes) => {
            cancelledAtBytes = receivedBytes;
            if (receivedBytes >= CANCEL_AFTER_BYTES) firstController.abort();
            return Promise.resolve();
          },
        }),
      );
      const partial = await stat(spoolPath);
      if (
        partial.size !== cancelledAtBytes ||
        partial.size < CANCEL_AFTER_BYTES ||
        partial.size >= input.model.sizeBytes
      ) {
        throw new Error('Public model cancellation did not preserve an exact resumable prefix');
      }
      partialSize = partial.size;
    } finally {
      await first.dispose().catch(() => undefined);
    }

    const secondController = new AbortController();
    const resumed = await transport.open(
      spec,
      { offset: partialSize, validator: firstValidator },
      secondController.signal,
    );
    try {
      const result = await worker.process({
        artifactId: spec.artifactId,
        expectedFiles: spec.expectedFiles,
        expectedTransferSha256: spec.expectedTransferSha256,
        expectedTransferSizeBytes: spec.expectedTransferSizeBytes,
        operationId: 'public-model-resume-complete-v1',
        resume: { offset: partialSize, spoolId },
        signal: secondController.signal,
        stream: resumed.body,
        transferProfile: spec.transferProfile,
        validationMode: 'authenticated',
        onProgress: () => Promise.resolve(),
      });
      const entry = result.entries[0];
      if (
        result.receivedBytes !== input.model.sizeBytes ||
        result.transferSha256 !== input.model.sha256 ||
        result.entries.length !== 1 ||
        !entry ||
        (await hashQualificationArtifactEntry(entry)) !== input.model.sha256
      ) {
        throw new Error('Public model whole-object verification failed');
      }
      await installVerifiedQualificationModel(
        spoolPath,
        path.join(input.modelCacheRoot, input.model.file),
        input.model.sha256,
      );
      await worker.discard(spoolId);
    } finally {
      await resumed.dispose().catch(() => undefined);
    }
    const redirectHosts = [...new Set(client.hosts)];
    if (!redirectHosts.includes('huggingface.co') || !redirectHosts.includes('us.aws.cdn.hf.co')) {
      throw new Error('Public model transport did not exercise the signed redirect policy');
    }
    return Object.freeze({
      schemaVersion: 1,
      repository: LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY,
      commit: LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT,
      file: input.model.file,
      sizeBytes: input.model.sizeBytes,
      sha256: input.model.sha256,
      redirectHosts,
      cancellationObserved: true,
      cancelledAtBytes,
      resumeObserved: true,
      rangeRequestCount: client.rangeRequestCount,
      validatorSha256: createHash('sha256').update(firstValidator, 'utf8').digest('hex'),
      credentialsUsed: false,
      privateHeadersUsed: false,
    });
  }
}

async function assertCancelled(operation: Promise<unknown>): Promise<void> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof LocalWhisperArtifactLifecycleError && error.code === 'DOWNLOAD_CANCELLED') return;
    throw error;
  }
  throw new Error('Public model cancellation was not observed');
}

export async function writePublicModelTransportEvidence(
  evidencePath: string,
  evidence: PublicModelTransportEvidence,
): Promise<void> {
  await mkdir(path.dirname(evidencePath), { recursive: true, mode: 0o700 });
  await writeCanonicalJson(evidencePath, evidence);
  await chmod(evidencePath, 0o600);
}
