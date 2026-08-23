import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { CiInstallCoordinator, resolveBootstrapNpmCommand } from '@scripts/ci-install-core.mjs';
import { CURRENT_COREPACK_VERSION, CURRENT_PACKAGE_MANAGER } from '@scripts/security/package-manager-policy.mjs';

interface CommandRequest {
  readonly arguments_: readonly string[];
  readonly command: string;
  readonly cwd: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly stdio: string;
}

async function createProject(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-ci-install-test-'));
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({
      devDependencies: { corepack: CURRENT_COREPACK_VERSION },
      packageManager: CURRENT_PACKAGE_MANAGER,
    }),
  );
  return directory;
}

async function createCorepackInstall(project: string): Promise<void> {
  const corepackDirectory = path.join(project, 'node_modules', 'corepack');
  await mkdir(path.join(corepackDirectory, 'dist'), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(corepackDirectory, 'package.json'),
      JSON.stringify({ name: 'corepack', version: CURRENT_COREPACK_VERSION }),
    ),
    writeFile(path.join(corepackDirectory, 'dist', 'corepack.js'), 'export {};\n'),
  ]);
}

describe('CI install coordinator', () => {
  it('uses the exact current npm through available Corepack', async () => {
    const project = await createProject();
    const calls: CommandRequest[] = [];
    try {
      await new CiInstallCoordinator({
        attempts: 1,
        cwd: project,
        output: { write: () => true },
        runCommand: async (request: CommandRequest) => {
          calls.push(request);
          return 0;
        },
      }).install();
      assert.deepEqual(
        calls.map((call) => call.arguments_),
        [
          [CURRENT_PACKAGE_MANAGER, '--version'],
          [CURRENT_PACKAGE_MANAGER, 'ci'],
        ],
      );
      assert.equal(calls[1]?.command, 'corepack');
    } finally {
      await rm(project, { force: true, recursive: true });
    }
  });

  it('bootstraps locked Corepack with scripts disabled before the exact npm install', async () => {
    const project = await createProject();
    const npmEntry = path.join(project, 'bootstrap', 'npm-cli.js');
    const calls: CommandRequest[] = [];
    const messages: string[] = [];
    let stagedCorepackEntry = '';
    try {
      await mkdir(path.dirname(npmEntry), { recursive: true });
      await writeFile(npmEntry, '');
      await new CiInstallCoordinator({
        attempts: 1,
        cwd: project,
        environment: { npm_execpath: npmEntry },
        nodeExecutable: process.execPath,
        output: { write: (value: string) => messages.push(value) > 0 },
        runCommand: async (request: CommandRequest) => {
          calls.push(request);
          if (calls.length === 1) return 1;
          if (calls.length === 2) {
            await createCorepackInstall(project);
            return 0;
          }
          stagedCorepackEntry = request.arguments_[0] ?? '';
          return 0;
        },
      }).install();

      assert.deepEqual(calls[1]?.arguments_, [npmEntry, 'ci', '--ignore-scripts', '--no-audit']);
      assert.equal(calls[1]?.environment.NPM_CONFIG_ENGINE_STRICT, 'false');
      assert.equal(calls[1]?.environment.NPM_CONFIG_IGNORE_SCRIPTS, 'true');
      assert.equal(calls[2]?.command, process.execPath);
      assert.deepEqual(calls[2]?.arguments_.slice(1), [CURRENT_PACKAGE_MANAGER, 'ci']);
      assert.notEqual(stagedCorepackEntry, path.join(project, 'node_modules', 'corepack', 'dist', 'corepack.js'));
      assert.equal(existsSync(path.dirname(path.dirname(stagedCorepackEntry))), false);
      assert.match(messages.join(''), /bootstrapping the locked script-disabled dependency graph/u);
    } finally {
      await rm(project, { force: true, recursive: true });
    }
  });

  it('rejects a project whose package-manager pins drift before running commands', async () => {
    const project = await createProject();
    let commandCount = 0;
    try {
      await writeFile(
        path.join(project, 'package.json'),
        JSON.stringify({
          devDependencies: { corepack: `^${CURRENT_COREPACK_VERSION}` },
          packageManager: CURRENT_PACKAGE_MANAGER,
        }),
      );
      await assert.rejects(
        new CiInstallCoordinator({
          cwd: project,
          runCommand: async () => {
            commandCount += 1;
            return 0;
          },
        }).install(),
        /CI_INSTALL_PACKAGE_MANAGER_POLICY_INVALID/u,
      );
      assert.equal(commandCount, 0);
    } finally {
      await rm(project, { force: true, recursive: true });
    }
  });

  it('resolves npm entrypoints without a Windows command shim', () => {
    const nodeExecutable = String.raw`C:\Program Files\nodejs\node.exe`;
    const npmEntry = String.raw`C:\npm\npm-cli.js`;
    const command = resolveBootstrapNpmCommand(
      'win32',
      nodeExecutable,
      { npm_execpath: npmEntry },
      (entry: string) => ({
        isFile: () => entry === npmEntry,
        isSymbolicLink: () => false,
      }),
    );
    assert.deepEqual(command, { executable: nodeExecutable, argumentPrefix: [npmEntry] });
  });
});
