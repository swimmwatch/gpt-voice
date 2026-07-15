import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

type WorkflowStep = {
  run?: string;
};

type Workflow = {
  jobs?: {
    quality?: {
      steps?: WorkflowStep[];
    };
  };
};

test('prepares documentation and FFmpeg before root unit tests', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'pr-checks.yml');
  const workflow = parse(await readFile(workflowPath, 'utf8')) as Workflow;
  const steps = workflow.jobs?.quality?.steps ?? [];
  const installDocumentationToolsStep = steps.findIndex((step) => step.run === 'npm run docs:install');
  const syncDocumentationAssetsStep = steps.findIndex((step) => step.run === 'npm run docs:sync-assets');
  const buildDocumentationStep = steps.findIndex((step) => step.run === 'npm run docs:build');
  const ffmpegStep = steps.findIndex(
    (step) => step.run === 'sudo apt-get update && sudo apt-get install --no-install-recommends -y ffmpeg',
  );
  const unitTestsStep = steps.findIndex((step) => step.run === 'npm test');

  assert.ok(installDocumentationToolsStep >= 0, 'Quality Gates must install the MkDocs toolchain.');
  assert.ok(syncDocumentationAssetsStep >= 0, 'Quality Gates must stage documentation assets.');
  assert.ok(buildDocumentationStep >= 0, 'Quality Gates must build documentation output.');
  assert.ok(ffmpegStep >= 0, 'Quality Gates must install FFmpeg for landing media checks.');
  assert.ok(unitTestsStep >= 0, 'Quality Gates must run the root unit suite.');
  assert.ok(
    installDocumentationToolsStep < syncDocumentationAssetsStep,
    'Documentation tools must be installed before assets are staged.',
  );
  assert.ok(
    syncDocumentationAssetsStep < buildDocumentationStep,
    'Documentation assets must be staged before the strict MkDocs build.',
  );
  assert.ok(buildDocumentationStep < unitTestsStep, 'Documentation output must exist before documentation tests run.');
  assert.ok(ffmpegStep < unitTestsStep, 'FFmpeg must be available before landing media tests run.');
});
