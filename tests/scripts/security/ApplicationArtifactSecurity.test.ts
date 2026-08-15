import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { createPackage } from '@electron/asar';

import {
  APPLICATION_ARTIFACT_SECURITY_SCHEMA_VERSION,
  APPLICATION_SBOM_FORMAT,
  ApplicationSbomGenerator,
  ArtifactVulnerabilityPolicy,
  canonicalArtifactSecurityJson,
} from '@scripts/security/applicationArtifactSecurity';

const SOURCE_COMMIT = '1'.repeat(40);
const PACKAGE_SHA256 = '2'.repeat(64);
const CHECKSUM_SHA256 = '3'.repeat(64);
const DATABASE_SHA256 = '4'.repeat(64);
const NOW = new Date('2026-08-13T12:00:00.000Z');
const UNSAFE_UNPACKED_ENTRY_NAME = 'unsafe-\u00e9-name';
const DATABASE = {
  DownloadedAt: '2026-08-13T11:00:00.000Z',
  NextUpdate: '2026-08-14T11:00:00.000Z',
  UpdatedAt: '2026-08-13T11:00:00.000Z',
  Version: 2,
};
const WINDOWS_APPLICATION_EXECUTABLE = 'GPT Voice.exe';

const EXPECTED_LOCKS = [
  [
    'googletest-v1.17.0-52eb810',
    'https://github.com/google/googletest.git',
    '52eb8108c5bdec04579160ae17225d66034bd723',
  ],
  ['nlohmann-json-v3.12.0-subset', 'https://github.com/nlohmann/json.git', '55f93686c01528224f448c19128836e7df245f72'],
  [
    'whisper-cpp-v1.9.1-f049fff',
    'https://github.com/ggml-org/whisper.cpp.git',
    'f049fff95a089aa9969deb009cdd4892b3e74916',
  ],
] as const;

function cleanReport(artifactName: string): object {
  return {
    ArtifactName: artifactName,
    ArtifactType: 'filesystem',
    Results: [{ Class: 'lang-pkgs', Target: 'component', Type: 'npm', Vulnerabilities: [] }],
    SchemaVersion: 2,
  };
}

async function createWorkspace(
  input: {
    readonly packageLockPaddingBytes?: number;
    readonly platform?: 'linux' | 'win32';
    readonly assembledPlaywrightVersion?: string;
    readonly sourceLockPaddingBytes?: number;
  } = {},
): Promise<{ readonly root: string; readonly unpackedRoot: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-artifact-security-'));
  const unpackedRoot = path.join(root, 'unpacked');
  const platform = input.platform ?? 'linux';
  const applicationName = platform === 'win32' ? WINDOWS_APPLICATION_EXECUTABLE : 'gpt-voice';
  const helperNames =
    platform === 'win32'
      ? { guard: 'fs-guard.exe', launcher: 'local-whisper-launcher.exe' }
      : { guard: 'fs-guard', launcher: 'local-whisper-launcher' };
  const runtimeName = platform === 'win32' ? 'runtime.dll' : 'runtime.so';
  const asarSource = path.join(root, 'asar-source');
  const helperBytes = {
    guard: Buffer.from('guard', 'utf8'),
    launcher: Buffer.from('launcher', 'utf8'),
  };
  const helperSha256 = {
    guard: createHash('sha256').update(helperBytes.guard).digest('hex'),
    launcher: createHash('sha256').update(helperBytes.launcher).digest('hex'),
  };
  await Promise.all([
    mkdir(path.join(root, 'node_modules', 'electron'), { recursive: true }),
    mkdir(path.join(root, 'node_modules', 'cloakbrowser'), { recursive: true }),
    mkdir(path.join(root, 'node_modules', 'playwright-core'), { recursive: true }),
    mkdir(path.join(root, 'runtime', 'local-whisper', 'sources', 'locks'), { recursive: true }),
    mkdir(path.join(unpackedRoot, 'resources', 'local-whisper', 'native'), { recursive: true }),
    mkdir(path.join(asarSource, 'node_modules', 'archiver'), { recursive: true }),
    mkdir(path.join(asarSource, 'node_modules', 'cloakbrowser'), { recursive: true }),
    mkdir(path.join(asarSource, 'node_modules', 'playwright-core'), { recursive: true }),
  ]);
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'gpt-voice', version: '1.4.0' }));
  await writeFile(
    path.join(root, 'package-lock.json'),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'gpt-voice', version: '1.4.0' },
        'node_modules/archiver': { version: '8.0.0' },
        'node_modules/electron': { version: '43.1.1' },
        'node_modules/cloakbrowser': { version: '0.5.3' },
        'node_modules/playwright-core': { version: '1.62.1' },
        'node_modules/test-only': { dev: true, version: '1.0.0' },
      },
      padding: 'x'.repeat(input.packageLockPaddingBytes ?? 0),
    }),
  );
  await Promise.all([
    writeFile(
      path.join(root, 'node_modules', 'electron', 'package.json'),
      JSON.stringify({ name: 'electron', version: '43.1.1' }),
    ),
    writeFile(
      path.join(root, 'node_modules', 'cloakbrowser', 'package.json'),
      JSON.stringify({ name: 'cloakbrowser', version: '0.5.3' }),
    ),
    writeFile(
      path.join(root, 'node_modules', 'playwright-core', 'package.json'),
      JSON.stringify({ name: 'playwright-core', version: '1.62.1' }),
    ),
    writeFile(path.join(unpackedRoot, applicationName), 'CANARY_APPLICATION_BYTES'),
    writeFile(path.join(unpackedRoot, 'resources', runtimeName), 'CANARY_RUNTIME_BYTES'),
    writeFile(path.join(unpackedRoot, 'resources', 'local-whisper', 'native', helperNames.guard), helperBytes.guard),
    writeFile(
      path.join(unpackedRoot, 'resources', 'local-whisper', 'native', helperNames.launcher),
      helperBytes.launcher,
    ),
    writeFile(
      path.join(asarSource, 'node_modules', 'archiver', 'package.json'),
      JSON.stringify({ name: 'archiver', version: '8.0.0' }),
    ),
    writeFile(
      path.join(asarSource, 'node_modules', 'cloakbrowser', 'package.json'),
      JSON.stringify({ name: 'cloakbrowser', version: '0.5.3' }),
    ),
    writeFile(
      path.join(asarSource, 'node_modules', 'playwright-core', 'package.json'),
      JSON.stringify({ name: 'playwright-core', version: input.assembledPlaywrightVersion ?? '1.62.1' }),
    ),
    writeFile(
      path.join(unpackedRoot, 'resources', 'local-whisper', 'native', 'helpers.manifest.json'),
      JSON.stringify({
        helpers: [
          { name: helperNames.guard, sha256: helperSha256.guard },
          { name: helperNames.launcher, sha256: helperSha256.launcher },
        ],
        platform,
      }),
    ),
  ]);
  await createPackage(asarSource, path.join(unpackedRoot, 'resources', 'app.asar'));
  for (const [lockId, repository, commit] of EXPECTED_LOCKS) {
    await writeFile(
      path.join(root, 'runtime', 'local-whisper', 'sources', 'locks', `${lockId}.json`),
      JSON.stringify({
        commit,
        lockId,
        padding: lockId === 'whisper-cpp-v1.9.1-f049fff' ? 'x'.repeat(input.sourceLockPaddingBytes ?? 0) : undefined,
        repository,
      }),
    );
  }
  return Object.freeze({ root, unpackedRoot });
}

async function sbomFixture() {
  const fixture = await createWorkspace();
  const generator = new ApplicationSbomGenerator();
  const generated = await generator.generate({
    packageFormat: 'appimage',
    packageSha256: PACKAGE_SHA256,
    platform: 'linux',
    sourceCommit: SOURCE_COMMIT,
    unpackedRoot: fixture.unpackedRoot,
    workspaceRoot: fixture.root,
  });
  return Object.freeze({ ...fixture, generated });
}

function createRecord(sbomSha256: string) {
  return new ArtifactVulnerabilityPolicy().createRecord({
    checksumSha256: CHECKSUM_SHA256,
    database: DATABASE,
    databaseSha256: DATABASE_SHA256,
    filesystemReport: cleanReport('unpacked-root'),
    filesystemTarget: 'unpacked-root',
    now: NOW,
    packageFormat: 'appimage',
    packageSha256: PACKAGE_SHA256,
    platform: 'linux',
    sbomReport: cleanReport('sbom'),
    sbomSha256,
    sbomTarget: 'sbom',
    sourceCommit: SOURCE_COMMIT,
    unpackedRootSha256: '7'.repeat(64),
  });
}

describe('Application artifact SBOM', () => {
  it('builds a bounded whole-application CycloneDX document without retaining file contents or paths', async () => {
    const fixture = await sbomFixture();
    try {
      assert.equal(fixture.generated.document.bomFormat, 'CycloneDX');
      assert.equal(fixture.generated.document.specVersion, '1.6');
      assert.ok(fixture.generated.document.components.some((component) => component.name === 'electron'));
      assert.ok(fixture.generated.document.components.some((component) => component.name === 'cloakbrowser'));
      assert.ok(fixture.generated.document.components.some((component) => component.name === 'playwright-core'));
      assert.ok(fixture.generated.document.components.some((component) => component.name === 'whisper.cpp'));
      assert.ok(fixture.generated.document.components.some((component) => component.name === 'fs-guard'));
      const serialized = canonicalArtifactSecurityJson(fixture.generated.document);
      assert.doesNotMatch(serialized, /CANARY_APPLICATION_BYTES|CANARY_RUNTIME_BYTES/u);
      assert.doesNotMatch(serialized, new RegExp(fixture.unpackedRoot.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('allows a bounded Windows product executable name containing spaces', async () => {
    const fixture = await createWorkspace({ platform: 'win32' });
    try {
      const generated = await new ApplicationSbomGenerator().generate({
        packageFormat: 'nsis',
        packageSha256: PACKAGE_SHA256,
        platform: 'win32',
        sourceCommit: SOURCE_COMMIT,
        unpackedRoot: fixture.unpackedRoot,
        workspaceRoot: fixture.root,
      });

      assert.ok(generated.document.components.some((component) => component.name === WINDOWS_APPLICATION_EXECUTABLE));
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('rejects a missing expected native lock before producing a partial SBOM', async () => {
    const fixture = await createWorkspace();
    try {
      await rm(path.join(fixture.root, 'runtime', 'local-whisper', 'sources', 'locks', `${EXPECTED_LOCKS[0][0]}.json`));
      await assert.rejects(
        () =>
          new ApplicationSbomGenerator().generate({
            packageFormat: 'appimage',
            packageSha256: PACKAGE_SHA256,
            platform: 'linux',
            sourceCommit: SOURCE_COMMIT,
            unpackedRoot: fixture.unpackedRoot,
            workspaceRoot: fixture.root,
          }),
        /SOURCE_LOCK_UNAVAILABLE/u,
      );
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('rejects final app.asar versions that do not match the reviewed lockfile', async () => {
    const fixture = await createWorkspace({ assembledPlaywrightVersion: '1.62.0' });
    try {
      await assert.rejects(
        () =>
          new ApplicationSbomGenerator().generate({
            packageFormat: 'appimage',
            packageSha256: PACKAGE_SHA256,
            platform: 'linux',
            sourceCommit: SOURCE_COMMIT,
            unpackedRoot: fixture.unpackedRoot,
            workspaceRoot: fixture.root,
          }),
        /APPLICATION_ARTIFACT_SECURITY_ASSEMBLY_COMPONENT_MISMATCH/u,
      );
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('rejects a helper manifest digest that does not match the final assembled helper bytes', async () => {
    const fixture = await createWorkspace();
    try {
      await writeFile(
        path.join(fixture.unpackedRoot, 'resources', 'local-whisper', 'native', 'fs-guard'),
        'mutated-helper',
      );
      await assert.rejects(
        () =>
          new ApplicationSbomGenerator().generate({
            packageFormat: 'appimage',
            packageSha256: PACKAGE_SHA256,
            platform: 'linux',
            sourceCommit: SOURCE_COMMIT,
            unpackedRoot: fixture.unpackedRoot,
            workspaceRoot: fixture.root,
          }),
        /APPLICATION_ARTIFACT_SECURITY_HELPER_MANIFEST_DIGEST_MISMATCH/u,
      );
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('accepts the bounded production lockfile size without raising the smaller SBOM-output ceiling', async () => {
    const fixture = await createWorkspace({ packageLockPaddingBytes: 300 * 1024 });
    try {
      const generated = await new ApplicationSbomGenerator().generate({
        packageFormat: 'appimage',
        packageSha256: PACKAGE_SHA256,
        platform: 'linux',
        sourceCommit: SOURCE_COMMIT,
        unpackedRoot: fixture.unpackedRoot,
        workspaceRoot: fixture.root,
      });
      assert.equal(generated.document.bomFormat, 'CycloneDX');
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('accepts the bounded immutable source-lock size needed by the full Whisper.cpp lock', async () => {
    const fixture = await createWorkspace({ sourceLockPaddingBytes: 700 * 1024 });
    try {
      const generated = await new ApplicationSbomGenerator().generate({
        packageFormat: 'appimage',
        packageSha256: PACKAGE_SHA256,
        platform: 'linux',
        sourceCommit: SOURCE_COMMIT,
        unpackedRoot: fixture.unpackedRoot,
        workspaceRoot: fixture.root,
      });

      assert.equal(generated.document.bomFormat, 'CycloneDX');
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('rejects an immutable source lock that exceeds the one-mebibyte contract ceiling', async () => {
    const fixture = await createWorkspace({ sourceLockPaddingBytes: 1024 * 1024 });
    try {
      await assert.rejects(
        () =>
          new ApplicationSbomGenerator().generate({
            packageFormat: 'appimage',
            packageSha256: PACKAGE_SHA256,
            platform: 'linux',
            sourceCommit: SOURCE_COMMIT,
            unpackedRoot: fixture.unpackedRoot,
            workspaceRoot: fixture.root,
          }),
        /SOURCE_LOCK_INVALID/u,
      );
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('returns a sanitized structural class for an invalid unpacked entry name', async () => {
    const fixture = await createWorkspace();
    try {
      await writeFile(path.join(fixture.unpackedRoot, UNSAFE_UNPACKED_ENTRY_NAME), 'CANARY_UNSAFE_ENTRY_BYTES');
      await assert.rejects(
        () =>
          new ApplicationSbomGenerator().generate({
            packageFormat: 'appimage',
            packageSha256: PACKAGE_SHA256,
            platform: 'linux',
            sourceCommit: SOURCE_COMMIT,
            unpackedRoot: fixture.unpackedRoot,
            workspaceRoot: fixture.root,
          }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, 'APPLICATION_ARTIFACT_SECURITY_UNPACKED_ROOT_NAME_INVALID');
          assert.doesNotMatch(error.message, /unsafe/u);
          return true;
        },
      );
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });
});

describe('Application artifact vulnerability policy', () => {
  it('creates a canonical clean evidence record and binds it to the exact package and SBOM', async () => {
    const fixture = await sbomFixture();
    try {
      const record = createRecord(fixture.generated.sha256);
      assert.equal(record.schemaVersion, APPLICATION_ARTIFACT_SECURITY_SCHEMA_VERSION);
      assert.equal(record.sbom.format, APPLICATION_SBOM_FORMAT);
      assert.equal(record.result, 'clean');
      const policy = new ArtifactVulnerabilityPolicy();
      policy.verifyBinding({
        checksumSha256: CHECKSUM_SHA256,
        packageFormat: 'appimage',
        packageSha256: PACKAGE_SHA256,
        platform: 'linux',
        record: {
          ...record,
          unpackedRootSha256: fixture.generated.unpackedRootSha256,
          sbom: { ...record.sbom, sha256: fixture.generated.sha256 },
        },
        sbom: fixture.generated.document,
        sourceCommit: SOURCE_COMMIT,
        unpackedRootSha256: fixture.generated.unpackedRootSha256,
      });
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('normalizes valid Trivy database timestamps to canonical record bytes', () => {
    const record = new ArtifactVulnerabilityPolicy().createRecord({
      checksumSha256: CHECKSUM_SHA256,
      database: {
        ...DATABASE,
        DownloadedAt: '2026-08-13T11:00:00Z',
        NextUpdate: '2026-08-14T11:00:00.123456789Z',
        UpdatedAt: '2026-08-13T11:00:00.123456789Z',
      },
      databaseSha256: DATABASE_SHA256,
      filesystemReport: cleanReport('unpacked-root'),
      filesystemTarget: 'unpacked-root',
      now: NOW,
      packageFormat: 'appimage',
      packageSha256: PACKAGE_SHA256,
      platform: 'linux',
      sbomReport: cleanReport('sbom'),
      sbomSha256: '8'.repeat(64),
      sbomTarget: 'sbom',
      sourceCommit: SOURCE_COMMIT,
      unpackedRootSha256: '7'.repeat(64),
    });
    assert.equal(record.scanner.database.updatedAt, '2026-08-13T11:00:00.123Z');
    assert.equal(record.scanner.database.updatedAt.endsWith('.123Z'), true);
  });

  it('rejects scanner reports without semantic result coverage', () => {
    for (const Results of [undefined, null, []]) {
      assert.throws(
        () =>
          new ArtifactVulnerabilityPolicy().createRecord({
            checksumSha256: CHECKSUM_SHA256,
            database: DATABASE,
            databaseSha256: DATABASE_SHA256,
            filesystemReport: {
              ArtifactName: 'unpacked-root',
              ArtifactType: 'filesystem',
              Results,
              SchemaVersion: 2,
            },
            filesystemTarget: 'unpacked-root',
            now: NOW,
            packageFormat: 'appimage',
            packageSha256: PACKAGE_SHA256,
            platform: 'linux',
            sbomReport: cleanReport('sbom'),
            sbomSha256: '8'.repeat(64),
            sbomTarget: 'sbom',
            sourceCommit: SOURCE_COMMIT,
            unpackedRootSha256: '7'.repeat(64),
          }),
        /SCAN_MALFORMED/u,
      );
    }
    assert.throws(
      () =>
        new ArtifactVulnerabilityPolicy().createRecord({
          checksumSha256: CHECKSUM_SHA256,
          database: DATABASE,
          databaseSha256: DATABASE_SHA256,
          filesystemReport: {
            ArtifactName: 'unpacked-root',
            ArtifactType: 'filesystem',
            Results: [{ Target: 'component', Vulnerabilities: [] }],
            SchemaVersion: 2,
          },
          filesystemTarget: 'unpacked-root',
          now: NOW,
          packageFormat: 'appimage',
          packageSha256: PACKAGE_SHA256,
          platform: 'linux',
          sbomReport: cleanReport('sbom'),
          sbomSha256: '8'.repeat(64),
          sbomTarget: 'sbom',
          sourceCommit: SOURCE_COMMIT,
          unpackedRootSha256: '7'.repeat(64),
        }),
      /SCAN_MALFORMED/u,
    );
  });

  for (const [name, input, expected] of [
    [
      'a high finding',
      {
        filesystemReport: {
          ...cleanReport('unpacked-root'),
          Results: [{ Class: 'lang-pkgs', Target: 'component', Type: 'npm', Vulnerabilities: [{ Severity: 'HIGH' }] }],
        },
      },
      /SCAN_FINDING/u,
    ],
    [
      'a critical unfixed finding',
      {
        filesystemReport: {
          ...cleanReport('unpacked-root'),
          Results: [
            {
              Class: 'lang-pkgs',
              Target: 'component',
              Type: 'npm',
              Vulnerabilities: [{ Severity: 'CRITICAL', Status: 'not_fixed' }],
            },
          ],
        },
      },
      /SCAN_FINDING/u,
    ],
    [
      'an ambiguous severity',
      {
        filesystemReport: {
          ...cleanReport('unpacked-root'),
          Results: [
            { Class: 'lang-pkgs', Target: 'component', Type: 'npm', Vulnerabilities: [{ Severity: 'MEDIUM' }] },
          ],
        },
      },
      /SCAN_AMBIGUOUS/u,
    ],
    ['a malformed scanner result', { sbomReport: {} }, /SCAN_MALFORMED/u],
    ['a stale database', { database: { ...DATABASE, UpdatedAt: '2026-08-01T00:00:00.000Z' } }, /DATABASE_STALE/u],
    ['an unavailable database', { database: null }, /DATABASE_INVALID/u],
  ] as const) {
    it(`fails closed for ${name}`, () => {
      assert.throws(
        () =>
          new ArtifactVulnerabilityPolicy().createRecord({
            checksumSha256: CHECKSUM_SHA256,
            database: DATABASE,
            databaseSha256: DATABASE_SHA256,
            filesystemReport: cleanReport('unpacked-root'),
            filesystemTarget: 'unpacked-root',
            now: NOW,
            packageFormat: 'appimage',
            packageSha256: PACKAGE_SHA256,
            platform: 'linux',
            sbomReport: cleanReport('sbom'),
            sbomSha256: '8'.repeat(64),
            sbomTarget: 'sbom',
            sourceCommit: SOURCE_COMMIT,
            unpackedRootSha256: '7'.repeat(64),
            ...input,
          }),
        expected,
      );
    });
  }

  it('rejects platform, package, SBOM, checksum, and unpacked-root substitutions', () => {
    const policy = new ArtifactVulnerabilityPolicy();
    const record = createRecord('8'.repeat(64));
    const binding = {
      checksumSha256: CHECKSUM_SHA256,
      packageFormat: 'appimage' as const,
      packageSha256: PACKAGE_SHA256,
      platform: 'linux' as const,
      record,
      sbom: { bomFormat: 'CycloneDX' },
      sourceCommit: SOURCE_COMMIT,
      unpackedRootSha256: '7'.repeat(64),
    };
    for (const invalid of [
      { ...binding, platform: 'win32' as const },
      { ...binding, packageSha256: '9'.repeat(64) },
      { ...binding, checksumSha256: 'a'.repeat(64) },
      { ...binding, sbom: { bomFormat: 'CycloneDX', changed: true } },
      { ...binding, unpackedRootSha256: 'b'.repeat(64) },
    ]) {
      assert.throws(() => policy.verifyBinding(invalid), /(?:FORMAT_INVALID|BINDING_INVALID)/u);
    }
  });
});
