import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sceneIds } from './data/timeline.ts';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
const composition = fs.readFileSync(path.join(sourceRoot, 'GptVoiceDemo.tsx'), 'utf8');

test('the composition mounts every validated scene exactly once and keeps debug overlays opt-in', () => {
  for (const sceneId of sceneIds) {
    const sceneReference = `from={scenes.${sceneId}.from}`;
    assert.equal(composition.split(sceneReference).length - 1, 1, `${sceneId} must have one sequence`);
  }

  assert.equal((composition.match(/<Sequence durationInFrames=/g) ?? []).length, sceneIds.length);
  assert.match(composition, /\{debugOverlays \? \(/);
  assert.match(composition, /<DebugOverlay effectsMode=\{effectsMode\} \/>/);
});
