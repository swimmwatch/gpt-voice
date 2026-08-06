import process from 'node:process';

import { parseArguments } from './whisper-cpp-build-core.mjs';
import {
  CUDA_PROFILE,
  verifyLinuxCudaPack,
  verifyWindowsCudaPack,
  WINDOWS_CUDA_PROFILE,
} from './verify-whisper-cpp-device.mjs';

try {
  const contractOnly = process.argv.includes('--contract-only');
  const arguments_ = parseArguments(process.argv.slice(2).filter((argument) => argument !== '--contract-only'));
  const profileId = arguments_.get('profile');
  if (contractOnly) throw new Error('Task 24 Windows verification does not accept contract-only mode');
  if (profileId === WINDOWS_CUDA_PROFILE) verifyWindowsCudaPack();
  else if (profileId === CUDA_PROFILE) verifyLinuxCudaPack();
  else throw new Error('CUDA verification accepts only the approved Linux or Task 24 Windows profile');
  process.stdout.write(`Local Whisper CUDA pack verified: ${profileId}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CUDA verification failed'}\n`);
  process.exitCode = 1;
}
