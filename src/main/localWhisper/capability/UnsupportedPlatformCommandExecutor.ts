import { PlatformCommandExecutor, type PlatformCommandExecutorDependencies } from './PlatformCommandExecutor';

/** Rejects resource commands on hosts outside the supported Linux and Windows matrix. */
export class UnsupportedPlatformCommandExecutor extends PlatformCommandExecutor {
  protected readonly windowsHide = true;

  public constructor(dependencies: PlatformCommandExecutorDependencies) {
    super(dependencies);
  }

  public run(): Promise<string> {
    return Promise.reject(new Error('Host resource commands are unsupported on this platform'));
  }
}
