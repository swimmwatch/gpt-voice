import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  hashPackageAttestationSubject,
  packageAttestationFailureMessage,
  resolvePackageAttestationWorkspacePath,
} from '@scripts/security/packageAttestationCommandSupport';

describe('package attestation command support', () => {
  let workspaceRoot: string;

  before(async () => {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-package-attestation-'));
  });

  after(async () => {
    await rm(workspaceRoot, { force: true, recursive: true });
  });

  it('resolves only bounded paths strictly below the workspace', () => {
    assert.equal(
      resolvePackageAttestationWorkspacePath(workspaceRoot, 'evidence/package'),
      path.join(workspaceRoot, 'evidence', 'package'),
    );
    for (const value of ['', '.', '../outside', '/absolute', 'UPPERCASE']) {
      assert.throws(
        () => resolvePackageAttestationWorkspacePath(workspaceRoot, value),
        /^Error: PACKAGE_ATTESTATION_ARGUMENT_INVALID$/u,
      );
    }
  });

  it('hashes a non-empty subject through its verified descriptor', async () => {
    const bytes = Buffer.from('package subject', 'utf8');
    const subjectPath = path.join(workspaceRoot, 'subject.AppImage');
    await writeFile(subjectPath, bytes);

    assert.equal(await hashPackageAttestationSubject(subjectPath), createHash('sha256').update(bytes).digest('hex'));
    await assert.rejects(
      hashPackageAttestationSubject(path.join(workspaceRoot, 'missing.AppImage')),
      /^Error: PACKAGE_ATTESTATION_SUBJECT_UNAVAILABLE$/u,
    );
  });

  it('reports only bounded package-attestation failures', () => {
    assert.equal(
      packageAttestationFailureMessage(new Error('PACKAGE_ATTESTATION_SUBJECT_INVALID')),
      'PACKAGE_ATTESTATION_SUBJECT_INVALID',
    );
    assert.equal(packageAttestationFailureMessage(new Error('private detail')), 'PACKAGE_ATTESTATION_FAILED');
    assert.equal(packageAttestationFailureMessage('private detail'), 'PACKAGE_ATTESTATION_FAILED');
  });
});
