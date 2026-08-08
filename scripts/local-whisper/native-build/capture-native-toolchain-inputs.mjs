import { resolve } from 'node:path';
import process from 'node:process';

import { parseArguments, readJson, requiredArgument, writeJsonAtomic } from '../source-import/native-source-core.mjs';
import { captureToolchainInputLock } from './native-toolchain-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = requiredArgument(arguments_, 'profile');
  const profile = readJson(
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles', `${profileId}.json`),
  );
  const toolchainRoot = resolve(requiredArgument(arguments_, 'toolchain-root'));
  const captured = captureToolchainInputLock(profile, toolchainRoot);
  writeJsonAtomic(requiredArgument(arguments_, 'output'), captured);
  process.stdout.write(`${profileId}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native toolchain capture failed'}\n`);
  process.exitCode = 1;
}
