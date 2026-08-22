import process from 'node:process';
import * as path from 'node:path';

import { ProductionCandidateAssembler } from './ProductionCandidateAssembler';
import { ProductionSigningAuthority } from './ProductionSigningAuthority';

function argumentsMap(values: readonly string[]): ReadonlyMap<string, string> {
  const parsed = new Map<string, string>();
  for (const value of values) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(value);
    if (!match || parsed.has(match[1]!)) throw new Error('Invalid or duplicate production candidate argument');
    parsed.set(match[1]!, match[2]!);
  }
  return parsed;
}

function required(arguments_: ReadonlyMap<string, string>, name: string): string {
  const value = arguments_.get(name);
  if (!value) throw new Error(`Missing production candidate argument: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const arguments_ = argumentsMap(process.argv.slice(2));
  const candidate = await new ProductionCandidateAssembler(
    ProductionSigningAuthority.fromEnvironment(process.env),
  ).assemble({
    applicationDirectories: {
      linux: path.resolve(required(arguments_, 'linux-applications')),
      win32: path.resolve(required(arguments_, 'windows-applications')),
    },
    bundles: {
      linux: {
        bundleDirectory: path.resolve(required(arguments_, 'linux-bundle')),
        descriptorPath: path.resolve(required(arguments_, 'linux-bundle-descriptor')),
      },
      win32: {
        bundleDirectory: path.resolve(required(arguments_, 'windows-bundle')),
        descriptorPath: path.resolve(required(arguments_, 'windows-bundle-descriptor')),
      },
    },
    candidatePath: path.resolve(required(arguments_, 'candidate')),
    candidateTarget: required(arguments_, 'candidate-target'),
    outputDirectory: path.resolve(required(arguments_, 'output')),
    runtimeDirectories: {
      linux: path.resolve(required(arguments_, 'linux-runtimes')),
      win32: path.resolve(required(arguments_, 'windows-runtimes')),
    },
    sourceCommit: required(arguments_, 'source-commit'),
  });
  process.stdout.write(
    `${JSON.stringify({ assets: candidate.assets.length, releaseCandidateDigest: candidate.releaseCandidateDigest })}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Production candidate assembly failed'}\n`);
  process.exitCode = 1;
});
