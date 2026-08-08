import process from 'node:process';

import { importerIdentity } from './importer-identity.mjs';
import {
  buildSourceCandidate,
  parseArguments,
  requiredArgument,
  runGit,
  writeJsonAtomic,
} from './native-source-core.mjs';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const lockId = requiredArgument(arguments_, 'lock');
  const repositoryRoot = requiredArgument(arguments_, 'repository-root');
  const output = requiredArgument(arguments_, 'output');
  const gitVersion = String(runGit(repositoryRoot, ['--version'], { encoding: 'utf8' })).trim();
  const candidate = buildSourceCandidate(repositoryRoot, lockId, importerIdentity(gitVersion));
  writeJsonAtomic(output, candidate);
  process.stdout.write(`${candidate.candidateDigest}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native source candidate failed'}\n`);
  process.exitCode = 1;
}
