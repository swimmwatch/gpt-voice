import process from 'node:process';

import { parseArguments } from './whisper-cpp-build-core.mjs';
import {
  CUDA_PROFILE,
  verifyLinuxCudaPack,
  verifyWindowsCudaContract,
  WINDOWS_CUDA_PROFILE,
} from './verify-whisper-cpp-device.mjs';

try {
  const contractOnly = process.argv.includes('--contract-only');
  const arguments_ = parseArguments(process.argv.slice(2).filter((argument) => argument !== '--contract-only'));
  const profileId = arguments_.get('profile');
  if (contractOnly) {
    if (profileId !== WINDOWS_CUDA_PROFILE)
      throw new Error('CUDA contract-only verification accepts only the Task-19 Windows profile');
    verifyWindowsCudaContract();
  } else {
    if (profileId !== CUDA_PROFILE) throw new Error('CUDA verification accepts only the qualified Linux profile');
    verifyLinuxCudaPack();
  }
  process.stdout.write(`Local Whisper CUDA pack verified: ${profileId}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CUDA verification failed'}\n`);
  process.exitCode = 1;
}
