import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { ScorecardWorkflowPolicy } from '@scripts/security/scorecardWorkflowPolicy';

describe('Scorecard workflow policy', () => {
  it('permits only a weekly, advisory GitHub-native Scorecard workflow', async () => {
    const workflow = await readFile(path.join(process.cwd(), '.github', 'workflows', 'security-scorecard.yml'), 'utf8');
    assert.doesNotThrow(() => new ScorecardWorkflowPolicy().verify(workflow));
  });

  it('rejects a pull-request trigger or an identity-token grant', () => {
    const policy = new ScorecardWorkflowPolicy();
    const safe = `on:\n  schedule:\n    - cron: '41 5 * * 1'\npermissions:\n  contents: read\n  security-events: write\njobs:\n  scorecard:\n    steps:\n      - uses: ossf/scorecard-action@ff5dd8929f96a8a4dc67d13f32b8c75057829621 # v2.4.0\n        continue-on-error: true\n      - uses: github/codeql-action/upload-sarif@5595ccaf912efad79be6eef63a5619ff05969be3 # v4.37.6\n`;
    assert.throws(
      () => policy.verify(safe.replace('  schedule:', '  pull_request: {}\n  schedule:')),
      /SCORECARD_WORKFLOW_TRIGGER_INVALID/u,
    );
    assert.throws(
      () => policy.verify(safe.replace('contents: read', 'contents: read\n  id-token: write')),
      /SCORECARD_WORKFLOW_PERMISSION_INVALID/u,
    );
  });
});
