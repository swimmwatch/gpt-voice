import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { BundleVerifier } from '@scripts/local-whisper/packaging/BundleVerifier';
import { FixtureBundleProducer } from '@scripts/local-whisper/packaging/FixtureBundleProducer';
import {
  inspectFlatDirectory,
  readCanonicalJson,
  writeCanonicalJson,
} from '@scripts/local-whisper/packaging/fileIntegrity';
import { PackageStager } from '@scripts/local-whisper/packaging/PackageStager';

let temporaryRoot = '';
let bundleDirectory = '';
let bundleDigest = '';

async function copyBundle(name: string): Promise<string> {
  const target = path.join(temporaryRoot, name);
  await cp(bundleDirectory, target, { recursive: true });
  return target;
}

async function refreshManifest(directory: string, mutate: (manifest: Record<string, unknown>) => void): Promise<void> {
  const manifestPath = path.join(directory, 'bundle-manifest.json');
  const manifest = (await readCanonicalJson(manifestPath)) as Record<string, unknown>;
  mutate(manifest);
  manifest.files = await inspectFlatDirectory(directory, ['bundle-manifest.json']);
  await writeCanonicalJson(manifestPath, manifest);
}

describe('generate-once Local Whisper fixture bundle', () => {
  before(async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), 'local-whisper-fixture-test-'));
    bundleDirectory = path.join(temporaryRoot, 'public-fixture');
    const produced = await new FixtureBundleProducer().produce(bundleDirectory);
    bundleDigest = produced.bundleManifestSha256;
  });

  after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it('publishes only the declared public bundle and verifies its exact producer digest', async () => {
    const files = await readdir(bundleDirectory);
    assert.equal(files.includes('catalog.sig'), false);
    assert.equal(
      files.some((fileName) => /private[-_.]?key/iu.test(fileName)),
      false,
    );
    const combinedText = (
      await Promise.all(files.map((fileName) => readFile(path.join(bundleDirectory, fileName), 'utf8')))
    ).join('\n');
    assert.equal(/BEGIN (?:ENCRYPTED )?PRIVATE KEY/u.test(combinedText), false);
    const verified = await new BundleVerifier().verify(bundleDirectory, {
      purpose: 'fixture',
      manifestSha256: bundleDigest,
    });
    assert.equal(verified.manifest.synthetic, true);
    assert.equal(verified.runtimePack.supportTier, 'planned');
  });

  it('refuses a second producer attempt at the declared output', async () => {
    await assert.rejects(new FixtureBundleProducer().produce(bundleDirectory), /already exists/u);
  });

  it('never accepts fixture-derived trust as production input', async () => {
    await assert.rejects(
      new BundleVerifier().verify(bundleDirectory, { purpose: 'production' }),
      /externally frozen digest/u,
    );
    await assert.rejects(
      new PackageStager().stage({
        mode: 'production',
        platform: 'linux',
        outputDirectory: path.join(temporaryRoot, 'production-package'),
        bundleDirectory,
        expectedBundleManifestSha256: bundleDigest,
      }),
      /purpose mismatch/u,
    );
  });

  it('rejects a changed byte and a wrong declared digest', async () => {
    const changed = await copyBundle('changed-byte');
    await writeFile(path.join(changed, 'synthetic-model.pack'), 'changed fixture byte\n', { mode: 0o600 });
    await assert.rejects(
      new BundleVerifier().verify(changed, { purpose: 'fixture', manifestSha256: bundleDigest }),
      /integrity mismatch/u,
    );
    await assert.rejects(
      new BundleVerifier().verify(bundleDirectory, { purpose: 'fixture', manifestSha256: '0'.repeat(64) }),
      /declared digest mismatch/u,
    );
  });

  it('rejects wrong purpose, wrong key, detached signatures, and leaked private material', async () => {
    const wrongPurpose = await copyBundle('wrong-purpose');
    await assert.rejects(
      new BundleVerifier().verify(wrongPurpose, {
        purpose: 'production',
        manifestSha256: bundleDigest,
      }),
      /purpose mismatch/u,
    );

    const wrongKey = await copyBundle('wrong-key');
    const keyringPath = path.join(wrongKey, 'keyring.json');
    const keyring = (await readCanonicalJson(keyringPath)) as {
      publicKeys: { keyId: string }[];
    } & Record<string, unknown>;
    keyring.publicKeys[0].keyId = 'fixture-different-key-v1';
    await writeCanonicalJson(keyringPath, keyring);
    await refreshManifest(wrongKey, () => undefined);
    await assert.rejects(
      new BundleVerifier().verify(wrongKey, { purpose: 'fixture' }),
      /not in the app-owned keyring/u,
    );

    const detached = await copyBundle('detached-signature');
    await writeFile(path.join(detached, 'catalog.sig'), 'forbidden detached signature\n', { mode: 0o600 });
    await refreshManifest(detached, () => undefined);
    await assert.rejects(new BundleVerifier().verify(detached, { purpose: 'fixture' }), /Detached/u);

    const leaked = await copyBundle('leaked-private-key');
    await writeFile(path.join(leaked, 'private-key.txt'), '-----BEGIN PRIVATE KEY-----\nleaked\n', { mode: 0o600 });
    await refreshManifest(leaked, () => undefined);
    await assert.rejects(new BundleVerifier().verify(leaked, { purpose: 'fixture' }), /trust boundary/u);
  });
});
