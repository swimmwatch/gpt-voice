import * as path from 'node:path';

export interface LinuxPerformancePrivateInputCommandValue {
  readonly workspaceRoot: string;
  readonly cacheRoot: string;
  readonly privateParent: string;
  readonly privateRunRoot: string;
}

const ARGUMENTS = ['workspace-root', 'cache-root', 'private-parent', 'private-run-root'] as const;

function invalid(): never {
  throw new Error('PRIVATE_INPUT_ARGUMENT_INVALID');
}

/** Parses the exact path-explicit private preflight contract without aliases. */
export class LinuxPerformancePrivateInputCommand {
  public static parse(argv: readonly string[]): LinuxPerformancePrivateInputCommandValue {
    if (argv.length !== ARGUMENTS.length) invalid();
    const values = new Map<string, string>();
    for (const argument of argv) {
      const match = /^--([a-z-]+)=([^\r\n]+)$/u.exec(argument);
      if (!match) invalid();
      const [, name, value] = match;
      if (!name || !value || !ARGUMENTS.includes(name as (typeof ARGUMENTS)[number]) || values.has(name)) invalid();
      values.set(name, value);
    }
    const resolved = ARGUMENTS.map((name) => {
      const value = values.get(name);
      if (!value || !path.isAbsolute(value) || value.length > 4096) invalid();
      return path.resolve(value);
    });
    return Object.freeze({
      workspaceRoot: resolved[0]!,
      cacheRoot: resolved[1]!,
      privateParent: resolved[2]!,
      privateRunRoot: resolved[3]!,
    });
  }
}
