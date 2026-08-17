import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HostMemoryAvailability } from '@main/localWhisper/capability/HostMemoryAvailability';

function availability(input: {
  readonly platform: NodeJS.Platform;
  readonly meminfo?: string | Error;
  readonly fallbackMemoryBytes: () => number;
}): HostMemoryAvailability {
  return new HostMemoryAvailability({
    platform: input.platform,
    readFile: () => {
      if (input.meminfo instanceof Error) throw input.meminfo;
      return input.meminfo ?? '';
    },
    fallbackMemoryBytes: input.fallbackMemoryBytes,
  });
}

describe('HostMemoryAvailability', () => {
  it('uses Linux MemAvailable in bytes instead of raw free pages', () => {
    const fallbackCalls: string[] = [];
    const sampler = availability({
      platform: 'linux',
      meminfo: 'MemTotal:       32768000 kB\nMemFree:         2500000 kB\nMemAvailable:    9000000 kB\n',
      fallbackMemoryBytes: () => {
        fallbackCalls.push('fallback');
        return 2_500_000 * 1024;
      },
    });

    assert.equal(sampler.sample(), 9_000_000 * 1024);
    assert.deepEqual(fallbackCalls, []);
  });

  it('falls back when Linux MemAvailable is missing, malformed, unreadable, or unsafe', () => {
    for (const meminfo of [
      'MemFree: 1000 kB\n',
      'MemAvailable: unavailable kB\n',
      'MemAvailable: 9007199254740992 kB\n',
      new Error('procfs unavailable'),
    ]) {
      const sampler = availability({
        platform: 'linux',
        meminfo,
        fallbackMemoryBytes: () => 4 * 1024 ** 3,
      });
      assert.equal(sampler.sample(), 4 * 1024 ** 3);
    }
  });

  it('uses the platform fallback outside Linux and fails closed for an invalid fallback', () => {
    const sampler = availability({
      platform: 'win32',
      meminfo: 'MemAvailable: 9000000 kB\n',
      fallbackMemoryBytes: () => 3 * 1024 ** 3,
    });
    assert.equal(sampler.sample(), 3 * 1024 ** 3);

    const invalidFallback = availability({
      platform: 'darwin',
      fallbackMemoryBytes: () => Number.NaN,
    });
    assert.equal(invalidFallback.sample(), 0);
  });
});
