import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { PackageConfigurationVerifier } from './PackageConfigurationVerifier';
import { PackagePolicyInspector } from './PackagePolicyInspector';
import { PackageStager } from './PackageStager';
import { parsePackageMode, parsePackagePlatform } from './contracts';
import { assertOnlyOptions, parseOptions, requiredOption } from './arguments';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.size > 0) {
    assertOnlyOptions(options, ['directory', 'mode', 'platform']);
    await Promise.all([
      new PackagePolicyInspector().inspect({
        directory: requiredOption(options, 'directory'),
        mode: parsePackageMode(requiredOption(options, 'mode')),
        platform: parsePackagePlatform(requiredOption(options, 'platform')),
      }),
      new PackageConfigurationVerifier().verify(path.join(workspaceRoot, 'package.json')),
    ]);
    process.stdout.write('Local Whisper base-package policy verified\n');
    return;
  }
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'local-whisper-policy-'));
  try {
    const helpersRoot = path.join(temporaryRoot, 'helpers');
    await mkdir(helpersRoot, { mode: 0o700 });
    const guard = path.join(helpersRoot, 'fs-guard');
    const launcher = path.join(helpersRoot, 'local-whisper-launcher');
    await Promise.all([
      writeFile(guard, 'synthetic helper identity: filesystem guard\n', { mode: 0o500 }),
      writeFile(launcher, 'synthetic helper identity: launcher\n', { mode: 0o500 }),
    ]);
    const output = path.join(temporaryRoot, 'local-whisper');
    await new PackageStager().stage({
      mode: 'disabled',
      platform: 'linux',
      outputDirectory: output,
      helpers: { filesystemGuard: guard, launcher, license: path.join(workspaceRoot, 'LICENSE') },
    });
    await Promise.all([
      new PackagePolicyInspector().inspect({ directory: output, mode: 'disabled', platform: 'linux' }),
      new PackageConfigurationVerifier().verify(path.join(workspaceRoot, 'package.json')),
    ]);
    process.stdout.write('Local Whisper base-package policy verified\n');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper package policy failed'}\n`);
  process.exitCode = 1;
});
