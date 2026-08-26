import process from 'node:process';

import { assertOnlyOptions, parseOptions, requiredOption } from '../packaging/arguments';
import { HostedProductionRuntimeArchiveCollector } from './HostedProductionRuntimeArchiveCollector';
import type { ProductionRuntimePlatform, ProductionRuntimeTarget } from './ProductionRuntimeArchiveProducer';

function platform(value: string): ProductionRuntimePlatform {
  if (value === 'linux' || value === 'win32') return value;
  throw new Error('Hosted production runtime collection requires --platform=linux or --platform=win32');
}

function target(value: string): ProductionRuntimeTarget {
  if (value === 'cpu' || value === 'sm_120a-real') return value;
  throw new Error('Hosted production runtime collection requires --target=cpu or --target=sm_120a-real');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  assertOnlyOptions(options, ['platform', 'target', 'first-pack', 'second-pack', 'output']);
  const record = await new HostedProductionRuntimeArchiveCollector().collect({
    firstPackDirectory: requiredOption(options, 'first-pack'),
    outputDirectory: requiredOption(options, 'output'),
    platform: platform(requiredOption(options, 'platform')),
    secondPackDirectory: requiredOption(options, 'second-pack'),
    target: target(requiredOption(options, 'target')),
  });
  process.stdout.write(
    `${JSON.stringify({ platform: record.platform, sha256: record.archive.sha256, target: record.target })}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Hosted production runtime archive collection failed'}\n`,
  );
  process.exitCode = 1;
});
