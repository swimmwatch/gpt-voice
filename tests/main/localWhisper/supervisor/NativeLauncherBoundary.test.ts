import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8');
}

test('Windows launcher assigns a suspended worker to a kill-on-close Job before resume', () => {
  const windows = source('runtime/local-whisper/launcher/src/platform/windows/windows_launcher.cpp');
  const create = windows.indexOf('CreateProcessW');
  const assign = windows.indexOf('AssignProcessToJobObject');
  const resume = windows.indexOf('ResumeThread');
  assert.ok(create >= 0 && assign > create && resume > assign);
  for (const primitive of [
    'CREATE_SUSPENDED',
    'JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE',
    'PROC_THREAD_ATTRIBUTE_HANDLE_LIST',
    'FILE_FLAG_OPEN_REPARSE_POINT',
    'TerminateJobObject',
    'QueryInformationJobObject',
  ]) {
    assert.ok(windows.includes(primitive), `missing Windows launcher primitive: ${primitive}`);
  }
  assert.doesNotMatch(windows, /ShellExecute|taskkill|system\s*\(|CreateProcessW\s*\(nullptr/u);
});

test('Linux launcher binds parent death, held execution, subreaping, and a dedicated process group', () => {
  const linux = source('runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp');
  for (const primitive of [
    'SYS_openat2',
    'RESOLVE_NO_SYMLINKS',
    'PR_SET_PDEATHSIG',
    'PR_SET_CHILD_SUBREAPER',
    'setpgid',
    'fexecve',
    'kill(-worker_pid, SIGTERM)',
    'kill(-worker_pid, SIGKILL)',
  ]) {
    assert.ok(linux.includes(primitive), `missing Linux launcher primitive: ${primitive}`);
  }
  assert.doesNotMatch(linux, /system\s*\(|\/bin\/sh|kill\(worker_pid/u);
});

test('TypeScript owner keeps launch argv and environment fixed and non-private', () => {
  const owner = source('src/main/localWhisper/supervisor/NativeLauncherProcessOwner.ts');
  assert.match(owner, /\[modelGuardLaunch \? MODEL_GUARD_ARGUMENT : LAUNCHER_ARGUMENT\]/u);
  assert.match(owner, /--local-whisper-model-launch-v1/u);
  assert.match(owner, /--local-whisper-launcher-v2/u);
  assert.match(owner, /shell: false/u);
  assert.match(owner, /LANG: 'C'/u);
  assert.match(owner, /LC_ALL: 'C'/u);
  assert.doesNotMatch(owner, /taskkill|modelPath|initialPrompt|targetRequestId/u);
});
