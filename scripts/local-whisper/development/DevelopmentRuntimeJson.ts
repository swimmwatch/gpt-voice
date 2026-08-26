/** Identifies a development-runtime JSON object. */
export function isDevelopmentRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks the complete development-runtime JSON key set without allocating a sorted copy. */
export function hasExactDevelopmentRuntimeKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}
