import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(__dirname, '..', '..');

test('Fedora package jobs measure, verify, and retain Linux size reports', () => {
  const dockerfile = readFileSync(path.join(projectRoot, 'build/fedora-release/Dockerfile'), 'utf8');
  const entrypoint = readFileSync(path.join(projectRoot, 'build/fedora-release/fedora-release-entrypoint.mjs'), 'utf8');
  const collector = readFileSync(path.join(projectRoot, 'scripts/collect-release-artifacts.mjs'), 'utf8');
  const workflow = readFileSync(path.join(projectRoot, '.github/workflows/pr-checks.yml'), 'utf8');

  assert.match(dockerfile, /xorg-x11-server-Xvfb/u);
  assert.match(entrypoint, /'measure:size'/u);
  assert.match(entrypoint, /'--platform=linux'/u);
  assert.match(entrypoint, /'--arch=x64'/u);
  assert.match(entrypoint, /'--output=release-artifacts\/size-linux-x64\.json'/u);
  assert.match(entrypoint, /'measure:startup'/u);
  assert.match(entrypoint, /await run\('xvfb-run'/u);
  assert.match(entrypoint, /'--output=release-artifacts\/startup-linux-x64\.json'/u);
  assert.match(entrypoint, /'verify:size'/u);
  assert.match(entrypoint, /'--baseline=build\/size-baselines\/v1\.4\.0-linux-x64\.json'/u);
  assert.match(collector, /size-linux-x64\.json/u);
  assert.match(collector, /startup-linux-x64\.json/u);
  assert.match(workflow, /Upload Linux measurement reports/u);
  assert.match(workflow, /release-artifacts\/size-linux-x64\.json/u);
  assert.match(workflow, /release-artifacts\/startup-linux-x64\.json/u);
});
