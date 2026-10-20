import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { resolveAppConfigPaths } from '@main/config';

import { AlphaSmokeCommandParser } from './AlphaSmokeCommand';
import { AlphaSmokeEvidenceSealer } from './AlphaSmokeEvidenceSealer';
import { FileAlphaSmokeStateStore } from './FileAlphaSmokeStateStore';
import { AlphaSmokeSession, ALPHA_SMOKE_DEADLINE_MILLISECONDS } from './AlphaSmokeSession';
import { LinuxAlphaSmokeClock } from './LinuxAlphaSmokeClock';
import { LinuxAlphaSmokeCommandRunner } from './LinuxAlphaSmokeCommandRunner';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';
import { InteractiveAlphaSmokeCheckpointPort } from './InteractiveAlphaSmokeCheckpointPort';
import { LinuxAlphaSmokeAdapter } from './LinuxAlphaSmokeAdapter';
import { PublicAlphaReleaseRepository } from './PublicAlphaReleaseRepository';

async function main(): Promise<void> {
  const command = new AlphaSmokeCommandParser().parse(process.argv.slice(2));
  const clock = new LinuxAlphaSmokeClock();
  let deadline =
    command.mode === 'physical' && command.phase === 'prepare'
      ? clock.capture(ALPHA_SMOKE_DEADLINE_MILLISECONDS)
      : null;
  const remainingMilliseconds = (): number =>
    deadline === null ? ALPHA_SMOKE_DEADLINE_MILLISECONDS : clock.remaining(deadline);
  const release = new PublicAlphaReleaseRepository({ remainingMilliseconds });
  if (command.mode === 'contract') {
    const input = await release.verify(command.platform);
    process.stdout.write(
      `${JSON.stringify({ platformSmokeInputDigest: input.platformSmokeInputDigest, target: input.target })}\n`,
    );
    return;
  }
  if (command.platform !== 'linux' || process.platform !== 'linux') {
    throw new Error('ALPHA_SMOKE_PHYSICAL_PLATFORM_MISMATCH');
  }

  const workRoot = command.workRoot!;
  const evidenceRoot = command.evidenceRoot!;
  const settingsBackupRoot = command.settingsBackupRoot!;
  const stateStore = new FileAlphaSmokeStateStore(evidenceRoot, 'control');
  if (command.phase !== 'prepare') {
    const stored = await stateStore.read();
    if (!stored || stored.monotonicDeadline === null) throw new Error('ALPHA_SMOKE_RESUME_INVALID');
    deadline = stored.monotonicDeadline;
  }
  const checkpoints = new InteractiveAlphaSmokeCheckpointPort({ remainingMilliseconds });
  let cleanupStarted = false;
  const debPath = path.join(workRoot, 'release', 'gpt-voice_2.4.0-alpha.1_amd64.deb');
  const settingsSourceRoot = resolveAppConfigPaths({
    environment: process.env,
    homeDirectory: homedir,
    platform: 'linux',
  }).appDirectory;
  const adapter = new LinuxAlphaSmokeAdapter({
    checkpoints,
    debPath,
    evidenceRoot,
    settingsBackupRoot,
    settingsSourceRoot,
    workRoot,
    remainingMilliseconds,
    commands: new LinuxAlphaSmokeCommandRunner(remainingMilliseconds),
    beginCleanup: () => {
      if (!cleanupStarted) {
        cleanupStarted = true;
        deadline = clock.capture(60_000);
      }
    },
  });
  const session = new AlphaSmokeSession({
    adapter,
    clock,
    sealer: new AlphaSmokeEvidenceSealer(),
    stateStore,
  });

  try {
    if (command.phase === 'prepare') {
      const operationStartedAtEpochMilliseconds = Date.now();
      const attemptId = `alpha-${Date.now().toString(36)}`;
      await adapter.assertInitialRoots();
      const input = await release.verify(command.platform);
      const materializedDebPath = await release.materializeVerifiedLinuxDeb(workRoot);
      if (materializedDebPath !== debPath) throw new Error('ALPHA_SMOKE_LINUX_DEB_PATH_INVALID');
      await session.prepare(attemptId, input, operationStartedAtEpochMilliseconds, deadline);
      const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(evidenceRoot);
      const workFilesystem = await LinuxAlphaSmokeFilesystem.openRoot(workRoot);
      try {
        await filesystem.writeExclusive(
          'control/runtime-bindings.json',
          `${JSON.stringify({ inputDigest: input.platformSmokeInputDigest, runtimes: release.runtimeBindings() })}\n`,
        );
        await filesystem.writeExclusive(
          'control/work-root-identity.json',
          `${JSON.stringify({ attemptId, ...(await workFilesystem.rootIdentity()) })}\n`,
        );
      } finally {
        await Promise.all([filesystem.dispose(), workFilesystem.dispose()]);
      }
      process.stdout.write(`${JSON.stringify({ attemptId, phase: 'prepare' })}\n`);
    } else if (command.phase === 'exercise') {
      process.stdout.write(
        `${JSON.stringify({ phase: 'exercise', status: await session.exercise(evidenceRoot, command.attemptId!) })}\n`,
      );
    } else {
      process.stdout.write(
        `${JSON.stringify({ phase: 'seal', status: await session.seal(evidenceRoot, command.attemptId!) })}\n`,
      );
    }
  } finally {
    checkpoints.close();
  }
}

main().catch((error: unknown) => {
  const diagnostic =
    error instanceof Error && /^ALPHA_SMOKE_[A-Z\d_]+$/u.test(error.message) ? error.message : 'ALPHA_SMOKE_FAILED';
  process.stderr.write(`${diagnostic}\n`);
  process.exitCode = 1;
});
