import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { LinuxAlphaSmokeAdapter } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeAdapter';
import { LinuxAlphaSmokeFilesystem } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeFilesystem';
import {
  LinuxIsolatedApplicationSession,
  type LinuxApplicationLaunchReceipt,
} from '@scripts/local-whisper/alpha-smoke/LinuxIsolatedApplicationSession';
import { LinuxAlphaSmokeClock } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeClock';
import {
  createPlatformSmokeInput,
  type AlphaSmokeAttempt,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

it('recovers the private launch receipt and stops only the owned application after a CLI restart', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-restart-cleanup-'));
  const workRoot = path.join(root, 'work');
  const evidenceRoot = path.join(root, 'evidence');
  const lifecycle: {
    child: ChildProcess | null;
    exit: Promise<unknown> | null;
    receipt: LinuxApplicationLaunchReceipt | null;
  } = { child: null, exit: null, receipt: null };
  try {
    for (const directory of ['work', 'evidence/control', 'backup'])
      await mkdir(path.join(root, directory), { recursive: true, mode: 0o700 });
    const firstSession = new LinuxIsolatedApplicationSession({
      workRoot,
      spawn: (_executable, _arguments, options) => {
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], options);
        lifecycle.child = child;
        lifecycle.exit = once(child, 'exit');
        return child;
      },
    });
    const receipt = await firstSession.launchOnline();
    lifecycle.receipt = receipt;
    const deadline = new LinuxAlphaSmokeClock().capture(60_000);
    const attempt: AlphaSmokeAttempt = {
      schemaVersion: 2,
      monotonicDeadline: deadline,
      completion: null,
      terminalOutcome: null,
      attemptId: 'alpha-test',
      deadlineEpochMilliseconds: Date.now() + 60_000,
      input: createPlatformSmokeInput(
        'linux',
        [{ fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb', length: 1, sha256: 'a'.repeat(64) }],
        'd'.repeat(64),
      ),
      packageDisposition: 'exact-alpha',
      settingsBackupStatus: 'retained-private',
      startedAtEpochMilliseconds: Date.now(),
      state: 'Finalizing',
    };
    await writeFile(
      path.join(evidenceRoot, 'control/owned-processes.json'),
      JSON.stringify({
        schemaVersion: 2,
        attemptId: attempt.attemptId,
        inputDigest: attempt.input.platformSmokeInputDigest,
        bootId: deadline.bootId,
        groups: [{ receipt, members: [receipt] }],
      }),
      { mode: 0o600 },
    );
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(workRoot);
    try {
      await writeFile(
        path.join(evidenceRoot, 'control/work-root-identity.json'),
        JSON.stringify({ attemptId: attempt.attemptId, ...(await filesystem.rootIdentity()) }),
        { mode: 0o600 },
      );
    } finally {
      await filesystem.dispose();
    }
    const noOperation = async (): Promise<void> => undefined;
    const resumed = new LinuxAlphaSmokeAdapter({
      workRoot,
      evidenceRoot,
      settingsBackupRoot: path.join(root, 'backup'),
      settingsSourceRoot: path.join(root, 'source'),
      debPath: path.join(workRoot, 'release/alpha.deb'),
      checkpoints: { confirm: noOperation },
    });
    Object.defineProperties(resumed, {
      backup: { value: () => ({ verifyRetained: noOperation }) },
      packageVerifier: { value: () => ({ assertRetained: noOperation }) },
      assertNoActivePackageProcess: { value: noOperation },
    });
    await resumed.finalize(attempt);
    let active = false;
    try {
      const stat = await readFile(`/proc/${receipt.processId}/stat`, 'utf8');
      active = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/u)[0] !== 'Z';
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    assert.equal(active, false, 'Owned application survived resumed cleanup');
    await lifecycle.exit;
  } finally {
    if (lifecycle.child && lifecycle.child.exitCode === null && lifecycle.child.signalCode === null)
      lifecycle.child.kill('SIGKILL');
    await lifecycle.exit;
    await rm(root, { recursive: true, force: true });
  }
});
