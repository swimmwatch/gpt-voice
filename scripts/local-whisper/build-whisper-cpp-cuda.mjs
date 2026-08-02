import process from 'node:process';

import { stageCudaPack } from './stage-whisper-cpp-cuda.mjs';
import { buildTargets, configureBuild, parseArguments, requireVerifiedInputs } from './whisper-cpp-build-core.mjs';

const CUDA_PROFILE = 'linux-x64-cuda-12.8.1-sm120a-v1';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = arguments_.get('profile');
  if (profileId !== CUDA_PROFILE) throw new Error(`Task 11 builds only --profile=${CUDA_PROFILE}`);
  requireVerifiedInputs();
  const configured = configureBuild(profileId, { engine: true, tests: false });
  buildTargets(configured, ['local-whisper-whisper-cpp-worker']);
  const stagingRoot = stageCudaPack(profileId, configured.buildRoot);
  process.stdout.write(`Local Whisper CUDA worker staged at ${stagingRoot}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CUDA build failed'}\n`);
  process.exitCode = 1;
}
