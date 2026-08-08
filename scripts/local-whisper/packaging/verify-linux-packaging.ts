import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { BundleVerifier } from './BundleVerifier';
import { FixtureBundleProducer } from './FixtureBundleProducer';
import { PackagePolicyInspector } from './PackagePolicyInspector';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'local-whisper-linux-consumer-'));
  try {
    if (process.platform !== 'linux') throw new Error('Linux Local Whisper package verification requires Linux');
    const bundleDirectory = path.join(temporaryRoot, 'public-fixture');
    const packageDirectory = path.join(temporaryRoot, 'package');
    const produced = await new FixtureBundleProducer().produce(bundleDirectory);
    await new BundleVerifier().verify(bundleDirectory, {
      purpose: 'fixture',
      manifestSha256: produced.bundleManifestSha256,
    });
    const preparation = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        path.join(workspaceRoot, 'scripts', 'local-whisper', 'packaging', 'prepare-package.ts'),
        '--mode=fixture',
        '--platform=linux',
        `--output=${packageDirectory}`,
        `--bundle=${bundleDirectory}`,
        `--bundle-digest=${produced.bundleManifestSha256}`,
      ],
      { cwd: workspaceRoot, encoding: 'utf8', shell: false },
    );
    if (preparation.status !== 0) throw new Error(preparation.stderr || 'Linux fixture package preparation failed');
    await new PackagePolicyInspector().inspect({ directory: packageDirectory, mode: 'fixture', platform: 'linux' });
    const verifiedAgain = await new BundleVerifier().verify(bundleDirectory, {
      purpose: 'fixture',
      manifestSha256: produced.bundleManifestSha256,
    });
    if (verifiedAgain.manifestSha256 !== produced.bundleManifestSha256) {
      throw new Error('Linux consumer mutated the generate-once fixture bundle');
    }
    process.stdout.write(
      `${JSON.stringify({ linuxConsumer: 'passed', bundleDigest: produced.bundleManifestSha256, keyId: produced.keyId })}\n`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Linux Local Whisper packaging failed'}\n`);
  process.exitCode = 1;
});
