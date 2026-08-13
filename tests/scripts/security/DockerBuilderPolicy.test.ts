import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  DockerBuilderPolicy,
  HADOLINT_IMAGE,
  SECURITY_BUILDER_TAG,
  TRIVY_DATABASE_ARGUMENTS,
  TRIVY_DATABASE_REPOSITORY,
  TRIVY_IMAGE,
} from '@scripts/security/dockerBuilderPolicy';

const DATABASE_SHA256 = 'a'.repeat(64);
const NOW = new Date('2026-08-10T12:00:00.000Z');
const database = {
  DownloadedAt: '2026-08-10T11:00:00.000Z',
  NextUpdate: '2026-08-11T11:00:00.000Z',
  UpdatedAt: '2026-08-10T11:00:00.000Z',
  Version: 2,
};
const cleanReport = {
  ArtifactName: SECURITY_BUILDER_TAG,
  ArtifactType: 'container_image',
  Metadata: {},
  Results: [{ Target: 'rootfs', Vulnerabilities: [] }],
  SchemaVersion: 2,
};
const dockerFixtureDirectory = path.join(process.cwd(), 'tests', 'fixtures', 'security', 'docker');

function dockerFixture(name: string): Promise<string> {
  return readFile(path.join(dockerFixtureDirectory, name), 'utf8');
}

function verifyEvidence(input: Partial<Parameters<DockerBuilderPolicy['verifyScanEvidence']>[0]> = {}): void {
  new DockerBuilderPolicy().verifyScanEvidence({
    builderImage: SECURITY_BUILDER_TAG,
    database,
    databaseSha256: DATABASE_SHA256,
    now: NOW,
    report: cleanReport,
    scannerImage: TRIVY_IMAGE,
    ...input,
  });
}

describe('Docker builder policy', () => {
  it('pins the reviewed Hadolint and Trivy manifest-list identities', () => {
    assert.equal(
      HADOLINT_IMAGE,
      'hadolint/hadolint:v2.12.0@sha256:30a8fd2e785ab6176eed53f74769e04f125afb2f74a6c52aef7d463583b6d45e',
    );
    assert.equal(
      TRIVY_IMAGE,
      'aquasec/trivy:0.68.2@sha256:05d0126976bdedcd0782a0336f77832dbea1c81b9cc5e4b3a5ea5d2ec863aca7',
    );
    assert.equal(TRIVY_DATABASE_REPOSITORY, 'ghcr.io/aquasecurity/trivy-db:2');
    assert.deepEqual(TRIVY_DATABASE_ARGUMENTS, ['--db-repository', TRIVY_DATABASE_REPOSITORY]);
  });

  it('accepts the reviewed immutable Fedora Dockerfile and clean current scan evidence', async () => {
    const policy = new DockerBuilderPolicy();
    const dockerfile = await dockerFixture('safe.Dockerfile');
    assert.doesNotThrow(() => policy.verifyDockerfile(dockerfile));
    assert.doesNotThrow(() => verifyEvidence());
  });

  it('accepts a clean Trivy schema-v2 report that omits an empty results collection', () => {
    const { Results: _results, ...emptyCleanReport } = cleanReport;
    assert.doesNotThrow(() => verifyEvidence({ report: emptyCleanReport }));
  });

  for (const [name, fixture, expected] of [
    ['a mutable base image', 'mutable-base.Dockerfile', /identity mismatch/u],
    ['a Hadolint suppression', 'hadolint-suppression.Dockerfile', /suppression/u],
    ['an unsafe instruction', 'unsafe-instruction.Dockerfile', /unsafe Dockerfile/u],
  ] as const) {
    it(`rejects ${name}`, async () => {
      const dockerfile = await dockerFixture(fixture);
      assert.throws(() => new DockerBuilderPolicy().verifyDockerfile(dockerfile), expected);
    });
  }

  for (const [name, input, expected] of [
    ['wrong scanner identity', { scannerImage: `${TRIVY_IMAGE}x` }, /identity mismatch/u],
    ['wrong builder identity', { builderImage: 'other:tag' }, /identity mismatch/u],
    ['malformed database identity', { databaseSha256: 'malformed' }, /identity malformed/u],
    ['stale database', { database: { ...database, UpdatedAt: '2026-08-01T00:00:00.000Z' } }, /unavailable or stale/u],
    [
      'expired database',
      { database: { ...database, NextUpdate: '2026-08-10T11:00:00.000Z' } },
      /unavailable or stale/u,
    ],
    ['malformed report', { report: {} }, /report malformed/u],
    [
      'unfixed critical finding',
      {
        report: {
          ...cleanReport,
          Results: [{ Vulnerabilities: [{ Severity: 'CRITICAL', Status: 'not_fixed' }] }],
        },
      },
      /high or critical/u,
    ],
  ] as const) {
    it(`rejects ${name}`, () => {
      assert.throws(() => verifyEvidence(input), expected);
    });
  }
});
