import process from 'node:process';

import { assertOnlyOptions, parseOptions, requiredOption } from '../packaging/arguments';
import { ProductionCandidateInventoryVerifier } from './ProductionCandidateInventoryVerifier';

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  assertOnlyOptions(options, ['artifacts', 'candidate', 'expected-target', 'target-kind']);
  const targetKind = requiredOption(options, 'target-kind');
  if (targetKind !== 'private' && targetKind !== 'release') {
    throw new Error('Production candidate target kind must be private or release');
  }
  const candidate = await new ProductionCandidateInventoryVerifier().verify({
    artifactDirectory: requiredOption(options, 'artifacts'),
    candidatePath: requiredOption(options, 'candidate'),
    expectedTarget: requiredOption(options, 'expected-target'),
    targetKind,
  });
  process.stdout.write(`Production Local Whisper candidate verified for ${candidate.target}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Production candidate verification failed'}\n`);
  process.exitCode = 1;
});
