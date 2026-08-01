import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statfsSync } from 'node:fs';
import { arch, platform, release, tmpdir } from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { LinuxManagedFilesystemAdapter } from '../../src/main/localWhisper/filesystem/LinuxManagedFilesystemAdapter';
import { ManagedArtifactPathResolver } from '../../src/main/localWhisper/filesystem/ManagedArtifactPathResolver';
import { NativeManagedFilesystemGuardTransport } from '../../src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';

const allowedArguments = new Set(['--fixture']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) {
  process.stderr.write('Unsupported Local Whisper filesystem verification argument\n');
  process.exit(2);
}

if (platform() !== 'linux') {
  process.stdout.write(
    `${JSON.stringify({
      architecture: arch(),
      platform: platform(),
      status: platform() === 'darwin' ? 'planned-unavailable' : 'manual-gate-required',
    })}\n`,
  );
  process.exit(platform() === 'darwin' ? 0 : 2);
}

if (arch() !== 'x64') {
  process.stderr.write('Linux Local Whisper filesystem verification requires x64\n');
  process.exit(2);
}

async function main(): Promise<void> {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-verify-'));
  if (!path.basename(temporaryRoot).startsWith('gpt-voice-local-whisper-verify-')) {
    throw new Error('Refusing unvalidated verification root');
  }
  let adapter: LinuxManagedFilesystemAdapter | null = null;
  try {
    const resolution = new ManagedArtifactPathResolver({
      environment: { XDG_DATA_HOME: path.join(temporaryRoot, 'data') },
      homeDirectory: () => path.join(temporaryRoot, 'home'),
      platform: 'linux',
    }).resolve();
    if (resolution.availability !== 'available') throw new Error('Managed storage unavailable');
    adapter = new LinuxManagedFilesystemAdapter(
      new NativeManagedFilesystemGuardTransport({
        executablePath: path.resolve('.cache', 'local-whisper', 'fs-guard', 'fs-guard'),
        spawnProcess: spawn,
      }),
    );
    const root = await adapter.initialize(resolution.managedRoot);
    await adapter.revalidate(root.token, root.identity);
    await adapter.release(root.token);
    await adapter.dispose();
    adapter = null;
    const fileSystem = statfsSync(temporaryRoot);
    process.stdout.write(
      `${JSON.stringify({
        architecture: arch(),
        filesystemType: String(fileSystem.type),
        kernelRelease: release(),
        nativeGuard: 'openat2-held-descriptor',
        platform: 'linux',
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
