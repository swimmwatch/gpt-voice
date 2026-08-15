import * as path from 'node:path';

import { LocalWhisperQualificationValidator } from './QualificationContracts';
import { createHostedPerformanceFixture } from './PerformanceQualificationFixtures';
import type { PerformanceBackend, PerformancePlatform } from './PerformanceQualification';
import { LocalWhisperQualificationSourceBaselineVerifier } from './QualificationSourceBaseline';

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function platforms(value: string | null): readonly PerformancePlatform[] {
  if (value === 'linux' || value === 'win32') return [value];
  if (value === 'both' || value === null) return ['linux', 'win32'];
  throw new Error('Expected --platform=linux, --platform=win32, or --platform=both');
}

function firstPassingFixtureWindow(result: Readonly<Record<string, unknown>>): number | null {
  if (!Array.isArray(result.candidateResults)) throw new Error('Performance fixture rows are invalid');
  for (const window of [1, 2, 4, 8] as const) {
    const rows = result.candidateResults.filter(
      (entry): entry is Readonly<Record<string, unknown>> =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry) && entry.candidateWindow === window,
    );
    if (rows.length === 3 && rows.every(({ status }) => status === 'Pass')) return window;
  }
  return null;
}

function main(): void {
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const qualificationRoot = path.join(workspaceRoot, 'docs/specs/local-whisper/qualification');
  const validator = new LocalWhisperQualificationValidator(qualificationRoot);
  const source = new LocalWhisperQualificationSourceBaselineVerifier(workspaceRoot).verify();
  const rows: Array<Readonly<Record<string, unknown>>> = [];
  for (const platform of platforms(argument('platform'))) {
    for (const backend of ['cpu', 'cuda'] as readonly PerformanceBackend[]) {
      const fixture = createHostedPerformanceFixture(validator, platform, backend);
      if (
        fixture.samples.length !== 288 ||
        firstPassingFixtureWindow(fixture.result) !== 4 ||
        fixture.result.selectedInFlightWindow !== null ||
        fixture.result.selectionStatus !== 'fixtureOnly'
      ) {
        throw new Error('Performance fixture did not prove the deterministic contract-only rows');
      }
      rows.push(
        Object.freeze({
          platform,
          backend,
          evidenceClaim: fixture.result.evidenceClaim,
          firstPassingFixtureWindow: firstPassingFixtureWindow(fixture.result),
          resultDigest: fixture.result.performanceResultDigest,
        }),
      );
    }
  }
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified',
      sourceRevision: source.sourceRevision,
      sourceProofDigest: source.sourceProofDigest,
      fullModelHashes: source.fullModelHashes,
      fixtures: rows,
    })}\n`,
  );
}

main();
