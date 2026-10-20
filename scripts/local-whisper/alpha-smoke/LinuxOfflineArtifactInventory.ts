import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';

const MANAGED_DIRECTORY = 'profile/data/com.swimmwatch.gptvoice/local-whisper';
const MAXIMUM_FILE_BYTES = 8 * 1024 ** 3;
const MAXIMUM_TOTAL_BYTES = 32 * 1024 ** 3;
const MAXIMUM_ENTRIES = 10_000;

/** Privately compares installed model/runtime bytes and identities without storing their contents. */
export class LinuxOfflineArtifactInventory {
  public constructor(
    private readonly workRoot: string,
    private readonly assertTime: () => void,
  ) {}

  public async capture(): Promise<string> {
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.workRoot, false);
    let entries = 0;
    let totalBytes = 0;
    const inventory = createHash('sha256');
    const visit = async (directory: string): Promise<number> => {
      this.assertTime();
      await filesystem.openChildDirectory(directory);
      const children = (await readdir(filesystem.directoryPath(directory), { withFileTypes: true })).sort(
        (left, right) => left.name.localeCompare(right.name, 'en'),
      );
      let files = 0;
      for (const entry of children) {
        this.assertTime();
        if (++entries > MAXIMUM_ENTRIES) throw new Error('ALPHA_SMOKE_LINUX_OFFLINE_ARTIFACTS_INVALID');
        const relative = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
          files += await visit(relative);
          continue;
        }
        if (!entry.isFile()) throw new Error('ALPHA_SMOKE_LINUX_OFFLINE_ARTIFACTS_INVALID');
        const handle = await filesystem.openRegularFile(relative, MAXIMUM_FILE_BYTES);
        try {
          const before = await handle.stat();
          const content = createHash('sha256');
          let bytes = 0;
          for await (const chunk of handle.createReadStream({ autoClose: false })) {
            this.assertTime();
            if (!Buffer.isBuffer(chunk)) throw new Error('ALPHA_SMOKE_LINUX_OFFLINE_ARTIFACTS_INVALID');
            bytes += chunk.length;
            if (bytes > before.size || totalBytes + bytes > MAXIMUM_TOTAL_BYTES)
              throw new Error('ALPHA_SMOKE_LINUX_OFFLINE_ARTIFACTS_INVALID');
            content.update(chunk);
          }
          const after = await handle.stat();
          if (
            bytes !== before.size ||
            before.size !== after.size ||
            before.ctimeMs !== after.ctimeMs ||
            before.mtimeMs !== after.mtimeMs
          )
            throw new Error('ALPHA_SMOKE_LINUX_OFFLINE_ARTIFACTS_INVALID');
          inventory.update(
            JSON.stringify([relative, before.dev, before.ino, before.mode, before.size, content.digest('hex')]),
          );
          totalBytes += bytes;
          files += 1;
        } finally {
          await handle.close();
        }
      }
      await filesystem.revalidate();
      return files;
    };
    try {
      for (const namespace of ['models', 'runtimes']) {
        if ((await visit(`${MANAGED_DIRECTORY}/${namespace}`)) === 0)
          throw new Error('ALPHA_SMOKE_LINUX_OFFLINE_ARTIFACTS_INVALID');
      }
      this.assertTime();
      return inventory.digest('hex');
    } finally {
      await filesystem.dispose();
    }
  }
}
