import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  LINUX_SETTINGS_BACKUP_FILES,
  LinuxSettingsBackup,
} from '@scripts/local-whisper/alpha-smoke/LinuxSettingsBackup';

async function roots(prefix: string) {
  const parent = await mkdtemp(path.join(tmpdir(), prefix));
  const sourceRoot = path.join(parent, 'source');
  const backupRoot = path.join(parent, 'backup');
  await mkdir(sourceRoot, { mode: 0o700 });
  await mkdir(backupRoot, { mode: 0o700 });
  return { backupRoot, parent, sourceRoot };
}

describe('LinuxSettingsBackup', () => {
  it('copies only the six-file allowlist into owner-only retained storage', async () => {
    const fixture = await roots('alpha-settings-backup-');
    try {
      await mkdir(path.join(fixture.sourceRoot, 'local-whisper'), { mode: 0o700 });
      await writeFile(path.join(fixture.sourceRoot, 'config.json'), '{"safe":"fixture"}\n', { mode: 0o640 });
      await writeFile(path.join(fixture.sourceRoot, 'local-whisper/settings.json'), '{"backend":"cpu"}\n', {
        mode: 0o600,
      });
      await writeFile(path.join(fixture.sourceRoot, 'gpt-voice.sqlite3'), 'excluded', { mode: 0o600 });
      await writeFile(path.join(fixture.sourceRoot, 'chatgpt-session.json'), 'excluded', { mode: 0o600 });

      const backup = new LinuxSettingsBackup(fixture);
      assert.equal(await backup.create('alpha-test'), 'retained-private');
      assert.equal(await backup.verifyRetained('alpha-test'), 'retained-private');
      assert.equal(await readFile(path.join(fixture.backupRoot, 'config.json'), 'utf8'), '{"safe":"fixture"}\n');
      assert.equal(
        await readFile(path.join(fixture.backupRoot, 'local-whisper/settings.json'), 'utf8'),
        '{"backend":"cpu"}\n',
      );
      await assert.rejects(readFile(path.join(fixture.backupRoot, 'gpt-voice.sqlite3')), /ENOENT/u);
      await assert.rejects(readFile(path.join(fixture.backupRoot, 'chatgpt-session.json')), /ENOENT/u);
      assert.equal((await lstat(path.join(fixture.backupRoot, 'config.json'))).mode & 0o777, 0o600);
      assert.equal((await lstat(path.join(fixture.backupRoot, 'settings-backup-receipt.json'))).mode & 0o777, 0o600);

      const receipt = JSON.parse(
        await readFile(path.join(fixture.backupRoot, 'settings-backup-receipt.json'), 'utf8'),
      ) as {
        attemptId: string;
        entries: readonly {
          backupMode: number | null;
          backupModifiedMilliseconds: number | null;
          relativePath: string;
          sourceMode: number | null;
          sourceModifiedMilliseconds: number | null;
          status: string;
        }[];
        status: string;
      };
      assert.equal(receipt.attemptId, 'alpha-test');
      assert.equal(receipt.status, 'retained-private');
      assert.deepEqual(
        receipt.entries.map((entry) => entry.relativePath),
        LINUX_SETTINGS_BACKUP_FILES,
      );
      assert.equal(receipt.entries.filter((entry) => entry.status === 'backed-up').length, 2);
      assert.ok(
        receipt.entries
          .filter((entry) => entry.status === 'backed-up')
          .every(
            (entry) =>
              entry.backupMode === 0o600 &&
              typeof entry.backupModifiedMilliseconds === 'number' &&
              typeof entry.sourceMode === 'number' &&
              typeof entry.sourceModifiedMilliseconds === 'number',
          ),
      );
      await assert.rejects(backup.verifyRetained('another-attempt'), /RECEIPT_ATTEMPT_MISMATCH/u);
    } finally {
      await rm(fixture.parent, { force: true, recursive: true });
    }
  });

  it('records every allowlisted setting as missing when the canonical source root is absent', async () => {
    const fixture = await roots('alpha-settings-missing-');
    try {
      await rm(fixture.sourceRoot, { recursive: true });
      const backup = new LinuxSettingsBackup(fixture);
      await backup.create('alpha-test');
      const receipt = JSON.parse(
        await readFile(path.join(fixture.backupRoot, 'settings-backup-receipt.json'), 'utf8'),
      ) as { entries: readonly { status: string }[] };
      assert.equal(receipt.entries.length, LINUX_SETTINGS_BACKUP_FILES.length);
      assert.ok(receipt.entries.every((entry) => entry.status === 'missing'));
    } finally {
      await rm(fixture.parent, { force: true, recursive: true });
    }
  });

  it('rejects symlinks and oversized settings before completion', async () => {
    const symlinkFixture = await roots('alpha-settings-symlink-');
    const oversizedFixture = await roots('alpha-settings-oversized-');
    try {
      await symlink('/tmp/not-read-by-test', path.join(symlinkFixture.sourceRoot, 'config.json'));
      await assert.rejects(new LinuxSettingsBackup(symlinkFixture).create('alpha-test'), /SOURCE_FILE_INVALID/u);

      await writeFile(path.join(oversizedFixture.sourceRoot, 'config.json'), Buffer.alloc(8 * 1024 * 1024 + 1), {
        mode: 0o600,
      });
      await assert.rejects(new LinuxSettingsBackup(oversizedFixture).create('alpha-test'), /SOURCE_FILE_INVALID/u);
    } finally {
      await rm(symlinkFixture.parent, { force: true, recursive: true });
      await rm(oversizedFixture.parent, { force: true, recursive: true });
    }
  });

  it('enforces the complete 32 MiB backup bound across individually valid files', async () => {
    const fixture = await roots('alpha-settings-total-bound-');
    try {
      await mkdir(path.join(fixture.sourceRoot, 'local-whisper'), { mode: 0o700 });
      for (const relativePath of LINUX_SETTINGS_BACKUP_FILES.slice(0, 5)) {
        const filePath = path.join(fixture.sourceRoot, relativePath);
        await writeFile(filePath, '', { mode: 0o600 });
        await truncate(filePath, 8 * 1024 * 1024);
      }
      await assert.rejects(new LinuxSettingsBackup(fixture).create('alpha-test'), /SOURCE_FILE_INVALID/u);
    } finally {
      await rm(fixture.parent, { force: true, recursive: true });
    }
  });

  it('detects backup content, permission, receipt, and inventory changes', async () => {
    for (const mutate of [
      async (root: string) => await writeFile(path.join(root, 'config.json'), 'changed'),
      async (root: string) => await chmod(path.join(root, 'config.json'), 0o644),
      async (root: string) => await writeFile(path.join(root, 'settings-backup-receipt.json'), '{}\n'),
      async (root: string) => await writeFile(path.join(root, 'unexpected.json'), '{}\n', { mode: 0o600 }),
    ]) {
      const fixture = await roots('alpha-settings-tamper-');
      try {
        await writeFile(path.join(fixture.sourceRoot, 'config.json'), '{}\n', { mode: 0o600 });
        const backup = new LinuxSettingsBackup(fixture);
        await backup.create('alpha-test');
        await mutate(fixture.backupRoot);
        await assert.rejects(backup.verifyRetained('alpha-test'), /ALPHA_SMOKE_LINUX_SETTINGS_BACKUP_/u);
      } finally {
        await rm(fixture.parent, { force: true, recursive: true });
      }
    }
  });

  it('rejects a non-private backup root before reading source settings', async () => {
    const fixture = await roots('alpha-settings-root-mode-');
    try {
      await writeFile(path.join(fixture.sourceRoot, 'config.json'), 'must-not-be-copied', { mode: 0o600 });
      await chmod(fixture.backupRoot, 0o755);
      await assert.rejects(new LinuxSettingsBackup(fixture).create('alpha-test'), /ROOT_INVALID/u);
      assert.deepEqual(await readFile(path.join(fixture.sourceRoot, 'config.json'), 'utf8'), 'must-not-be-copied');
    } finally {
      await rm(fixture.parent, { force: true, recursive: true });
    }
  });
});
