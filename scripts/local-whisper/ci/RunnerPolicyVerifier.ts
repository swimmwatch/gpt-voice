import { parse } from 'yaml';

import { isRecord } from '../packaging/contracts';
import runnerPolicy from './runner-policy.json';

export const NATIVE_PATH_OWNERS = [
  '.github/actions/**',
  '.github/workflows/**',
  'build/fedora-release/**',
  'docs/specs/local-whisper-performance-remediation/**',
  'package-lock.json',
  'package.json',
  'runtime/local-whisper/**',
  'scripts/build-fedora-release.mjs',
  'scripts/local-whisper/**',
  'scripts/prepare-cloakbrowser.mjs',
  'src/main/localWhisper/**',
  'src/shared/localWhisper/**',
  'webpack.config.js',
] as const;

const REQUIRED_WORKFLOW_PATH_FILTERS = [
  '.github/actions/**',
  '.github/codeql-config.yml',
  '.github/workflows/**',
  'build/fedora-release/**',
  'package-lock.json',
  'package.json',
  'runtime/local-whisper/**',
  'scripts/**',
  'src/main/**',
  'src/renderer/**',
  'src/shared/**',
  'tests/**',
  'webpack.config.js',
] as const;

const PLATFORM_CONTRACTS = {
  linux: {
    coreJob: 'native-linux-core',
    coreTimeoutMinutes: 60,
    gateJob: 'native-quality-linux',
    gateName: 'Local Whisper Native Quality (Linux)',
    lanes: [
      { checkName: 'Static Analysis', lane: 'static-analysis', timeoutMinutes: 20 },
      { checkName: 'GCC and Package', lane: 'gcc-package', timeoutMinutes: 30 },
    ],
    runner: '${{ vars.CI_LINUX_RUNNER }}',
    shardJob: 'native-linux-shards',
    toolchain: 'clang-${{ vars.CI_LLVM_VERSION }}',
  },
  windows: {
    coreJob: 'native-windows-core',
    coreTimeoutMinutes: 60,
    gateJob: 'native-quality-windows',
    gateName: 'Local Whisper Native Quality (Windows)',
    lanes: [
      { checkName: 'MSVC Analyze', lane: 'analyze', timeoutMinutes: 30 },
      { checkName: 'MSVC AddressSanitizer', lane: 'asan', timeoutMinutes: 30 },
    ],
    runner: '${{ vars.CI_WINDOWS_RUNNER }}',
    shardJob: 'native-windows-shards',
    toolchain: 'windows-x64-msvc-19.51-v1',
  },
} as const;

const PERFORMANCE_CONTRACTS = {
  linux: {
    laneJob: 'performance-linux-fixtures',
    gateJob: 'performance-linux',
    gateName: 'Local Whisper Performance (Linux)',
    runner: '${{ vars.CI_LINUX_RUNNER }}',
    verifierCommand: 'verify:local-whisper:performance:linux',
  },
  windows: {
    laneJob: 'performance-windows-fixtures',
    gateJob: 'performance-windows',
    gateName: 'Local Whisper Performance (Windows)',
    runner: '${{ vars.CI_WINDOWS_RUNNER }}',
    verifierCommand: 'verify:local-whisper:qualification:windows',
  },
} as const;

export const REQUIRED_RUNNER_LABELS = {
  linux: runnerPolicy.linux,
  windows: runnerPolicy.windows,
} as const;

type NativePlatform = keyof typeof PLATFORM_CONTRACTS;

interface ConfiguredRunnerLabels {
  readonly linux: string;
  readonly windows: string;
}

const WORKFLOW_RUNNER_REFERENCES = new Set([
  '${{ matrix.runner }}',
  '${{ vars.CI_LINUX_RUNNER }}',
  '${{ vars.CI_WINDOWS_RUNNER }}',
]);
const CLANG_TOOLCHAIN = /^clang-(?<major>\d+)$/u;
const SOURCE_COMMIT = /^[a-f\d]{40}$/u;
const SHA_256 = /^[a-f\d]{64}$/u;

interface WorkflowJob {
  readonly env?: unknown;
  readonly if?: unknown;
  readonly name?: unknown;
  readonly needs?: unknown;
  readonly permissions?: unknown;
  readonly 'runs-on'?: unknown;
  readonly steps?: unknown;
  readonly strategy?: unknown;
  readonly 'timeout-minutes'?: unknown;
}

interface RunnerEvidence {
  readonly architecture?: unknown;
  readonly nativeSourceManifest?: unknown;
  readonly reportedImage?: unknown;
  readonly runnerLabel?: unknown;
  readonly sourceCommit?: unknown;
  readonly testedDigests?: unknown;
  readonly toolchain?: unknown;
}

function parseJobs(text: string): Record<string, WorkflowJob> {
  const document = parse(text) as unknown;
  if (!isRecord(document) || !isRecord(document.jobs)) throw new Error('Native CI workflow must declare jobs');
  const jobs: Record<string, WorkflowJob> = {};
  for (const [name, value] of Object.entries(document.jobs)) {
    if (!isRecord(value)) throw new Error(`Native CI job ${name} must be an object`);
    jobs[name] = value;
  }
  return jobs;
}

function jobText(job: WorkflowJob): string {
  return JSON.stringify(job);
}

function pathMatchesOwner(path: string, owner: string): boolean {
  return owner.endsWith('/**') ? path.startsWith(owner.slice(0, -2)) : path === owner;
}

function countOccurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

function matrixRows(job: WorkflowJob, owner: string): readonly Record<string, unknown>[] {
  if (!isRecord(job.strategy) || !isRecord(job.strategy.matrix) || !Array.isArray(job.strategy.matrix.include)) {
    throw new Error(`${owner} must declare a matrix include list`);
  }
  if (job.strategy['fail-fast'] !== false) throw new Error(`${owner} matrix must disable fail-fast`);
  return job.strategy.matrix.include.map((entry) => {
    if (!isRecord(entry)) throw new Error(`${owner} matrix row must be an object`);
    return entry;
  });
}

function exactStringSet(value: unknown, expected: readonly string[], error: string): void {
  if (!Array.isArray(value)) throw new Error(error);
  const actual = value.map((entry) => {
    if (typeof entry !== 'string') throw new Error(error);
    return entry;
  });
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected].sort())) throw new Error(error);
}

function exactPermissions(value: unknown, expected: Readonly<Record<string, string>>): boolean {
  if (!isRecord(value)) return false;
  return JSON.stringify(Object.entries(value).sort()) === JSON.stringify(Object.entries(expected).sort());
}

function verifyPathFilters(workflowText: string): void {
  if (!workflowText.includes('pull_request:')) return;
  for (const path of REQUIRED_WORKFLOW_PATH_FILTERS) {
    if (countOccurrences(workflowText, `- ${path}`) !== 2) {
      throw new Error(`Native CI workflow must select ${path} on pull requests and pushes`);
    }
  }
}

function verifyConfiguredRunners(jobs: Record<string, WorkflowJob>): void {
  for (const [jobName, job] of Object.entries(jobs)) {
    if (typeof job['runs-on'] !== 'string' || !WORKFLOW_RUNNER_REFERENCES.has(job['runs-on'])) {
      throw new Error(`Job ${jobName} must use a configured runner reference`);
    }
  }
}

function verifyConfiguredRunnerLabels(labels: ConfiguredRunnerLabels): void {
  for (const platform of Object.keys(REQUIRED_RUNNER_LABELS) as NativePlatform[]) {
    if (labels[platform] !== REQUIRED_RUNNER_LABELS[platform]) {
      throw new Error(`Configured ${platform} runner must be ${REQUIRED_RUNNER_LABELS[platform]}`);
    }
  }
}

function verifyRequiredNativeParallelism(jobs: Record<string, WorkflowJob>): void {
  for (const platform of Object.keys(PLATFORM_CONTRACTS) as NativePlatform[]) {
    const contract = PLATFORM_CONTRACTS[platform];
    const core = jobs[contract.coreJob];
    const shards = jobs[contract.shardJob];
    const gate = jobs[contract.gateJob];
    if (!core || core['runs-on'] !== contract.runner) {
      throw new Error(`${contract.coreJob} must use its configured ${platform} runner`);
    }
    if (core.needs !== undefined || core['timeout-minutes'] !== contract.coreTimeoutMinutes) {
      throw new Error(`${contract.coreJob} must start independently with its approved timeout`);
    }
    if (!shards || shards['runs-on'] !== '${{ matrix.runner }}') {
      throw new Error(`${contract.shardJob} must run on its matrix runner`);
    }
    if (shards.needs !== undefined || shards['timeout-minutes'] !== '${{ matrix.timeoutMinutes }}') {
      throw new Error(`${contract.shardJob} must start independently with matrix-owned timeouts`);
    }
    const rows = matrixRows(shards, contract.shardJob);
    if (rows.length !== contract.lanes.length) {
      throw new Error(`${contract.shardJob} must contain the exact approved lane count`);
    }
    const lanes = rows.map((row) => row.lane);
    exactStringSet(
      lanes,
      contract.lanes.map((lane) => lane.lane),
      `${contract.shardJob} must contain the exact approved lanes`,
    );
    if (rows.some((row) => row.runner !== contract.runner)) {
      throw new Error(`${contract.shardJob} must use its configured ${platform} runner`);
    }
    for (const lane of contract.lanes) {
      const row = rows.find((candidate) => candidate.lane === lane.lane);
      if (!row || row.checkName !== lane.checkName || row.timeoutMinutes !== lane.timeoutMinutes) {
        throw new Error(`${contract.shardJob} ${lane.lane} metadata must remain parameterized and exact`);
      }
    }
    if (
      !gate ||
      gate.name !== contract.gateName ||
      gate.if !== '${{ always() }}' ||
      gate['runs-on'] !== contract.runner
    ) {
      throw new Error(`${contract.gateJob} must remain an always-running configured aggregate gate`);
    }
    exactStringSet(
      gate.needs,
      [contract.coreJob, contract.shardJob],
      `${contract.gateJob} must require every ${platform} native lane`,
    );
    const gateText = jobText(gate);
    if (
      !gateText.includes(`needs.${contract.coreJob}.result`) ||
      !gateText.includes(`needs.${contract.shardJob}.result`) ||
      countOccurrences(gateText, 'success') !== 2 ||
      gateText.includes('continue-on-error')
    ) {
      throw new Error(`${contract.gateJob} must fail closed over every ${platform} native lane`);
    }
    const coreText = jobText(core);
    if (
      !exactPermissions(core.permissions, { contents: 'read', 'security-events': 'write' }) ||
      !coreText.includes(`--runner-label=${contract.runner}`) ||
      !coreText.includes(`TOOLCHAIN":"${contract.toolchain}`)
    ) {
      throw new Error(`${contract.coreJob} must retain least-privilege CodeQL and runner evidence`);
    }
    if (jobText(shards).includes('security-events') || gateText.includes('security-events')) {
      throw new Error(`${platform} non-CodeQL native lanes must not write security events`);
    }
  }
}

function verifyPrimaryEvidence(jobs: Record<string, WorkflowJob>): void {
  const linuxCore = jobText(jobs['native-linux-core'] ?? {});
  const linuxShards = jobText(jobs['native-linux-shards'] ?? {});
  const windowsCore = jobText(jobs['native-windows-core'] ?? {});
  const windowsShards = jobText(jobs['native-windows-shards'] ?? {});
  if (
    !linuxCore.includes('native-sanitizer-proof') ||
    !linuxCore.includes('worker-tsan') ||
    !linuxCore.includes('native-fuzz') ||
    !linuxShards.includes('lint:local-whisper') ||
    !linuxShards.includes('native-analysis') ||
    !linuxShards.includes('fs-guard:gcc') ||
    !linuxShards.includes('native-hardening')
  ) {
    throw new Error('Primary Linux runner must retain sanitizer and lint evidence');
  }
  if (
    !windowsCore.includes('native-hardening') ||
    !windowsCore.includes('languages":"c-cpp') ||
    !windowsShards.includes('msvc-asan') ||
    !windowsShards.includes('LOCAL_WHISPER_MSVC_ANALYZE')
  ) {
    throw new Error('Primary Windows runner must retain ASan and PE-hardening evidence');
  }
  const nativeJobs = [linuxCore, linuxShards, windowsCore, windowsShards].join('');
  if (nativeJobs.includes('continue-on-error')) throw new Error('Native quality lanes must fail closed');
}

function verifyPerformanceQualification(jobs: Record<string, WorkflowJob>): void {
  for (const [platform, contract] of Object.entries(PERFORMANCE_CONTRACTS)) {
    const lane = jobs[contract.laneJob];
    const gate = jobs[contract.gateJob];
    if (
      !lane ||
      lane['runs-on'] !== contract.runner ||
      lane.needs !== undefined ||
      lane['timeout-minutes'] !== 15 ||
      !exactPermissions(lane.permissions, { contents: 'read' })
    ) {
      throw new Error(`${platform} performance fixture lane must use its configured runner and least privilege`);
    }
    const laneText = jobText(lane);
    if (
      !laneText.includes('test:local-whisper:performance-contracts') ||
      !laneText.includes(contract.verifierCommand) ||
      laneText.includes('continue-on-error') ||
      laneText.includes('materialize:local-whisper:qualification:models')
    ) {
      throw new Error(`${platform} performance fixture lane must run only the deterministic contract checks`);
    }
    if (
      !gate ||
      gate.name !== contract.gateName ||
      gate.if !== '${{ always() }}' ||
      gate['runs-on'] !== contract.runner ||
      gate['timeout-minutes'] !== 5
    ) {
      throw new Error(`${contract.gateJob} must remain an always-running configured aggregate gate`);
    }
    exactStringSet(gate.needs, [contract.laneJob], `${contract.gateJob} must require every performance lane`);
    const gateText = jobText(gate);
    if (
      !gateText.includes(`needs.${contract.laneJob}.result`) ||
      countOccurrences(gateText, 'success') !== 1 ||
      gateText.includes('continue-on-error')
    ) {
      throw new Error(`${contract.gateJob} must fail closed over every performance lane`);
    }
  }
}

function operatingSystemForRunner(runnerLabel: string): 'Linux' | 'Windows' {
  if (runnerLabel === REQUIRED_RUNNER_LABELS.linux) return 'Linux';
  if (runnerLabel === REQUIRED_RUNNER_LABELS.windows) return 'Windows';
  throw new Error('Runner evidence has an unsupported label');
}

function verifyToolchainVersion(profile: string, version: string): void {
  const clang = CLANG_TOOLCHAIN.exec(profile);
  if (clang && new RegExp(`clang version ${clang.groups?.major}\\.`, 'u').test(version)) return;
  if (profile === 'windows-x64-msvc-19.51-v1' && /Version 19\.51\./u.test(version)) return;
  throw new Error('Runner evidence compiler version does not match its toolchain profile');
}

/** Keeps parallel native lanes parameterized while retaining fail-closed platform evidence. */
export class RunnerPolicyVerifier {
  public ownsNativePath(path: string): boolean {
    return NATIVE_PATH_OWNERS.some((owner) => pathMatchesOwner(path, owner));
  }

  public verify(workflowText: string, configuredRunnerLabels: ConfiguredRunnerLabels = REQUIRED_RUNNER_LABELS): void {
    const jobs = parseJobs(workflowText);
    verifyPathFilters(workflowText);
    verifyConfiguredRunners(jobs);
    verifyConfiguredRunnerLabels(configuredRunnerLabels);
    verifyRequiredNativeParallelism(jobs);
    verifyPrimaryEvidence(jobs);
    verifyPerformanceQualification(jobs);
  }

  public verifyEvidence(value: unknown): void {
    if (!isRecord(value)) throw new Error('Runner evidence must be an object');
    const evidence: RunnerEvidence = value;
    if (typeof evidence.runnerLabel !== 'string') throw new Error('Runner evidence has an unsupported label');
    const expectedOperatingSystem = operatingSystemForRunner(evidence.runnerLabel);
    if (evidence.architecture !== 'x64') throw new Error('Runner evidence requires x64 architecture');
    if (typeof evidence.sourceCommit !== 'string' || !SOURCE_COMMIT.test(evidence.sourceCommit)) {
      throw new Error('Runner evidence requires an exact source commit');
    }
    if (
      !isRecord(evidence.reportedImage) ||
      typeof evidence.reportedImage.imageOS !== 'string' ||
      typeof evidence.reportedImage.imageVersion !== 'string' ||
      evidence.reportedImage.runnerOS !== expectedOperatingSystem
    ) {
      throw new Error('Runner evidence host does not match its runner label');
    }
    if (
      !isRecord(evidence.toolchain) ||
      typeof evidence.toolchain.profile !== 'string' ||
      typeof evidence.toolchain.version !== 'string'
    ) {
      throw new Error('Runner evidence toolchain is missing');
    }
    const expectedWindowsToolchain = expectedOperatingSystem === 'Windows';
    if (
      (expectedWindowsToolchain && evidence.toolchain.profile !== 'windows-x64-msvc-19.51-v1') ||
      (!expectedWindowsToolchain && !CLANG_TOOLCHAIN.test(evidence.toolchain.profile))
    ) {
      throw new Error('Runner evidence toolchain does not match its runner label');
    }
    verifyToolchainVersion(evidence.toolchain.profile, evidence.toolchain.version);
    if (
      !isRecord(evidence.nativeSourceManifest) ||
      Object.keys(evidence.nativeSourceManifest).length === 0 ||
      Object.values(evidence.nativeSourceManifest).some((digest) => typeof digest !== 'string' || !SHA_256.test(digest))
    ) {
      throw new Error('Runner evidence native source manifest is invalid');
    }
    if (
      !Array.isArray(evidence.testedDigests) ||
      evidence.testedDigests.length === 0 ||
      evidence.testedDigests.some((digest) => typeof digest !== 'string' || !SOURCE_COMMIT.test(digest))
    ) {
      throw new Error('Runner evidence tested digests are invalid');
    }
  }
}
