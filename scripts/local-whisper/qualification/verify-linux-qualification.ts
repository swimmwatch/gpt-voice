import * as path from 'node:path';

import { LinuxQualificationEvidenceVerifier } from './LinuxQualificationEvidenceVerifier';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
async function main(): Promise<void> {
  const verified = await new LinuxQualificationEvidenceVerifier().verify(qualificationRoot);
  process.stdout.write(
    `Local Whisper Linux qualification: Pass; resultDigest=${verified.resultDigest}; evidenceIndexDigest=${verified.evidenceIndexDigest}\n`,
  );
}

void main();
