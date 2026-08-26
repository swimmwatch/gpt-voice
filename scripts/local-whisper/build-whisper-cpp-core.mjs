import process from 'node:process';

import { stageCpuPack } from './stage-whisper-cpp-cpu.mjs';
import { buildTargets, configureBuild, parseArguments, requireVerifiedInputs } from './whisper-cpp-build-core.mjs';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = arguments_.get('profile');
  const skipRuntimePack = arguments_.get('skip-runtime-pack') === true;
  if (!['linux-x64-cpu-baseline-v1', 'windows-x64-cpu-msvc-19.51-v1'].includes(profileId))
    throw new Error(`Unsupported CPU build profile: ${profileId}`);
  if (skipRuntimePack && profileId !== 'windows-x64-cpu-msvc-19.51-v1') {
    throw new Error('Skipping runtime-pack staging is reserved for Windows native quality builds');
  }
  requireVerifiedInputs(profileId);
  const configured = configureBuild(profileId, {
    captureWindowsExecutionInputs: profileId === 'windows-x64-cpu-msvc-19.51-v1' && !skipRuntimePack,
    engine: true,
    preparedLinuxQuality:
      process.env.LOCAL_WHISPER_PREPARED_LINUX_QUALITY === 'true' ||
      process.env.LOCAL_WHISPER_PREPARED_LINUX_COMPATIBILITY === 'true',
    preparedWindowsQuality: process.env.LOCAL_WHISPER_PREPARED_WINDOWS_QUALITY === 'true',
    tests: false,
  });
  buildTargets(configured, ['local-whisper-whisper-cpp-worker']);
  if (skipRuntimePack) {
    process.stdout.write(`Local Whisper CPU worker built at ${configured.buildRoot}\n`);
  } else {
    const stagingRoot = stageCpuPack(profileId, configured.buildRoot, configured.profile, configured.tools);
    process.stdout.write(`Local Whisper CPU worker staged at ${stagingRoot}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp CPU build failed'}\n`);
  process.exitCode = 1;
}
