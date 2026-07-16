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
  permissions?: Record<string, string>;
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
  const media = workflow.jobs?.media;
  const pages = workflow.jobs?.pages;
  assert.ok(landing, 'Expected a landing validation job.');
  assert.ok(media, 'Expected a product video validation job.');
  assert.ok(pages, 'Expected a Pages artifact validation job.');
  assert.equal(landing.needs, 'quality');
  assert.equal(media.needs, 'quality');
  assert.equal(pages.needs, 'landing');
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
  for (const command of [
    'npm ci',
    'npm ci --prefix media/video',
    'npm --prefix media/video run typecheck',
    'npm --prefix media/video run test:timeline',
    'npm --prefix media/video run test:content',
    'npm --prefix media/video run test:scenes',
    'npm --prefix media/video run test:ui',
    'npm --prefix media/video run validate:timeline',
    'npm --prefix media/video run render:representative',
  ]) {
    assert.ok(
      media.steps?.some((step) => step.run === command),
      `Expected media command: ${command}`,
    );
  }
  for (const command of [
    'npm ci',
    'npm run docs:install',
    'npm run docs:sync-assets',
    'npx playwright install --with-deps chromium firefox webkit',
    'npm run pages:build',
    'node --import tsx --test tests/documentation/pagesArtifact.test.ts',
    'npm run pages:test:e2e',
  ]) {
    assert.ok(
      pages.steps?.some((step) => step.run === command),
      `Expected Pages command: ${command}`,
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
