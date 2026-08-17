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
  const launchEnvironment = source('src/main/localWhisper/supervisor/NativeRuntimeLogLaunchEnvironment.ts');
  assert.match(owner, /\[modelGuardLaunch \? MODEL_GUARD_ARGUMENT : LAUNCHER_ARGUMENT\]/u);
  assert.match(owner, /--local-whisper-model-launch-v1/u);
  assert.match(owner, /--local-whisper-launcher-v2/u);
  assert.match(owner, /createNativeRuntimeLogLaunchEnvironment/u);
  assert.match(owner, /shell: false/u);
  assert.match(launchEnvironment, /LOCAL_WHISPER_NATIVE_LOG_LEVEL/u);
  assert.match(launchEnvironment, /LOCAL_WHISPER_NATIVE_PROCESS_INSTANCE_ID/u);
  assert.match(launchEnvironment, /LOCAL_WHISPER_NATIVE_LAUNCHER_PROCESS_INSTANCE_ID/u);
  assert.match(launchEnvironment, /LOCAL_WHISPER_NATIVE_WORKER_PROCESS_INSTANCE_ID/u);
  assert.match(launchEnvironment, /LANG: 'C'/u);
  assert.match(launchEnvironment, /LC_ALL: 'C'/u);
  assert.doesNotMatch(`${owner}\n${launchEnvironment}`, /taskkill|modelPath|initialPrompt|targetRequestId/u);
});

test('native launchers replace the inherited tree identity with each authorized child identity', () => {
  const linuxGuard = source('runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp');
  const windowsGuard = source(
    'runtime/local-whisper/fs-guard/src/platform/windows/windows_model_launch_application.cpp',
  );
  const linuxLauncher = source('runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp');
  const windowsLauncher = source('runtime/local-whisper/launcher/src/platform/windows/windows_launcher.cpp');

  for (const guard of [linuxGuard, windowsGuard]) {
    assert.match(guard, /NativeLogChildProcess::launcher/u);
    assert.match(guard, /NativeLogChildProcess::worker/u);
    assert.match(guard, /LOCAL_WHISPER_NATIVE_WORKER_PROCESS_INSTANCE_ID/u);
  }
  for (const launcher of [linuxLauncher, windowsLauncher]) {
    assert.match(launcher, /NativeLogChildProcess::worker/u);
    assert.match(launcher, /LOCAL_WHISPER_NATIVE_PROCESS_INSTANCE_ID/u);
  }
  assert.doesNotMatch(linuxGuard, /std::array<char\*, 3> environment/u);
  assert.doesNotMatch(windowsGuard, /flags, nullptr, nullptr, &startup/u);
});
