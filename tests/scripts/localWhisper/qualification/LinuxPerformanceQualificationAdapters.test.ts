import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LinuxPerformanceAttemptProcessAdapter,
  LinuxPerformanceCachePreparationAdapter,
} from '@scripts/local-whisper/qualification/LinuxPerformanceQualificationAdapters';
import type {
  PerformanceAttemptRequest,
  PreparedPerformanceArtifact,
} from '@scripts/local-whisper/qualification/PerformanceQualificationCollector';

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('Linux performance qualification adapters', () => {
  it('prepares only the four authenticated cell files for explicit cold and warm states', async () => {
    if (process.platform !== 'linux') return;
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-cache-'));
    try {
      const files: PreparedPerformanceArtifact[] = [];
      for (let index = 0; index < 4; index += 1) {
        const bytes = Buffer.from(`cache-input-${index}`, 'utf8');
        const absolutePath = path.join(root, `${index}.bin`);
        await writeFile(absolutePath, bytes);
        files.push({
          absolutePath,
          identity: { relativePath: `${index}.bin`, sizeBytes: bytes.byteLength, sha256: sha256(bytes) },
        });
      }
      const adapter = new LinuxPerformanceCachePreparationAdapter(
        path.resolve('scripts/local-whisper/qualification/linux_performance_cache.py'),
      );
      for (const cacheState of ['cold', 'warm'] as const) {
        await adapter.prepare({
          cacheState,
          inputSetDigest: createHash('sha256').update(cacheState).digest('hex'),
          files,
        });
      }
      for (const file of files) {
        assert.equal(sha256(await readFile(file.absolutePath)), file.identity.sha256);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('bounds hook output and terminates its owned process group on timeout and cancellation', async () => {
    if (process.platform !== 'linux') return;
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-process-'));
    try {
      const executable = path.join(root, 'attempt.py');
      await writeFile(
        executable,
        `#!/usr/bin/python3
import json, sys, time
request = json.loads(sys.stdin.readline())
if request["behavior"] == "sleep":
    time.sleep(10)
elif request["behavior"] == "stderr":
    sys.stderr.write("private native output")
else:
    sys.stdout.write("{}\\n")
`,
      );
      await chmod(executable, 0o755);
      const adapter = new LinuxPerformanceAttemptProcessAdapter();
      const timeout = adapter.start({
        executablePath: executable,
        workingDirectory: root,
        timeoutMilliseconds: 50,
        request: { behavior: 'sleep' } as unknown as PerformanceAttemptRequest,
      });
      await assert.rejects(timeout.complete(), /ATTEMPT_TIMEOUT/u);
      await timeout.terminate();

      const abort = new AbortController();
      const cancelled = adapter.start({
        executablePath: executable,
        workingDirectory: root,
        timeoutMilliseconds: 10_000,
        signal: abort.signal,
        request: { behavior: 'sleep' } as unknown as PerformanceAttemptRequest,
      });
      abort.abort();
      await assert.rejects(cancelled.complete(), /COLLECTION_CANCELLED/u);
      await cancelled.terminate();

      const stderr = adapter.start({
        executablePath: executable,
        workingDirectory: root,
        timeoutMilliseconds: 1000,
        request: { behavior: 'stderr' } as unknown as PerformanceAttemptRequest,
      });
      await assert.rejects(stderr.complete(), (error: unknown) => {
        assert.equal(String(error).includes('private native output'), false);
        return /ATTEMPT_PROCESS_FAILED/u.test(String(error));
      });
      await stderr.terminate();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
