/** Requires a JSON object while preserving the caller-owned qualification error code. */
export function requireQualificationRecord(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
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
