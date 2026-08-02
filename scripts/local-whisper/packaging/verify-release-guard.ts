import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { parsePackageMode, parsePackagePlatform } from './contracts';
import { FixtureBundleProducer } from './FixtureBundleProducer';
import { PackageStager } from './PackageStager';
import { ReleaseCollectionGuard } from './ReleaseCollectionGuard';
import { assertOnlyOptions, parseOptions, requiredOption } from './arguments';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

async function selfTest(): Promise<void> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'local-whisper-release-guard-'));
  try {
    const helpersRoot = path.join(temporaryRoot, 'helpers');
    await mkdir(helpersRoot, { mode: 0o700 });
    const filesystemGuard = path.join(helpersRoot, 'fs-guard');
    const launcher = path.join(helpersRoot, 'local-whisper-launcher');
    await Promise.all([
      writeFile(filesystemGuard, 'release-guard filesystem helper\n', { mode: 0o500 }),
      writeFile(launcher, 'release-guard launcher helper\n', { mode: 0o500 }),
    ]);
    const helpers = { filesystemGuard, launcher, license: path.join(workspaceRoot, 'LICENSE') };
    const disabledDirectory = path.join(temporaryRoot, 'disabled-package');
    await new PackageStager().stage({
      mode: 'disabled',
      platform: 'linux',
      outputDirectory: disabledDirectory,
      helpers,
    });
    const guard = new ReleaseCollectionGuard();
    await guard.assertCollectable({ mode: 'disabled', platform: 'linux', stagingDirectory: disabledDirectory });

    const bundleDirectory = path.join(temporaryRoot, 'fixture-bundle');
    const fixture = await new FixtureBundleProducer().produce(bundleDirectory);
    const fixtureDirectory = path.join(temporaryRoot, 'fixture-package');
    await new PackageStager().stage({
      mode: 'fixture',
      platform: 'linux',
      outputDirectory: fixtureDirectory,
      bundleDirectory,
      expectedBundleManifestSha256: fixture.bundleManifestSha256,
      helpers,
    });
    await guard.assertCollectable({ mode: 'fixture', platform: 'linux', stagingDirectory: fixtureDirectory }).then(
      () => {
        throw new Error('Release guard accepted fixture trust');
      },
      (error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes('Fixture')) throw error;
      },
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.size === 0) {
    await selfTest();
  } else {
    assertOnlyOptions(options, ['mode', 'platform', 'staging', 'bundle']);
    await new ReleaseCollectionGuard().assertCollectable({
      mode: parsePackageMode(requiredOption(options, 'mode')),
      platform: parsePackagePlatform(requiredOption(options, 'platform')),
      stagingDirectory: requiredOption(options, 'staging'),
      productionBundleDirectory: options.get('bundle'),
    });
  }
  process.stdout.write('Local Whisper release-collection guard verified\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper release guard failed'}\n`);
  process.exitCode = 1;
});
