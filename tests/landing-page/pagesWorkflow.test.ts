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
  needs?: string;
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
};

type Workflow = {
  concurrency?: { 'cancel-in-progress'?: boolean; group?: string };
  jobs?: Record<string, WorkflowJob>;
  on?: { push?: { branches?: string[]; paths?: string[] }; workflow_dispatch?: Record<string, never> | null };
  permissions?: Record<string, string>;
};

test('keeps the English landing Pages workflow least-privilege and self-validating', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'pages.yml');
  const workflow = parse(await readFile(workflowPath, 'utf8')) as Workflow;

  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.concurrency?.group, 'github-pages');
  assert.equal(workflow.concurrency?.['cancel-in-progress'], false);
  assert.deepEqual(workflow.on?.push?.branches, ['main']);
  assert.ok(workflow.on?.push?.paths?.includes('src/landing-page/**'));
  assert.ok(workflow.on?.push?.paths?.includes('tests/landing-page/**'));
  assert.ok(workflow.on?.workflow_dispatch !== undefined);

  const build = workflow.jobs?.build;
  assert.ok(build, 'Expected a build job.');
  assert.ok(build.steps?.some((step) => step.uses === 'actions/setup-node@v6'));
  assert.ok(build.steps?.some((step) => step.uses === 'actions/configure-pages@v6'));
  for (const command of [
    'npm ci',
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
      build.steps?.some((step) => step.run === command),
      `Expected build command: ${command}`,
    );
  }
  assert.ok(build.steps?.some((step) => step.uses === 'actions/upload-pages-artifact@v5'));

  const deploy = workflow.jobs?.deploy;
  assert.ok(deploy, 'Expected a deploy job.');
  assert.equal(deploy.needs, 'build');
  assert.deepEqual(deploy.permissions, { 'id-token': 'write', pages: 'write' });
  assert.ok(deploy.steps?.some((step) => step.uses === 'actions/deploy-pages@v5'));
});
