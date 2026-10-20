import { readFile } from 'node:fs/promises';
import type { AlphaSmokeAttempt } from './AlphaSmokeProtocol';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';
import type { LinuxApplicationLaunchReceipt, LinuxApplicationOwnedGroup } from './LinuxIsolatedApplicationSession';
import { isRecord } from '../packaging/contracts';

const JOURNAL_FILE = 'control/owned-processes.json';
const MAX_JOURNAL_BYTES = 256 * 1024;
const MAX_GROUP_MEMBERS = 4096;

function parseReceipt(value: unknown): LinuxApplicationLaunchReceipt {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(',') !== 'processId,startTime' ||
    typeof value.processId !== 'number' ||
    !Number.isSafeInteger(value.processId) ||
    value.processId <= 0 ||
    typeof value.startTime !== 'string' ||
    !/^\d{1,30}$/u.test(value.startTime)
  )
    throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_INVALID');
  return { processId: value.processId, startTime: value.startTime };
}

/** Persists only private attempt-bound process identities; a reboot never grants ownership. */
export class LinuxAlphaSmokeProcessJournal {
  public constructor(private readonly evidenceRoot: string) {}

  private async bootId(attempt: AlphaSmokeAttempt): Promise<string> {
    const bootId = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
    if (attempt.monotonicDeadline === null || attempt.monotonicDeadline.bootId !== bootId)
      throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_BOOT_INVALID');
    return bootId;
  }

  public async write(attempt: AlphaSmokeAttempt, groups: readonly LinuxApplicationOwnedGroup[]): Promise<void> {
    const document = JSON.stringify({
      schemaVersion: 2,
      attemptId: attempt.attemptId,
      inputDigest: attempt.input.platformSmokeInputDigest,
      bootId: await this.bootId(attempt),
      groups,
    });
    if (Buffer.byteLength(document) > MAX_JOURNAL_BYTES) throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_INVALID');
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.evidenceRoot);
    try {
      await filesystem.openChildDirectory('control', true);
      await filesystem.replaceAtomically(JOURNAL_FILE, document);
    } finally {
      await filesystem.dispose();
    }
  }

  public async read(attempt: AlphaSmokeAttempt): Promise<readonly LinuxApplicationOwnedGroup[]> {
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.evidenceRoot);
    try {
      let handle;
      try {
        handle = await filesystem.openRegularFile(JOURNAL_FILE, MAX_JOURNAL_BYTES);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
        throw error;
      }
      let value: unknown;
      try {
        const before = await handle.stat();
        value = JSON.parse(await handle.readFile('utf8')) as unknown;
        const after = await handle.stat();
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
          throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_INVALID');
        await filesystem.revalidate();
      } finally {
        await handle.close();
      }
      if (
        !isRecord(value) ||
        Object.keys(value).sort().join(',') !== 'attemptId,bootId,groups,inputDigest,schemaVersion' ||
        value.schemaVersion !== 2 ||
        value.attemptId !== attempt.attemptId ||
        value.inputDigest !== attempt.input.platformSmokeInputDigest ||
        value.bootId !== (await this.bootId(attempt)) ||
        !Array.isArray(value.groups) ||
        value.groups.length > 2
      )
        throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_INVALID');
      const raw: unknown[] = value.groups;
      const groups = raw.map((group): LinuxApplicationOwnedGroup => {
        if (
          !isRecord(group) ||
          Object.keys(group).sort().join(',') !== 'members,receipt' ||
          !Array.isArray(group.members) ||
          group.members.length === 0 ||
          group.members.length > MAX_GROUP_MEMBERS
        )
          throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_INVALID');
        const receipt = parseReceipt(group.receipt);
        const members: LinuxApplicationLaunchReceipt[] = group.members.map(parseReceipt);
        if (
          new Set(members.map((member) => member.processId)).size !== members.length ||
          !members.some((member) => member.processId === receipt.processId && member.startTime === receipt.startTime)
        )
          throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_INVALID');
        return { receipt, members };
      });
      if (new Set(groups.map((group) => group.receipt.processId)).size !== groups.length)
        throw new Error('ALPHA_SMOKE_PROCESS_JOURNAL_INVALID');
      return groups;
    } finally {
      await filesystem.dispose();
    }
  }
}
