export interface CorepackCommand {
  readonly executable: string;
  readonly argumentPrefix: readonly string[];
}

export interface CorepackEntryIdentity {
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export function resolveCorepackCommand(
  platform: NodeJS.Platform,
  nodeExecutable: string,
  inspectEntry?: (entryPath: string) => CorepackEntryIdentity,
): CorepackCommand;
