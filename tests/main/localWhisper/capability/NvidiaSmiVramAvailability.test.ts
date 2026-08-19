import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HostResourceAvailabilityStatus,
  HostResourcePlatform,
  HostResourceUnavailableReason,
} from '@main/localWhisper/capability/HostResourceAvailability';
import {
  NvidiaSmiExecutableResolver,
  type NvidiaSmiCommandPort,
} from '@main/localWhisper/capability/NvidiaSmiHostInventory';
import { NvidiaSmiVramAvailability } from '@main/localWhisper/capability/NvidiaSmiVramAvailability';

class FakeCommand implements NvidiaSmiCommandPort {
  public readonly calls: { readonly executablePath: string; readonly arguments_: readonly string[] }[] = [];

  public constructor(private readonly output: string | Error) {}

  public run(executablePath: string, arguments_: readonly string[]): Promise<string> {
    this.calls.push(Object.freeze({ executablePath, arguments_: Object.freeze([...arguments_]) }));
    return this.output instanceof Error ? Promise.reject(this.output) : Promise.resolve(this.output);
  }
}

function availability(input: {
  readonly platform: NodeJS.Platform;
  readonly environment?: Readonly<NodeJS.ProcessEnv>;
  readonly pathExists: (filePath: string) => boolean;
  readonly command: NvidiaSmiCommandPort;
}): NvidiaSmiVramAvailability {
  return new NvidiaSmiVramAvailability(
    input.command,
    new NvidiaSmiExecutableResolver({
      platform: input.platform,
      environment: input.environment ?? Object.freeze({}),
      pathExists: input.pathExists,
    }),
  );
}

describe('NvidiaSmiVramAvailability', () => {
  it('reads bounded free VRAM for one exact Linux PCI device without a shell', async () => {
    const command = new FakeCommand('8297\n');
    const sampler = availability({
      platform: HostResourcePlatform.Linux,
      pathExists: (filePath) => filePath === '/usr/bin/nvidia-smi',
      command,
    });

    assert.deepEqual(await sampler.sample('0000:01:00.0'), {
      status: HostResourceAvailabilityStatus.Available,
      bytes: 8297 * 1024 ** 2,
    });
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
    const sampler = availability({
      platform: HostResourcePlatform.Windows,
      environment: Object.freeze({ SystemRoot: 'C:\\Windows' }),
      pathExists: (filePath) => filePath === executablePath,
      command,
    });

    assert.equal(await sampler.availableBytes('0000:02:00.0'), 4096 * 1024 ** 2);
    assert.equal(command.calls[0]?.executablePath, executablePath);
  });

  it('fails closed for forged identities, missing tools, command failures, and malformed output', async () => {
    const invalidIdentityCommand = new FakeCommand('1024');
    const invalidIdentity = availability({
      platform: HostResourcePlatform.Linux,
      pathExists: () => true,
      command: invalidIdentityCommand,
    });
    assert.deepEqual(await invalidIdentity.sample('--id=all'), {
      status: HostResourceAvailabilityStatus.Unavailable,
      reason: HostResourceUnavailableReason.InvalidRequest,
    });
    assert.equal(invalidIdentityCommand.calls.length, 0);

    for (const output of ['1, 2', '-1', 'unknown', '9'.repeat(33)]) {
      const sampler = availability({
        platform: HostResourcePlatform.Linux,
        pathExists: () => true,
        command: new FakeCommand(output),
      });
      assert.equal(await sampler.availableBytes('0000:01:00.0'), null);
    }

    const failed = availability({
      platform: HostResourcePlatform.Linux,
      pathExists: () => true,
      command: new FakeCommand(new Error('unavailable')),
    });
    assert.deepEqual(await failed.sample('0000:01:00.0'), {
      status: HostResourceAvailabilityStatus.Unavailable,
      reason: HostResourceUnavailableReason.CommandFailed,
    });

    const missing = availability({
      platform: HostResourcePlatform.Linux,
      pathExists: () => false,
      command: new FakeCommand('1024'),
    });
    assert.deepEqual(await missing.sample('0000:01:00.0'), {
      status: HostResourceAvailabilityStatus.Unavailable,
      reason: HostResourceUnavailableReason.SourceUnavailable,
    });
  });
});
