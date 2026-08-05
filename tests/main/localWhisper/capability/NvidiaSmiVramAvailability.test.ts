import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  NvidiaSmiVramAvailability,
  type NvidiaSmiCommandPort,
} from '@main/localWhisper/capability/NvidiaSmiVramAvailability';

class FakeCommand implements NvidiaSmiCommandPort {
  public readonly calls: { readonly executablePath: string; readonly arguments_: readonly string[] }[] = [];

  public constructor(private readonly output: string | Error) {}

  public run(executablePath: string, arguments_: readonly string[]): Promise<string> {
    this.calls.push(Object.freeze({ executablePath, arguments_: Object.freeze([...arguments_]) }));
    return this.output instanceof Error ? Promise.reject(this.output) : Promise.resolve(this.output);
  }
}

describe('NvidiaSmiVramAvailability', () => {
  it('reads bounded free VRAM for one exact Linux PCI device without a shell', async () => {
    const command = new FakeCommand('8297\n');
    const availability = new NvidiaSmiVramAvailability({
      platform: 'linux',
      environment: Object.freeze({}),
      pathExists: (filePath) => filePath === '/usr/bin/nvidia-smi',
      command,
    });

    assert.equal(await availability.sample('0000:01:00.0'), 8297 * 1024 ** 2);
    assert.deepEqual(command.calls, [
      {
        executablePath: '/usr/bin/nvidia-smi',
        arguments_: ['--id=0000:01:00.0', '--query-gpu=memory.free', '--format=csv,noheader,nounits'],
      },
    ]);
  });

  it('uses an allowlisted Windows driver path', async () => {
    const command = new FakeCommand('4096');
    const executablePath = 'C:\\Windows\\System32\\nvidia-smi.exe';
    const availability = new NvidiaSmiVramAvailability({
      platform: 'win32',
      environment: Object.freeze({ SystemRoot: 'C:\\Windows' }),
      pathExists: (filePath) => filePath === executablePath,
      command,
    });

    assert.equal(await availability.sample('0000:02:00.0'), 4096 * 1024 ** 2);
    assert.equal(command.calls[0]?.executablePath, executablePath);
  });

  it('fails closed for forged identities, missing tools, command failures, and malformed output', async () => {
    const invalidIdentityCommand = new FakeCommand('1024');
    const invalidIdentity = new NvidiaSmiVramAvailability({
      platform: 'linux',
      environment: Object.freeze({}),
      pathExists: () => true,
      command: invalidIdentityCommand,
    });
    assert.equal(await invalidIdentity.sample('--id=all'), null);
    assert.equal(invalidIdentityCommand.calls.length, 0);

    for (const output of ['1, 2', '-1', 'unknown', '9'.repeat(33), new Error('unavailable')]) {
      const availability = new NvidiaSmiVramAvailability({
        platform: 'linux',
        environment: Object.freeze({}),
        pathExists: () => true,
        command: new FakeCommand(output),
      });
      assert.equal(await availability.sample('0000:01:00.0'), null);
    }

    const missing = new NvidiaSmiVramAvailability({
      platform: 'linux',
      environment: Object.freeze({}),
      pathExists: () => false,
      command: new FakeCommand('1024'),
    });
    assert.equal(await missing.sample('0000:01:00.0'), null);
  });
});
