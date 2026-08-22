import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import * as path from 'node:path';

import {
  DeterministicRuntimePackProducer,
  assertReproducibleRuntimePacks,
  type QualificationRuntimePackRecord,
} from '../qualification/DeterministicRuntimePackProducer';
import { sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';

export type ProductionRuntimePlatform = 'linux' | 'win32';
export type ProductionRuntimeTarget = 'cpu' | 'sm_120a-real';

export interface ProductionRuntimeArchive {
  readonly archive: {
    readonly file: string;
    readonly sha256: string;
    readonly signatureInputSha256: string;
    readonly sizeBytes: number;
  };
  readonly platform: ProductionRuntimePlatform;
  readonly profileId: string;
  readonly purpose: 'production';
  readonly reproducible: true;
  readonly expectedFiles: QualificationRuntimePackRecord['expectedFiles'];
  readonly evidence: QualificationRuntimePackRecord['evidence'];
  readonly target: ProductionRuntimeTarget;
  readonly transferProfile: 'restricted-tar-gzip-v1';
}

function profileFor(platform: ProductionRuntimePlatform, target: ProductionRuntimeTarget): string {
  if (platform === 'linux' && target === 'cpu') return 'linux-x64-cpu-baseline-v1';
  if (platform === 'linux' && target === 'sm_120a-real') return 'linux-x64-cuda-12.8.1-sm120a-v1';
  if (platform === 'win32' && target === 'cpu') return 'windows-x64-cpu-msvc-19.51-v1';
  return 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1';
}

function archiveFile(platform: ProductionRuntimePlatform, target: ProductionRuntimeTarget): string {
  return `gpt-voice-local-whisper-${platform}-x64-${target}.tar.gz`;
}

function recordFrom(
  pack: QualificationRuntimePackRecord,
  platform: ProductionRuntimePlatform,
  target: ProductionRuntimeTarget,
): ProductionRuntimeArchive {
  return Object.freeze({
    archive: {
      file: archiveFile(platform, target),
      sha256: pack.archive.sha256,
      signatureInputSha256: pack.archive.signatureInputSha256,
      sizeBytes: pack.archive.sizeBytes,
    },
    platform,
    profileId: profileFor(platform, target),
    purpose: 'production',
    reproducible: true,
    expectedFiles: Object.freeze(pack.expectedFiles.map((entry) => Object.freeze({ ...entry }))),
    evidence: Object.freeze({ ...pack.evidence }),
    target,
    transferProfile: 'restricted-tar-gzip-v1',
  });
}

/**
 * Materializes independently rebuilt runtime stages into deterministic production-candidate archive bytes.
 * Signing is deliberately outside this class: only the protected signer may turn its digest-bound output
 * into a release asset.
 */
export class ProductionRuntimeArchiveProducer {
  private readonly packProducer = new DeterministicRuntimePackProducer();

  public static profileFor(platform: ProductionRuntimePlatform, target: ProductionRuntimeTarget): string {
    return profileFor(platform, target);
  }

  public async collectVerifiedPack(input: {
    readonly outputDirectory: string;
    readonly pack: QualificationRuntimePackRecord;
    readonly packDirectory: string;
    readonly platform: ProductionRuntimePlatform;
    readonly target: ProductionRuntimeTarget;
  }): Promise<ProductionRuntimeArchive> {
    const expectedProfileId = profileFor(input.platform, input.target);
    if (
      input.pack.profileId !== expectedProfileId ||
      input.pack.transferProfile !== 'restricted-tar-gzip-v1' ||
      input.pack.archive.signatureInputSha256 !== input.pack.archive.sha256
    ) {
      throw new Error('Production runtime pack identity is invalid');
    }
    const outputDirectory = path.resolve(input.outputDirectory);
    await mkdir(outputDirectory, { mode: 0o700 });
    const record = recordFrom(input.pack, input.platform, input.target);
    const outputArchive = path.join(outputDirectory, record.archive.file);
    await copyFile(path.join(path.resolve(input.packDirectory), input.pack.archive.file), outputArchive, 0);
    if ((await sha256File(outputArchive)) !== record.archive.sha256) {
      throw new Error('Production runtime archive identity changed while collecting output');
    }
    await writeCanonicalJson(path.join(outputDirectory, 'runtime-archive.json'), record);
    return record;
  }

  public async produce(input: {
    readonly firstStageRoot: string;
    readonly outputDirectory: string;
    readonly platform: ProductionRuntimePlatform;
    readonly secondStageRoot: string;
    readonly target: ProductionRuntimeTarget;
  }): Promise<ProductionRuntimeArchive> {
    const firstStageRoot = path.resolve(input.firstStageRoot);
    const secondStageRoot = path.resolve(input.secondStageRoot);
    if (firstStageRoot === secondStageRoot) {
      throw new Error('Production runtime archive requires independent clean stage roots');
    }
    const outputDirectory = path.resolve(input.outputDirectory);
    await mkdir(path.dirname(outputDirectory), { mode: 0o700, recursive: true });
    const temporaryRoot = await mkdtemp(path.join(path.dirname(outputDirectory), '.production-runtime-'));
    try {
      const profileId = profileFor(input.platform, input.target);
      const firstDirectory = path.join(temporaryRoot, 'first');
      const secondDirectory = path.join(temporaryRoot, 'second');
      const [first, second] = await Promise.all([
        this.packProducer.produce({ stageRoot: firstStageRoot, outputDirectory: firstDirectory, profileId }),
        this.packProducer.produce({ stageRoot: secondStageRoot, outputDirectory: secondDirectory, profileId }),
      ]);
      await assertReproducibleRuntimePacks(first, second, firstDirectory, secondDirectory);

      return await this.collectVerifiedPack({
        outputDirectory,
        pack: first,
        packDirectory: firstDirectory,
        platform: input.platform,
        target: input.target,
      });
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  }
}
