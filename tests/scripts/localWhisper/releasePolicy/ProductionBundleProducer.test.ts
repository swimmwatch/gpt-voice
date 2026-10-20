import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { BundleVerifier } from '@scripts/local-whisper/packaging/BundleVerifier';
import { PackageStager } from '@scripts/local-whisper/packaging/PackageStager';
import { LocalWhisperPackagedCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperPackagedCatalog';
import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { ProductionLocalWhisperEnvironmentFactory } from '@main/localWhisper/composition/createProductionLocalWhisperEnvironment';
import { LOCAL_WHISPER_WORKER_PROTOCOL_VERSION } from '@shared/localWhisper';
import { sha256Bytes, writeCanonicalJson } from '@scripts/local-whisper/packaging/fileIntegrity';
import { ProductionBundleProducer } from '@scripts/local-whisper/release-policy/ProductionBundleProducer';
import {
  ProductionRuntimeArchiveProducer,
  type ProductionRuntimePlatform,
  type ProductionRuntimeTarget,
} from '@scripts/local-whisper/release-policy/ProductionRuntimeArchiveProducer';
import { ProductionSigningAuthority } from '@scripts/local-whisper/release-policy/ProductionSigningAuthority';

function authority(): ProductionSigningAuthority {
  const pair = generateKeyPairSync('ed25519');
  return new ProductionSigningAuthority(
    'production-test-ed25519-v1',
    pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  );
}

async function runtime(
  root: string,
  platform: ProductionRuntimePlatform,
  target: ProductionRuntimeTarget,
): Promise<string> {
  const directory = path.join(root, target);
  const file = `gpt-voice-local-whisper-${platform}-x64-${target}.tar.gz`;
  const bytes = Buffer.from(`production ${target} runtime`, 'utf8');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), bytes);
  const cpu = target === 'cpu';
  await writeCanonicalJson(path.join(directory, 'runtime-archive.json'), {
    archive: {
      file,
      sha256: sha256Bytes(bytes),
      signatureInputSha256: sha256Bytes(bytes),
      sizeBytes: bytes.byteLength,
    },
    evidence: {
      noticesSha256: (cpu ? '1' : '2').repeat(64),
      provenanceSha256: (cpu ? '3' : '4').repeat(64),
      runtimeManifestSha256: (cpu ? '5' : '6').repeat(64),
      sbomSha256: (cpu ? '7' : '8').repeat(64),
    },
    expectedFiles: [
      {
        fileId: 'worker',
        kind: 'executable',
        mode: 0o500,
        sha256: (cpu ? '9' : 'a').repeat(64),
        sizeBytes: 123,
      },
    ],
    platform,
    profileId: ProductionRuntimeArchiveProducer.profileFor(platform, target),
    purpose: 'production',
    reproducible: true,
    target,
    transferProfile: 'restricted-tar-gzip-v1',
  });
  return directory;
}

describe('ProductionBundleProducer', () => {
  for (const platform of ['linux', 'win32'] as const) {
    it(`creates a verified signed ${platform} bundle and activates its packaged catalog boundary`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-production-bundle-'));
      try {
        const [cpu, cuda] = await Promise.all([
          runtime(root, platform, 'cpu'),
          runtime(root, platform, 'sm_120a-real'),
        ]);
        const output = path.join(root, 'bundle');
        const result = await new ProductionBundleProducer(authority()).produce({
          appRevision: '1.4.0',
          approvedAt: '2026-08-22T00:00:00.000Z',
          approvedBy: 'release-maintainer',
          outputDirectory: output,
          platform,
          releaseTarget: 'task32-protected-candidate',
          runtimeDirectories: { cpu, 'sm_120a-real': cuda },
          sourceCommit: 'a'.repeat(40),
        });

        const verified = await new BundleVerifier().verify(output, {
          purpose: 'production',
          manifestSha256: result.bundleManifestSha256,
        });
        await new BundleVerifier().verifyProductionApproval(verified);
        assert.equal(verified.runtimePacks.length, 2);
        assert.equal(verified.modelPack, null);
        await assert.rejects(readFile(path.join(output, 'model-pack.manifest.json')), /ENOENT/u);
        const catalog = await readFile(path.join(output, 'catalog.json'), 'utf8');
        assert.match(catalog, /production-test-ed25519-v1/u);
        assert.doesNotMatch(catalog, /BEGIN PRIVATE KEY/u);
        const envelope = JSON.parse(catalog) as { readonly payloadBase64: string };
        const payload = JSON.parse(Buffer.from(envelope.payloadBase64, 'base64').toString('utf8')) as {
          readonly runtimes: readonly { readonly source: { readonly file: string; readonly url: string } }[];
        };
        for (const target of ['cpu', 'sm_120a-real']) {
          const publishedFile = `${platform}-gpt-voice-local-whisper-${platform}-x64-${target}.tar.gz`;
          assert.ok(payload.runtimes.some(({ source }) => source.file === publishedFile));
          assert.ok(payload.runtimes.some(({ source }) => source.url.endsWith(`/${publishedFile}`)));
        }

        const helper = path.join(root, 'unused-helper');
        await writeFile(helper, 'test-only helper bytes');
        const stagingRoot = path.join(root, 'staged');
        const stager = new PackageStager();
        await stager.stage({
          mode: 'production',
          platform,
          bundleDirectory: output,
          expectedBundleManifestSha256: result.bundleManifestSha256,
          outputDirectory: stagingRoot,
          helpers: { filesystemGuard: helper, launcher: helper, license: helper },
        });
        const resourcesPath = path.join(root, 'resources');
        await mkdir(resourcesPath);
        await cp(path.join(stagingRoot, 'shared'), path.join(resourcesPath, 'local-whisper'), { recursive: true });
        const packaged = new LocalWhisperPackagedCatalogRepository({
          bundleManifestSha256: result.bundleManifestSha256,
          appRevision: '1.4.0',
          platform,
          resourcesPath,
          readFile,
          workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
        });
        const loaded = await packaged.load();
        assert.ok(loaded);
        const repository = new LocalWhisperCatalogRepository({
          readDocument: () => loaded.document,
          trustPolicy: loaded.trustPolicy,
        });
        assert.equal(repository.load().success, true);

        const reads: string[] = [];
        const factory = new ProductionLocalWhisperEnvironmentFactory(
          {
            appRevision: '1.4.0',
            architecture: 'x64',
            platform,
            resourcesPath,
            availableMemoryBytes: () => 8 * 1024 ** 3,
            availableVramBytes: () => Promise.resolve(null),
            configurationRoot: path.join(root, 'settings'),
            environment: Object.freeze({}),
            fileSystem: {} as never,
            homeDirectory: () => root,
            logicalProcessorCount: 8,
            nextRequestId: () => 'packaged-test-request',
            now: () => 1,
            openPath: () => Promise.resolve(''),
            pid: 100,
            randomBytes: (size) => Buffer.alloc(size, 1),
            randomNonce: () => 'packaged-test-nonce',
            readNvidiaInventory: () => Promise.resolve({ available: false, reason: 'DEVICE_NOT_FOUND' }),
            readFile: (filePath) => {
              reads.push(filePath);
              return readFile(filePath);
            },
            spawnProcess: () => {
              throw new Error('Test must not start native processes');
            },
          },
          loaded,
        );
        const environment = await factory.create();
        // No native helpers are installed in this fixture. Reaching their fixed
        // path proves that production composition authenticated the pinned staged catalog.
        assert.ok(reads.includes(path.join(resourcesPath, 'local-whisper', 'native', 'helpers.manifest.json')));
        await environment.dispose();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});
