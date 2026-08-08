import { createHash } from 'node:crypto';
import { chmod, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { ArtifactTransferJournalStore } from './ArtifactLifecycleTypes';

const JOURNAL_FILE_PATTERN = /^journal-[a-f0-9]{64}\.json$/u;
const MAXIMUM_JOURNAL_BYTES = 16 * 1024;
const MAXIMUM_JOURNAL_COUNT = 256;

function journalName(artifactId: LocalWhisperArtifactId): string {
  return `journal-${createHash('sha256').update(artifactId, 'utf8').digest('hex')}.json`;
}

/** Owner-private atomic JSON store; parsing and authority remain in ArtifactTransferJournalRepository. */
export class FileArtifactTransferJournalStore implements ArtifactTransferJournalStore {
  public constructor(
    private readonly root: string,
    private readonly temporaryNonce: () => string,
  ) {}

  public async list(): Promise<readonly unknown[]> {
    await this.initialize();
    const names = (await readdir(this.root)).filter((name) => JOURNAL_FILE_PATTERN.test(name)).sort();
    if (names.length > MAXIMUM_JOURNAL_COUNT) throw new Error('Local Whisper journal limit exceeded');
    return await Promise.all(names.map(async (name) => await this.readPath(this.path(name))));
  }

  public async read(artifactId: LocalWhisperArtifactId): Promise<unknown> {
    await this.initialize();
    try {
      return await this.readPath(this.path(journalName(artifactId)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  public async write(artifactId: LocalWhisperArtifactId, value: unknown): Promise<void> {
    await this.initialize();
    const destination = this.path(journalName(artifactId));
    const temporaryName = `${journalName(artifactId)}.${this.temporaryNonce()}.tmp`;
    const temporary = this.path(temporaryName);
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    if (bytes.byteLength > MAXIMUM_JOURNAL_BYTES) throw new Error('Local Whisper journal too large');
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, destination);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  public async remove(artifactId: LocalWhisperArtifactId): Promise<void> {
    await unlink(this.path(journalName(artifactId))).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  private async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await chmod(this.root, 0o700);
  }

  private path(name: string): string {
    const candidate = resolve(this.root, name);
    if (!candidate.startsWith(`${resolve(this.root)}${sep}`)) throw new Error('Unsafe Local Whisper journal path');
    return candidate;
  }

  private async readPath(filePath: string): Promise<unknown> {
    const handle = await open(filePath, 'r');
    try {
      const identity = await handle.stat();
      if (!identity.isFile() || identity.size > MAXIMUM_JOURNAL_BYTES) throw new Error('Invalid Local Whisper journal');
      return JSON.parse((await handle.readFile()).toString('utf8')) as unknown;
    } finally {
      await handle.close();
    }
  }
}
