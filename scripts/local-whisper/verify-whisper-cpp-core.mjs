import process from 'node:process';

import {
  buildTargets,
  configureBuild,
  parseArguments,
  requireVerifiedInputs,
  runFormattingAndTidy,
  runTests,
} from './whisper-cpp-build-core.mjs';

const LINUX_QUALITY_ENGINE_TARGETS = Object.freeze([
  'local_whisper_whisper_cpp_qualification_tests',
  'local-whisper-whisper-cpp-direct-engine',
  'local-whisper-whisper-cpp-worker',
]);

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const suite = arguments_.get('suite');
  if (!['all', 'cancellation', 'core', 'device-proof', 'loader'].includes(suite))
    throw new Error('Expected --suite=all, core, loader, device-proof, or cancellation');
  const suites = suite === 'all' ? ['core', 'loader', 'device-proof', 'cancellation'] : [suite];
  if (process.platform === 'win32') {
    const profileId = arguments_.get('profile') ?? 'windows-x64-cpu-msvc-19.51-v1';
    if (profileId !== 'windows-x64-cpu-msvc-19.51-v1') {
      throw new Error('Windows native quality requires the exact Task 24 CPU profile');
    }
    const sanitizers = arguments_.get('sanitizers') === 'address';
    if (arguments_.has('sanitizers') && !sanitizers) {
      throw new Error('Windows native quality supports only --sanitizers=address');
    }
    requireVerifiedInputs(profileId);
    const configured = configureBuild(profileId, {
      engine: false,
      preparedWindowsQuality: true,
      sanitizers,
      tests: true,
    });
    const targets = [
      'local_whisper_whisper_cpp_core_tests',
      'local_whisper_whisper_cpp_loader_tests',
      'local_whisper_whisper_cpp_device_tests',
      'local_whisper_whisper_cpp_cancellation_tests',
    ];
    buildTargets(configured, targets);
    for (const label of suites) runTests(configured, label);
    process.stdout.write(
      `Local Whisper Whisper.cpp ${sanitizers ? 'sanitized' : 'ordinary'} ${suite} suite verified\n`,
    );
    process.exit(0);
  }
  requireVerifiedInputs();
  const preparedLinuxQuality = process.env.LOCAL_WHISPER_PREPARED_LINUX_QUALITY === 'true';
  const preparedLinuxCompatibility = process.env.LOCAL_WHISPER_PREPARED_LINUX_COMPATIBILITY === 'true';
  const preparedLinux = preparedLinuxQuality || preparedLinuxCompatibility;
  const targets = [
    'local_whisper_whisper_cpp_core_tests',
    'local_whisper_whisper_cpp_loader_tests',
    'local_whisper_whisper_cpp_device_tests',
    'local_whisper_whisper_cpp_cancellation_tests',
  ];
  const profiles = preparedLinuxCompatibility
    ? ['linux-x64-cpu-baseline-v1']
    : ['linux-x64-cpu-baseline-v1', 'linux-x64-clang-18.1.3-asan-ubsan-v1'];
  const configuredProfiles = profiles.map((profileId) =>
    configureBuild(profileId, { engine: false, preparedLinuxQuality: preparedLinux, tests: true }),
  );
  for (const configured of configuredProfiles) {
    buildTargets(configured, targets);
    for (const label of suites) runTests(configured, label);
  }
  if (preparedLinuxCompatibility) {
    process.stdout.write(`Local Whisper Whisper.cpp ${suite} suite verified\n`);
    process.exit(0);
  }
  const clang = configuredProfiles[1];
  if (!clang) throw new Error('Linux Clang sanitizer profile is unavailable');
  const engine = configureBuild('linux-x64-cpu-baseline-v1', {
    directEngine: true,
    engine: true,
    preparedLinuxQuality: preparedLinux,
    tests: true,
  });
  buildTargets(
    engine,
    preparedLinuxQuality && suite === 'core'
      ? LINUX_QUALITY_ENGINE_TARGETS
      : ['local_whisper_whisper_cpp_qualification_tests'],
  );
  runTests(engine, 'direct-engine');
  await runFormattingAndTidy(clang, engine);
  process.stdout.write(`Local Whisper Whisper.cpp ${suite} suite verified\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp core verification failed'}\n`);
  process.exitCode = 1;
}
