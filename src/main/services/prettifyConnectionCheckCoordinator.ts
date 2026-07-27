import type { PrettifyRuntime } from '@main/services/prettifyProviders';
import type {
  PrettifyCliConnectionResult,
  PrettifyCliProviderId,
  PrettifySettingsInput,
} from '@shared/prettifySettings';

export interface PrettifyConnectionCheckOwner {
  once(event: 'destroyed', listener: () => void): unknown;
  removeListener(event: 'destroyed', listener: () => void): unknown;
}

/** Owns per-renderer CLI connection cancellation for one main composition graph. */
export class PrettifyConnectionCheckCoordinator<Owner extends PrettifyConnectionCheckOwner> {
  private readonly activeChecks = new Map<Owner, AbortController>();
  private disposed = false;

  public constructor(private readonly runtime: Pick<PrettifyRuntime, 'checkCliConnection'>) {}

  public async check(
    owner: Owner,
    providerId: PrettifyCliProviderId,
    draftSettings: PrettifySettingsInput,
  ): Promise<PrettifyCliConnectionResult> {
    if (this.disposed) throw new Error('Prettify connection coordinator is disposed');

    this.activeChecks.get(owner)?.abort();
    const controller = new AbortController();
    const handleOwnerDestroyed = (): void => controller.abort();
    this.activeChecks.set(owner, controller);
    owner.once('destroyed', handleOwnerDestroyed);

    try {
      return await this.runtime.checkCliConnection(providerId, draftSettings, controller.signal);
    } finally {
      if (this.activeChecks.get(owner) === controller) this.activeChecks.delete(owner);
      owner.removeListener('destroyed', handleOwnerDestroyed);
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.activeChecks.values()) controller.abort();
    this.activeChecks.clear();
  }
}
