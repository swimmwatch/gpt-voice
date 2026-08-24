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
  assert.match(collector, /collectedSha256 !== sourceSha256/u);
  assert.match(pullRequestWorkflow, /Build and smoke Windows package/u);
  assert.match(pullRequestWorkflow, /--platform=win32/u);
  assert.match(pullRequestWorkflow, /--arch=\$\{\{ vars\.CI_ARCHITECTURE \}\}/u);
  assert.match(pullRequestWorkflow, /--output=release-artifacts\/size-win32-x64\.json/u);
  assert.match(pullRequestWorkflow, /--output=release-artifacts\/startup-win32-x64\.json/u);
  assert.match(pullRequestWorkflow, /Verify Windows size budget when a reviewed baseline exists/u);
  assert.match(pullRequestWorkflow, /Upload Windows measurement reports/u);
  assert.match(releaseWorkflow, /Measure Windows package size/u);
  assert.match(releaseWorkflow, /runs-on: \$\{\{ vars\.CI_WINDOWS_RUNNER \}\}/u);
  assert.match(releaseWorkflow, /node-version: \$\{\{ vars\.CI_NODE_VERSION \}\}/u);
  assert.match(releaseWorkflow, /--arch=\$\{\{ vars\.CI_ARCHITECTURE \}\}/u);
  assert.match(releaseWorkflow, /retention-days: \$\{\{ vars\.CI_RELEASE_ARTIFACT_RETENTION_DAYS \}\}/u);
  assert.match(releaseWorkflow, /Measure Windows cold startup/u);
  assert.match(releaseWorkflow, /Verify Windows size budget when a reviewed baseline exists/u);
  assert.doesNotMatch(releaseWorkflow, /^permissions:\n {2}contents: write$/mu);
  assert.match(releaseWorkflow, /^permissions:\n {2}contents: read$/mu);
  assert.match(releaseWorkflow, /verify-production-candidate:[\s\S]*permissions:\n {6}contents: read/u);
  assert.match(releaseWorkflow, /Assemble and Verify Production Candidate/u);
  assert.match(releaseWorkflow, /publish:[\s\S]*if: >-[\s\S]*inputs\.publish == true/u);
  assert.match(releaseWorkflow, /publish:[\s\S]*permissions:\n {6}actions: read\n {6}contents: write/u);
  assert.doesNotMatch(releaseWorkflow, /github\.event\.release|--clobber/u);
  assert.match(releaseWorkflow, /build-windows:[\s\S]*Build Windows v1\.4 reference/u);
  assert.match(releaseWorkflow, /build-windows:[\s\S]*fetch-depth: 0/u);
  assert.doesNotMatch(releaseWorkflow, /baseline_ref/u);
  assert.match(releaseWorkflow, /BASELINE_REF: 3845bad421f32650cb57a44f32345bfe0f46a127/u);
  assert.match(releaseWorkflow, /build-windows:[\s\S]*git worktree add --detach \.size-baseline/u);
  assert.match(releaseWorkflow, /size-win32-x64\.json/u);
  assert.match(releaseWorkflow, /Upload Windows v1\.4 reference size report/u);
});
