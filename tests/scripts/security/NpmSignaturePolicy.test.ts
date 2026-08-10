import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NpmSignaturePolicy, type NpmCommandEvidence } from '@scripts/security/npmSignaturePolicy';

const LOCKFILE_SHA256 = 'a'.repeat(64);
const installation: NpmCommandEvidence = {
  arguments: ['npm', 'ci', '--ignore-scripts', '--no-audit'],
  exitCode: 0,
  output: '',
  program: 'corepack',
};
const signatures: NpmCommandEvidence = {
  arguments: ['npm', 'audit', 'signatures', '--json', '--ignore-scripts'],
  exitCode: 0,
  output: JSON.stringify({ invalid: [], missing: [] }),
  program: 'corepack',
};

describe('npm signature policy', () => {
  it('accepts script-disabled Corepack evidence for the exact lockfile', () => {
    assert.doesNotThrow(() =>
      new NpmSignaturePolicy().verify({
        expectedLockfileSha256: LOCKFILE_SHA256,
        install: installation,
        installedLockfileSha256: LOCKFILE_SHA256,
        signatures,
      }),
    );
  });

  for (const input of [
    { install: { ...installation, arguments: ['npm', 'ci'] }, reason: 'command identity mismatch' },
    { install: { ...installation, exitCode: 1 }, reason: 'evidence unavailable' },
    { installedLockfileSha256: 'b'.repeat(64), reason: 'lockfile identity mismatch' },
    { signatures: { ...signatures, output: '{}' }, reason: 'signature evidence malformed' },
    {
      signatures: { ...signatures, output: JSON.stringify({ invalid: [{}], missing: [] }) },
      reason: 'registry signature',
    },
    {
      signatures: { ...signatures, output: JSON.stringify({ invalid: [], missing: [{}] }) },
      reason: 'registry signature',
    },
  ]) {
    it(`fails closed when ${input.reason}`, () => {
      assert.throws(
        () =>
          new NpmSignaturePolicy().verify({
            expectedLockfileSha256: LOCKFILE_SHA256,
            install: input.install ?? installation,
            installedLockfileSha256: input.installedLockfileSha256 ?? LOCKFILE_SHA256,
            signatures: input.signatures ?? signatures,
          }),
        new RegExp(input.reason, 'u'),
      );
    });
  }
});
