import type {
  LocalWhisperLoadRequest,
  LocalWhisperProbeRequest,
  LocalWhisperSupervisorResult,
  LocalWhisperTranscriptionRequest,
} from './LocalWhisperWorkerSupervisor';
import type { ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';
import type {
  LocalWhisperWorkerLaunchAuthority,
  LocalWhisperWorkerLaunchMode as ProcessWorkerLaunchMode,
} from './WorkerProcessOwnership';

export type LocalWhisperWorkerLaunchMode = Exclude<ProcessWorkerLaunchMode, 'registry'>;

export interface LocalWhisperWorkerLifecycleSession {
  cancel(): Promise<LocalWhisperSupervisorResult>;
  forceCleanup(): Promise<LocalWhisperSupervisorResult>;
  load(request: LocalWhisperLoadRequest): Promise<LocalWhisperSupervisorResult>;
  probe(request: LocalWhisperProbeRequest): Promise<LocalWhisperSupervisorResult>;
  shutdown(): Promise<LocalWhisperSupervisorResult>;
  startAndHandshake(authority: LocalWhisperWorkerLaunchAuthority): Promise<LocalWhisperSupervisorResult>;
  transcribe(request: LocalWhisperTranscriptionRequest): Promise<LocalWhisperSupervisorResult<string>>;
  unload(configurationEpoch: number): Promise<LocalWhisperSupervisorResult>;
  warmup(configurationEpoch: number): Promise<LocalWhisperSupervisorResult>;
}

export interface LocalWhisperWorkerLifecycleDependencies {
  readonly createSession: (
    mode: LocalWhisperWorkerLaunchMode,
    modelAuthority: ManagedArtifactLease | null,
  ) => LocalWhisperWorkerLifecycleSession;
}

/** Enforces a disposable probe process and a separately launched full-load process. */
export class LocalWhisperWorkerLifecycle {
  private fullLoadSession: LocalWhisperWorkerLifecycleSession | null = null;
  private readonly usedSessions = new Set<LocalWhisperWorkerLifecycleSession>();

  public constructor(private readonly dependencies: LocalWhisperWorkerLifecycleDependencies) {}

  public get activeFullLoadSession(): LocalWhisperWorkerLifecycleSession | null {
    return this.fullLoadSession;
  }

  public async probeOnce(
    authority: LocalWhisperWorkerLaunchAuthority,
    request: LocalWhisperProbeRequest,
  ): Promise<LocalWhisperSupervisorResult> {
    if (this.fullLoadSession) throw new Error('Local Whisper full-load worker is active');
    if (authority.launchMode !== 'probe') throw new Error('Local Whisper probe launch mode mismatch');
    const session = this.createFreshSession('probe', null);
    const started = await session.startAndHandshake(authority);
    if (!started.success) return started;
    const probed = await session.probe(request);
    if (!probed.success) return probed;
    const cleaned = await session.forceCleanup();
    return cleaned.success ? probed : cleaned;
  }

  public async startFullLoad(
    authority: LocalWhisperWorkerLaunchAuthority,
    request: LocalWhisperLoadRequest,
  ): Promise<LocalWhisperSupervisorResult> {
    if (this.fullLoadSession) throw new Error('Local Whisper full-load worker is active');
    if (authority.launchMode !== 'fullLoad') throw new Error('Local Whisper full-load launch mode mismatch');
    request.modelLease.assertActive();
    const session = this.createFreshSession('fullLoad', request.modelLease);
    this.fullLoadSession = session;
    try {
      const started = await session.startAndHandshake(authority);
      if (!started.success) {
        if (this.fullLoadSession === session) this.fullLoadSession = null;
        return started;
      }
      const loaded = await session.load(request);
      if (!loaded.success) {
        await session.shutdown().catch(() => undefined);
        if (this.fullLoadSession === session) this.fullLoadSession = null;
        return loaded;
      }
      if (this.fullLoadSession !== session) {
        throw new Error('Local Whisper full-load worker was terminated during startup');
      }
      return loaded;
    } catch (error) {
      if (this.fullLoadSession === session) this.fullLoadSession = null;
      throw error;
    }
  }

  public async shutdownFullLoad(): Promise<LocalWhisperSupervisorResult | null> {
    const session = this.fullLoadSession;
    if (!session) return null;
    const result = await session.shutdown();
    if (result.success) this.fullLoadSession = null;
    return result;
  }

  public async forceCleanupFullLoad(): Promise<LocalWhisperSupervisorResult | null> {
    const session = this.fullLoadSession;
    if (!session) return null;
    const result = await session.forceCleanup();
    if (result.success) this.fullLoadSession = null;
    return result;
  }

  private createFreshSession(
    mode: LocalWhisperWorkerLaunchMode,
    modelAuthority: ManagedArtifactLease | null,
  ): LocalWhisperWorkerLifecycleSession {
    const session = this.dependencies.createSession(mode, modelAuthority);
    if (this.usedSessions.has(session)) throw new Error('Local Whisper worker session was reused');
    this.usedSessions.add(session);
    return session;
  }
}
