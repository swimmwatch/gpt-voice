import process from 'node:process';

import { assertOnlyOptions, parseOptions, requiredOption } from '../packaging/arguments';
import {
  ProductionRuntimeArchiveProducer,
  type ProductionRuntimePlatform,
  type ProductionRuntimeTarget,
} from './ProductionRuntimeArchiveProducer';

function platform(value: string): ProductionRuntimePlatform {
  if (value === 'linux' || value === 'win32') return value;
  throw new Error('Production runtime construction requires --platform=linux or --platform=win32');
}

function target(value: string): ProductionRuntimeTarget {
  if (value === 'cpu' || value === 'sm_120a-real') return value;
  throw new Error('Production runtime construction requires --target=cpu or --target=sm_120a-real');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  assertOnlyOptions(options, ['platform', 'target', 'first-stage', 'second-stage', 'output']);
  const record = await new ProductionRuntimeArchiveProducer().produce({
    firstStageRoot: requiredOption(options, 'first-stage'),
    outputDirectory: requiredOption(options, 'output'),
    platform: platform(requiredOption(options, 'platform')),
    secondStageRoot: requiredOption(options, 'second-stage'),
    target: target(requiredOption(options, 'target')),
  });
  process.stdout.write(
    `${JSON.stringify({ platform: record.platform, sha256: record.archive.sha256, target: record.target })}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Production runtime archive construction failed'}\n`,
  );
  process.exitCode = 1;
});
