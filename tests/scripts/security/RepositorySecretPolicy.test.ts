import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { RepositorySecretPolicy, TRACKED_TEXT_GIT_ARGUMENTS } from '@scripts/security/repositorySecretPolicy';

const fixtureDirectory = path.join(process.cwd(), 'tests', 'fixtures', 'security', 'repository-secret');
const githubToken = `ghp_${'A'.repeat(36)}`;
const openAiKey = `sk-${'A'.repeat(24)}`;
const privateKey = `${'-'.repeat(5)}BEGIN PRIVATE KEY${'-'.repeat(5)}\nnot-a-key\n${'-'.repeat(5)}END PRIVATE KEY${'-'.repeat(5)}`;

async function fixture(name: string): Promise<string> {
  return readFile(path.join(fixtureDirectory, name), 'utf8');
}

describe('Repository secret policy', () => {
  it('selects every tracked text file, including tests, prototypes, extensions, and dotfiles', () => {
    assert.deepEqual(TRACKED_TEXT_GIT_ARGUMENTS, ['grep', '-Il', '-z', '-e', '', '--', '.']);
  });

  it('allows only the exact digest-bound synthetic canary at its reviewed test path', () => {
    const reviewedCanary = ['sk-proj-', 'abcdefghijklmnopqrstuvwxyz123456'].join('');
    const policy = new RepositorySecretPolicy();
    assert.doesNotThrow(() =>
      policy.assertNoBlockingFindings([{ path: 'tests/main/diagnosticCaptureStorage.test.ts', text: reviewedCanary }]),
    );
    assert.throws(
      () => policy.assertNoBlockingFindings([{ path: 'tests/main/unreviewed.test.ts', text: reviewedCanary }]),
      /high-confidence secret/u,
    );
    assert.throws(
      () =>
        policy.assertNoBlockingFindings([
          { path: 'tests/main/diagnosticCaptureStorage.test.ts', text: `${reviewedCanary}x` },
        ]),
      /high-confidence secret/u,
    );
  });

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

  it('keeps exact approved private-key bytes and continues after an approved block', async () => {
    const policy = new RepositorySecretPolicy();
    const delimiter = '-'.repeat(5);
    const reviewedPath = 'tests/main/diagnosticTextRedactor.test.ts';
    const reviewedSource = await readFile(path.join(process.cwd(), reviewedPath), 'utf8');
    const beginMarker = `${delimiter}BEGIN PRIVATE KEY${delimiter}`;
    const endMarker = `${delimiter}END PRIVATE KEY${delimiter}`;
    const start = reviewedSource.indexOf(beginMarker);
    assert.notEqual(start, -1);
    const end = reviewedSource.indexOf(endMarker, start + beginMarker.length);
    assert.notEqual(end, -1);
    const approved = reviewedSource.slice(start, end + endMarker.length);
    assert.deepEqual(policy.scan([{ path: reviewedPath, text: approved }]), []);
    assert.ok(
      policy.scan([{ path: 'tests/unreviewed.txt', text: approved }]).some(({ rule }) => rule === 'private-key'),
    );
    assert.ok(
      policy
        .scan([{ path: reviewedPath, text: `${approved}\n${privateKey}` }])
        .some(({ rule }) => rule === 'private-key'),
    );
    assert.ok(
      policy
        .scan([{ path: reviewedPath, text: approved.replace('${canaries[8]}', 'different-material') }])
        .some(({ rule }) => rule === 'private-key'),
    );
  });

  it('finishes scanning repeated incomplete key headers within a bounded subprocess', () => {
    const script = `
      const assert = require('node:assert/strict');
      const { RepositorySecretPolicy } = require('./scripts/security/repositorySecretPolicy.ts');
      const marker = '-'.repeat(5) + 'BEGIN PRIVATE KEY' + '-'.repeat(5) + '\\n';
      const text = marker.repeat(Math.floor((1024 * 1024) / marker.length));
      assert.deepEqual(new RepositorySecretPolicy().scan([{ path: 'tests/incomplete.txt', text }]), []);
    `;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
      timeout: 3_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  });

  it('retains optional key labels, multiline blocks and global non-overlapping matching', () => {
    const policy = new RepositorySecretPolicy();
    const delimiter = '-'.repeat(5);
    for (const [beginLabel, endLabel] of [
      ['', ''],
      ['RSA ', 'RSA '],
      ['EC ', 'RSA '],
    ]) {
      const block = `${delimiter}BEGIN ${beginLabel}PRIVATE KEY${delimiter}\nbody\n${delimiter}END ${endLabel}PRIVATE KEY${delimiter}`;
      assert.ok(policy.scan([{ path: 'tests/keys.txt', text: block }]).some(({ rule }) => rule === 'private-key'));
    }
    const malformed = `${delimiter}BEGIN lower PRIVATE KEY${delimiter}\nbody\n${delimiter}END PRIVATE KEY${delimiter}`;
    assert.ok(
      !policy.scan([{ path: 'tests/invalid-label.txt', text: malformed }]).some(({ rule }) => rule === 'private-key'),
    );
    const repeated = `${privateKey}\n${privateKey}`;
    assert.equal(
      policy.scan([{ path: 'tests/multiple.txt', text: repeated }]).filter(({ rule }) => rule === 'private-key').length,
      1,
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
