export class AppImageLauncherHardener {
  public constructor(projectDirectory?: string);
  public apply(): Promise<void>;
  public verify(): Promise<void>;
}

export function assertSandboxedAppRun(source: string): void;
