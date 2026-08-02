import type {
  LocalWhisperLoadRequest,
  LocalWhisperProbeRequest,
  LocalWhisperSupervisorResult,
} from './LocalWhisperWorkerSupervisor';
import type { ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';
import type { LocalWhisperWorkerLaunchAuthority } from './WorkerProcessOwnership';

export type LocalWhisperWorkerLaunchMode = 'fullLoad' | 'probe';

export interface LocalWhisperWorkerLifecycleSession {
  load(request: LocalWhisperLoadRequest): Promise<LocalWhisperSupervisorResult>;
  probe(request: LocalWhisperProbeRequest): Promise<LocalWhisperSupervisorResult>;
  shutdown(): Promise<LocalWhisperSupervisorResult>;
  startAndHandshake(authority: LocalWhisperWorkerLaunchAuthority): Promise<LocalWhisperSupervisorResult>;
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
    const session = this.createFreshSession('probe', null);
    const started = await session.startAndHandshake(authority);
    if (!started.success) return started;
    const probed = await session.probe(request);
    const stopped = await session.shutdown();
    return stopped.success ? probed : stopped;
  }

  public async startFullLoad(
    authority: LocalWhisperWorkerLaunchAuthority,
    request: LocalWhisperLoadRequest,
  ): Promise<LocalWhisperSupervisorResult> {
    if (this.fullLoadSession) throw new Error('Local Whisper full-load worker is active');
    request.modelLease.assertActive();
    const session = this.createFreshSession('fullLoad', request.modelLease);
    const started = await session.startAndHandshake(authority);
    if (!started.success) return started;
    const loaded = await session.load(request);
    if (!loaded.success) {
      await session.shutdown().catch(() => undefined);
      return loaded;
    }
    this.fullLoadSession = session;
    return loaded;
  }

  public async shutdownFullLoad(): Promise<LocalWhisperSupervisorResult | null> {
    const session = this.fullLoadSession;
    if (!session) return null;
    const result = await session.shutdown();
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
