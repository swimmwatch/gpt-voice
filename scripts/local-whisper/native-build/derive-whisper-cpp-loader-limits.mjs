import { resolve } from 'node:path';
import process from 'node:process';

import { parseArguments, readJson, requiredArgument, writeJsonAtomic } from '../source-import/native-source-core.mjs';
import { buildLoaderLimitCandidate } from './loader-limit-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const sourceLock = readJson(requiredArgument(arguments_, 'source-lock'));
  const output = requiredArgument(arguments_, 'output');
  const candidate = buildLoaderLimitCandidate(workspaceRoot, sourceLock);
  writeJsonAtomic(output, candidate);
  process.stdout.write(`${candidate.candidateDigest}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Loader-limit derivation failed'}\n`);
  process.exitCode = 1;
}
