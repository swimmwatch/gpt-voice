import { parse } from 'yaml';

import { isRecord } from '../packaging/contracts';
import runnerPolicy from './runner-policy.json';

export const NATIVE_PATH_OWNERS = [
  '.github/actions/**',
  '.github/workflows/**',
  'build/fedora-release/**',
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
    runner: '${{ vars.CI_LINUX_RUNNER }}',
    toolchain: 'clang-${{ vars.CI_LLVM_VERSION }}',
  },
  windows: {
    runner: '${{ vars.CI_WINDOWS_RUNNER }}',
    toolchain: 'msvc-hosted',
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
  readonly 'runs-on'?: unknown;
  readonly steps?: unknown;
  readonly strategy?: unknown;
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

function matrixRows(job: WorkflowJob): readonly Record<string, unknown>[] {
  if (!isRecord(job.strategy) || !isRecord(job.strategy.matrix) || !Array.isArray(job.strategy.matrix.include)) {
    throw new Error('native-quality must declare a matrix include list');
  }
  if (job.strategy['fail-fast'] !== false) throw new Error('native-quality matrix must disable fail-fast');
  return job.strategy.matrix.include.map((entry) => {
    if (!isRecord(entry)) throw new Error('native-quality matrix row must be an object');
    return entry;
  });
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

function verifyRequiredNativeMatrix(jobs: Record<string, WorkflowJob>): void {
  const job = jobs['native-quality'];
  if (!job || job['runs-on'] !== '${{ matrix.runner }}') {
    throw new Error('native-quality must run on its matrix runner');
  }
  const rows = matrixRows(job);
  if (rows.length !== Object.keys(PLATFORM_CONTRACTS).length) {
    throw new Error('native-quality must contain exactly one row for each supported platform');
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const platform = row.platform;
    if (platform !== 'linux' && platform !== 'windows')
      throw new Error('native-quality has an unsupported platform row');
    if (seen.has(platform)) throw new Error(`native-quality duplicates the ${platform} platform row`);
    seen.add(platform);
    const contract = PLATFORM_CONTRACTS[platform];
    if (row.runner !== contract.runner || row.toolchain !== contract.toolchain) {
      throw new Error(`native-quality ${platform} row does not use its configured runner and toolchain`);
    }
  }

  const text = jobText(job);
  if (
    !text.includes('--runner-label=${{ matrix.runner }}') ||
    !text.includes('--toolchain=${{ matrix.toolchain }}') ||
    !text.includes('--expected-os=${{ matrix.platform }}')
  ) {
    throw new Error('native-quality must emit evidence for its configured matrix row');
  }
}

function verifyPrimaryEvidence(jobs: Record<string, WorkflowJob>): void {
  const nativeQuality = jobText(jobs['native-quality'] ?? {});
  if (!nativeQuality.includes('native-sanitizer-proof') || !nativeQuality.includes('lint:local-whisper')) {
    throw new Error('Primary Linux runner must retain sanitizer and lint evidence');
  }
  if (!nativeQuality.includes('msvc-asan') || !nativeQuality.includes('native-hardening')) {
    throw new Error('Primary Windows runner must retain ASan and PE-hardening evidence');
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
  if (profile === 'msvc-hosted' && /Version 19\.\d+\./u.test(version)) return;
  throw new Error('Runner evidence compiler version does not match its toolchain profile');
}

/** Keeps the ordinary native matrix parameterized while retaining platform-specific quality evidence. */
export class RunnerPolicyVerifier {
  public ownsNativePath(path: string): boolean {
    return NATIVE_PATH_OWNERS.some((owner) => pathMatchesOwner(path, owner));
  }

  public verify(workflowText: string, configuredRunnerLabels: ConfiguredRunnerLabels = REQUIRED_RUNNER_LABELS): void {
    const jobs = parseJobs(workflowText);
    verifyPathFilters(workflowText);
    verifyConfiguredRunners(jobs);
    verifyConfiguredRunnerLabels(configuredRunnerLabels);
    verifyRequiredNativeMatrix(jobs);
    verifyPrimaryEvidence(jobs);
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
      (expectedWindowsToolchain && evidence.toolchain.profile !== 'msvc-hosted') ||
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
