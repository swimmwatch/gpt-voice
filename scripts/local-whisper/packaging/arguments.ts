export function parseOptions(arguments_: readonly string[]): ReadonlyMap<string, string> {
  const options = new Map<string, string>();
  for (const argument of arguments_) {
    if (!argument.startsWith('--') || !argument.includes('=')) throw new Error(`Invalid option: ${argument}`);
    const separator = argument.indexOf('=');
    const key = argument.slice(2, separator);
    const value = argument.slice(separator + 1);
    if (!key || !value || options.has(key)) throw new Error(`Invalid or duplicate option: ${argument}`);
    options.set(key, value);
  }
  return options;
}

export function requiredOption(options: ReadonlyMap<string, string>, key: string): string {
  const value = options.get(key);
  if (!value) throw new Error(`Missing required --${key}=... option`);
  return value;
}

export function assertOnlyOptions(options: ReadonlyMap<string, string>, allowed: readonly string[]): void {
  for (const key of options.keys()) {
    if (!allowed.includes(key)) throw new Error(`Unknown option: --${key}`);
  }
}
