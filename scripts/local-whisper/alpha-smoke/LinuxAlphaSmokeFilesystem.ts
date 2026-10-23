import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, rename, unlink, rmdir, type FileHandle } from 'node:fs/promises';
import { userInfo } from 'node:os';
import path from 'node:path';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

/** Pins each directory component; all operations resolve beneath held descriptors. */
export class LinuxAlphaSmokeFilesystem {
  private readonly directories = new Map<string, FileHandle>();
  private readonly ancestors = new Map<string, FileHandle>();
  private constructor(
    private readonly root: string,
    private readonly privateRoot: boolean,
  ) {}

  public static async openRoot(this: void, root: string, privateRoot = true): Promise<LinuxAlphaSmokeFilesystem> {
    if (process.platform !== 'linux' || !path.isAbsolute(root) || path.resolve(root) !== root || root === '/') {
      throw new Error('ALPHA_SMOKE_FILESYSTEM_ROOT_INVALID');
    }
    const filesystem = new LinuxAlphaSmokeFilesystem(root, privateRoot);
    let current = await open('/', constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    let currentPath = '/';
    try {
      for (const segment of root.slice(1).split('/')) {
        const next = await open(
          `/proc/self/fd/${current.fd}/${segment}`,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
        filesystem.ancestors.set(currentPath, current);
        current = next;
        currentPath = path.posix.join(currentPath, segment);
      }
      filesystem.directories.set('', current);
      await filesystem.revalidate();
      return filesystem;
    } catch (error) {
      await current.close();
      await Promise.all([...filesystem.ancestors.values()].map(async (handle) => await handle.close()));
      throw error;
    }
  }

  public directoryPath(relative = ''): string {
    const directory = this.directories.get(relative);
    if (!directory) throw new Error('ALPHA_SMOKE_FILESYSTEM_DIRECTORY_NOT_OPEN');
    return `/proc/self/fd/${directory.fd}`;
  }

  public async openChildDirectory(relative: string, create = false): Promise<string> {
    this.assertRelative(relative);
    let parent = '';
    for (const segment of relative.split('/')) {
      const current = parent ? `${parent}/${segment}` : segment;
      if (!this.directories.has(current)) {
        const anchored = `${this.directoryPath(parent)}/${segment}`;
        if (create) {
          await mkdir(anchored, { mode: PRIVATE_DIRECTORY_MODE }).catch((error: unknown) => {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
          });
        }
        const handle = await open(anchored, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        this.directories.set(current, handle);
      }
      parent = current;
    }
    await this.revalidate();
    return this.directoryPath(relative);
  }

  public async resolve(relative: string, createParents = false): Promise<string> {
    this.assertRelative(relative);
    await this.revalidate();
    const parent = path.posix.dirname(relative);
    if (parent !== '.') await this.openChildDirectory(parent, createParents);
    return `${this.directoryPath(parent === '.' ? '' : parent)}/${path.posix.basename(relative)}`;
  }

  public async openRegularFile(relative: string, maximumBytes: number): Promise<FileHandle> {
    const anchored = await this.resolve(relative);
    const handle = await open(anchored, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const metadata = await handle.stat();
      if (
        !metadata.isFile() ||
        metadata.uid !== userInfo().uid ||
        metadata.size > maximumBytes ||
        (this.privateRoot && (metadata.mode & 0o777) !== PRIVATE_FILE_MODE)
      ) {
        throw new Error('ALPHA_SMOKE_FILESYSTEM_FILE_INVALID');
      }
      return handle;
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  public async writeExclusive(relative: string, content: string | Buffer): Promise<void> {
    await this.write(relative, content, false);
  }

  public async replaceAtomically(relative: string, content: string | Buffer): Promise<void> {
    await this.write(relative, content, true);
  }

  private async write(relative: string, content: string | Buffer, replace: boolean): Promise<void> {
    const destination = await this.resolve(relative);
    const staging = `${destination}.${randomUUID()}.partial`;
    const handle = await open(
      staging,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      PRIVATE_FILE_MODE,
    );
    try {
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.revalidate();
      if (replace) await rename(staging, destination);
      else await link(staging, destination);
      await this.directories.get(path.posix.dirname(relative) === '.' ? '' : path.posix.dirname(relative))?.sync();
      await this.revalidate();
    } finally {
      await unlink(staging).catch((error: unknown) => {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      });
    }
  }

  public async revalidate(): Promise<void> {
    for (const [absolute, handle] of this.ancestors) {
      const held = await handle.stat();
      const linked = await lstat(absolute);
      if (!linked.isDirectory() || linked.isSymbolicLink() || held.dev !== linked.dev || held.ino !== linked.ino)
        throw new Error('ALPHA_SMOKE_FILESYSTEM_IDENTITY_CHANGED');
    }
    for (const [relative, handle] of this.directories) {
      const held = await handle.stat();
      const linked = await lstat(
        relative === ''
          ? this.root
          : `${this.directoryPath(path.posix.dirname(relative) === '.' ? '' : path.posix.dirname(relative))}/${path.posix.basename(relative)}`,
      );
      if (
        !held.isDirectory() ||
        linked.isSymbolicLink() ||
        held.dev !== linked.dev ||
        held.ino !== linked.ino ||
        held.uid !== userInfo().uid ||
        (this.privateRoot && (held.mode & 0o777) !== PRIVATE_DIRECTORY_MODE)
      ) {
        throw new Error('ALPHA_SMOKE_FILESYSTEM_IDENTITY_CHANGED');
      }
    }
  }

  public async removeDisposableTree(relative: string, assertTime?: () => void): Promise<void> {
    assertTime?.();
    const anchored = await this.resolve(relative);
    const identity = await this.rootIdentity();
    for (const [name, handle] of this.directories) {
      if (name === relative || name.startsWith(`${relative}/`)) {
        this.directories.delete(name);
        await handle.close();
      }
    }
    await this.removeDisposableDirectory(anchored, identity.device, async () => await this.revalidate(), assertTime);
  }

  /** App-created child modes may vary; deletion still pins identity, owner, device and every parent. */
  private async removeDisposableDirectory(
    anchored: string,
    device: number,
    revalidateParent: () => Promise<void>,
    assertTime?: () => void,
  ): Promise<void> {
    assertTime?.();
    await revalidateParent();
    const handle = await open(anchored, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const revalidate = async (): Promise<void> => {
      assertTime?.();
      await revalidateParent();
      const held = await handle.stat();
      const linked = await lstat(anchored);
      if (
        !held.isDirectory() ||
        !linked.isDirectory() ||
        linked.isSymbolicLink() ||
        held.uid !== userInfo().uid ||
        held.dev !== device ||
        held.dev !== linked.dev ||
        held.ino !== linked.ino
      )
        throw new Error('ALPHA_SMOKE_FILESYSTEM_IDENTITY_CHANGED');
    };
    try {
      await revalidate();
      for (const entry of await readdir(`/proc/self/fd/${handle.fd}`, { withFileTypes: true })) {
        await revalidate();
        const child = `/proc/self/fd/${handle.fd}/${entry.name}`;
        if (entry.isDirectory()) await this.removeDisposableDirectory(child, device, revalidate, assertTime);
        else await unlink(child);
      }
      await revalidate();
      await rmdir(anchored);
    } finally {
      await handle.close();
    }
  }

  public async rootIdentity(): Promise<Readonly<{ device: number; inode: number }>> {
    await this.revalidate();
    const metadata = await this.directories.get('')?.stat();
    if (!metadata) throw new Error('ALPHA_SMOKE_FILESYSTEM_ROOT_INVALID');
    return Object.freeze({ device: metadata.dev, inode: metadata.ino });
  }

  public async clearDisposableRoot(
    expected: Readonly<{ device: number; inode: number }>,
    assertTime?: () => void,
  ): Promise<void> {
    assertTime?.();
    const identity = await this.rootIdentity();
    if (identity.device !== expected.device || identity.inode !== expected.inode)
      throw new Error('ALPHA_SMOKE_FILESYSTEM_IDENTITY_CHANGED');
    const entries = await readdir(this.directoryPath(), { withFileTypes: true });
    if (entries.some((entry) => !['release', 'profile'].includes(entry.name) || !entry.isDirectory()))
      throw new Error('ALPHA_SMOKE_FILESYSTEM_CLEANUP_INVENTORY_INVALID');
    for (const entry of entries) await this.removeDisposableTree(entry.name, assertTime);
    await this.revalidate();
    assertTime?.();
    if ((await readdir(this.directoryPath())).length !== 0)
      throw new Error('ALPHA_SMOKE_FILESYSTEM_CLEANUP_INCOMPLETE');
  }

  public async dispose(): Promise<void> {
    const handles = [...this.directories.values(), ...this.ancestors.values()];
    this.directories.clear();
    this.ancestors.clear();
    await Promise.all(handles.map(async (handle) => await handle.close()));
  }

  private assertRelative(relative: string): void {
    if (
      !relative ||
      relative.includes('\0') ||
      relative.includes('\\') ||
      relative.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
    ) {
      throw new Error('ALPHA_SMOKE_FILESYSTEM_PATH_INVALID');
    }
  }
}
