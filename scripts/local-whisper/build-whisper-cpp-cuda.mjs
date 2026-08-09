import process from 'node:process';

import { stageCudaPack } from './stage-whisper-cpp-cuda.mjs';
import { buildTargets, configureBuild, parseArguments, requireVerifiedInputs } from './whisper-cpp-build-core.mjs';

const CUDA_PROFILES = new Set(['linux-x64-cuda-12.8.1-sm120a-v1', 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1']);

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = arguments_.get('profile');
  if (!CUDA_PROFILES.has(profileId)) throw new Error(`Unsupported CUDA build profile: ${profileId}`);
  requireVerifiedInputs(profileId);
  const configured = configureBuild(profileId, {
    engine: true,
    preparedLinuxQuality: process.env.LOCAL_WHISPER_PREPARED_LINUX_QUALITY === 'true',
    tests: false,
  });
  buildTargets(configured, ['local-whisper-whisper-cpp-worker']);
  const stagingRoot = stageCudaPack(profileId, configured.buildRoot, configured.profile);
  process.stdout.write(`Local Whisper CUDA worker staged at ${stagingRoot}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CUDA build failed'}\n`);
  process.exitCode = 1;
}
