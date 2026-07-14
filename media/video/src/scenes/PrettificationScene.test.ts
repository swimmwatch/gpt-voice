import assert from 'node:assert/strict';
import test from 'node:test';
import { prompts } from '../data/content.ts';
import { getPrettificationViewState } from '../data/prettificationState.ts';

test('Prettify follows selection, F12, processing, and result cue frames', () => {
  assert.deepEqual(getPrettificationViewState(0), {
    fixtureId: 'prettifySelection',
    showHotkey: false,
    showResult: false,
  });
  assert.equal(getPrettificationViewState(90).showHotkey, true);
  assert.equal(getPrettificationViewState(120).fixtureId, 'prettifyingSelection');
  assert.equal(getPrettificationViewState(251).showResult, false);
  assert.equal(getPrettificationViewState(252).fixtureId, 'prettifiedSelection');
  assert.equal(getPrettificationViewState(252).showResult, true);
});

test('the approved Prettify result preserves the required security-review meaning', () => {
  for (const phrase of ['pull request', 'security issues', 'three']) {
    assert.equal(prompts.prettify.source.includes(phrase), true);
    assert.equal(prompts.prettify.result.includes(phrase), true);
  }
});
