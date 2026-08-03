import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LinuxResourceSampler } from '@scripts/local-whisper/qualification/LinuxResourceSampler';

describe('LinuxResourceSampler', () => {
  it('samples exact PSS ownership and proves ten zero-settlement observations', async () => {
    if (process.platform !== 'linux') return;
    const target = spawn('/usr/bin/sleep', ['1'], { shell: false, stdio: 'ignore' });
    assert.ok(target.pid);
    const sampler = new LinuxResourceSampler(
      path.resolve('scripts/local-whisper/qualification/linux_resource_sampler.py'),
    ).start(target.pid, 'cpu');
    await sampler.ready;
    const series = await sampler.finish();
    assert.ok(series.samples.some((sample) => sample.ownedProcessCount === 1 && sample.ramBytes > 0));
    assert.equal(
      series.samples.slice(-10).every((sample) => sample.ownedProcessCount === 0),
      true,
    );
    assert.equal(
      series.samples.every((sample) => sample.vramBytes === 'notApplicable'),
      true,
    );
  });

  it('rejects missing and trailing readiness bytes', async () => {
    if (process.platform !== 'linux') return;
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-sampler-ready-'));
    try {
      for (const [name, frame] of [
        ['missing', ''],
        ['trailing', 'READY\\nTRAILING'],
      ] as const) {
        const scriptPath = path.join(root, `${name}.py`);
        await writeFile(
          scriptPath,
          `import os, sys\nsys.stdin.buffer.read()\nos.write(3, ${JSON.stringify(frame)}.encode("ascii"))\nos.close(3)\n`,
        );
        const session = new LinuxResourceSampler(scriptPath).start(process.pid, 'cpu');
        await assert.rejects(session.ready, /readiness framing is invalid/u);
        await assert.rejects(session.finish(), /readiness framing is invalid/u);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
