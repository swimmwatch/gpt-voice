import process from 'node:process';

import {
  approveSourceCandidate,
  parseArguments,
  readJson,
  requiredArgument,
  writeJsonAtomic,
} from './native-source-core.mjs';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const candidate = readJson(requiredArgument(arguments_, 'candidate'));
  const review = readJson(requiredArgument(arguments_, 'review-record'));
  const output = requiredArgument(arguments_, 'output');
  const lock = approveSourceCandidate(candidate, review);
  writeJsonAtomic(output, lock);
  process.stdout.write(`${lock.lockId}\t${lock.materialization.manifestSha256}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native source approval failed'}\n`);
  process.exitCode = 1;
}
