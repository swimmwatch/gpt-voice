import { parse } from 'yaml';

import { isRecord } from '../packaging/contracts';

const FORBIDDEN_WORKFLOW_MARKERS = Object.freeze([
  'github.event.release',
  'apply:release-version',
  '--clobber',
  'gh release upload',
]);

function parseWorkflow(text: string): Readonly<Record<string, unknown>> {
  const workflow = parse(text) as unknown;
  if (!isRecord(workflow) || !isRecord(workflow.on) || !isRecord(workflow.jobs)) {
    throw new Error('RELEASE_WORKFLOW_INVALID');
  }
  return workflow;
}

/** Guards the read-only candidate workflow; protected staging and publication remain manual gates. */
export class ReleaseWorkflowPolicyVerifier {
  public verify(workflow: string): void {
    const document = parseWorkflow(workflow);
    const triggers = document.on as Readonly<Record<string, unknown>>;
    const jobs = document.jobs as Readonly<Record<string, unknown>>;
    const dispatch = triggers.workflow_dispatch;
    if (!isRecord(dispatch) || !isRecord(dispatch.inputs) || !isRecord(dispatch.inputs.release_tag)) {
      throw new Error('RELEASE_WORKFLOW_TRIGGER_INVALID');
    }
    if (dispatch.inputs.release_tag.required !== true) throw new Error('RELEASE_WORKFLOW_TRIGGER_INVALID');
    if (FORBIDDEN_WORKFLOW_MARKERS.some((marker) => workflow.includes(marker))) {
      throw new Error('RELEASE_WORKFLOW_MUTATION_FORBIDDEN');
    }
    if (
      !isRecord(jobs['build-linux']) ||
      !isRecord(jobs['build-windows']) ||
      !isRecord(jobs['attest-release']) ||
      !isRecord(jobs.publish)
    ) {
      throw new Error('RELEASE_WORKFLOW_CANDIDATE_JOBS_MISSING');
    }
    const publish = jobs.publish;
    if (
      'release' in triggers ||
      publish.if !== "github.event_name == 'workflow_dispatch'" ||
      !isRecord(publish.permissions) ||
      publish.permissions.contents !== 'write' ||
      JSON.stringify(publish.needs) !== JSON.stringify(['build-linux', 'build-windows', 'attest-release']) ||
      !JSON.stringify(publish).includes('gh release create') ||
      !JSON.stringify(publish).includes('Release tag already exists') ||
      !JSON.stringify(publish).includes('--target') ||
      workflow.split('gh release create').length !== 2
    ) {
      throw new Error('RELEASE_WORKFLOW_PUBLICATION_FORBIDDEN');
    }
  }
}
