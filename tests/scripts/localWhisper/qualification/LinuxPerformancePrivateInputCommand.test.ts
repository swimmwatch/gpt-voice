import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LinuxPerformancePrivateInputCommand } from '@scripts/local-whisper/qualification/LinuxPerformancePrivateInputCommand';

describe('Linux performance private input command', () => {
  it('accepts four exact absolute paths independent of ordering', () => {
    const root = path.resolve('/tmp/private-input-command');
    const value = LinuxPerformancePrivateInputCommand.parse([
      `--private-run-root=${path.join(root, 'private', 'run')}`,
      `--cache-root=${path.join(root, 'cache')}`,
      `--workspace-root=${root}`,
      `--private-parent=${path.join(root, 'private')}`,
    ]);
    assert.equal(value.workspaceRoot, root);
    assert.equal(value.privateRunRoot, path.join(root, 'private', 'run'));
  });

  it('rejects aliases, duplicates, extras, relative paths, and newline injection', () => {
    const root = path.resolve('/tmp/private-input-command');
    const valid = [
      `--workspace-root=${root}`,
      `--cache-root=${path.join(root, 'cache')}`,
      `--private-parent=${path.join(root, 'private')}`,
      `--private-run-root=${path.join(root, 'private', 'run')}`,
    ];
    const invalid = [
      valid.slice(0, -1),
      [...valid, `--extra=${root}`],
      [...valid.slice(0, -1), valid[0]!],
      [...valid.slice(0, -1), '--private-run-root=relative'],
      [...valid.slice(0, -1), `--private-run-root=${root}\n/private`],
    ];
    for (const argv of invalid)
      assert.throws(() => LinuxPerformancePrivateInputCommand.parse(argv), /ARGUMENT_INVALID/u);
  });
});
