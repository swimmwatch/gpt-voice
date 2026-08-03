import * as path from 'node:path';

import { LocalWhisperQualificationValidator } from './QualificationContracts';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
new LocalWhisperQualificationValidator(qualificationRoot).validateInputs();
process.stdout.write('Local Whisper qualification inputs: valid; candidate state: Pending\n');
