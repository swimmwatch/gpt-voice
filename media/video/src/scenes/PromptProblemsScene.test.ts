import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promptProblems } from '../data/content.ts';

const videoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath: string): string => fs.readFileSync(path.join(videoRoot, relativePath), 'utf8');

test('the opening maps all sixteen prompt problems without product markup', () => {
  const opening = read('src/scenes/PromptProblemsScene.tsx');
  const map = read('src/product-ui/PromptProblemMap.tsx');

  assert.equal(promptProblems.flatMap((group) => group.issues).length, 16);
  assert.match(map, /promptProblems\.map/);
  assert.doesNotMatch(opening, /ProductUiFrame|GPT-Voice|MainToolbar/);
});

test('the composition starts the canonical product bridge at the fixed product-reveal frame', () => {
  const composition = read('src/GptVoiceDemo.tsx');
  const bridge = read('src/scenes/ProductBridgeScene.tsx');

  assert.match(composition, /from=\{scenes\.productBridge\.from\}/);
  assert.match(composition, /from=\{scenes\.promptProblems\.from\}/);
  assert.match(bridge, /<ProductUiFrame/);
  assert.match(bridge, /claims\.control/);
  assert.match(bridge, /opacity: 1/);
});
