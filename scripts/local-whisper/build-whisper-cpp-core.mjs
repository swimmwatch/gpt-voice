import process from 'node:process';

import { stageCpuPack } from './stage-whisper-cpp-cpu.mjs';
import { buildTargets, configureBuild, parseArguments, requireVerifiedInputs } from './whisper-cpp-build-core.mjs';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = arguments_.get('profile');
  if (!['linux-x64-cpu-baseline-v1', 'windows-x64-cpu-msvc-19.39-v1'].includes(profileId))
    throw new Error(`Unsupported CPU build profile: ${profileId}`);
  requireVerifiedInputs(profileId);
  const configured = configureBuild(profileId, { engine: true, tests: false });
  buildTargets(configured, ['local-whisper-whisper-cpp-worker']);
  const stagingRoot = stageCpuPack(profileId, configured.buildRoot, configured.profile);
  process.stdout.write(`Local Whisper CPU worker staged at ${stagingRoot}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CPU build failed'}\n`);
  process.exitCode = 1;
}
