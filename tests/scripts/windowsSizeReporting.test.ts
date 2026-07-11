import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(__dirname, '..', '..');

test('Windows package jobs measure and retain current and reference size reports', () => {
  const collector = readFileSync(path.join(projectRoot, 'scripts/collect-release-artifacts.mjs'), 'utf8');
  const pullRequestWorkflow = readFileSync(path.join(projectRoot, '.github/workflows/pr-checks.yml'), 'utf8');
  const releaseWorkflow = readFileSync(path.join(projectRoot, '.github/workflows/release-builds.yml'), 'utf8');

  assert.match(collector, /win32: \['size-win32-x64\.json', 'startup-win32-x64\.json'\]/u);
  assert.match(pullRequestWorkflow, /Measure Windows package size/u);
  assert.match(pullRequestWorkflow, /--platform=win32/u);
  assert.match(pullRequestWorkflow, /--arch=x64/u);
  assert.match(pullRequestWorkflow, /--output=release-artifacts\/size-win32-x64\.json/u);
  assert.match(pullRequestWorkflow, /Measure Windows cold startup/u);
  assert.match(pullRequestWorkflow, /--output=release-artifacts\/startup-win32-x64\.json/u);
  assert.match(pullRequestWorkflow, /Verify Windows size budget when a reviewed baseline exists/u);
  assert.match(pullRequestWorkflow, /Upload Windows measurement reports/u);
  assert.match(releaseWorkflow, /Measure Windows package size/u);
  assert.match(releaseWorkflow, /Measure Windows cold startup/u);
  assert.match(releaseWorkflow, /Verify Windows size budget when a reviewed baseline exists/u);
  assert.match(releaseWorkflow, /build-windows:[\s\S]*Build Windows v1\.4 reference when requested/u);
  assert.match(releaseWorkflow, /build-windows:[\s\S]*fetch-depth: 0/u);
  assert.match(releaseWorkflow, /3845bad421f32650cb57a44f32345bfe0f46a127/u);
  assert.match(releaseWorkflow, /build-windows:[\s\S]*git worktree add --detach \.size-baseline/u);
  assert.match(releaseWorkflow, /size-win32-x64\.json/u);
  assert.match(releaseWorkflow, /Upload Windows v1\.4 reference size report/u);
});
