import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, statfsSync } from 'node:fs';
import { arch, platform, release, tmpdir } from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { LinuxManagedFilesystemAdapter } from '../../src/main/localWhisper/filesystem/LinuxManagedFilesystemAdapter';
import { ManagedArtifactPathResolver } from '../../src/main/localWhisper/filesystem/ManagedArtifactPathResolver';
import type { ManagedFilesystemPlatformAdapter } from '../../src/main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';
import { NativeManagedFilesystemGuardTransport } from '../../src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';
import { WindowsManagedFilesystemAdapter } from '../../src/main/localWhisper/filesystem/WindowsManagedFilesystemAdapter';
import { createNativeRuntimeLogLaunchEnvironment } from '../../src/main/localWhisper/supervisor/NativeRuntimeLogLaunchEnvironment';

const MAX_GUARD_LINE_BYTES = 256 * 1024;
const GUARD_FAILURE_TIMEOUT_MS = 10_000;

const allowedArguments = new Set(['--fixture']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) {
  process.stderr.write('Unsupported Local Whisper filesystem verification argument\n');
  process.exit(2);
}

if (platform() !== 'linux' && platform() !== 'win32') {
  process.stdout.write(
    `${JSON.stringify({
      architecture: arch(),
      platform: platform(),
      status: platform() === 'darwin' ? 'planned-unavailable' : 'unsupported',
    })}\n`,
  );
  process.exit(platform() === 'darwin' ? 0 : 2);
}

if (arch() !== 'x64') {
  process.stderr.write('Local Whisper filesystem verification requires x64\n');
  process.exit(2);
}

async function verifyOversizedGuardRestart(executablePath: string): Promise<void> {
  const child = spawn(executablePath, [], {
    env: createNativeRuntimeLogLaunchEnvironment('win32', process.env, randomUUID()),
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.resume();
  child.stderr.resume();
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Oversized guard input did not terminate its owned process'));
    }, GUARD_FAILURE_TIMEOUT_MS);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Oversized guard process failed to start: ${error.message}`));
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      if (signal || code === 0) reject(new Error('Oversized guard input was not rejected'));
      else resolve();
    });
    child.stdin.end(`${'x'.repeat(MAX_GUARD_LINE_BYTES + 1)}\n`, 'utf8');
  });
}

async function main(): Promise<void> {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-verify-'));
  if (!path.basename(temporaryRoot).startsWith('gpt-voice-local-whisper-verify-')) {
    throw new Error('Refusing unvalidated verification root');
  }
  let adapter: (ManagedFilesystemPlatformAdapter & { dispose(): Promise<void> }) | null = null;
  try {
    const hostPlatform = platform() as 'linux' | 'win32';
    const configuredBase = path.join(temporaryRoot, 'data');
    mkdirSync(configuredBase, { mode: 0o700, recursive: true });
    const resolution = new ManagedArtifactPathResolver({
      environment: hostPlatform === 'win32' ? { LOCALAPPDATA: configuredBase } : { XDG_DATA_HOME: configuredBase },
      homeDirectory: () => path.join(temporaryRoot, 'home'),
      platform: hostPlatform,
    }).resolve();
    if (resolution.availability !== 'available') throw new Error('Managed storage unavailable');
    const guardExecutablePath = path.resolve(
      '.cache',
      'local-whisper',
      'fs-guard',
      hostPlatform === 'win32' ? 'fs-guard.exe' : 'fs-guard',
    );
    if (hostPlatform === 'win32') await verifyOversizedGuardRestart(guardExecutablePath);
    const transport = new NativeManagedFilesystemGuardTransport({
      environment: process.env,
      executablePath: guardExecutablePath,
      generateProcessInstanceId: randomUUID,
      platform: hostPlatform,
      spawnProcess: spawn,
    });
    adapter =
      hostPlatform === 'win32'
        ? new WindowsManagedFilesystemAdapter(transport)
        : new LinuxManagedFilesystemAdapter(transport);
    const root = await adapter.initialize(resolution.managedRoot);
    await adapter.revalidate(root.token, root.identity);
    await adapter.release(root.token);
    await adapter.dispose();
    adapter = null;
    const fileSystem = hostPlatform === 'linux' ? String(statfsSync(temporaryRoot).type) : 'ntfs-volume-bound';
    process.stdout.write(
      `${JSON.stringify({
        architecture: arch(),
        filesystemType: fileSystem,
        kernelRelease: release(),
        nativeGuard: hostPlatform === 'win32' ? 'ntcreatefile-held-handle' : 'openat2-held-descriptor',
        platform: hostPlatform,
        status: 'verified-fixture',
      })}\n`,
    );
  } finally {
    await adapter?.dispose();
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error ? `${error.message}\n` : 'Filesystem verification failed\n');
  process.exitCode = 1;
});
