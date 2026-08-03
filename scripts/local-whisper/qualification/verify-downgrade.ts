import * as path from 'node:path';

import { LocalWhisperQualificationValidator } from './QualificationContracts';

const platformArgument = process.argv.slice(2).find((argument) => argument.startsWith('--platform='));
if (platformArgument !== '--platform=linux') {
  throw new Error('Task 19 downgrade verification accepts only --platform=linux');
}
const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const state = new LocalWhisperQualificationValidator(qualificationRoot).readLinuxState();
if (state.previousPackageState !== 'Pending') throw new Error('Unexpected Linux downgrade state');
process.stdout.write('Local Whisper Linux downgrade: Pending (immediately preceding package unavailable)\n');
