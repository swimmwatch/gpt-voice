import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parse } from 'yaml';

const WORKFLOW_PATH = '.github/workflows/pr-checks.yml';
const MSVC_ACTION_PATH = '.github/actions/initialize-msvc-environment/action.yml';
const workflowText = readFileSync(WORKFLOW_PATH, 'utf8');
const workflow = record(parse(workflowText), 'workflow');
const jobs = record(workflow.jobs, 'workflow jobs');

function record(value: unknown, owner: string): Readonly<Record<string, unknown>> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value), `${owner} must be an object`);
  return value as Readonly<Record<string, unknown>>;
}

function job(name: string): Readonly<Record<string, unknown>> {
  return record(jobs[name], `job ${name}`);
}

function jobText(name: string): string {
  return JSON.stringify(job(name));
}

function steps(name: string): readonly Readonly<Record<string, unknown>>[] {
  const value = job(name).steps;
  assert.ok(Array.isArray(value), `job ${name} must declare steps`);
  return value.map((entry, index) => record(entry, `job ${name} step ${index}`));
}

function stepNames(name: string): readonly string[] {
  return steps(name).map((step) => {
    const stepName = step.name;
    if (typeof stepName !== 'string') throw new Error(`job ${name} has a step without a name`);
    return stepName;
  });
}

function matrixRows(name: string): readonly Readonly<Record<string, unknown>>[] {
  const strategy = record(job(name).strategy, `${name} strategy`);
  assert.equal(strategy['fail-fast'], false);
  const matrix = record(strategy.matrix, `${name} matrix`);
  assert.ok(Array.isArray(matrix.include));
  return matrix.include.map((entry, index) => record(entry, `${name} matrix row ${index}`));
}

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function namedStep(jobName: string, stepName: string): Readonly<Record<string, unknown>> {
  const step = steps(jobName).find((candidate) => candidate.name === stepName);
  assert.ok(step, `${jobName} must retain ${stepName}`);
  return step;
}

test('Local Whisper uses independent native lanes with stable fail-closed platform gates', () => {
  const msvcAction = readFileSync(MSVC_ACTION_PATH, 'utf8');
  const linuxRows = matrixRows('native-linux-shards');
  const windowsRows = matrixRows('native-windows-shards');

  assert.equal(job('native-linux-core')['runs-on'], '${{ vars.CI_LINUX_RUNNER }}');
  assert.equal(job('native-windows-core')['runs-on'], '${{ vars.CI_WINDOWS_RUNNER }}');
  assert.deepEqual(linuxRows, [
    {
      checkName: 'Static Analysis',
      lane: 'static-analysis',
      runner: '${{ vars.CI_LINUX_RUNNER }}',
      timeoutMinutes: 20,
    },
    {
      checkName: 'GCC and Package',
      lane: 'gcc-package',
      runner: '${{ vars.CI_LINUX_RUNNER }}',
      timeoutMinutes: 30,
    },
  ]);
  assert.deepEqual(windowsRows, [
    {
      checkName: 'MSVC Analyze',
      lane: 'analyze',
      runner: '${{ vars.CI_WINDOWS_RUNNER }}',
      timeoutMinutes: 30,
    },
    {
      checkName: 'MSVC AddressSanitizer',
      lane: 'asan',
      runner: '${{ vars.CI_WINDOWS_RUNNER }}',
      timeoutMinutes: 30,
    },
  ]);
  for (const jobName of ['native-linux-core', 'native-linux-shards', 'native-windows-core', 'native-windows-shards']) {
    assert.equal(job(jobName).needs, undefined, `${jobName} must start independently`);
  }

  const linuxGate = job('native-quality-linux');
  assert.equal(linuxGate.name, 'Local Whisper Native Quality (Linux)');
  assert.equal(linuxGate.if, '${{ always() }}');
  assert.deepEqual(linuxGate.needs, ['native-linux-core', 'native-linux-shards']);
  assert.match(jobText('native-quality-linux'), /needs\.native-linux-core\.result/u);
  assert.match(jobText('native-quality-linux'), /needs\.native-linux-shards\.result/u);
  assert.equal(count(jobText('native-quality-linux'), 'success'), 2);

  const windowsGate = job('native-quality-windows');
  assert.equal(windowsGate.name, 'Local Whisper Native Quality (Windows)');
  assert.equal(windowsGate.if, '${{ always() }}');
  assert.deepEqual(windowsGate.needs, ['native-windows-core', 'native-windows-shards']);
  assert.match(jobText('native-quality-windows'), /needs\.native-windows-core\.result/u);
  assert.match(jobText('native-quality-windows'), /needs\.native-windows-shards\.result/u);
  assert.equal(count(jobText('native-quality-windows'), 'success'), 2);

  const nativeJobs = Object.entries(jobs)
    .filter(([name]) => name.startsWith('native-'))
    .map(([, value]) => JSON.stringify(value))
    .join('');
  assert.doesNotMatch(nativeJobs, /continue-on-error/u);
  assert.doesNotMatch(workflowText, /ubuntu-22\.04|ubuntu-26\.04|windows-2022/u);
  assert.match(msvcAction, /vcvarsall\.bat/u);
  assert.match(msvcAction, /VCToolsVersion.*14\.51/u);
  assert.match(msvcAction, /\[regex\]::Match\(\$compilerBanner, 'Version\\s\+/u);
  assert.match(msvcAction, /StartsWith\('19\.51\.'/u);
  assert.match(msvcAction, /\$env:PATH = \$values\['PATH'\]/u);
  assert.match(msvcAction, /Get-Command (?:cmake|ctest|cl|ninja)\.exe/u);
});

test('Linux core preserves TSan, fuzzing, sanitizer, coverage, and CodeQL ordering', () => {
  const names = stepNames('native-linux-core');
  const tsan = names.indexOf('Run Linux worker ThreadSanitizer gate');
  const fuzz = names.indexOf('Run bounded Linux parser fuzzing');
  const codeql = names.indexOf('Initialize Linux C++ CodeQL database');
  const analyze = names.indexOf('Analyze Linux C++ CodeQL database');
  const coverage = names.indexOf('Emit Linux native-quality coverage');
  assert.ok(tsan >= 0 && fuzz >= 0 && codeql >= 0 && codeql < tsan && codeql < fuzz);
  assert.ok(analyze > codeql && coverage > analyze);

  const core = jobText('native-linux-core');
  assert.match(core, /LD_PRELOAD/u);
  assert.match(core, /test:local-whisper:worker-tsan-proof/u);
  assert.match(core, /test:local-whisper:worker-tsan/u);
  assert.match(core, /test:local-whisper:native-fuzz-proof/u);
  assert.match(core, /test:local-whisper:whisper-cpp-cancellation/u);
  assert.match(core, /emit:local-whisper:native-quality-coverage/u);
  assert.match(core, /--codeql-database=\.cache\/codeql\/cpp-linux\/cpp/u);
  assert.match(core, /--evidence=contract-inspection,compile,execute,analyze,sanitize,tsan,binary-inspection/u);
  assert.match(core, /category":"\/language:c-cpp,host:linux/u);
  assert.doesNotMatch(core, /SEMMLE_|CODEQL_RUNNER/u);

  const shards = jobText('native-linux-shards');
  assert.equal(
    namedStep('native-linux-shards', 'Run Linux formatting and clang-tidy checks').if,
    "matrix.lane == 'static-analysis'",
  );
  assert.equal(
    namedStep('native-linux-shards', 'Prove Linux analyzer rejects bad sources').if,
    "matrix.lane == 'static-analysis'",
  );
  assert.equal(
    namedStep('native-linux-shards', 'Run focused Linux GCC 13 guard and launcher quality').if,
    "matrix.lane == 'gcc-package'",
  );
  assert.equal(
    namedStep('native-linux-shards', 'Build and verify Linux Whisper.cpp CPU pack').if,
    "matrix.lane == 'gcc-package'",
  );
  assert.equal(
    namedStep('native-linux-shards', 'Verify Linux AMD contracts without hardware claims').if,
    "matrix.lane == 'gcc-package'",
  );
  assert.match(shards, /verify:local-whisper:worker-vectors/u);
  assert.match(shards, /lint:local-whisper:worker-common/u);
  assert.match(shards, /test:local-whisper:native-analysis/u);
  assert.match(shards, /test:local-whisper:fs-guard:gcc/u);
  assert.match(shards, /verify:local-whisper:native-hardening -- --platform=linux/u);
  assert.equal(count(workflowText, 'Run bounded Linux parser fuzzing'), 1);
  assert.equal(count(workflowText, 'Run focused Linux GCC 13 guard and launcher quality'), 1);
});

test('Windows core, analysis, and ASan lanes retain the complete required surface', () => {
  const core = jobText('native-windows-core');
  const shards = jobText('native-windows-shards');
  assert.match(core, /--codeql-database=\.cache\/codeql\/cpp-windows\/cpp/u);
  assert.match(core, /test:local-whisper:fs-guard:native/u);
  assert.match(core, /test:local-whisper:whisper-cpp-core/u);
  assert.match(core, /verify:local-whisper:native-hardening -- --platform=windows/u);
  assert.match(core, /windows-x64-cpu-msvc-19\.51-v1/u);
  assert.match(core, /windows-x64-cuda-12\.8\.1-sm120a-msvc-19\.39-v1/u);
  assert.match(core, /vulkan-windows-x64/u);
  assert.match(core, /category":"\/language:c-cpp,host:windows/u);
  const windowsCoreSteps = stepNames('native-windows-core');
  assert.ok(
    windowsCoreSteps.indexOf('Emit Windows native-quality coverage') >
      windowsCoreSteps.indexOf('Analyze Windows C++ CodeQL database'),
  );
  assert.match(shards, /LOCAL_WHISPER_MSVC_ANALYZE/u);
  assert.match(shards, /test:local-whisper:fs-guard:msvc-asan/u);
  assert.match(shards, /test:local-whisper:whisper-cpp:msvc-asan/u);
  assert.match(shards, /--platform=windows --contract-only/u);
  assert.equal(namedStep('native-windows-shards', 'Run MSVC /analyze native suites').if, "matrix.lane == 'analyze'");
  assert.equal(
    namedStep('native-windows-shards', 'Run MSVC AddressSanitizer native suites').if,
    "matrix.lane == 'asan'",
  );
  assert.equal(count(workflowText, 'Run MSVC /analyze native suites'), 1);
  assert.equal(count(workflowText, 'Run MSVC AddressSanitizer native suites'), 1);
  assert.doesNotMatch(shards, /continue-on-error/u);
});

test('Quality Gates parallelizes static, test/build, and CodeQL work with scoped permissions', () => {
  const qualityStatic = job('quality-static');
  const qualityTests = job('quality-tests');
  const qualityCodeql = job('quality-codeql');
  assert.equal(qualityStatic.needs, undefined);
  assert.equal(qualityTests.needs, undefined);
  assert.equal(qualityCodeql.needs, undefined);
  assert.equal(qualityStatic['timeout-minutes'], '${{ fromJSON(vars.CI_QUALITY_TIMEOUT_MINUTES) }}');
  assert.equal(qualityTests['timeout-minutes'], '${{ fromJSON(vars.CI_QUALITY_TIMEOUT_MINUTES) }}');
  assert.equal(qualityCodeql['timeout-minutes'], '${{ fromJSON(vars.CI_QUALITY_TIMEOUT_MINUTES) }}');
  assert.equal(record(namedStep('quality-tests', 'Checkout').with, 'quality-tests checkout inputs')['fetch-depth'], 0);

  const gate = job('quality');
  assert.equal(gate.name, 'Quality Gates');
  assert.equal(gate.if, '${{ always() }}');
  assert.deepEqual(gate.needs, ['quality-static', 'quality-tests', 'quality-codeql']);
  assert.match(jobText('quality'), /needs\.quality-static\.result/u);
  assert.match(jobText('quality'), /needs\.quality-tests\.result/u);
  assert.match(jobText('quality'), /needs\.quality-codeql\.result/u);

  const codeqlPermissionJobs = Object.entries(jobs)
    .filter(([, value]) => record(value, 'job').permissions !== undefined)
    .filter(([, value]) => record(record(value, 'job').permissions, 'permissions')['security-events'] === 'write')
    .map(([name]) => name)
    .sort();
  assert.deepEqual(codeqlPermissionJobs, ['native-linux-core', 'native-windows-core', 'quality-codeql']);
  assert.equal(record(workflow.permissions, 'workflow permissions')['security-events'], undefined);
  assert.equal(count(workflowText, 'queries: security-and-quality'), 3);
});

test('Package smoke starts independently while attestations remain downstream', () => {
  const packageSmoke = job('package-smoke');
  assert.equal(packageSmoke.needs, undefined);
  assert.equal(job('package-attestation-input').needs, 'package-smoke');
  assert.equal(job('package-attestation').needs, 'package-attestation-input');
  const rows = matrixRows('package-smoke');
  assert.deepEqual(rows.map((row) => row.artifactPlatform).sort(), ['linux', 'win32']);
  assert.match(jobText('package-smoke'), /Build and smoke exact Linux packages in Fedora/u);
  assert.match(jobText('package-smoke'), /Build and smoke Windows package/u);
  assert.match(jobText('package-attestation-input'), /verify:security:package-attestation/u);
  assert.doesNotMatch(jobText('package-attestation'), /actions\/checkout|setup-ci-project|npm run/u);
});

test('security aggregate consumes real native, CodeQL, package, and attestation job results', () => {
  const aggregate = job('security-aggregate');
  assert.equal(aggregate.if, '${{ always() }}');
  assert.deepEqual(aggregate.needs, [
    'native-quality-linux',
    'native-quality-windows',
    'quality',
    'package-attestation',
  ]);
  const aggregateText = jobText('security-aggregate');
  for (const dependency of aggregate.needs) {
    assert.equal(aggregateText.includes(`needs.${dependency}.result`), true);
  }
  assert.match(aggregateText, /!= 'success'/u);
});

test('Native analysis and CodeQL retain real host builds and source inclusion contracts', () => {
  const codeqlConfig = readFileSync('.github/codeql-config.yml', 'utf8');
  const windowsBuildDrivers = [
    'scripts/local-whisper/native-fs-guard-quality.mjs',
    'scripts/local-whisper/native-launcher-quality.mjs',
    'scripts/local-whisper/native-worker-quality.mjs',
    'scripts/local-whisper/whisper-cpp-build-core.mjs',
  ].map((path) => readFileSync(path, 'utf8'));
  const analyzerConfigurations = [
    'runtime/local-whisper/common/.clang-tidy',
    'runtime/local-whisper/fs-guard/.clang-tidy',
    'runtime/local-whisper/launcher/.clang-tidy',
    'runtime/local-whisper/whisper-cpp/.clang-tidy',
  ].map((path) => readFileSync(path, 'utf8'));
  const nativeHardening = readFileSync('runtime/local-whisper/cmake/LocalWhisperHardening.cmake', 'utf8');

  assert.equal(count(workflowText, 'languages: c-cpp'), 2);
  assert.equal(count(workflowText, 'languages: javascript-typescript'), 1);
  assert.equal(count(workflowText, 'build-mode: manual'), 2);
  assert.match(workflowText, /schedule:\r?\n {4}- cron: '17 3 \* \* 1'/u);
  assert.match(workflowText, /- \.github\/codeql-config\.yml/u);
  assert.match(workflowText, /- docs\/specs\/local-whisper-native-review-remediation\/\*\*/u);
  assert.match(workflowText, /- eslint\.config\.mjs/u);
  assert.match(workflowText, /- postcss\.config\.js/u);
  assert.match(workflowText, /- tsconfig\*\.json/u);
  assert.match(workflowText, /- scripts\/\*\*/u);
  assert.match(workflowText, /- src\/renderer\/\*\*/u);
  assert.match(codeqlConfig, /src\/main/u);
  assert.match(codeqlConfig, /src\/renderer/u);
  assert.match(codeqlConfig, /src\/shared/u);
  assert.match(codeqlConfig, /scripts/u);
  assert.match(codeqlConfig, /build/u);
  assert.match(codeqlConfig, /webpack\.config\.js/u);
  assert.match(codeqlConfig, /eslint\.config\.mjs/u);
  assert.match(nativeHardening, /LOCAL_WHISPER_MSVC_ANALYZE/u);
  assert.match(
    nativeHardening,
    /target_compile_options\(\$\{target\} PRIVATE \/analyze \/analyze:external- \/external:W0 \/analyze:autolog-\)/u,
  );
  assert.ok(windowsBuildDrivers.every((driver) => driver.includes('LOCAL_WHISPER_MSVC_ANALYZE=ON')));
  assert.ok(windowsBuildDrivers.every((driver) => !driver.includes('CMAKE_CXX_FLAGS=/analyze')));
  assert.ok(analyzerConfigurations.every((configuration) => configuration.includes('clang-analyzer-*')));
});
