import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  SECURITY_EVIDENCE_KINDS,
  SECURITY_EVIDENCE_POLICY,
  SECURITY_EVIDENCE_RETENTION_VARIABLE,
  SecurityEvidencePolicy,
  type SecurityEvidenceDescriptor,
} from '@scripts/security/securityEvidencePolicy';

const workspaceRoot = process.cwd();
const DIGEST = 'a'.repeat(64);

function descriptor(): SecurityEvidenceDescriptor {
  return {
    digest: DIGEST,
    kind: 'application-scan',
    path: 'release-artifacts/application-security-linux/application-artifact-security-linux-appimage.json',
    retention: SECURITY_EVIDENCE_RETENTION_VARIABLE,
    storage: 'github-actions-artifact',
  };
}

describe('Security evidence policy', () => {
  it('centralizes every security evidence class with an approved GitHub-native storage owner', () => {
    assert.deepEqual(Object.keys(SECURITY_EVIDENCE_POLICY).sort(), [...SECURITY_EVIDENCE_KINDS].sort());
    assert.doesNotThrow(() =>
      new SecurityEvidencePolicy().verifyDescriptor({
        digest: DIGEST,
        kind: 'attestation',
        path: null,
        retention: null,
        storage: 'github-attestation',
      }),
    );
  });

  it('accepts bounded GitHub-native, digest-addressed repository evidence', () => {
    assert.doesNotThrow(() => new SecurityEvidencePolicy().verifyDescriptor(descriptor()));
  });

  for (const canary of [
    'release-artifacts/audio.wav',
    'release-artifacts/transcript.txt',
    'release-artifacts/model-content.json',
    'release-artifacts/api-token.txt',
    'release-artifacts/session-cookie.json',
    'release-artifacts/browser-profile.zip',
    'release-artifacts/capability.txt',
    'release-artifacts/environment-dump.txt',
    '/home/private/report.json',
    'C:\\Users\\private\\report.json',
    'https://example.invalid/evidence.json',
  ]) {
    it(`rejects privacy canary ${canary}`, () => {
      assert.throws(
        () => new SecurityEvidencePolicy().assertPrivacySafe([canary]),
        /SECURITY_EVIDENCE_PRIVACY_INVALID/u,
      );
    });
  }

  it('rejects missing retention, unbounded storage, and non-GitHub paths', () => {
    const policy = new SecurityEvidencePolicy();
    for (const invalid of [
      { ...descriptor(), retention: null },
      { ...descriptor(), path: '../private.json' },
      { ...descriptor(), digest: null },
      { ...descriptor(), storage: 'hosted-dashboard' },
    ]) {
      assert.throws(() => policy.verifyDescriptor(invalid), /SECURITY_EVIDENCE_/u);
    }
  });

  it('keeps repository workflows free of hosted security vendors and requires bounded GitHub-native controls', async () => {
    const workflowDirectory = path.join(workspaceRoot, '.github', 'workflows');
    const securityDirectory = path.join(workspaceRoot, 'scripts', 'security');
    const workflows = Object.fromEntries(
      await Promise.all(
        (await readdir(workflowDirectory))
          .filter((name) => name.endsWith('.yml'))
          .map(async (name) => [name, await readFile(path.join(workflowDirectory, name), 'utf8')] as const),
      ),
    );
    const sources = await Promise.all(
      (await readdir(securityDirectory))
        .filter((name) => name.endsWith('.ts') && name !== 'securityEvidencePolicy.ts')
        .map((name) => readFile(path.join(securityDirectory, name), 'utf8')),
    );
    assert.doesNotThrow(() => new SecurityEvidencePolicy().verifyRepositoryConfiguration({ sources, workflows }));
  });
});
