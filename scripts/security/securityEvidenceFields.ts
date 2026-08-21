import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

const SHA256 = /^[a-f0-9]{64}$/u;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;

/** Identifies a security-policy JSON object. */
export function isSecurityRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Encodes one security evidence value with the canonical catalog serializer. */
export function canonicalSecurityEvidenceBytes(value: unknown): Buffer {
  return Buffer.from(serializeCanonicalLocalWhisperCatalogJson(value), 'utf8');
}

/** Owns security field validation while delegating error vocabulary to its policy. */
export class SecurityEvidenceFields {
  public constructor(private readonly invalid: (code: string) => never) {}

  public exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[], code: string): void {
    const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'));
    const expected = [...keys].sort((left, right) => left.localeCompare(right, 'en'));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) this.invalid(code);
  }

  public sha256(value: unknown, code: string): string {
    if (typeof value !== 'string' || !SHA256.test(value)) this.invalid(code);
    return value;
  }

  public sourceCommit(value: unknown, code: string): string {
    if (typeof value !== 'string' || !SOURCE_COMMIT.test(value)) this.invalid(code);
    return value;
  }
}
