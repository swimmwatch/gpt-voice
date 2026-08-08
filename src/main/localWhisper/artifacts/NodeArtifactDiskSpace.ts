import { statfs } from 'node:fs/promises';

import type { ArtifactDiskSpacePort } from './ArtifactLifecycleTypes';

/** Reports exact filesystem capacity and a conservative retained-installation allowance. */
export class NodeArtifactDiskSpace implements ArtifactDiskSpacePort {
  public constructor(
    private readonly managedRoot: string,
    private readonly retainedInstalledBytes: () => number,
  ) {}

  public async getFreeBytes(): Promise<number> {
    const value = await statfs(this.managedRoot, { bigint: true });
    const available = value.bavail * value.bsize;
    return available <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(available) : Number.MAX_SAFE_INTEGER;
  }

  public async getRetainedInstalledBytes(): Promise<number> {
    const value = this.retainedInstalledBytes();
    return Number.isSafeInteger(value) && value >= 0 ? value : Number.MAX_SAFE_INTEGER;
  }
}
