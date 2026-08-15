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

function selectedWindow(result: Readonly<Record<string, unknown>>): number | null {
  const selected = result.selectedInFlightWindow;
  if (selected === null || selected === 1 || selected === 2 || selected === 4 || selected === 8) return selected;
  throw new Error('Performance fixture selected an invalid window');
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
      if (selectedWindow(fixture.result) !== 4 || fixture.result.selectionStatus !== 'fixtureOnly') {
        throw new Error('Performance fixture did not select the deterministic contract-only window');
      }
      rows.push(
        Object.freeze({
          platform,
          backend,
          evidenceClaim: fixture.result.evidenceClaim,
          selectedInFlightWindow: fixture.result.selectedInFlightWindow,
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
