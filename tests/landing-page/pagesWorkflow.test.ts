import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

type WorkflowStep = {
  run?: string;
  uses?: string;
};

type WorkflowJob = {
  needs?: string | string[];
  steps?: WorkflowStep[];
};

type Workflow = {
  jobs?: Record<string, WorkflowJob>;
  on?: {
    pull_request?: { branches?: string[] };
    push?: unknown;
    release?: unknown;
    workflow_dispatch?: unknown;
  };
  permissions?: Record<string, string>;
};

test('keeps English landing validation PR-only and free of deployment work', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'pr-checks.yml');
  const workflow = parse(await readFile(workflowPath, 'utf8')) as Workflow;
  const pagesWorkflowPath = path.join(process.cwd(), '.github', 'workflows', 'pages.yml');

  assert.deepEqual(workflow.permissions, { contents: 'read' });
  await assert.rejects(readFile(pagesWorkflowPath), 'A standalone Pages deployment workflow must not exist.');
  assert.deepEqual(workflow.on?.pull_request?.branches, ['main']);
  assert.equal(workflow.on?.push, undefined);
  assert.equal(workflow.on?.release, undefined);
  assert.equal(workflow.on?.workflow_dispatch, undefined);

  const landing = workflow.jobs?.landing;
  assert.ok(landing, 'Expected a landing validation job.');
  assert.equal(landing.needs, 'quality');
  assert.ok(landing.steps?.some((step) => step.uses === 'actions/setup-node@v6'));
  for (const command of [
    'npm ci',
    'sudo apt-get update && sudo apt-get install --no-install-recommends -y ffmpeg',
    'npx playwright install --with-deps chromium firefox webkit',
    'npm run landing:typecheck',
    'npm run landing:lint',
    'npm run landing:format:check',
    'npm run landing:build',
    'npm run landing:test',
    'npm run landing:test:e2e',
    'npm run landing:verify:media',
    'npm run landing:verify:seo',
    'npm run landing:verify:a11y',
    'npm run landing:verify:browser-support',
    'npm run landing:verify:sizes',
  ]) {
    assert.ok(
      landing.steps?.some((step) => step.run === command),
      `Expected landing command: ${command}`,
    );
  }
  for (const action of ['actions/configure-pages@v6', 'actions/upload-pages-artifact@v5', 'actions/deploy-pages@v5']) {
    assert.equal(
      Object.values(workflow.jobs ?? {})
        .flatMap((job) => job.steps ?? [])
        .some((step) => step.uses === action),
      false,
      `Landing validation must not deploy Pages: ${action}`,
    );
  }
});
