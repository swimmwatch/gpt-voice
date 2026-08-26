function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidUnicodeScalars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Produces the sole deterministic JSON representation accepted by Local Whisper signed documents. */
export function serializeCanonicalLocalWhisperCatalogJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (!hasValidUnicodeScalars(value)) throw new TypeError('Invalid catalog value');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError('Invalid catalog value');
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeCanonicalLocalWhisperCatalogJson(entry)).join(',')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map(
        (key) =>
          `${serializeCanonicalLocalWhisperCatalogJson(key)}:${serializeCanonicalLocalWhisperCatalogJson(value[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  throw new TypeError('Invalid catalog value');
}
