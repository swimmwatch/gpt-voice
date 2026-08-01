import { NativeLauncherProcessOwner, type NativeLauncherProcessOwnerDependencies } from './NativeLauncherProcessOwner';

/** Linux launcher owns PDEATHSIG, control-stream death, and the worker process group. */
export class LinuxProcessGroupOwner extends NativeLauncherProcessOwner {
  public constructor(dependencies: Omit<NativeLauncherProcessOwnerDependencies, 'platform'>) {
    super({ ...dependencies, platform: 'linux' });
  }
}
