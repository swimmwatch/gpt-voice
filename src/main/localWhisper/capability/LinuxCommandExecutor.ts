import { PlatformCommandExecutor, type PlatformCommandExecutorDependencies } from './PlatformCommandExecutor';

/** Executes reviewed Linux resource commands directly without invoking sh. */
export class LinuxCommandExecutor extends PlatformCommandExecutor {
  protected readonly windowsHide = false;

  public constructor(dependencies: PlatformCommandExecutorDependencies) {
    super(dependencies);
  }
}
