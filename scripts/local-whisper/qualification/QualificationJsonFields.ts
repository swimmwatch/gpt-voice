/** Identifies a non-null, non-array JSON object. */
export function isQualificationRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Compares a JSON object's complete key set independent of key order. */
export function hasExactQualificationKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right, 'en'));
  return JSON.stringify(actual) === JSON.stringify(sortedExpected);
}

/** Identifies an integer inside the caller's inclusive qualification range. */
export function isQualificationSafeInteger(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

/** Requires a JSON object while preserving the caller-owned qualification error code. */
export function requireQualificationRecord(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (!isQualificationRecord(value)) throw new Error(code);
  return value;
}

/** Requires a string-valued field while preserving the caller-owned qualification error code. */
export function requireQualificationStringField(
  value: Readonly<Record<string, unknown>>,
  field: string,
  code: string,
): string {
  const result = value[field];
  if (typeof result !== 'string') throw new Error(code);
  return result;
}
