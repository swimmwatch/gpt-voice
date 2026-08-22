import { lstat, mkdir, open } from 'node:fs/promises';
import * as path from 'node:path';

import {
  assertReproducibleRuntimePacks,
  type QualificationRuntimePackRecord,
} from '../qualification/DeterministicRuntimePackProducer';
import { isRecord, isSafeRelativePath, isSha256 } from '../packaging/contracts';
import { readCanonicalJson, sha256File } from '../packaging/fileIntegrity';
import {
  ProductionRuntimeArchiveProducer,
  type ProductionRuntimeArchive,
  type ProductionRuntimePlatform,
  type ProductionRuntimeTarget,
} from './ProductionRuntimeArchiveProducer';

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

async function readPrefix(filePath: string, length: number): Promise<Buffer> {
  const handle = await open(filePath, 'r');
  try {
    const prefix = Buffer.alloc(length);
    const { bytesRead } = await handle.read(prefix, 0, length, 0);
    return prefix.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function parsePackRecord(value: unknown, expectedProfileId: string): QualificationRuntimePackRecord {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.profileId !== expectedProfileId ||
    value.transferProfile !== 'restricted-tar-gzip-v1' ||
    !isRecord(value.archive) ||
    !isSafeRelativePath(value.archive.file) ||
    path.basename(value.archive.file) !== value.archive.file ||
    !isPositiveSafeInteger(value.archive.sizeBytes) ||
    !isSha256(value.archive.sha256) ||
    value.archive.signatureInputSha256 !== value.archive.sha256 ||
    !Array.isArray(value.expectedFiles) ||
    value.expectedFiles.length === 0 ||
    !isRecord(value.evidence)
  ) {
    throw new Error('Hosted production runtime pack record is invalid');
  }
  return value as unknown as QualificationRuntimePackRecord;
}

async function verifiedPack(directory: string, profileId: string): Promise<QualificationRuntimePackRecord> {
  const resolvedDirectory = path.resolve(directory);
  const record = parsePackRecord(await readCanonicalJson(path.join(resolvedDirectory, 'runtime-pack.json')), profileId);
  const archivePath = path.join(resolvedDirectory, record.archive.file);
  const [metadata, prefix, digest] = await Promise.all([
    lstat(archivePath),
    readPrefix(archivePath, GZIP_MAGIC.byteLength),
    sha256File(archivePath),
  ]);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size !== record.archive.sizeBytes ||
    !prefix.equals(GZIP_MAGIC) ||
    digest !== record.archive.sha256
  ) {
    throw new Error('Hosted production runtime archive identity is invalid');
  }
  return record;
}

/** Admits only independently reproduced runtime-pack output from the current hosted runner. */
export class HostedProductionRuntimeArchiveCollector {
  public async collect(input: {
    readonly firstPackDirectory: string;
    readonly outputDirectory: string;
    readonly platform: ProductionRuntimePlatform;
    readonly secondPackDirectory: string;
    readonly target: ProductionRuntimeTarget;
  }): Promise<ProductionRuntimeArchive> {
    const profileId = ProductionRuntimeArchiveProducer.profileFor(input.platform, input.target);
    const firstDirectory = path.resolve(input.firstPackDirectory);
    const secondDirectory = path.resolve(input.secondPackDirectory);
    if (firstDirectory === secondDirectory) {
      throw new Error('Hosted production runtime collection requires independent pack directories');
    }
    const [first, second] = await Promise.all([
      verifiedPack(firstDirectory, profileId),
      verifiedPack(secondDirectory, profileId),
    ]);
    await assertReproducibleRuntimePacks(first, second, firstDirectory, secondDirectory);

    const outputDirectory = path.resolve(input.outputDirectory);
    await mkdir(path.dirname(outputDirectory), { recursive: true, mode: 0o700 });
    return new ProductionRuntimeArchiveProducer().collectVerifiedPack({
      outputDirectory,
      pack: first,
      packDirectory: firstDirectory,
      platform: input.platform,
      target: input.target,
    });
  }
}
