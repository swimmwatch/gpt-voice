import assert from 'node:assert/strict';
import type { execFile } from 'node:child_process';
import { describe, it } from 'node:test';

import { LinuxCommandExecutor } from '@main/localWhisper/capability/LinuxCommandExecutor';
import { WindowsCommandExecutor } from '@main/localWhisper/capability/WindowsCommandExecutor';

interface RecordedExecution {
  readonly executablePath: string;
  readonly arguments_: readonly string[];
  readonly options: Readonly<Record<string, unknown>>;
}

function fakeExecFile(records: RecordedExecution[], output: string | Error): typeof execFile {
  return ((
    executablePath: string,
    arguments_: readonly string[],
    options: Readonly<Record<string, unknown>>,
    callback: (error: Error | null, stdout: string) => void,
  ) => {
    records.push(Object.freeze({ executablePath, arguments_: Object.freeze([...arguments_]), options }));
    callback(output instanceof Error ? output : null, output instanceof Error ? '' : output);
    return Object.freeze({});
  }) as unknown as typeof execFile;
}

describe('PlatformCommandExecutor', () => {
  it('executes structured arguments directly with platform-specific window handling', async () => {
    for (const [executorType, expectedWindowsHide] of [
      [LinuxCommandExecutor, false],
      [WindowsCommandExecutor, true],
    ] as const) {
      const records: RecordedExecution[] = [];
      const executor = new executorType({ execFile: fakeExecFile(records, '4096\n') });

      assert.equal(await executor.run('/trusted/nvidia-smi', ['--query-gpu=memory.free']), '4096\n');
      assert.deepEqual(records, [
        {
          executablePath: '/trusted/nvidia-smi',
          arguments_: ['--query-gpu=memory.free'],
          options: {
            encoding: 'utf8',
            maxBuffer: 4096,
            timeout: 2000,
            windowsHide: expectedWindowsHide,
          },
        },
      ]);
    }
  });

  it('propagates a bounded command failure without invoking a shell', async () => {
    const executor = new WindowsCommandExecutor({ execFile: fakeExecFile([], new Error('failed')) });
    await assert.rejects(executor.run('nvidia-smi.exe', []), /failed/u);
  });
});
