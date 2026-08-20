import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LinuxPerformanceCollectionPlatformAdapter,
  LinuxPerformanceAttemptProcessAdapter,
  LinuxPerformanceCachePreparationAdapter,
} from '@scripts/local-whisper/qualification/LinuxPerformanceQualificationAdapters';
import { PerformanceQualificationPrivateRoot } from '@scripts/local-whisper/qualification/PerformanceQualificationCommand';
import { qualificationCanonicalJson } from '@scripts/local-whisper/qualification/QualificationContracts';
import type { FocusedPerformanceRunPlan } from '@scripts/local-whisper/qualification/FocusedPerformanceQualification';
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

  it('authenticates a derived candidate graph without requiring it to be a Git worktree', async () => {
    if (process.platform !== 'linux') return;
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-focused-derived-'));
    try {
      const source = path.join(root, 'derived-candidate');
      await mkdir(source, { mode: 0o700 });
      const identities = new Map<string, PreparedPerformanceArtifact['identity']>();
      for (const [relativePath, contents] of [
        ['derived-candidate/app', 'application'],
        ['derived-candidate/runtime', 'runtime'],
        ['inputs/model.bin', 'model'],
        ['inputs/input.wav', 'input'],
      ] as const) {
        const bytes = Buffer.from(contents, 'utf8');
        const absolutePath = path.join(root, relativePath);
        await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
        await writeFile(absolutePath, bytes, { mode: 0o600 });
        identities.set(relativePath, { relativePath, sizeBytes: bytes.byteLength, sha256: sha256(bytes) });
      }
      await chmod(path.join(root, 'derived-candidate', 'app'), 0o500);
      const plan = {
        platform: 'linux',
        candidateSource: { relativePath: 'derived-candidate' },
        applicationArtifact: identities.get('derived-candidate/app'),
        runtimeArtifact: identities.get('derived-candidate/runtime'),
        model: { artifact: identities.get('inputs/model.bin') },
        inputFixture: identities.get('inputs/input.wav'),
      } as FocusedPerformanceRunPlan;
      const adapter = new LinuxPerformanceCollectionPlatformAdapter(
        await PerformanceQualificationPrivateRoot.create(root),
      );
      const prepared = await adapter.prepareFocused(plan);
      await adapter.verifyFocused(plan, prepared);
      assert.equal(prepared.candidateSource, source);
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
import json, os, sys, time
request = json.loads(sys.stdin.readline())
if request["behavior"] == "sleep":
    time.sleep(10)
elif request["behavior"] == "stderr":
    sys.stderr.write("private native output")
elif request["behavior"] == "diagnostic-sleep":
    os.write(4, b"LWQD1\\tmodel\\tcoordinatorPreflightCatalogResolved\\n")
    time.sleep(10)
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

      const diagnosticTimeout = adapter.start({
        executablePath: executable,
        workingDirectory: root,
        timeoutMilliseconds: 50,
        request: { behavior: 'diagnostic-sleep' } as unknown as PerformanceAttemptRequest,
      });
      await assert.rejects(
        diagnosticTimeout.complete(),
        /ATTEMPT_MODEL_INSTALL_COORDINATOR_PREFLIGHT_CATALOG_RESOLVED_TIMEOUT/u,
      );
      await diagnosticTimeout.terminate();

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

  it('completes after a successful attempt exits even when a descendant retains its event channel', async () => {
    if (process.platform !== 'linux') return;
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-event-channel-'));
    try {
      const executable = path.join(root, 'attempt.py');
      await writeFile(
        executable,
        `#!/usr/bin/python3
import json, os, subprocess, sys
json.loads(sys.stdin.readline())
os.write(3, b'{"schemaVersion":1,"kind":"terminal","sequence":0,"status":"success"}\\n')
sys.stdout.write("{}\\n")
sys.stdout.flush()
subprocess.Popen(
    [sys.executable, "-c", "import time; time.sleep(0.5)"],
    close_fds=True,
    pass_fds=(3,),
)
`,
      );
      await chmod(executable, 0o755);
      const session = new LinuxPerformanceAttemptProcessAdapter().start({
        executablePath: executable,
        workingDirectory: root,
        timeoutMilliseconds: 1_000,
        request: {} as PerformanceAttemptRequest,
      });
      const started = performance.now();
      await session.complete();
      assert.ok(performance.now() - started < 400);
      await session.terminate();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('sends the attempt request as canonical JSON', async () => {
    if (process.platform !== 'linux') return;
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-request-'));
    try {
      const executable = path.join(root, 'attempt.py');
      await writeFile(
        executable,
        `#!/usr/bin/python3
import sys
expected = ${JSON.stringify(qualificationCanonicalJson({ sample: 'value', schemaVersion: 3 }))}
received = sys.stdin.readline().rstrip('\\n')
if received != expected:
    sys.exit(1)
sys.stdout.write('{}\\n')
`,
      );
      await chmod(executable, 0o755);
      const session = new LinuxPerformanceAttemptProcessAdapter().start({
        executablePath: executable,
        workingDirectory: root,
        timeoutMilliseconds: 1_000,
        request: { sample: 'value', schemaVersion: 3 } as unknown as PerformanceAttemptRequest,
      });
      await session.complete();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
