import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createNativeRuntimeLogLaunchEnvironment,
  isNativeRuntimeProcessInstanceId,
  resolveNativeRuntimeLogLaunchLevel,
} from '@main/localWhisper/supervisor/NativeRuntimeLogLaunchEnvironment';

const PROCESS_INSTANCE_ID = '11111111-1111-1111-8111-111111111111';

test('native log launch configuration resolves development, CI, and production levels without inheriting private values', () => {
  assert.equal(resolveNativeRuntimeLogLaunchLevel({}), 'debug');
  assert.equal(resolveNativeRuntimeLogLaunchLevel({ NODE_ENV: 'production' }), 'info');
  assert.equal(resolveNativeRuntimeLogLaunchLevel({ CI: 'true', NODE_ENV: 'production' }), 'debug');
  assert.deepEqual(
    createNativeRuntimeLogLaunchEnvironment(
      'linux',
      { NODE_ENV: 'production', PRIVATE_CANARY: 'must-not-propagate' },
      PROCESS_INSTANCE_ID,
    ),
    {
      LANG: 'C',
      LC_ALL: 'C',
      LOCAL_WHISPER_NATIVE_LOG_LEVEL: 'info',
      LOCAL_WHISPER_NATIVE_PROCESS_INSTANCE_ID: PROCESS_INSTANCE_ID,
    },
  );
  assert.deepEqual(
    createNativeRuntimeLogLaunchEnvironment(
      'win32',
      { CI: 'true', SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', PRIVATE_CANARY: 'must-not-propagate' },
      PROCESS_INSTANCE_ID,
    ),
    {
      LOCAL_WHISPER_NATIVE_LOG_LEVEL: 'debug',
      LOCAL_WHISPER_NATIVE_PROCESS_INSTANCE_ID: PROCESS_INSTANCE_ID,
      SystemRoot: 'C:\\Windows',
      WINDIR: 'C:\\Windows',
    },
  );
});

test('native log launch configuration rejects an invalid process identity before spawning a native process', () => {
  assert.equal(isNativeRuntimeProcessInstanceId(PROCESS_INSTANCE_ID), true);
  assert.equal(isNativeRuntimeProcessInstanceId('not-a-uuid'), false);
  assert.throws(() => createNativeRuntimeLogLaunchEnvironment('linux', {}, 'not-a-uuid'));
});
