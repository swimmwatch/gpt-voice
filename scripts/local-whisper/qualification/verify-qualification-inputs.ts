import * as path from 'node:path';

import { LocalWhisperQualificationValidator } from './QualificationContracts';
import { LinuxQualificationEvidenceVerifier } from './LinuxQualificationEvidenceVerifier';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
async function main(): Promise<void> {
  const validator = new LocalWhisperQualificationValidator(qualificationRoot);
  validator.validateInputs();
  const state = validator.readLinuxState();
  if (state.schemaVersion === 1) {
    process.stdout.write('Local Whisper qualification inputs: valid; candidate state: Pending\n');
  } else {
    const verified = await new LinuxQualificationEvidenceVerifier().verify(qualificationRoot);
    process.stdout.write(
      `Local Whisper qualification inputs: frozen; candidateInputDigest=${verified.candidateInputDigest}\n`,
    );
  }
}

void main();
