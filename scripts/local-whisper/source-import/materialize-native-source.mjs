import process from 'node:process';

import { materializeSource, parseArguments, readJson, requiredArgument } from './native-source-core.mjs';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const lock = readJson(requiredArgument(arguments_, 'lock-file'));
  const destination = materializeSource(
    requiredArgument(arguments_, 'repository-root'),
    requiredArgument(arguments_, 'store-root'),
    lock,
  );
  process.stdout.write(`${destination}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native source materialization failed'}\n`);
  process.exitCode = 1;
}
