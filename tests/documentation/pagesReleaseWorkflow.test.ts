import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

type WorkflowStep = {
  id?: string;
  run?: string;
  uses?: string;
  with?: { path?: string };
};

type WorkflowJob = {
  if?: string;
  needs?: string[];
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
};

type Workflow = {
  jobs?: Record<string, WorkflowJob>;
};

test('deploys one verified Pages artifact only after release builds complete', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'release-builds.yml');
  const workflow = parse(await readFile(workflowPath, 'utf8')) as Workflow;
  const pages = workflow.jobs?.['publish-pages'];

  assert.ok(pages, 'Expected the release-gated Pages publication job.');
  assert.deepEqual(pages.needs, ['build-linux', 'build-windows']);
  assert.equal(pages.if, "github.event_name == 'release'");
  assert.deepEqual(pages.permissions, { contents: 'read', 'id-token': 'write', pages: 'write' });

  for (const command of [
    'npm ci',
    'npm run docs:install',
    'npm run docs:sync-assets',
    'npm run pages:build',
    'node --import tsx --test tests/documentation/pagesArtifact.test.ts',
  ]) {
    assert.ok(
      pages.steps?.some((step) => step.run === command),
      `Expected Pages release command: ${command}`,
    );
  }

  assert.ok(pages.steps?.some((step) => step.uses === 'actions/configure-pages@v6'));
  assert.ok(
    pages.steps?.some(
      (step) => step.uses === 'actions/upload-pages-artifact@v5' && step.with?.path === 'build/github-pages',
    ),
  );
  assert.ok(pages.steps?.some((step) => step.id === 'deployment' && step.uses === 'actions/deploy-pages@v5'));
});
