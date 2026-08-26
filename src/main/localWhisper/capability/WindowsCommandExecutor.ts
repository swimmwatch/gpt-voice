import { PlatformCommandExecutor, type PlatformCommandExecutorDependencies } from './PlatformCommandExecutor';

/** Executes reviewed Windows resource commands directly without invoking PowerShell. */
export class WindowsCommandExecutor extends PlatformCommandExecutor {
  protected readonly windowsHide = true;

  public constructor(dependencies: PlatformCommandExecutorDependencies) {
    super(dependencies);
  }
}
