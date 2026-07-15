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

test('installs FFmpeg before root unit tests exercise landing media', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'pr-checks.yml');
  const workflow = parse(await readFile(workflowPath, 'utf8')) as Workflow;
  const steps = workflow.jobs?.quality?.steps ?? [];
  const ffmpegStep = steps.findIndex(
    (step) => step.run === 'sudo apt-get update && sudo apt-get install --no-install-recommends -y ffmpeg',
  );
  const unitTestsStep = steps.findIndex((step) => step.run === 'npm test');

  assert.ok(ffmpegStep >= 0, 'Quality Gates must install FFmpeg for landing media checks.');
  assert.ok(unitTestsStep >= 0, 'Quality Gates must run the root unit suite.');
  assert.ok(ffmpegStep < unitTestsStep, 'FFmpeg must be available before landing media tests run.');
});
