const TOKEN_PATTERN = /\p{L}+(?:'\p{L}+)*|\p{Nd}+/gu;
const PEAK_QUANTUM_BYTES = 64 * 1024 * 1024;

export type QualificationLocale = 'en_us' | 'ru_ru';

function localeName(locale: QualificationLocale): string {
  return locale === 'en_us' ? 'en-US' : 'ru-RU';
}

/** Applies the frozen Section 19.2 Unicode/case/token contract. */
export function qualificationTokens(text: string, locale: QualificationLocale): readonly string[] {
  const normalized = text
    .normalize('NFKC')
    .replace(/\u2019/gu, "'")
    .toLocaleLowerCase(localeName(locale));
  return Object.freeze([...(normalized.matchAll(TOKEN_PATTERN) ?? [])].map((match) => match[0]));
}

/** Computes unit-cost token Levenshtein distance with bounded linear memory. */
export function qualificationEditDistance(left: readonly string[], right: readonly string[]): number {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  let previous = Array.from({ length: shorter.length + 1 }, (_unused, index) => index);
  for (let longerIndex = 1; longerIndex <= longer.length; longerIndex += 1) {
    const current = [longerIndex];
    for (let shorterIndex = 1; shorterIndex <= shorter.length; shorterIndex += 1) {
      const substitution =
        previous[shorterIndex - 1]! + (longer[longerIndex - 1] === shorter[shorterIndex - 1] ? 0 : 1);
      current.push(Math.min(previous[shorterIndex]! + 1, current[shorterIndex - 1]! + 1, substitution));
    }
    previous = current;
  }
  return previous[shorter.length]!;
}

export function qualificationWerPercentage(
  rows: readonly {
    readonly locale: QualificationLocale;
    readonly reference: string;
    readonly hypothesis: string;
  }[],
): number {
  let edits = 0;
  let references = 0;
  for (const row of rows) {
    const reference = qualificationTokens(row.reference, row.locale);
    const hypothesis = qualificationTokens(row.hypothesis, row.locale);
    if (reference.length === 0) throw new Error('Qualification WER reference is empty');
    edits += qualificationEditDistance(reference, hypothesis);
    references += reference.length;
  }
  if (references === 0) throw new Error('Qualification WER corpus is empty');
  return (edits / references) * 100;
}

export function qualificationMedian(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Qualification median input is invalid');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export function roundQualificationPeakBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Qualification peak is invalid');
  return Math.ceil(value / PEAK_QUANTUM_BYTES) * PEAK_QUANTUM_BYTES;
}
