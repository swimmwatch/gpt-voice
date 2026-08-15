import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

import { resolveCorepackCommand } from './corepack-command.mjs';

const MAXIMUM_COMMAND_OUTPUT_BYTES = 2 * 1024 * 1024;
const PINNED_PACKAGE_MANAGER = 'npm@11.9.0';

function fail(code) {
  throw new Error(`NPM_SIGNATURE_PREINSTALL_${code}`);
}

function option(name) {
  const prefix = `--${name}=`;
  const values = process.argv.slice(2).filter((value) => value.startsWith(prefix));
  if (values.length > 1) fail('ARGUMENT_INVALID');
  return values[0]?.slice(prefix.length) ?? null;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function command(arguments_, cwd, captureOutput) {
  return await new Promise((resolve) => {
    const corepack = resolveCorepackCommand(process.platform, process.execPath);
    const child = spawn(corepack.executable, [...corepack.argumentPrefix, ...arguments_], {
      cwd,
      env: {
        ...process.env,
        NPM_CONFIG_AUDIT: 'false',
        NPM_CONFIG_IGNORE_SCRIPTS: 'true',
      },
      stdio: ['ignore', captureOutput ? 'pipe' : 'ignore', 'ignore'],
      windowsHide: true,
    });
    const chunks = [];
    let byteLength = 0;
    let overflow = false;
    if (captureOutput) {
      child.stdout.on('data', (chunk) => {
        const bytes = Buffer.from(chunk);
        byteLength += bytes.byteLength;
        if (byteLength > MAXIMUM_COMMAND_OUTPUT_BYTES) {
          overflow = true;
          child.kill();
          return;
        }
        chunks.push(bytes);
      });
    }
    child.once('error', () => resolve({ exitCode: 1, output: Buffer.alloc(0), overflow: false }));
    child.once('close', (code) => resolve({ exitCode: code ?? 1, output: Buffer.concat(chunks), overflow }));
  });
}

function signatureResult(bytes) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail('EVIDENCE_MALFORMED');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !Array.isArray(value.invalid) ||
    !Array.isArray(value.missing)
  ) {
    fail('EVIDENCE_MALFORMED');
  }
  if (value.invalid.length > 0 || value.missing.length > 0) fail('EVIDENCE_REJECTED');
}

async function main() {
  const workspace = path.resolve(option('workspace') ?? process.cwd());
  const packageJsonPath = path.join(workspace, 'package.json');
  const packageLockPath = path.join(workspace, 'package-lock.json');
  const [packageJsonBytes, expectedLockfile] = await Promise.all([
    readFile(packageJsonPath),
    readFile(packageLockPath),
  ]).catch(() => fail('INPUT_UNAVAILABLE'));
  let packageJson;
  try {
    packageJson = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(packageJsonBytes));
  } catch {
    fail('INPUT_MALFORMED');
  }
  if (packageJson?.packageManager !== PINNED_PACKAGE_MANAGER) fail('TOOLCHAIN_MISMATCH');

  const isolatedDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-npm-signatures-'));
  try {
    await Promise.all([
      copyFile(packageJsonPath, path.join(isolatedDirectory, 'package.json')),
      copyFile(packageLockPath, path.join(isolatedDirectory, 'package-lock.json')),
    ]);
    const install = await command(['npm', 'ci', '--ignore-scripts', '--no-audit'], isolatedDirectory, false);
    if (install.exitCode !== 0 || install.overflow) fail('INSTALL_FAILED');
    const installedLockfile = await readFile(path.join(isolatedDirectory, 'package-lock.json')).catch(() =>
      fail('LOCKFILE_UNAVAILABLE'),
    );
    if (sha256(installedLockfile) !== sha256(expectedLockfile)) fail('LOCKFILE_MISMATCH');
    const signatures = await command(
      ['npm', 'audit', 'signatures', '--json', '--ignore-scripts'],
      isolatedDirectory,
      true,
    );
    if (signatures.exitCode !== 0 || signatures.overflow) fail('EVIDENCE_UNAVAILABLE');
    signatureResult(signatures.output);
    process.stdout.write('npm pre-install registry signatures verified\n');
  } finally {
    await rm(isolatedDirectory, { force: true, recursive: true });
  }
}

await main().catch((error) => {
  const message =
    error instanceof Error && /^NPM_SIGNATURE_PREINSTALL_[A-Z_]+$/u.test(error.message)
      ? error.message
      : 'NPM_SIGNATURE_PREINSTALL_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
