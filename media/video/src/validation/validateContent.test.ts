import assert from 'node:assert/strict';
import test from 'node:test';
import { claims, productLabels, promptProblems, prompts } from '../data/content.ts';
import { narrationReferences } from '../data/script.ts';

const prohibitedCopy = [/\b1\.4\.0\b/, /\b2\.0\.0\b/, /LinkedIn/i, /subtitle/i, /caption/i];

test('content keeps approved prompt examples, qualification, and English translation direction', () => {
  assert.equal(promptProblems.flatMap((group) => group.issues).length, 16);
  assert.equal(prompts.translation.inputLanguage, 'Russian');
  assert.equal(prompts.translation.targetLanguage, 'English');
  assert.equal(prompts.translation.result, prompts.spoken);
  assert.equal(prompts.prettify.result.includes('three highest-priority findings'), true);
  assert.match(claims.providerQualification, /does not bypass quotas/);
});

test('content excludes release, caption, and unqualified provider claims', () => {
  const visibleCopy = JSON.stringify({ claims, narrationReferences, productLabels, promptProblems, prompts });
  for (const pattern of prohibitedCopy) assert.doesNotMatch(visibleCopy, pattern);
  assert.equal(claims.providerScale.endsWith('*'), true);
});
