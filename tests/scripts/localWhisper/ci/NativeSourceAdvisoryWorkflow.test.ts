import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { WORKSPACE_ROOT } from '../packaging/packagingTestUtils';

const workflowPath = path.join(WORKSPACE_ROOT, '.github', 'workflows', 'local-whisper-native-advisories.yml');

describe('Native source advisory workflow', () => {
  it('runs only on a weekly schedule with read-only authority and no artifact publication', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /^on:\n {2}schedule:\n {4}- cron: '.+'$/mu);
    assert.doesNotMatch(workflow, /^ {2}(?:pull_request|push|workflow_dispatch):/mu);
    assert.match(workflow, /^permissions:\n {2}contents: read$/mu);
    assert.match(workflow, /runs-on: \$\{\{ vars\.CI_LINUX_RUNNER \}\}/u);
    assert.match(workflow, /actions\/checkout@[a-f0-9]{40} # v7/u);
    assert.match(workflow, /persist-credentials: false/u);
    assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact@/u);
    assert.doesNotMatch(workflow, /workflow_dispatch/u);
  });

  it('emits and validates one bounded report without running a second live scan', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(
      workflow,
      /scan:local-whisper:native-advisory -- --locks=all --output-directory=\$\{ADVISORY_EVIDENCE_DIRECTORY\}/u,
    );
    assert.match(workflow, /cat \$\{ADVISORY_EVIDENCE_DIRECTORY\}\/report-\*\.json/u);
    assert.match(
      workflow,
      /verify:local-whisper:native-advisory:evidence -- --advisory-evidence-dir=\$\{ADVISORY_EVIDENCE_DIRECTORY\}/u,
    );
    assert.equal((workflow.match(/api\.osv\.dev/gu) ?? []).length, 0);
  });
});
