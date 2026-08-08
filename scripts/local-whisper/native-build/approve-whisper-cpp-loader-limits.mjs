import { resolve } from 'node:path';
import process from 'node:process';

import { parseArguments, readJson, requiredArgument, writeJsonAtomic } from '../source-import/native-source-core.mjs';
import { approveLoaderLimitCandidate, loaderLimitInputsPath } from './loader-limit-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const candidate = readJson(requiredArgument(arguments_, 'candidate'));
  const review = readJson(requiredArgument(arguments_, 'review-record'));
  const inputs = readJson(loaderLimitInputsPath(workspaceRoot));
  const approved = approveLoaderLimitCandidate(candidate, review, inputs);
  writeJsonAtomic(requiredArgument(arguments_, 'table-output'), approved.table);
  writeJsonAtomic(requiredArgument(arguments_, 'provenance-output'), approved.provenance);
  process.stdout.write(`${approved.table.tableSha256}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Loader-limit approval failed'}\n`);
  process.exitCode = 1;
}
