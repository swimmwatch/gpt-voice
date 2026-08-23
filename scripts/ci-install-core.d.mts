export interface CiInstallCommand {
  readonly argumentPrefix: readonly string[];
  readonly executable: string;
}

export interface CiInstallCommandRequest {
  readonly arguments_: readonly string[];
  readonly command: string;
  readonly cwd: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly stdio: 'ignore' | 'inherit';
}

export interface CiInstallEntryIdentity {
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface CiInstallCoordinatorOptions {
  readonly attempts?: number;
  readonly cwd?: string;
  readonly delay?: (milliseconds: number) => Promise<void>;
  readonly environment?: NodeJS.ProcessEnv;
  readonly nodeExecutable?: string;
  readonly output?: { write(value: string): unknown };
  readonly platform?: NodeJS.Platform;
  readonly runCommand?: (request: CiInstallCommandRequest) => Promise<number>;
}

export function resolveBootstrapNpmCommand(
  platform: NodeJS.Platform,
  nodeExecutable: string,
  environment: NodeJS.ProcessEnv,
  inspectEntry?: (entryPath: string) => CiInstallEntryIdentity,
): CiInstallCommand;

export class CiInstallCoordinator {
  public constructor(options?: CiInstallCoordinatorOptions);
  public install(): Promise<void>;
}
