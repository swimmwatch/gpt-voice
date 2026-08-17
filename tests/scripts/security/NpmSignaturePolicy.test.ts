import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';

import { resolveCorepackCommand } from '@scripts/security/corepack-command.mjs';
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
  it('invokes the bundled Corepack entry directly on Windows without a command shell', () => {
    const nodeExecutable = String.raw`C:\Program Files\nodejs\node.exe`;
    const inspectEntry = () => ({ isFile: () => true, isSymbolicLink: () => false });
    assert.deepEqual(resolveCorepackCommand('win32', nodeExecutable, inspectEntry), {
      executable: nodeExecutable,
      argumentPrefix: [path.win32.join(path.win32.dirname(nodeExecutable), 'node_modules/corepack/dist/corepack.js')],
    });
    assert.deepEqual(resolveCorepackCommand('linux', '/opt/node/bin/node'), {
      executable: 'corepack',
      argumentPrefix: [],
    });
    assert.throws(() => resolveCorepackCommand('win32', 'node.exe'), /COREPACK_NODE_EXECUTABLE_INVALID/u);
    assert.throws(
      () =>
        resolveCorepackCommand('win32', nodeExecutable, () => ({
          isFile: () => true,
          isSymbolicLink: () => true,
        })),
      /COREPACK_ENTRY_UNAVAILABLE/u,
    );
  });

  it(
    'spawns the verified Windows Corepack entry through the active Node executable',
    { skip: process.platform !== 'win32' },
    async () => {
      const command = resolveCorepackCommand(process.platform, process.execPath);
      const result = await new Promise<{ readonly exitCode: number; readonly stdout: string }>((resolve) => {
        const child = spawn(command.executable, [...command.argumentPrefix, 'npm', '--version'], {
          shell: false,
          stdio: ['ignore', 'pipe', 'ignore'],
          windowsHide: true,
        });
        const chunks: Buffer[] = [];
        child.stdout.on('data', (chunk: Buffer) => {
          if (chunks.reduce((total, value) => total + value.byteLength, 0) + chunk.byteLength > 256) {
            child.kill();
            return;
          }
          chunks.push(chunk);
        });
        child.once('error', () => resolve({ exitCode: 1, stdout: '' }));
        child.once('close', (code) =>
          resolve({ exitCode: code ?? 1, stdout: Buffer.concat(chunks).toString('utf8').trim() }),
        );
      });
      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /^\d+\.\d+\.\d+$/u);
    },
  );

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
