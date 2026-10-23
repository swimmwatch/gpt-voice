/** Distinguishes an allowlisted program's nonzero exit status from a launch failure. */
export class LinuxAlphaSmokeCommandExitError extends Error {
  public constructor(
    public readonly exitCode: number | null,
    public readonly signal: NodeJS.Signals | null,
  ) {
    super('ALPHA_SMOKE_LINUX_COMMAND_EXITED');
  }
}
