export type SecurityCommandPlatform = 'linux' | 'win32';

/** Preserves a command failure cause without changing its bounded public message. */
export function securityErrorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'cause', { configurable: true, value: cause });
  return error;
}

/** Owns bounded `--name=value` parsing for security command entrypoints. */
export class SecurityCommandOptions {
  public constructor(
    private readonly arguments_: readonly string[],
    private readonly invalid: () => never,
  ) {}

  public optional(name: string): string | null {
    const prefix = `--${name}=`;
    const values = this.arguments_.filter((argument_) => argument_.startsWith(prefix));
    if (values.length > 1) this.invalid();
    return values.length === 1 ? (values[0]?.slice(prefix.length) ?? null) : null;
  }

  public required(name: string): string {
    const value = this.optional(name);
    if (!value) this.invalid();
    return value;
  }

  public platform(): SecurityCommandPlatform {
    const value = this.required('platform');
    if (value !== 'linux' && value !== 'win32') this.invalid();
    return value;
  }
}
