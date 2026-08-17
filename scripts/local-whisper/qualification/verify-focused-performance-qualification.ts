import * as path from 'node:path';

import { createFocusedPerformanceFixture } from './FocusedPerformanceQualification';
import { LocalWhisperQualificationValidator } from './QualificationContracts';
import { LocalWhisperQualificationSourceBaselineVerifier } from './QualificationSourceBaseline';

function main(): void {
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const validator = new LocalWhisperQualificationValidator(
    path.join(workspaceRoot, 'docs/specs/local-whisper/qualification'),
  );
  const source = new LocalWhisperQualificationSourceBaselineVerifier(workspaceRoot).verify();
  const fixtures = (['cpu', 'cuda'] as const).map((backend) => {
    const fixture = createFocusedPerformanceFixture(validator, backend);
    if (fixture.bundle.samples.length !== 6 || fixture.result.status !== 'Pass') {
      throw new Error('Focused performance fixture did not prove the candidate-only contract');
    }
    return Object.freeze({
      backend,
      resultDigest: fixture.result.focusedPerformanceResultDigest,
      timingGate: fixture.result.timingGate,
    });
  });
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified',
      sourceRevision: source.sourceRevision,
      sourceProofDigest: source.sourceProofDigest,
      fullModelHashes: source.fullModelHashes,
      fixtures,
    })}\n`,
  );
}

main();
