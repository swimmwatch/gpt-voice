import { lstat, readdir } from 'node:fs/promises';
import * as path from 'node:path';

import { isRecord, isSha256 } from '../packaging/contracts';
import { readCanonicalJson, sha256File } from '../packaging/fileIntegrity';
import { LocalWhisperQualificationValidator } from './QualificationContracts';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const qualificationRoot = path.join(workspaceRoot, 'docs', 'specs', 'local-whisper', 'qualification');
const artifactRoot = path.join(workspaceRoot, '.cache', 'local-whisper', 'qualification', 'direct-engine');

async function verifyFile(filePath: string, expectedSize: unknown, expectedSha256: unknown): Promise<void> {
  if (!Number.isSafeInteger(expectedSize) || (expectedSize as number) <= 0 || !isSha256(expectedSha256)) {
    throw new Error('Direct-engine file identity is invalid');
  }
  const metadata = await lstat(filePath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size !== expectedSize ||
    (await sha256File(filePath)) !== expectedSha256
  ) {
    throw new Error('Direct-engine staged file identity changed');
  }
}

async function verifyBackend(backend: 'cpu' | 'cuda'): Promise<string> {
  const root = path.join(artifactRoot, backend);
  const manifest = await readCanonicalJson(path.join(root, 'direct-engine-manifest.json'));
  new LocalWhisperQualificationValidator(qualificationRoot).validateDocument('directEngineManifest', manifest);
  if (!isRecord(manifest) || manifest.backend !== backend || !isRecord(manifest.binary)) {
    throw new Error('Direct-engine backend manifest mismatch');
  }
  await verifyFile(
    path.join(root, 'bin', String(manifest.binary.fileName)),
    manifest.binary.sizeBytes,
    manifest.binary.sha256,
  );
  if (!Array.isArray(manifest.libraries)) throw new Error('Direct-engine library manifest is invalid');
  for (const library of manifest.libraries) {
    if (!isRecord(library)) throw new Error('Direct-engine library record is invalid');
    await verifyFile(path.join(root, 'lib', String(library.fileName)), library.sizeBytes, library.sha256);
  }
  const allowedRootEntries =
    backend === 'cpu' ? ['bin', 'direct-engine-manifest.json'] : ['bin', 'direct-engine-manifest.json', 'lib'];
  const actualRootEntries = (await readdir(root)).sort((left, right) => left.localeCompare(right, 'en'));
  if (JSON.stringify(actualRootEntries) !== JSON.stringify(allowedRootEntries.sort())) {
    throw new Error('Unexpected direct-engine staged file');
  }
  if (typeof manifest.manifestDigest !== 'string') throw new Error('Direct-engine manifest digest missing');
  return manifest.manifestDigest;
}

async function main(): Promise<void> {
  const [cpu, cuda] = await Promise.all([verifyBackend('cpu'), verifyBackend('cuda')]);
  process.stdout.write(`${JSON.stringify({ cpuManifestDigest: cpu, cudaManifestDigest: cuda })}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Direct-engine verification failed'}\n`);
  process.exitCode = 1;
});
