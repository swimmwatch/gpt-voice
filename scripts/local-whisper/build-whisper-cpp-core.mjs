import process from 'node:process';

import { stageCpuPack } from './stage-whisper-cpp-cpu.mjs';
import { buildTargets, configureBuild, parseArguments, requireVerifiedInputs } from './whisper-cpp-build-core.mjs';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = arguments_.get('profile');
  if (profileId !== 'linux-x64-cpu-baseline-v1')
    throw new Error('Task 10 builds only --profile=linux-x64-cpu-baseline-v1');
  requireVerifiedInputs();
  const configured = configureBuild(profileId, { engine: true, tests: false });
  buildTargets(configured, ['local-whisper-whisper-cpp-worker']);
  const stagingRoot = stageCpuPack(profileId, configured.buildRoot);
  process.stdout.write(`Local Whisper CPU worker staged at ${stagingRoot}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CPU build failed'}\n`);
  process.exitCode = 1;
}
