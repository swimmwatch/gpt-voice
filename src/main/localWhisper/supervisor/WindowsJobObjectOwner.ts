import { NativeLauncherProcessOwner, type NativeLauncherProcessOwnerDependencies } from './NativeLauncherProcessOwner';

/** Windows launcher creates suspended, assigns to kill-on-close Job Object, then resumes. */
export class WindowsJobObjectOwner extends NativeLauncherProcessOwner {
  public constructor(dependencies: Omit<NativeLauncherProcessOwnerDependencies, 'platform'>) {
    super({ ...dependencies, platform: 'win32' });
  }
}
