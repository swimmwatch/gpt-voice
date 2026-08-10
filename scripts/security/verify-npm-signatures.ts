import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { NpmSignaturePolicy, type NpmCommandEvidence } from './npmSignaturePolicy';

const workspaceRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');
const packageLockPath = path.join(workspaceRoot, 'package-lock.json');

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

async function runCorepack(arguments_: readonly string[], cwd: string): Promise<NpmCommandEvidence> {
  return new Promise((resolve) => {
    const child = spawn('corepack', arguments_, {
      cwd,
      env: { ...process.env, NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_IGNORE_SCRIPTS: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.resume();
    child.once('error', () => {
      resolve({ arguments: arguments_, exitCode: 1, output: '', program: 'corepack' });
    });
    child.once('close', (code) => {
      resolve({ arguments: arguments_, exitCode: code ?? 1, output, program: 'corepack' });
    });
  });
}

async function main(): Promise<void> {
  const expectedLockfile = await readFile(packageLockPath);
  const isolatedDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-npm-signatures-'));
  try {
    await Promise.all([
      copyFile(packageJsonPath, path.join(isolatedDirectory, 'package.json')),
      copyFile(packageLockPath, path.join(isolatedDirectory, 'package-lock.json')),
    ]);
    const install = await runCorepack(['npm', 'ci', '--ignore-scripts', '--no-audit'], isolatedDirectory);
    const signatures = await runCorepack(
      ['npm', 'audit', 'signatures', '--json', '--ignore-scripts'],
      isolatedDirectory,
    );
    new NpmSignaturePolicy().verify({
      expectedLockfileSha256: sha256(expectedLockfile),
      install,
      installedLockfileSha256: sha256(await readFile(path.join(isolatedDirectory, 'package-lock.json'))),
      signatures,
    });
    process.stdout.write('npm registry signature evidence verified\n');
  } finally {
    await rm(isolatedDirectory, { force: true, recursive: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'npm signature policy failed'}\n`);
  process.exitCode = 1;
});
