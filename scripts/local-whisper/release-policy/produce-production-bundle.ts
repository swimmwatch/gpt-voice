import process from 'node:process';
import * as path from 'node:path';

import { writeCanonicalJson } from '../packaging/fileIntegrity';
import { ProductionBundleProducer } from './ProductionBundleProducer';
import type { ProductionRuntimePlatform } from './ProductionRuntimeArchiveProducer';
import { ProductionSigningAuthority } from './ProductionSigningAuthority';

function argumentsMap(values: readonly string[]): ReadonlyMap<string, string> {
  const parsed = new Map<string, string>();
  for (const value of values) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(value);
    if (!match || parsed.has(match[1]!)) throw new Error('Invalid or duplicate production bundle argument');
    parsed.set(match[1]!, match[2]!);
  }
  return parsed;
}

function required(arguments_: ReadonlyMap<string, string>, name: string): string {
  const value = arguments_.get(name);
  if (!value) throw new Error(`Missing production bundle argument: ${name}`);
  return value;
}

function platform(value: string): ProductionRuntimePlatform {
  if (value === 'linux' || value === 'win32') return value;
  throw new Error('Production bundle platform must be linux or win32');
}

async function main(): Promise<void> {
  const arguments_ = argumentsMap(process.argv.slice(2));
  const descriptorPath = path.resolve(required(arguments_, 'descriptor'));
  const result = await new ProductionBundleProducer(ProductionSigningAuthority.fromEnvironment(process.env)).produce({
    appRevision: required(arguments_, 'app-revision'),
    approvedAt: required(arguments_, 'approved-at'),
    approvedBy: required(arguments_, 'approved-by'),
    outputDirectory: path.resolve(required(arguments_, 'output')),
    platform: platform(required(arguments_, 'platform')),
    releaseTarget: required(arguments_, 'release-target'),
    runtimeDirectories: {
      cpu: path.resolve(required(arguments_, 'cpu-runtime')),
      'sm_120a-real': path.resolve(required(arguments_, 'cuda-runtime')),
    },
    sourceCommit: required(arguments_, 'source-commit'),
  });
  await writeCanonicalJson(descriptorPath, result);
  process.stdout.write(
    `${JSON.stringify({ platform: result.platform, bundleManifestSha256: result.bundleManifestSha256 })}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Production bundle construction failed'}\n`);
  process.exitCode = 1;
});
