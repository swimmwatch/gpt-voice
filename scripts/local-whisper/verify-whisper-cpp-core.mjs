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
  if (suite !== 'core' && suite !== 'loader') throw new Error('Expected --suite=core or --suite=loader');
  requireVerifiedInputs();
  const gcc = configureBuild('linux-x64-cpu-baseline-v1', { engine: false, tests: true });
  buildTargets(gcc, ['local_whisper_whisper_cpp_core_tests', 'local_whisper_whisper_cpp_loader_tests']);
  runTests(gcc, suite);
  const clang = configureBuild('linux-x64-clang-18.1.3-asan-ubsan-v1', {
    engine: false,
    tests: true,
  });
  buildTargets(clang, ['local_whisper_whisper_cpp_core_tests', 'local_whisper_whisper_cpp_loader_tests']);
  runTests(clang, suite);
  const engine = configureBuild('linux-x64-cpu-baseline-v1', { engine: true, tests: false });
  runFormattingAndTidy(clang, engine);
  process.stdout.write(`Local Whisper Whisper.cpp ${suite} suite verified\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Whisper.cpp core verification failed'}\n`);
  process.exitCode = 1;
}
