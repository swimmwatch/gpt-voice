import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GitHubAttestationVerifier,
  PackageAttestationInputPolicy,
  PackageAttestationVerifier,
  PACKAGE_ATTESTATION_SUBJECT_NAMES,
  type GitHubAttestationCommand,
  type PackageAttestationInput,
  type PackageAttestationSubjectName,
} from '@scripts/security/packageAttestationPolicy';

const SOURCE_COMMIT = 'a'.repeat(40);
const REPOSITORY = 'swimmwatch/gpt-voice';
const INVOCATION = '123456789-1-package-smoke-linux';

function subjects(): Record<PackageAttestationSubjectName, Uint8Array> {
  return {
    checksum: Buffer.from('synthetic-checksum', 'utf8'),
    package: Buffer.from('synthetic-package', 'utf8'),
    sbom: Buffer.from('synthetic-sbom', 'utf8'),
    scanner: Buffer.from('synthetic-scanner', 'utf8'),
    smoke: Buffer.from('synthetic-smoke', 'utf8'),
  };
}

function input(): PackageAttestationInput {
  return new PackageAttestationInputPolicy().create({
    invocation: INVOCATION,
    platform: 'linux',
    repository: REPOSITORY,
    sourceCommit: SOURCE_COMMIT,
    subjects: subjects(),
  });
}

function verify(value = input(), subjectBytes = subjects()): void {
  new PackageAttestationVerifier().verify({
    expected: {
      invocation: INVOCATION,
      platform: 'linux',
      repository: REPOSITORY,
      sourceCommit: SOURCE_COMMIT,
      workflowPath: '.github/workflows/pr-checks.yml',
    },
    input: value,
    subjects: subjectBytes,
  });
}

describe('Package attestation policy', () => {
  it('serializes a bounded canonical Linux chain and verifies every bound subject', () => {
    const policy = new PackageAttestationInputPolicy();
    const value = input();

    assert.doesNotThrow(() => verify(value));
    assert.equal(
      policy.parse(policy.serialize(value)).source.workflowRef,
      `${REPOSITORY}/.github/workflows/pr-checks.yml@${SOURCE_COMMIT}`,
    );
  });

  for (const name of PACKAGE_ATTESTATION_SUBJECT_NAMES) {
    it(`rejects a ${name} mutation`, () => {
      const mutated = subjects();
      mutated[name] = Buffer.from(`changed-${name}`, 'utf8');
      assert.throws(() => verify(input(), mutated), /PACKAGE_ATTESTATION_BINDING_INVALID/u);
    });
  }

  it('rejects source revision, workflow identity, invocation, cancellation, and unavailable evidence', () => {
    const value = input();
    const variants: readonly unknown[] = [
      {
        ...value,
        source: {
          ...value.source,
          commit: 'b'.repeat(40),
          workflowRef: `${REPOSITORY}/.github/workflows/pr-checks.yml@${'b'.repeat(40)}`,
        },
      },
      {
        ...value,
        source: { ...value.source, workflowRef: `${REPOSITORY}/.github/workflows/other.yml@${SOURCE_COMMIT}` },
      },
      { ...value, build: { ...value.build, invocation: '123456789-2-package-smoke-linux' } },
      { ...value, build: { ...value.build, status: 'cancelled' } },
    ];
    for (const variant of variants) {
      assert.throws(() => verify(variant as PackageAttestationInput), /PACKAGE_ATTESTATION_(?:BINDING|INPUT)_/u);
    }
    const unavailable = subjects();
    unavailable.package = Buffer.alloc(0);
    assert.throws(() => verify(input(), unavailable), /PACKAGE_ATTESTATION_SUBJECT_UNAVAILABLE/u);
  });

  it('fails closed for malformed canonical input and an unsupported GitHub verifier', async () => {
    const policy = new PackageAttestationInputPolicy();
    assert.throws(() => policy.parse('{"schemaVersion":1}\n'), /PACKAGE_ATTESTATION_INPUT_MALFORMED/u);
    const command: GitHubAttestationCommand = { verify: async () => 'unsupported' };
    await assert.rejects(
      () =>
        new GitHubAttestationVerifier(command).verify({
          repository: REPOSITORY,
          sourceCommit: SOURCE_COMMIT,
          subjectPaths: [
            'attestation-input.json',
            ...PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => `subject/${name}`),
          ],
          workflowPath: '.github/workflows/pr-checks.yml',
        }),
      /PACKAGE_ATTESTATION_GITHUB_UNSUPPORTED/u,
    );
  });

  for (const result of ['invalid', 'unavailable'] as const) {
    it(`does not accept an ${result} GitHub attestation result`, async () => {
      const command: GitHubAttestationCommand = { verify: async () => result };
      await assert.rejects(
        () =>
          new GitHubAttestationVerifier(command).verify({
            repository: REPOSITORY,
            sourceCommit: SOURCE_COMMIT,
            subjectPaths: [
              'attestation-input.json',
              ...PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => `subject/${name}`),
            ],
            workflowPath: '.github/workflows/pr-checks.yml',
          }),
        (error: unknown) =>
          error instanceof Error && error.message === `PACKAGE_ATTESTATION_GITHUB_${result.toUpperCase()}`,
      );
    });
  }

  it('requires the signed input subject and exact provenance identity', async () => {
    const calls: Array<{ readonly path: string; readonly sourceCommit: string; readonly workflowPath: string }> = [];
    const command: GitHubAttestationCommand = {
      verify: async (path, expectation) => {
        calls.push({ path, sourceCommit: expectation.sourceCommit, workflowPath: expectation.workflowPath });
        return 'verified';
      },
    };
    const verifier = new GitHubAttestationVerifier(command);
    const subjectPaths = [
      'attestation-input.json',
      ...PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => `subject/${name}`),
    ];
    await verifier.verify({
      repository: REPOSITORY,
      sourceCommit: SOURCE_COMMIT,
      subjectPaths,
      workflowPath: '.github/workflows/pr-checks.yml',
    });
    assert.equal(calls.length, subjectPaths.length);
    assert.equal(
      calls.every((call) => call.sourceCommit === SOURCE_COMMIT),
      true,
    );
    assert.equal(
      calls.every((call) => call.workflowPath === '.github/workflows/pr-checks.yml'),
      true,
    );
    await assert.rejects(
      () =>
        verifier.verify({
          repository: REPOSITORY,
          sourceCommit: SOURCE_COMMIT,
          subjectPaths: subjectPaths.filter((path) => path !== 'attestation-input.json'),
          workflowPath: '.github/workflows/pr-checks.yml',
        }),
      /PACKAGE_ATTESTATION_SUBJECT_UNAVAILABLE/u,
    );
  });
});
