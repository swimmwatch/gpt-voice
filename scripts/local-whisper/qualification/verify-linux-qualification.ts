import * as path from 'node:path';

import { LocalWhisperQualificationValidator } from './QualificationContracts';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const validator = new LocalWhisperQualificationValidator(qualificationRoot);
validator.validateInputs();
const state = validator.readLinuxState();
if (state.candidateState !== 'Pending' || state.representativeWindowsExecution !== 'NotRun') {
  throw new Error('Linux qualification state is not safely pending');
}
process.stdout.write('Local Whisper Linux qualification: Pending (production candidate and profiles are not frozen)\n');
