import { parse } from 'yaml';

import { isRecord } from '../local-whisper/packaging/contracts';

export const SCORECARD_ACTION = 'ossf/scorecard-action@ff5dd8929f96a8a4dc67d13f32b8c75057829621';
export const CODEQL_UPLOAD_SARIF_ACTION = 'github/codeql-action/upload-sarif@5595ccaf912efad79be6eef63a5619ff05969be3';

function fail(code: string): never {
  throw new Error(`SCORECARD_WORKFLOW_${code}`);
}

/** Validates the weekly, advisory-only GitHub-native Scorecard workflow. */
export class ScorecardWorkflowPolicy {
  public verify(text: string): void {
    const workflow = parse(text) as unknown;
    if (!isRecord(workflow) || !isRecord(workflow.on) || !isRecord(workflow.permissions) || !isRecord(workflow.jobs)) {
      fail('MALFORMED');
    }
    const triggerKeys = Object.keys(workflow.on).sort((left, right) => left.localeCompare(right, 'en'));
    if (JSON.stringify(triggerKeys) !== JSON.stringify(['schedule'])) fail('TRIGGER_INVALID');
    if (!Array.isArray(workflow.on.schedule) || workflow.on.schedule.length !== 1) fail('TRIGGER_INVALID');
    if (workflow.permissions.contents !== 'read' || workflow.permissions['security-events'] !== 'write')
      fail('PERMISSION_INVALID');
    if (Object.keys(workflow.permissions).length !== 2) fail('PERMISSION_INVALID');
    const job = workflow.jobs.scorecard;
    if (!isRecord(job) || !Array.isArray(job.steps)) fail('JOB_INVALID');
    const serialized = JSON.stringify(job);
    if (
      !serialized.includes(SCORECARD_ACTION) ||
      !serialized.includes(CODEQL_UPLOAD_SARIF_ACTION) ||
      !serialized.includes('continue-on-error') ||
      serialized.includes('actions/upload-artifact@') ||
      serialized.includes('workflow_dispatch') ||
      serialized.includes('id-token') ||
      serialized.includes('contents: write')
    ) {
      fail('POLICY_INVALID');
    }
  }
}
