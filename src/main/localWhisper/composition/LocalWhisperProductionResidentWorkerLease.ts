import type { LocalWhisperSettings, LocalWhisperWorkerTranscriptionOptions } from '@shared/localWhisper';

import type {
  LocalWhisperCoordinatorWorkerResult,
  LocalWhisperResidentWorkerLease,
} from '../coordinator/LocalWhisperCoordinatorTypes';
import type {
  LocalWhisperWorkerLifecycle,
  LocalWhisperWorkerLifecycleSession,
} from '../supervisor/LocalWhisperWorkerLifecycle';
import type { LocalWhisperSupervisorResult } from '../supervisor/LocalWhisperWorkerSupervisor';

export interface LocalWhisperProductionResidentWorkerLeaseDependencies {
  readonly configurationEpoch: number;
  readonly lifecycle: Pick<LocalWhisperWorkerLifecycle, 'forceCleanupFullLoad' | 'shutdownFullLoad'>;
  readonly revalidateAuthority: () => Promise<boolean>;
  readonly session: LocalWhisperWorkerLifecycleSession;
}

function result<T>(value: LocalWhisperSupervisorResult<T>): LocalWhisperCoordinatorWorkerResult<T> {
  return value.success
    ? Object.freeze({ success: true, value: value.value })
    : Object.freeze({ success: false, code: value.error.code });
}

function transcriptionOptions(settings: LocalWhisperSettings): LocalWhisperWorkerTranscriptionOptions {
  const decoding = settings.decoding;
  return Object.freeze({
    language: settings.language === 'auto' ? null : settings.language,
    initialPrompt: settings.initialPrompt,
    temperatureHundredths: decoding.temperatureHundredths,
    strategy: decoding.strategy,
    candidateCount:
      decoding.strategy === 'beamSearch'
        ? decoding.beamSize
        : decoding.strategy === 'bestOfSampling'
          ? decoding.bestOf
          : null,
  });
}

/** Owns one warmed resident worker until graceful or forced terminal cleanup. */
export class LocalWhisperProductionResidentWorkerLease implements LocalWhisperResidentWorkerLease {
  private closed = false;

  public constructor(private readonly dependencies: LocalWhisperProductionResidentWorkerLeaseDependencies) {}

  public async transcribe(
    request: Parameters<LocalWhisperResidentWorkerLease['transcribe']>[0],
  ): Promise<LocalWhisperCoordinatorWorkerResult<string>> {
    if (this.closed) return Object.freeze({ success: false, code: 'WORKER_CRASHED' });
    if (request.signal.aborted) return Object.freeze({ success: false, code: 'CANCELLED' });
    const onAbort = (): void => {
      void this.dependencies.session.cancel();
    };
    request.signal.addEventListener('abort', onAbort, { once: true });
    try {
      return result(
        await this.dependencies.session.transcribe({
          audio: request.audio,
          configurationEpoch: this.dependencies.configurationEpoch,
          options: transcriptionOptions(request.settings),
          settingsEpoch: request.settingsEpoch,
        }),
      );
    } finally {
      request.signal.removeEventListener('abort', onAbort);
    }
  }

  public async cancel(): Promise<LocalWhisperCoordinatorWorkerResult> {
    if (this.closed) return Object.freeze({ success: false, code: 'OPERATION_CONFLICT' });
    return result(await this.dependencies.session.cancel());
  }

  public async revalidate(): Promise<boolean> {
    if (this.closed) return false;
    try {
      return await this.dependencies.revalidateAuthority();
    } catch {
      return false;
    }
  }

  public async unload(): Promise<LocalWhisperCoordinatorWorkerResult> {
    if (this.closed) return Object.freeze({ success: false, code: 'OPERATION_CONFLICT' });
    const stopped = await this.dependencies.lifecycle.shutdownFullLoad();
    if (!stopped) return Object.freeze({ success: false, code: 'OPERATION_CONFLICT' });
    if (stopped.success) this.closed = true;
    return result(stopped);
  }

  public async terminate(): Promise<boolean> {
    if (this.closed) return true;
    const stopped = await this.dependencies.lifecycle.forceCleanupFullLoad();
    const success = stopped?.success ?? true;
    if (success) this.closed = true;
    return success;
  }

  public async shutdown(): Promise<boolean> {
    if (this.closed) return true;
    const stopped = await this.dependencies.lifecycle.shutdownFullLoad();
    const success = stopped?.success ?? true;
    if (success) this.closed = true;
    return success;
  }
}
