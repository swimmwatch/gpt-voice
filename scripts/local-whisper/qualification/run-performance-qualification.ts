import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { LocalWhisperQualificationValidator, qualificationCanonicalJson } from './QualificationContracts';
import {
  type PerformanceExecutionMode,
  type PerformancePlatform,
  type PerformanceQualificationManifest,
  type PerformanceQualificationSample,
} from './PerformanceQualification';
import { LocalWhisperPerformanceResultProducer } from './PerformanceQualificationResultProducer';

const MAXIMUM_INPUT_BYTES = 8 * 1024 * 1024;

/** Reports an existing output without exposing its filesystem error details. */
class QualificationOutputExistsError extends Error {
  public readonly cause: unknown;

  public constructor(cause: unknown) {
    super('Qualification output already exists');
    this.name = 'QualificationOutputExistsError';
    this.cause = cause;
  }
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((candidate) => candidate.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function platform(value: string): PerformancePlatform {
  if (value === 'linux' || value === 'win32') return value;
  throw new Error('Expected --platform=linux or --platform=win32');
}

function executionMode(value: string): PerformanceExecutionMode {
  if (value === 'hostedFixture' || value === 'representativeHost') return value;
  throw new Error('Expected --mode=hostedFixture or --mode=representativeHost');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containedPath(root: string, candidate: string): string {
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Qualification path escaped its validated root');
  }
  return resolved;
}

async function validatedRoot(value: string): Promise<string> {
  const resolved = path.resolve(value);
  const metadata = await lstat(resolved);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('Qualification root is invalid');
  return realpath(resolved);
}

async function readBundle(
  root: string,
  value: string,
): Promise<{
  readonly manifest: PerformanceQualificationManifest;
  readonly samples: readonly PerformanceQualificationSample[];
}> {
  const inputPath = containedPath(root, value);
  const metadata = await lstat(inputPath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size <= 0 || metadata.size > MAXIMUM_INPUT_BYTES) {
    throw new Error('Qualification input is invalid');
  }
  const document = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  if (!isRecord(document) || Object.keys(document).sort().join('|') !== 'manifest|samples') {
    throw new Error('Qualification input bundle is invalid');
  }
  if (!isRecord(document.manifest) || !Array.isArray(document.samples)) {
    throw new Error('Qualification input bundle is invalid');
  }
  return Object.freeze({
    manifest: document.manifest as unknown as PerformanceQualificationManifest,
    samples: document.samples as readonly PerformanceQualificationSample[],
  });
}

async function writeResult(root: string, value: string, result: Readonly<Record<string, unknown>>): Promise<void> {
  const outputPath = containedPath(root, value);
  const parent = await realpath(path.dirname(outputPath));
  containedPath(root, path.join(parent, path.basename(outputPath)));
  try {
    await writeFile(outputPath, `${qualificationCanonicalJson(result)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (isRecord(error) && error.code === 'EEXIST') {
      throw new QualificationOutputExistsError(error);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const expectedPlatform = platform(argument('platform'));
  const expectedMode = executionMode(argument('mode'));
  const root = await validatedRoot(argument('root'));
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const validator = new LocalWhisperQualificationValidator(
    path.join(workspaceRoot, 'docs/specs/local-whisper/qualification'),
  );
  const bundle = await readBundle(root, argument('input'));
  if (bundle.manifest.platform !== expectedPlatform || bundle.manifest.executionMode !== expectedMode) {
    throw new Error('Qualification input mode does not match the requested execution contract');
  }
  const result = new LocalWhisperPerformanceResultProducer(validator).produce(bundle.manifest, bundle.samples);
  await writeResult(root, argument('output'), result);
  process.stdout.write(
    `${JSON.stringify({
      status: 'produced',
      platform: result.platform,
      backend: result.backend,
      executionMode: result.executionMode,
      selectionStatus: result.selectionStatus,
      selectedInFlightWindow: result.selectedInFlightWindow,
      performanceResultDigest: result.performanceResultDigest,
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Performance qualification failed'}\n`);
  process.exitCode = 1;
});
