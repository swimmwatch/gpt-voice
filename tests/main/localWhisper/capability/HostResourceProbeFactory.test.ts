import assert from 'node:assert/strict';
import type { execFile } from 'node:child_process';
import { describe, it } from 'node:test';

import { FallbackHostMemoryAvailability } from '@main/localWhisper/capability/FallbackHostMemoryAvailability';
import { HostResourceKind, HostResourcePlatform } from '@main/localWhisper/capability/HostResourceAvailability';
import { HostResourceProbeFactory } from '@main/localWhisper/capability/HostResourceProbeFactory';
import { LinuxHostMemoryAvailability } from '@main/localWhisper/capability/LinuxHostMemoryAvailability';
import { WindowsHostMemoryAvailability } from '@main/localWhisper/capability/WindowsHostMemoryAvailability';

const unusedExecFile = (() => {
  throw new Error('Command execution was not expected');
}) as unknown as typeof execFile;

describe('HostResourceProbeFactory', () => {
  it('returns Linux resource probes for a Linux host', () => {
    const probes = new HostResourceProbeFactory({
      platform: HostResourcePlatform.Linux,
      environment: Object.freeze({}),
      pathExists: () => false,
      readFile: () => 'MemAvailable: 2048 kB\n',
      fallbackMemoryBytes: () => 1024,
      execFile: unusedExecFile,
    }).create();

    assert.ok(probes.memory instanceof LinuxHostMemoryAvailability);
    assert.equal(probes.memory.kind, HostResourceKind.Ram);
    assert.equal(probes.vram.kind, HostResourceKind.Vram);
    assert.equal(probes.memory.availableBytes(), 2048 * 1024);
  });

  it('returns Windows resource probes for a Windows host', () => {
    const probes = new HostResourceProbeFactory({
      platform: HostResourcePlatform.Windows,
      environment: Object.freeze({ SystemRoot: 'C:\\Windows' }),
      pathExists: () => false,
      readFile: () => {
        throw new Error('Windows must not read procfs');
      },
      fallbackMemoryBytes: () => 4096,
      execFile: unusedExecFile,
    }).create();

    assert.ok(probes.memory instanceof WindowsHostMemoryAvailability);
    assert.equal(probes.memory.availableBytes(), 4096);
  });

  it('keeps unsupported hosts on a non-command fallback implementation', async () => {
    const probes = new HostResourceProbeFactory({
      platform: 'darwin',
      environment: Object.freeze({}),
      pathExists: () => false,
      readFile: () => '',
      fallbackMemoryBytes: () => 8192,
      execFile: unusedExecFile,
    }).create();

    assert.ok(probes.memory instanceof FallbackHostMemoryAvailability);
    assert.equal(probes.memory.availableBytes(), 8192);
    assert.equal(await probes.vram.availableBytes('0000:01:00.0'), null);
  });
});
