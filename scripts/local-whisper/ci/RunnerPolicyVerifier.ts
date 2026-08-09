import { parse } from 'yaml';

import { isRecord } from '../packaging/contracts';

export const NATIVE_PATH_OWNERS = [
  '.github/actions/initialize-msvc-environment/action.yml',
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

const JOBS = {
  'native-quality-linux': { label: 'ubuntu-24.04', primary: true },
  'native-quality-windows': { label: 'windows-latest', primary: true },
} as const;

const APPROVED_RUNNER_LABELS = new Set(['ubuntu-24.04', 'windows-latest']);
interface WorkflowJob {
  readonly 'runs-on'?: unknown;
  readonly steps?: unknown;
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

const SOURCE_COMMIT = /^[a-f\d]{40}$/u;
const SHA_256 = /^[a-f\d]{64}$/u;

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

function expectedToolchain(runnerLabel: string): string {
  return runnerLabel.startsWith('windows-') ? 'msvc-19.39' : 'clang-18';
}

function verifyPathFilters(workflowText: string): void {
  if (!workflowText.includes('pull_request:')) return;
  for (const owner of NATIVE_PATH_OWNERS) {
    if (countOccurrences(workflowText, `- ${owner}`) !== 2) {
      throw new Error(`Native CI workflow must select ${owner} on pull requests and pushes`);
    }
  }
}

function verifyApprovedRunners(jobs: Record<string, WorkflowJob>): void {
  for (const [jobName, job] of Object.entries(jobs)) {
    if (!isRecord(job) || typeof job['runs-on'] !== 'string') continue;
    if (!APPROVED_RUNNER_LABELS.has(job['runs-on'])) {
      throw new Error(`Job ${jobName} has an unsupported runner label ${job['runs-on']}`);
    }
  }
}

function verifyRequiredRunnerJobs(jobs: Record<string, WorkflowJob>): void {
  for (const [jobName, contract] of Object.entries(JOBS)) {
    const job = jobs[jobName];
    if (!isRecord(job) || job['runs-on'] !== contract.label) {
      throw new Error(`${jobName} must run on ${contract.label}`);
    }
    const text = jobText(job);
    if (
      !text.includes(`--runner-label=${contract.label}`) ||
      !text.includes(`--toolchain=${expectedToolchain(contract.label)}`)
    ) {
      throw new Error(`${jobName} must emit evidence for its exact runner and toolchain`);
    }
  }
}

function verifyPrimaryEvidence(jobs: Record<string, WorkflowJob>): void {
  const primaryLinux = jobText(jobs['native-quality-linux'] ?? {});
  const primaryWindows = jobText(jobs['native-quality-windows'] ?? {});
  if (!primaryLinux.includes('native-sanitizer-proof') || !primaryLinux.includes('lint:local-whisper')) {
    throw new Error('Primary Linux runner must retain sanitizer and lint evidence');
  }
  if (!primaryWindows.includes('msvc-asan') || !primaryWindows.includes('native-hardening')) {
    throw new Error('Primary Windows runner must retain ASan and PE-hardening evidence');
  }
}

/** Keeps the ordinary native matrix fixed while retaining costly analysis on primary runners only. */
export class RunnerPolicyVerifier {
  public ownsNativePath(path: string): boolean {
    return NATIVE_PATH_OWNERS.some((owner) => pathMatchesOwner(path, owner));
  }

  public verify(workflowText: string): void {
    const jobs = parseJobs(workflowText);
    verifyPathFilters(workflowText);
    verifyApprovedRunners(jobs);
    verifyRequiredRunnerJobs(jobs);
    verifyPrimaryEvidence(jobs);
  }

  public verifyEvidence(value: unknown): void {
    if (!isRecord(value)) throw new Error('Runner evidence must be an object');
    const evidence: RunnerEvidence = value;
    if (typeof evidence.runnerLabel !== 'string' || !APPROVED_RUNNER_LABELS.has(evidence.runnerLabel)) {
      throw new Error('Runner evidence has an unsupported label');
    }
    if (evidence.architecture !== 'x64') throw new Error('Runner evidence requires x64 architecture');
    if (typeof evidence.sourceCommit !== 'string' || !SOURCE_COMMIT.test(evidence.sourceCommit)) {
      throw new Error('Runner evidence requires an exact source commit');
    }
    if (
      !isRecord(evidence.reportedImage) ||
      typeof evidence.reportedImage.imageOS !== 'string' ||
      typeof evidence.reportedImage.imageVersion !== 'string' ||
      typeof evidence.reportedImage.runnerOS !== 'string'
    ) {
      throw new Error('Runner evidence image metadata is missing');
    }
    const expectedOperatingSystem = evidence.runnerLabel.startsWith('windows-') ? 'Windows' : 'Linux';
    if (evidence.reportedImage.runnerOS !== expectedOperatingSystem) {
      throw new Error('Runner evidence host does not match its runner label');
    }
    if (!isRecord(evidence.toolchain) || typeof evidence.toolchain.profile !== 'string') {
      throw new Error('Runner evidence toolchain is missing');
    }
    const expectedToolchainProfile = expectedToolchain(evidence.runnerLabel);
    if (evidence.toolchain.profile !== expectedToolchainProfile) {
      throw new Error('Runner evidence toolchain does not match its runner label');
    }
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
