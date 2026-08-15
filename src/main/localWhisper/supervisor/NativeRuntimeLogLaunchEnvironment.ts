import type { NativeRuntimeLogLevel } from '@shared/localWhisper';

export const NATIVE_LOG_LEVEL_ENVIRONMENT_KEY = 'LOCAL_WHISPER_NATIVE_LOG_LEVEL';
export const NATIVE_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY = 'LOCAL_WHISPER_NATIVE_PROCESS_INSTANCE_ID';
export const NATIVE_LAUNCHER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY = 'LOCAL_WHISPER_NATIVE_LAUNCHER_PROCESS_INSTANCE_ID';
export const NATIVE_WORKER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY = 'LOCAL_WHISPER_NATIVE_WORKER_PROCESS_INSTANCE_ID';

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type NativeRuntimeLogLaunchLevel = Extract<NativeRuntimeLogLevel, 'debug' | 'info'>;

/** Validates the opaque identifier that binds one private native process to its diagnostics. */
export function isNativeRuntimeProcessInstanceId(value: string): boolean {
  return CANONICAL_UUID_PATTERN.test(value);
}

/** Uses debug only for development/CI and retains production diagnostics at the moderate info level. */
export function resolveNativeRuntimeLogLaunchLevel(source: Readonly<NodeJS.ProcessEnv>): NativeRuntimeLogLaunchLevel {
  if (source.CI === 'true') return 'debug';
  return source.NODE_ENV === 'development' ? 'debug' : 'info';
}

export interface NativeRuntimeLogChildProcessIdentities {
  readonly launcherProcessInstanceId?: string;
  readonly workerProcessInstanceId?: string;
}

/** Builds the complete, private environment inherited by one trusted native process tree. */
export function createNativeRuntimeLogLaunchEnvironment(
  platform: 'linux' | 'win32',
  source: Readonly<NodeJS.ProcessEnv>,
  processInstanceId: string,
  childProcessIdentities: NativeRuntimeLogChildProcessIdentities = {},
): NodeJS.ProcessEnv {
  const childIdentities = [
    childProcessIdentities.launcherProcessInstanceId,
    childProcessIdentities.workerProcessInstanceId,
  ].filter((value): value is string => value !== undefined);
  if (
    !isNativeRuntimeProcessInstanceId(processInstanceId) ||
    childIdentities.some((value) => !isNativeRuntimeProcessInstanceId(value)) ||
    new Set([processInstanceId, ...childIdentities]).size !== childIdentities.length + 1
  ) {
    throw new Error('Invalid Local Whisper native process instance ID');
  }
  const result: NodeJS.ProcessEnv = {
    [NATIVE_LOG_LEVEL_ENVIRONMENT_KEY]: resolveNativeRuntimeLogLaunchLevel(source),
    [NATIVE_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY]: processInstanceId,
    ...(childProcessIdentities.launcherProcessInstanceId
      ? {
          [NATIVE_LAUNCHER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY]: childProcessIdentities.launcherProcessInstanceId,
        }
      : {}),
    ...(childProcessIdentities.workerProcessInstanceId
      ? { [NATIVE_WORKER_PROCESS_INSTANCE_ID_ENVIRONMENT_KEY]: childProcessIdentities.workerProcessInstanceId }
      : {}),
  };
  if (platform === 'linux') return { ...result, LANG: 'C', LC_ALL: 'C' };
  for (const key of ['SystemRoot', 'WINDIR'] as const) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) result[key] = value;
  }
  return result;
}
