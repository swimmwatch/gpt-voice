import process from 'node:process';

import {
  buildTargets,
  configureBuild,
  parseArguments,
  requireVerifiedInputs,
  runFormattingAndTidy,
  runTests,
} from './whisper-cpp-build-core.mjs';

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const suite = arguments_.get('suite');
  if (!['cancellation', 'core', 'device-proof', 'loader'].includes(suite))
    throw new Error('Expected --suite=core, loader, device-proof, or cancellation');
  if (process.platform === 'win32') {
    const profileId = arguments_.get('profile') ?? 'windows-x64-cpu-msvc-19.39-v1';
    if (profileId !== 'windows-x64-cpu-msvc-19.39-v1') {
      throw new Error('Windows native quality requires the exact Task 24 CPU profile');
    }
    requireVerifiedInputs(profileId);
    const configured = configureBuild(profileId, { engine: false, tests: true });
    const targets = [
      'local_whisper_whisper_cpp_core_tests',
      'local_whisper_whisper_cpp_loader_tests',
      'local_whisper_whisper_cpp_device_tests',
      'local_whisper_whisper_cpp_cancellation_tests',
    ];
    buildTargets(configured, targets);
    runTests(configured, suite);
    process.stdout.write(`Local Whisper Whisper.cpp ${suite} suite verified\n`);
    process.exit(0);
  }
  requireVerifiedInputs();
  const gcc = configureBuild('linux-x64-cpu-baseline-v1', { engine: false, tests: true });
  const targets = [
    'local_whisper_whisper_cpp_core_tests',
    'local_whisper_whisper_cpp_loader_tests',
    'local_whisper_whisper_cpp_device_tests',
    'local_whisper_whisper_cpp_cancellation_tests',
  ];
  buildTargets(gcc, targets);
  runTests(gcc, suite);
  const clang = configureBuild('linux-x64-clang-18.1.3-asan-ubsan-v1', {
    engine: false,
    tests: true,
  });
  buildTargets(clang, targets);
  runTests(clang, suite);
  const engine = configureBuild('linux-x64-cpu-baseline-v1', {
    directEngine: true,
    engine: true,
    tests: false,
  });
  runFormattingAndTidy(clang, engine);
  process.stdout.write(`Local Whisper Whisper.cpp ${suite} suite verified\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp core verification failed'}\n`);
  process.exitCode = 1;
}
