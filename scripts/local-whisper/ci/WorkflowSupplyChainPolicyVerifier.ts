import { parse } from 'yaml';

import { isRecord } from '../packaging/contracts';

const FULL_SHA_ACTION_REFERENCE = /^[\w.-]+\/[\w.-]+@[a-f\d]{40}\s+#\s+v[\w.-]+$/u;
const IMMUTABLE_IMAGE = /^(?<name>[\w./-]+:[\w.-]+)@sha256:[a-f\d]{64}$/u;
const EXECUTABLE_DOWNLOAD = /\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b/iu;
const BROAD_ANALYZER_SUPPRESSION = /--(?:disable|exclude|ignore)(?:=|\s+)(?:all|\*)\b/iu;
const UNSAFE_RUN_INTERPOLATION = /\$\{\{\s*(?:github\.(?:event|head_ref|ref_name)|inputs\.)/u;
const UNTRUSTED_CACHE_INTERPOLATION = /\$\{\{\s*github\.(?:event|head_ref|ref_name)/u;

export const ACTIONLINT_IMAGE =
  'rhysd/actionlint:1.7.9@sha256:a0383f60d92601e2694e24b24d37df7b6a40bed7cedbc447611c50009bf02d94';
export const FEDORA_44_IMAGE = 'fedora:44@sha256:6c75d5bf57cb0fa5aa4b92c6a83c86c791644496d9ac230de7711f5b8ec3b898';

interface WorkflowDocument {
  readonly jobs: Record<string, unknown>;
  readonly permissions: Record<string, unknown>;
}

interface WorkflowStep {
  readonly run?: unknown;
  readonly uses?: unknown;
  readonly with?: unknown;
}

function parseWorkflow(text: string, name: string): WorkflowDocument {
  const value = parse(text) as unknown;
  if (!isRecord(value) || !isRecord(value.jobs) || !isRecord(value.permissions)) {
    throw new Error(`${name} must declare jobs and workflow permissions`);
  }
  return { jobs: value.jobs, permissions: value.permissions };
}

function validatePermissions(value: Record<string, unknown>, location: string): void {
  const entries = Object.entries(value);
  if (entries.length !== 1 || !('contents' in value) || !['read', 'write'].includes(String(value.contents))) {
    throw new Error(`${location} permissions must contain only contents read or write`);
  }
}

function stepsFor(workflow: WorkflowDocument): readonly [string, WorkflowStep][] {
  const result: [string, WorkflowStep][] = [];
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    if (!isRecord(job)) throw new Error(`Job ${jobName} must be an object`);
    if (job.permissions !== undefined) {
      if (!isRecord(job.permissions)) throw new Error(`Job ${jobName} permissions must be an object`);
      validatePermissions(job.permissions, `Job ${jobName}`);
    }
    if (job.steps === undefined) continue;
    if (!Array.isArray(job.steps)) throw new Error(`Job ${jobName} steps must be an array`);
    for (const step of job.steps) {
      if (!isRecord(step)) throw new Error(`Job ${jobName} has an invalid step`);
      result.push([jobName, step]);
    }
  }
  return result;
}

function validateActionReferences(text: string, name: string): void {
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('- uses:')) continue;
    const reference = trimmed.slice('- uses:'.length).trim();
    if (reference.startsWith('./')) continue;
    if (!FULL_SHA_ACTION_REFERENCE.test(reference)) {
      throw new Error(`${name} contains a mutable or uncommented Action reference: ${reference}`);
    }
  }
}

function validateImage(image: string, name: string): void {
  const match = IMMUTABLE_IMAGE.exec(image);
  if (!match?.groups) throw new Error(`${name} must use a tag@sha256 image identity`);
  const expected =
    match.groups.name === 'rhysd/actionlint:1.7.9'
      ? ACTIONLINT_IMAGE
      : match.groups.name === 'fedora:44'
        ? FEDORA_44_IMAGE
        : null;
  if (expected && image !== expected) throw new Error(`${name} has an unreviewed image digest`);
}

function validateContainerReferences(text: string, name: string): void {
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('container:')) continue;
    validateImage(trimmed.slice('container:'.length).split('#', 1)[0]?.trim() ?? '', name);
  }
  if (text.includes('docker run') && !text.includes(ACTIONLINT_IMAGE)) {
    throw new Error(`${name} executes an unreviewed container image`);
  }
}

function validateWorkflowSteps(workflow: WorkflowDocument, name: string): void {
  for (const [jobName, step] of stepsFor(workflow)) {
    validateStep(step, name, jobName);
  }
}

function validateStep(step: WorkflowStep, name: string, owner: string): void {
  if (typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@')) {
    if (!isRecord(step.with) || step.with['persist-credentials'] !== false) {
      throw new Error(`${name} job ${owner} checkout must set persist-credentials: false`);
    }
  }
  if (typeof step.run === 'string') {
    if (EXECUTABLE_DOWNLOAD.test(step.run) && !step.run.includes('sha256sum --check --status')) {
      throw new Error(`${name} job ${owner} executes an unverified download`);
    }
    if (BROAD_ANALYZER_SUPPRESSION.test(step.run)) {
      throw new Error(`${name} job ${owner} applies a broad analyzer suppression`);
    }
    if (UNSAFE_RUN_INTERPOLATION.test(step.run)) {
      throw new Error(`${name} job ${owner} interpolates untrusted data into a shell command`);
    }
  }
  if (typeof step.uses === 'string' && step.uses.startsWith('actions/cache@') && isRecord(step.with)) {
    const cacheConfiguration = JSON.stringify(step.with);
    if (UNTRUSTED_CACHE_INTERPOLATION.test(cacheConfiguration)) {
      throw new Error(`${name} job ${owner} uses untrusted cache input`);
    }
  }
}

function validateCompositeAction(text: string, name: string): void {
  const value = parse(text) as unknown;
  if (
    !isRecord(value) ||
    !isRecord(value.runs) ||
    value.runs.using !== 'composite' ||
    !Array.isArray(value.runs.steps)
  ) {
    throw new Error(`${name} must declare composite action steps`);
  }
  for (const step of value.runs.steps) {
    if (!isRecord(step)) throw new Error(`${name} has an invalid composite action step`);
    validateStep(step, name, 'composite');
  }
}

/** Validates immutable workflow inputs before CI can execute a referenced tool or artifact. */
export class WorkflowSupplyChainPolicyVerifier {
  public verify(input: {
    readonly actions?: Readonly<Record<string, string>>;
    readonly workflows: Readonly<Record<string, string>>;
    readonly fedoraDockerfile: string;
  }): void {
    for (const [name, text] of Object.entries(input.workflows)) {
      const workflow = parseWorkflow(text, name);
      validatePermissions(workflow.permissions, `${name} workflow`);
      validateActionReferences(text, name);
      validateContainerReferences(text, name);
      validateWorkflowSteps(workflow, name);
    }
    for (const [name, text] of Object.entries(input.actions ?? {})) {
      validateActionReferences(text, name);
      validateContainerReferences(text, name);
      validateCompositeAction(text, name);
    }

    if (!input.workflows['actionlint.yml']?.includes(ACTIONLINT_IMAGE)) {
      throw new Error('actionlint must run from the reviewed immutable container image');
    }
    const fedoraImage = input.fedoraDockerfile
      .split(/\r?\n/u)
      .find((line) => line.startsWith('FROM '))
      ?.slice('FROM '.length)
      .trim();
    if (!fedoraImage) throw new Error('Fedora builder image is missing');
    validateImage(fedoraImage, 'Fedora builder');
  }
}
