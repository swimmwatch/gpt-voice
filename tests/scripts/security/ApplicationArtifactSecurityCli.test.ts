import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { createPackage } from '@electron/asar';

import { canonicalArtifactSecurityJson } from '@scripts/security/applicationArtifactSecurity';

const SOURCE_COMMIT = '1'.repeat(40);
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
const SCANNER_SCRIPT = path.join(process.cwd(), 'scripts', 'security', 'scan-application-artifacts.ts');

interface ArtifactSecurityFixture {
  readonly binDirectory: string;
  readonly cacheDirectory: string;
  readonly root: string;
  readonly tracePath: string;
}

async function createFixture(
  input: { readonly databaseAgeDays?: number; readonly platform?: 'linux' | 'win32' } = {},
): Promise<ArtifactSecurityFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-artifact-security-cli-'));
  const binDirectory = path.join(root, 'bin');
  const cacheDirectory = path.join(root, 'trivy-cache');
  const platform = input.platform ?? 'linux';
  const unpackedRoot = path.join(root, 'release', platform === 'linux' ? 'linux-unpacked' : 'win-unpacked');
  const tracePath = path.join(root, 'trivy-trace.txt');
  const applicationName = platform === 'linux' ? 'gpt-voice' : 'GPT Voice.exe';
  const runtimeName = platform === 'linux' ? 'runtime.so' : 'runtime.dll';
  const helperNames =
    platform === 'linux'
      ? { guard: 'fs-guard', launcher: 'local-whisper-launcher' }
      : { guard: 'fs-guard.exe', launcher: 'local-whisper-launcher.exe' };
  const helperDigests = {
    guard: createHash('sha256').update('guard').digest('hex'),
    launcher: createHash('sha256').update('launcher').digest('hex'),
  };
  const asarSource = path.join(root, 'asar-source');
  await Promise.all([
    mkdir(binDirectory, { recursive: true }),
    mkdir(path.join(cacheDirectory, 'db'), { recursive: true }),
    mkdir(path.join(root, 'node_modules', 'electron'), { recursive: true }),
    mkdir(path.join(root, 'node_modules', 'cloakbrowser'), { recursive: true }),
    mkdir(path.join(root, 'node_modules', 'playwright-core'), { recursive: true }),
    mkdir(path.join(root, 'runtime', 'local-whisper', 'sources', 'locks'), { recursive: true }),
    mkdir(path.join(unpackedRoot, 'resources', 'local-whisper', 'native'), { recursive: true }),
    mkdir(path.join(asarSource, 'node_modules', 'cloakbrowser'), { recursive: true }),
    mkdir(path.join(asarSource, 'node_modules', 'playwright-core'), { recursive: true }),
  ]);
  const databaseTime = new Date(Date.now() - (input.databaseAgeDays ?? 0) * 24 * 60 * 60 * 1000);
  await Promise.all([
    writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ build: { productName: 'GPT Voice' }, name: 'gpt-voice', version: '1.4.0' }),
    ),
    writeFile(
      path.join(root, 'package-lock.json'),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { name: 'gpt-voice', version: '1.4.0' },
          'node_modules/cloakbrowser': { version: '0.5.3' },
          'node_modules/electron': { version: '43.1.1' },
          'node_modules/playwright-core': { version: '1.62.1' },
        },
      }),
    ),
    writeFile(
      path.join(cacheDirectory, 'db', 'metadata.json'),
      JSON.stringify({
        DownloadedAt: databaseTime.toISOString(),
        NextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        UpdatedAt: databaseTime.toISOString(),
        Version: 2,
      }),
    ),
    writeFile(path.join(cacheDirectory, 'db', 'trivy.db'), 'TRIVY_DATABASE_PAYLOAD'),
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
    writeFile(
      path.join(asarSource, 'node_modules', 'cloakbrowser', 'package.json'),
      JSON.stringify({ name: 'cloakbrowser', version: '0.5.3' }),
    ),
    writeFile(
      path.join(asarSource, 'node_modules', 'playwright-core', 'package.json'),
      JSON.stringify({ name: 'playwright-core', version: '1.62.1' }),
    ),
    ...(platform === 'linux'
      ? [
          writeFile(path.join(root, 'release', 'GPT Voice-1.4.0.AppImage'), 'CANARY_APPIMAGE_BYTES'),
          writeFile(path.join(root, 'release', 'gpt-voice_1.4.0_amd64.deb'), 'CANARY_DEB_BYTES'),
          writeFile(path.join(root, 'release', 'gpt-voice-1.4.0.x86_64.rpm'), 'CANARY_RPM_BYTES'),
        ]
      : [writeFile(path.join(root, 'release', 'GPT Voice Setup 1.4.0.exe'), 'CANARY_NSIS_BYTES')]),
    writeFile(path.join(unpackedRoot, applicationName), 'CANARY_APPLICATION_BYTES'),
    writeFile(path.join(unpackedRoot, 'resources', runtimeName), 'CANARY_RUNTIME_BYTES'),
    writeFile(path.join(unpackedRoot, 'resources', 'local-whisper', 'native', helperNames.guard), 'guard'),
    writeFile(path.join(unpackedRoot, 'resources', 'local-whisper', 'native', helperNames.launcher), 'launcher'),
    writeFile(
      path.join(unpackedRoot, 'resources', 'local-whisper', 'native', 'helpers.manifest.json'),
      JSON.stringify({
        helpers: [
          { name: helperNames.guard, sha256: helperDigests.guard },
          { name: helperNames.launcher, sha256: helperDigests.launcher },
        ],
        platform,
      }),
    ),
  ]);
  await createPackage(asarSource, path.join(unpackedRoot, 'resources', 'app.asar'));
  for (const [lockId, repository, commit] of EXPECTED_LOCKS) {
    await writeFile(
      path.join(root, 'runtime', 'local-whisper', 'sources', 'locks', `${lockId}.json`),
      JSON.stringify({ commit, lockId, repository }),
    );
  }
  await createFakeTrivy(binDirectory);
  return Object.freeze({ binDirectory, cacheDirectory, root, tracePath });
}

async function createFakeTrivy(binDirectory: string): Promise<void> {
  const program = `
const fs = require('node:fs');
const path = require('node:path');
const isWindowsExecutable =
  process.platform === 'win32' &&
  [process.argv0, process.execPath].some((value) => path.basename(value).toLowerCase() === 'trivy.exe');
const isDirectScript = path.resolve(process.argv[1] ?? '') === __filename;
if (isWindowsExecutable || isDirectScript) {
  const args = isWindowsExecutable
    ? [path.basename(process.argv[1] ?? ''), ...process.argv.slice(2)]
    : process.argv.slice(2);
  if (args[0] === 'version') {
    fs.writeSync(1, 'Version: 0.69.3\\n');
    process.exit(0);
  }
  if (args[0] === 'image' && args.includes('--download-db-only')) process.exit(0);
  if (process.env.FAKE_TRIVY_MODE === 'scanner-failure') process.exit(2);
  const outputIndex = args.indexOf('--output');
  if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(3);
  const output = args[outputIndex + 1];
  if (process.env.FAKE_TRIVY_TRACE) fs.appendFileSync(process.env.FAKE_TRIVY_TRACE, output + '\\n');
  if (process.env.FAKE_TRIVY_MODE === 'malformed') {
    fs.writeFileSync(output, '{}');
    process.exit(0);
  }
  const report = {
    ArtifactName: process.env.FAKE_TRIVY_MODE === 'windows-separators' ? args.at(-1).split('/').join('\\\\') : args.at(-1),
    ArtifactType: args[0] === 'sbom' ? 'cyclonedx' : 'filesystem',
    SchemaVersion: 2,
  };
  if (args[0] === 'sbom' && process.env.FAKE_TRIVY_MODE !== 'empty-sbom') {
    report.Results = [{ Class: 'lang-pkgs', Target: args.at(-1), Type: 'npm', Vulnerabilities: [] }];
  }
  fs.writeFileSync(output, JSON.stringify(report));
  process.exit(0);
}
`;
  const unixPath = path.join(binDirectory, 'trivy');
  await writeFile(unixPath, `#!/usr/bin/env node\n${program}`);
  await chmod(unixPath, 0o755);
  const fakeTrivyModule = path.join(binDirectory, 'fake-trivy.cjs');
  await writeFile(
    path.join(binDirectory, 'trivy.cmd'),
    `@echo off\r\n"${process.execPath}" "%~dp0fake-trivy.cjs" %*\r\n`,
  );
  await writeFile(fakeTrivyModule, program);
  if (process.platform === 'win32') {
    await copyFile(process.execPath, path.join(binDirectory, 'trivy.exe'));
  }
}

async function runScanner(
  fixture: ArtifactSecurityFixture,
  input: {
    readonly mode?: 'empty-sbom' | 'malformed' | 'scanner-failure' | 'windows-separators';
    readonly platform?: 'linux' | 'win32';
  } = {},
): Promise<{ readonly code: number | null; readonly stderr: string; readonly stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        SCANNER_SCRIPT,
        `--platform=${input.platform ?? 'linux'}`,
        `--source-commit=${SOURCE_COMMIT}`,
        '--output-directory=evidence',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APPLICATION_ARTIFACT_SECURITY_WORKSPACE: fixture.root,
          FAKE_TRIVY_MODE: input.mode,
          FAKE_TRIVY_TRACE: fixture.tracePath,
          NODE_OPTIONS:
            process.platform === 'win32'
              ? `${process.env.NODE_OPTIONS ?? ''} --require="${path
                  .join(fixture.binDirectory, 'fake-trivy.cjs')
                  .split(path.sep)
                  .join('/')}"`.trim()
              : process.env.NODE_OPTIONS,
          PATH: `${fixture.binDirectory}${path.delimiter}${process.env.PATH ?? ''}`,
          TRIVY_CACHE_DIR: fixture.cacheDirectory,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      resolve(
        Object.freeze({
          code,
          stderr: Buffer.concat(stderr).toString('utf8'),
          stdout: Buffer.concat(stdout).toString('utf8'),
        }),
      );
    });
  });
}

describe('Application artifact security scanner CLI', () => {
  it('emits only bounded canonical evidence and removes raw scanner reports', async () => {
    const fixture = await createFixture();
    try {
      const result = await runScanner(fixture);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /Application artifact security evidence verified for linux/u);
      const evidenceDirectory = path.join(fixture.root, 'evidence');
      const entries = (await readdir(evidenceDirectory)).sort((left, right) => left.localeCompare(right, 'en'));
      assert.equal(entries.length, 9);
      for (const entry of entries) {
        const bytes = await readFile(path.join(evidenceDirectory, entry));
        assert.ok(bytes.byteLength <= 256 * 1024);
        assert.doesNotMatch(bytes.toString('utf8'), /CANARY_(?:APPLICATION|RUNTIME|APPIMAGE|DEB|RPM)_BYTES/u);
        if (entry.endsWith('.json')) {
          const text = bytes.toString('utf8');
          assert.equal(text, `${canonicalArtifactSecurityJson(JSON.parse(text) as unknown)}\n`);
        }
      }
      const rawReportPaths = (await readFile(fixture.tracePath, 'utf8')).trim().split('\n');
      assert.equal(rawReportPaths.length, 5);
      await Promise.all(rawReportPaths.map((reportPath) => assert.rejects(access(reportPath))));
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('binds scanner database identity to the actual vulnerability database payload', async () => {
    const fixture = await createFixture();
    try {
      const first = await runScanner(fixture);
      assert.equal(first.code, 0, first.stderr);
      const recordPath = path.join(fixture.root, 'evidence', 'application-artifact-security-linux-appimage.json');
      const firstRecord = JSON.parse(await readFile(recordPath, 'utf8')) as {
        scanner: { database: { sha256: string } };
      };
      await rm(path.join(fixture.root, 'evidence'), { force: true, recursive: true });
      await writeFile(path.join(fixture.cacheDirectory, 'db', 'trivy.db'), 'MUTATED_TRIVY_DATABASE_PAYLOAD');
      const second = await runScanner(fixture);
      assert.equal(second.code, 0, second.stderr);
      const secondRecord = JSON.parse(await readFile(recordPath, 'utf8')) as {
        scanner: { database: { sha256: string } };
      };
      assert.notEqual(secondRecord.scanner.database.sha256, firstRecord.scanner.database.sha256);
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  for (const [name, mode, databaseAgeDays, expected] of [
    ['a scanner process failure', 'scanner-failure', 0, /SCANNER_UNAVAILABLE/u],
    ['a malformed scanner report', 'malformed', 0, /SCAN_MALFORMED/u],
    ['an SBOM report without semantic coverage', 'empty-sbom', 0, /SCAN_MALFORMED/u],
    ['a stale scanner database', undefined, 8, /DATABASE_STALE/u],
  ] as const) {
    it(`fails closed and removes partial evidence for ${name}`, async () => {
      const fixture = await createFixture({ databaseAgeDays });
      try {
        const result = await runScanner(fixture, { mode });
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, expected);
        await assert.rejects(access(path.join(fixture.root, 'evidence')));
      } finally {
        await rm(fixture.root, { force: true, recursive: true });
      }
    });
  }

  it('accepts a Windows Trivy report that uses backslash-separated workspace-relative artifact names', async () => {
    const fixture = await createFixture({ platform: 'win32' });
    try {
      const result = await runScanner(fixture, { mode: 'windows-separators', platform: 'win32' });
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /Application artifact security evidence verified for win32/u);
      assert.equal((await readdir(path.join(fixture.root, 'evidence'))).length, 5);
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });
});
