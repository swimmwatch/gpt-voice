import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'SceneLightLeak.tsx');

test('scene light leaks are fixed-seed, short-lived, and layered behind scene content', () => {
  const component = fs.readFileSync(componentPath, 'utf8');

  assert.match(component, /<LightLeak/);
  assert.match(component, /seed=\{seed\}/);
  assert.match(component, /durationInFrames=\{24\}/);
  assert.match(component, /opacity: 0\.12/);
  assert.match(component, /pointerEvents: 'none'/);
});
