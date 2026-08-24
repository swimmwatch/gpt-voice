import { parse } from 'yaml';

import { isRecord } from '../packaging/contracts';

const CANDIDATE_JOB_IDS = Object.freeze([
  'validate-production-inputs',
  'verify-production-signing-authority',
  'build-linux-runtimes',
  'build-windows-runtimes',
  'produce-production-bundles',
  'build-linux',
  'build-windows',
  'verify-release-attestation-input',
  'attest-release',
  'verify-production-candidate',
]);
const PRODUCTION_ENVIRONMENT_NAME = 'local-whisper-production';
const PRODUCTION_SIGNING_JOB_IDS: readonly string[] = Object.freeze([
  'verify-production-signing-authority',
  'produce-production-bundles',
  'verify-production-candidate',
]);
const PRODUCTION_SIGNING_PRIVATE_KEY_SECRET = 'secrets.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM';
const PROTECTED_JOB_IDS = Object.freeze([
  ...PRODUCTION_SIGNING_JOB_IDS,
  'build-linux-runtimes',
  'build-windows-runtimes',
  'build-linux',
  'build-windows',
  'publish',
]);

function parseWorkflow(text: string): Readonly<Record<string, unknown>> {
  const workflow = parse(text) as unknown;
  if (!isRecord(workflow) || !isRecord(workflow.on) || !isRecord(workflow.jobs)) {
    throw new Error('RELEASE_WORKFLOW_INVALID');
  }
  return workflow;
}

function needsJob(job: Readonly<Record<string, unknown>>, dependency: string): boolean {
  return job.needs === dependency || (Array.isArray(job.needs) && job.needs.includes(dependency));
}

function verifyDispatchContract(triggers: Readonly<Record<string, unknown>>): void {
  const dispatch = triggers.workflow_dispatch;
  if (!isRecord(dispatch) || !isRecord(dispatch.inputs) || Object.keys(triggers).length !== 1) {
    throw new Error('RELEASE_WORKFLOW_TRIGGER_INVALID');
  }
  const inputNames = Object.keys(dispatch.inputs).sort();
  const candidateLabel = dispatch.inputs.candidate_label;
  const candidateRunId = dispatch.inputs.candidate_run_id;
  const publish = dispatch.inputs.publish;
  const releaseTag = dispatch.inputs.release_tag;
  const watchCorrelation = dispatch.inputs.watch_correlation;
  if (
    inputNames.join(',') !== 'candidate_label,candidate_run_id,publish,release_tag,watch_correlation' ||
    !isRecord(candidateLabel) ||
    candidateLabel.required !== true ||
    candidateLabel.type !== 'string' ||
    !isRecord(candidateRunId) ||
    candidateRunId.required !== false ||
    candidateRunId.type !== 'string' ||
    !isRecord(publish) ||
    publish.required !== false ||
    publish.default !== false ||
    publish.type !== 'boolean' ||
    !isRecord(releaseTag) ||
    releaseTag.required !== false ||
    releaseTag.type !== 'string' ||
    !isRecord(watchCorrelation) ||
    watchCorrelation.required !== false ||
    watchCorrelation.type !== 'string'
  ) {
    throw new Error('RELEASE_WORKFLOW_PUBLICATION_INPUT_INVALID');
  }
}

function verifyCandidateJobs(jobs: Readonly<Record<string, unknown>>): void {
  for (const [jobId, job] of Object.entries(jobs)) {
    if (jobId === 'publish') continue;
    if (!isRecord(job)) throw new Error('RELEASE_WORKFLOW_CANDIDATE_JOBS_MISSING');
    const jobText = JSON.stringify(job);
    if (
      (isRecord(job.permissions) && job.permissions.contents === 'write') ||
      jobText.includes('gh release') ||
      jobText.includes('gh api')
    ) {
      throw new Error('RELEASE_WORKFLOW_CANDIDATE_MUTATION_FORBIDDEN');
    }
  }

  for (const jobId of CANDIDATE_JOB_IDS) {
    const job = jobs[jobId];
    if (!isRecord(job)) throw new Error('RELEASE_WORKFLOW_CANDIDATE_JOBS_MISSING');
  }

  const verification = jobs['verify-production-candidate'];
  if (!isRecord(verification)) throw new Error('RELEASE_WORKFLOW_CANDIDATE_JOBS_MISSING');
  const verificationText = JSON.stringify(verification);
  const assembleIndex = verificationText.indexOf('construct:local-whisper:production-candidate');
  const verifyIndex = verificationText.indexOf('verify:local-whisper:production-candidate');
  const preserveIndex = verificationText.indexOf('gpt-voice-production-candidate');
  if (
    assembleIndex < 0 ||
    verifyIndex <= assembleIndex ||
    preserveIndex <= verifyIndex ||
    !verificationText.includes('contents":"read') ||
    !verificationText.includes('--target-kind=') ||
    !verificationText.includes('--expected-target=')
  ) {
    throw new Error('RELEASE_WORKFLOW_VERIFIED_CANDIDATE_REQUIRED');
  }
}

function verifyProtectedEnvironment(jobs: Readonly<Record<string, unknown>>): void {
  for (const jobId of PROTECTED_JOB_IDS) {
    const job = jobs[jobId];
    if (!isRecord(job) || job.environment !== PRODUCTION_ENVIRONMENT_NAME) {
      throw new Error('RELEASE_WORKFLOW_PROTECTED_ENVIRONMENT_REQUIRED');
    }
  }
}

function verifySigningAuthority(jobs: Readonly<Record<string, unknown>>): void {
  const requiredCommands = new Map([
    ['verify-production-signing-authority', 'verify:local-whisper:production-signing-authority'],
    ['produce-production-bundles', 'construct:local-whisper:production-bundle'],
    ['verify-production-candidate', 'construct:local-whisper:production-candidate'],
  ]);
  for (const [jobId, command] of requiredCommands) {
    const signingJob = jobs[jobId];
    if (!isRecord(signingJob)) throw new Error('RELEASE_WORKFLOW_SIGNING_AUTHORITY_REQUIRED');
    const signingText = JSON.stringify(signingJob);
    if (
      !signingText.includes(command) ||
      !signingText.includes('vars.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_ID') ||
      !signingText.includes('vars.CI_LOCAL_WHISPER_PRODUCTION_SIGNING_PUBLIC_KEY_PEM') ||
      !signingText.includes(PRODUCTION_SIGNING_PRIVATE_KEY_SECRET)
    ) {
      throw new Error('RELEASE_WORKFLOW_SIGNING_AUTHORITY_REQUIRED');
    }
  }
  for (const [jobId, job] of Object.entries(jobs)) {
    if (
      !PRODUCTION_SIGNING_JOB_IDS.includes(jobId) &&
      JSON.stringify(job).includes(PRODUCTION_SIGNING_PRIVATE_KEY_SECRET)
    ) {
      throw new Error('RELEASE_WORKFLOW_SIGNING_AUTHORITY_LEAKED');
    }
  }
  for (const jobId of ['build-linux-runtimes', 'build-windows-runtimes']) {
    const job = jobs[jobId];
    if (!isRecord(job) || !needsJob(job, 'verify-production-signing-authority')) {
      throw new Error('RELEASE_WORKFLOW_SIGNING_AUTHORITY_REQUIRED');
    }
  }
  const preflight = jobs['verify-production-signing-authority'];
  if (!isRecord(preflight) || preflight.if !== '${{ inputs.publish != true }}') {
    throw new Error('RELEASE_WORKFLOW_PUBLICATION_REBUILD_FORBIDDEN');
  }
}

function verifyConstructionGraph(jobs: Readonly<Record<string, unknown>>): void {
  const bundle = jobs['produce-production-bundles'];
  const linuxApplication = jobs['build-linux'];
  const windowsApplication = jobs['build-windows'];
  const windowsRuntimes = jobs['build-windows-runtimes'];
  const candidate = jobs['verify-production-candidate'];
  if (
    !isRecord(bundle) ||
    !needsJob(bundle, 'validate-production-inputs') ||
    !needsJob(bundle, 'build-linux-runtimes') ||
    !needsJob(bundle, 'build-windows-runtimes') ||
    !isRecord(linuxApplication) ||
    !needsJob(linuxApplication, 'produce-production-bundles') ||
    !isRecord(windowsApplication) ||
    !needsJob(windowsApplication, 'produce-production-bundles') ||
    !isRecord(candidate) ||
    !needsJob(candidate, 'validate-production-inputs') ||
    !needsJob(candidate, 'produce-production-bundles') ||
    !needsJob(candidate, 'build-linux') ||
    !needsJob(candidate, 'build-windows') ||
    !needsJob(candidate, 'attest-release')
  ) {
    throw new Error('RELEASE_WORKFLOW_CONSTRUCTION_GRAPH_INVALID');
  }
  for (const jobId of CANDIDATE_JOB_IDS) {
    if (jobId === 'validate-production-inputs' || jobId === 'verify-production-signing-authority') continue;
    const job = jobs[jobId];
    if (isRecord(job) && Object.prototype.hasOwnProperty.call(job, 'if')) {
      throw new Error('RELEASE_WORKFLOW_PUBLICATION_REBUILD_FORBIDDEN');
    }
  }
  if (
    JSON.stringify(linuxApplication).includes('produce-runtime-packs.mjs') ||
    JSON.stringify(windowsApplication).includes('produce-runtime-packs.mjs')
  ) {
    throw new Error('RELEASE_WORKFLOW_CONSTRUCTION_GRAPH_INVALID');
  }
  if (!isRecord(windowsRuntimes)) throw new Error('RELEASE_WORKFLOW_CONSTRUCTION_GRAPH_INVALID');
  const windowsRuntimeText = JSON.stringify(windowsRuntimes);
  const cpuToolsetIndex = windowsRuntimeText.indexOf('Initialize exact MSVC 14.51 developer environment');
  const cpuBuildIndex = windowsRuntimeText.indexOf('--backend=cpu --platform=win32');
  const cudaToolsetIndex = windowsRuntimeText.indexOf('Initialize exact MSVC 14.39 developer environment');
  const cudaBuildIndex = windowsRuntimeText.indexOf('--backend=cuda --platform=win32');
  if (
    cpuToolsetIndex < 0 ||
    cpuBuildIndex <= cpuToolsetIndex ||
    cudaToolsetIndex <= cpuBuildIndex ||
    cudaBuildIndex <= cudaToolsetIndex ||
    !windowsRuntimeText.includes('"toolset-version":"14.51"') ||
    !windowsRuntimeText.includes('"toolset-version":"14.39"')
  ) {
    throw new Error('RELEASE_WORKFLOW_CONSTRUCTION_GRAPH_INVALID');
  }
}

function verifyPublishJob(jobs: Readonly<Record<string, unknown>>): void {
  const publish = jobs.publish;
  const publishCondition = isRecord(publish) && typeof publish.if === 'string' ? publish.if : '';
  if (
    !isRecord(publish) ||
    !publishCondition.includes('inputs.publish == true') ||
    !publishCondition.includes("needs.validate-production-inputs.result == 'success'") ||
    !publishCondition.includes("needs.verify-production-candidate.result == 'skipped'") ||
    !needsJob(publish, 'validate-production-inputs') ||
    !needsJob(publish, 'verify-production-candidate') ||
    !isRecord(publish.permissions) ||
    publish.permissions.actions !== 'read' ||
    publish.permissions.contents !== 'write'
  ) {
    throw new Error('RELEASE_WORKFLOW_PUBLICATION_GATE_INVALID');
  }
  const publishText = JSON.stringify(publish);
  const requiredMarkers = [
    'gpt-voice-production-candidate',
    'gpt-voice-production-candidate-descriptor',
    'candidate-run-id',
    'github-token',
    'run-id',
    'verify:local-whisper:production-promotion-source',
    'verify:local-whisper:production-candidate',
    'verify:local-whisper:published-release',
    'gpt-voice-alpha-deployment-evidence',
    'inputs.release_tag',
    'candidate_target',
    'github.sha',
    'gh api',
    'gh release view',
    'gh release create',
    'release-assets',
    '--target',
    '--prerelease',
  ];
  if (requiredMarkers.some((marker) => !publishText.includes(marker))) {
    throw new Error('RELEASE_WORKFLOW_PUBLICATION_INCOMPLETE');
  }
  if (
    [
      'construct:local-whisper:production-candidate',
      'construct:local-whisper:production-bundle',
      'electron-builder',
      'produce-runtime-packs.mjs',
    ].some((marker) => publishText.includes(marker))
  ) {
    throw new Error('RELEASE_WORKFLOW_PUBLICATION_REBUILD_FORBIDDEN');
  }
}

/** Guards the default-off candidate path while preserving the Task 33 publication capability. */
export class ReleaseWorkflowPolicyVerifier {
  public verify(workflow: string): void {
    const document = parseWorkflow(workflow);
    const triggers = document.on as Readonly<Record<string, unknown>>;
    const jobs = document.jobs as Readonly<Record<string, unknown>>;
    verifyDispatchContract(triggers);

    if (
      document['run-name'] !== '${{ inputs.watch_correlation || inputs.candidate_label }}' ||
      workflow.includes('github.event.release') ||
      workflow.includes('--clobber') ||
      !isRecord(document.permissions) ||
      document.permissions.contents !== 'read'
    ) {
      throw new Error('RELEASE_WORKFLOW_MUTATION_FORBIDDEN');
    }

    verifyCandidateJobs(jobs);
    verifyPublishJob(jobs);
    verifyProtectedEnvironment(jobs);
    verifySigningAuthority(jobs);
    verifyConstructionGraph(jobs);

    const workflowText = JSON.stringify(document);
    if (
      workflowText.includes('--mode=disabled') ||
      !workflowText.includes('--mode=production') ||
      !workflowText.includes('LOCAL_WHISPER_PRODUCTION_BUNDLE_DIRECTORY') ||
      !workflowText.includes('LOCAL_WHISPER_PRODUCTION_BUNDLE_DESCRIPTOR') ||
      !workflowText.includes('--bundle-descriptor=') ||
      !workflowText.includes('verify:local-whisper:packaging:release-guard') ||
      !workflowText.includes('produce-runtime-packs.mjs') ||
      !workflowText.includes('collect:local-whisper:hosted-production-runtime-archive') ||
      !workflowText.includes('construct:local-whisper:production-bundle') ||
      !workflowText.includes('construct:local-whisper:production-candidate') ||
      !workflowText.includes('verify:local-whisper:production-workflow-inputs') ||
      !workflowText.includes('link-hosted-production-toolchain.mjs') ||
      !workflowText.includes('provision:local-whisper:ninja-license') ||
      !workflowText.includes('kernel.apparmor_restrict_unprivileged_userns=0') ||
      !workflowText.includes('/usr/bin/unshare -Urn -- true') ||
      !workflowText.includes('kernel.apparmor_restrict_unprivileged_userns=1') ||
      !workflowText.includes("steps.linux-network-namespace.outcome != 'skipped'") ||
      !workflowText.includes('provision:local-whisper:windows-vc-runtime-license') ||
      !workflowText.includes('cuda-toolkit@b8bf9c6c28f8a92fbb04dcfcaee872e60c57462d') ||
      workflowText.includes('CI_LOCAL_WHISPER_LINUX_CPU_STAGE_A_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_LINUX_CPU_STAGE_B_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_LINUX_CUDA_STAGE_A_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_LINUX_CUDA_STAGE_B_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_WINDOWS_CPU_STAGE_A_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_WINDOWS_CPU_STAGE_B_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_WINDOWS_CUDA_STAGE_A_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_WINDOWS_CUDA_STAGE_B_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_PRODUCTION_BUNDLE_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_PRODUCTION_BUNDLE_SHA256') ||
      workflowText.includes('CI_LOCAL_WHISPER_PRODUCTION_CANDIDATE_ARTIFACTS_DIRECTORY') ||
      workflowText.includes('CI_LOCAL_WHISPER_PRODUCTION_CANDIDATE_MANIFEST_PATH') ||
      workflowText.includes('--bundle-digest=') ||
      !workflowText.includes('verify:local-whisper:production-candidate') ||
      !workflowText.includes('gpt-voice-local-whisper-runtimes-') ||
      !workflowText.includes('runtime-assets/*/*.tar.gz')
    ) {
      throw new Error('RELEASE_WORKFLOW_PRODUCTION_INPUTS_REQUIRED');
    }
  }
}
