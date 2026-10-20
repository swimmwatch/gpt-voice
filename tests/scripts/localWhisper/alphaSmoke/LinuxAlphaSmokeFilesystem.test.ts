import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rename, symlink, readdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { LinuxAlphaSmokeFilesystem } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeFilesystem';

for (const mode of [0o755, 0o775]) {
  it(`cleans app-created ${mode.toString(8)} directories without relaxing private writes or following symlinks`, async () => {
    const sandbox = await mkdtemp(path.join(tmpdir(), 'alpha-app-cache-cleanup-'));
    const root = path.join(sandbox, 'work');
    const outside = path.join(sandbox, 'outside');
    try {
      await mkdir(path.join(root, 'profile/Cache'), { recursive: true, mode: 0o700 });
      await chmod(path.join(root, 'profile/Cache'), mode);
      await mkdir(outside, { mode: 0o700 });
      await writeFile(path.join(outside, 'retained.txt'), 'retained', { mode: 0o600 });
      await writeFile(path.join(root, 'profile/Cache/cache.bin'), 'disposable', { mode: 0o600 });
      await symlink(outside, path.join(root, 'profile/Cache/outside-link'));
      const writer = await LinuxAlphaSmokeFilesystem.openRoot(root);
      try {
        await assert.rejects(writer.writeExclusive('profile/Cache/receipt.json', '{}'), /IDENTITY_CHANGED/u);
      } finally {
        await writer.dispose();
      }
      const cleanup = await LinuxAlphaSmokeFilesystem.openRoot(root);
      try {
        await cleanup.clearDisposableRoot(await cleanup.rootIdentity());
        assert.deepEqual(await readdir(root), []);
        assert.equal(await readFile(path.join(outside, 'retained.txt'), 'utf8'), 'retained');
      } finally {
        await cleanup.dispose();
      }
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
}

it('stops disposable cleanup at its deadline without deleting the remaining tree', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-cleanup-deadline-'));
  const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(root);
  try {
    await mkdir(path.join(root, 'release'), { mode: 0o700 });
    await writeFile(path.join(root, 'release/retained.bin'), 'retained', { mode: 0o600 });
    const identity = await filesystem.rootIdentity();
    await assert.rejects(
      filesystem.clearDisposableRoot(identity, () => {
        throw new Error('ALPHA_SMOKE_CLEANUP_DEADLINE_EXHAUSTED');
      }),
      /CLEANUP_DEADLINE_EXHAUSTED/u,
    );
    assert.equal(await readFile(path.join(root, 'release/retained.bin'), 'utf8'), 'retained');
  } finally {
    await filesystem.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects root replacement without writing through the replacement symlink', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'alpha-fs-root-'));
  const root = path.join(parent, 'owned');
  const replacement = path.join(parent, 'other');
  await mkdir(root, { mode: 0o700 });
  await mkdir(replacement, { mode: 0o700 });
  const fs = await LinuxAlphaSmokeFilesystem.openRoot(root);
  try {
    await rename(root, `${root}-held`);
    await symlink(replacement, root);
    await assert.rejects(fs.writeExclusive('receipt.json', '{}'), /IDENTITY_CHANGED/u);
    assert.deepEqual(await readdir(replacement), []);
  } finally {
    await fs.dispose();
    await rm(parent, { recursive: true, force: true });
  }
});

it('pins parents, rejects traversal, and performs durable private exclusive writes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-fs-parent-'));
  const fs = await LinuxAlphaSmokeFilesystem.openRoot(root);
  try {
    await fs.openChildDirectory('journal', true);
    await fs.writeExclusive('journal/state.json', '{}');
    assert.equal(await readFile(path.join(root, 'journal/state.json'), 'utf8'), '{}');
    await assert.rejects(fs.writeExclusive('journal/state.json', 'other'), /EEXIST/u);
    await assert.rejects(fs.resolve('../other'), /PATH_INVALID/u);
    await rename(path.join(root, 'journal'), path.join(root, 'held'));
    await symlink('held', path.join(root, 'journal'));
    await assert.rejects(fs.writeExclusive('journal/new.json', '{}'), /IDENTITY_CHANGED/u);
    assert.deepEqual(await readdir(path.join(root, 'held')), ['state.json']);
  } finally {
    await fs.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects an ancestor replaced by a symlink even when the root inode is unchanged', async () => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'alpha-fs-ancestor-'));
  const parent = path.join(sandbox, 'parent');
  const heldParent = path.join(sandbox, 'held-parent');
  const root = path.join(parent, 'root');
  await mkdir(parent, { mode: 0o700 });
  await mkdir(root, { mode: 0o700 });
  const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(root);
  try {
    await rename(parent, heldParent);
    await symlink(heldParent, parent);
    await assert.rejects(filesystem.writeExclusive('receipt.json', '{}'), /IDENTITY_CHANGED/u);
    assert.deepEqual(await readdir(path.join(heldParent, 'root')), []);
  } finally {
    await filesystem.dispose();
    await rm(sandbox, { recursive: true, force: true });
  }
});
