import * as path from 'node:path';

import { LinuxQualificationEvidenceVerifier } from './LinuxQualificationEvidenceVerifier';

const platformArgument = process.argv.slice(2).find((argument) => argument.startsWith('--platform='));
if (platformArgument !== '--platform=linux') {
  throw new Error('Task 19 downgrade verification accepts only --platform=linux');
}
const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
async function main(): Promise<void> {
  const verified = await new LinuxQualificationEvidenceVerifier().verify(qualificationRoot);
  process.stdout.write(
    `Local Whisper Linux downgrade: Pass; predecessorEvidenceDigest=${verified.predecessorEvidenceDigest}\n`,
  );
}

void main();
