import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { RepositorySecretPolicy } from '@scripts/security/repositorySecretPolicy';

const fixtureDirectory = path.join(process.cwd(), 'tests', 'fixtures', 'security', 'repository-secret');
const githubToken = `ghp_${'A'.repeat(36)}`;
const openAiKey = `sk-${'A'.repeat(24)}`;
const privateKey = `${'-'.repeat(5)}BEGIN PRIVATE KEY${'-'.repeat(5)}\nnot-a-key\n${'-'.repeat(5)}END PRIVATE KEY${'-'.repeat(5)}`;

async function fixture(name: string): Promise<string> {
  return readFile(path.join(fixtureDirectory, name), 'utf8');
}

describe('Repository secret policy', () => {
  it('accepts ordinary source and documentation while retaining entropy-only findings as advisory', async () => {
    const findings = new RepositorySecretPolicy().assertNoBlockingFindings([
      { path: 'docs/ordinary.md', text: await fixture('ordinary-doc.md') },
      { path: 'src/ordinary.ts', text: await fixture('ordinary-source.ts') },
      { path: 'tests/entropy.txt', text: await fixture('entropy-only.txt') },
    ]);

    assert.deepEqual(findings, [{ path: 'tests/entropy.txt', rule: 'entropy', severity: 'advisory' }]);
  });

  for (const [name, text, rule] of [
    ['GitHub token', githubToken, 'github-token'],
    ['OpenAI API key', openAiKey, 'openai-api-key'],
    ['private key block', privateKey, 'private-key'],
  ] as const) {
    it(`blocks a synthetic ${name} without disclosing its value`, () => {
      const policy = new RepositorySecretPolicy();
      assert.throws(
        () => policy.assertNoBlockingFindings([{ path: 'scripts/fixture.ts', text }]),
        (error: unknown) =>
          error instanceof Error &&
          error.message === 'Repository secret policy violation: high-confidence secret detected' &&
          !error.message.includes(text),
      );
      assert.equal(policy.scan([{ path: 'scripts/fixture.ts', text }])[0]?.rule, rule);
    });
  }

  it('ignores only a generated root with its validated marker', () => {
    const policy = new RepositorySecretPolicy();
    const files = [
      { path: 'build/generated/.generated-root', text: 'gpt-voice-generated-root-v1\n' },
      { path: 'build/generated/test.ts', text: githubToken },
    ];
    assert.deepEqual(policy.assertNoBlockingFindings(files), []);
    assert.throws(
      () => policy.assertNoBlockingFindings([{ path: 'build/generated/test.ts', text: githubToken }]),
      /high-confidence secret/u,
    );
  });

  it('rejects unsafe paths and oversized text evidence', () => {
    const policy = new RepositorySecretPolicy();
    assert.throws(() => policy.scan([{ path: '../outside.txt', text: 'ordinary' }]), /invalid repository text input/u);
    assert.throws(
      () => policy.scan([{ path: 'docs/large.txt', text: 'a'.repeat(1024 * 1024 + 1) }]),
      /invalid repository text input/u,
    );
    assert.throws(
      () =>
        policy.scan([
          { path: 'docs/duplicate.md', text: 'first' },
          { path: 'docs/duplicate.md', text: 'second' },
        ]),
      /invalid repository text input/u,
    );
  });
});
