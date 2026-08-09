import process from 'node:process';
import { resolve } from 'node:path';

import { createNativeHardeningManifest, verifyNativeHardening } from './native-build/native-hardening-core.mjs';

function parsePlatform(arguments_) {
  if (arguments_.length !== 1 || !arguments_[0].startsWith('--platform=')) {
    throw new Error('Expected exactly one --platform=linux or --platform=windows argument');
  }
  const platform = arguments_[0].slice('--platform='.length);
  if (platform !== 'linux' && platform !== 'windows')
    throw new Error('Native hardening supports Linux and Windows only');
  const hostPlatform = process.platform === 'win32' ? 'windows' : process.platform;
  if (platform !== hostPlatform) throw new Error('Native hardening verification must inspect host-native binaries');
  return platform;
}

try {
  const platform = parsePlatform(process.argv.slice(2));
  const workspaceRoot = resolve(import.meta.dirname, '..', '..');
  const report = verifyNativeHardening({
    manifest: createNativeHardeningManifest(platform),
    workspaceRoot,
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native hardening verification failed'}\n`);
  process.exitCode = 1;
}
