import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
});
