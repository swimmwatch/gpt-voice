export type SecretFindingSeverity = 'advisory' | 'blocking';

export interface RepositoryTextFile {
  readonly path: string;
  readonly text: string;
}

export interface RepositorySecretFinding {
  readonly path: string;
  readonly rule: 'entropy' | 'github-token' | 'openai-api-key' | 'private-key';
  readonly severity: SecretFindingSeverity;
}

const GENERATED_ROOT_MARKER = '.generated-root';
const GENERATED_ROOT_PREFIXES = ['build/generated/', 'dist/', 'release/', 'release-artifacts/'] as const;
const MAXIMUM_TEXT_FILE_BYTES = 1024 * 1024;
const PRIVATE_KEY_BLOCK = /-{5}BEGIN (?:[A-Z]+ )?PRIVATE KEY-{5}[\s\S]*?-{5}END (?:[A-Z]+ )?PRIVATE KEY-{5}/u;
const GITHUB_TOKEN = /\bgh[pousr]_[A-Za-z\d]{36,255}\b/u;
const OPENAI_API_KEY = /\bsk-(?:proj-)?[A-Za-z\d_-]{20,255}\b/u;
const ENTROPY_CANDIDATE = /\b[A-Za-z\d+/_-]{40,255}\b/gu;
const ENTROPY_THRESHOLD = 3.6;

function isGeneratedPath(filePath: string, files: ReadonlyMap<string, string>): boolean {
  const prefix = GENERATED_ROOT_PREFIXES.find((candidate) => filePath.startsWith(candidate));
  if (!prefix) return false;
  return files.get(`${prefix}${GENERATED_ROOT_MARKER}`) === 'gpt-voice-generated-root-v1\n';
}

function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((total, count) => {
    const probability = count / value.length;
    return total - probability * Math.log2(probability);
  }, 0);
}

function containsHighEntropyCandidate(text: string): boolean {
  ENTROPY_CANDIDATE.lastIndex = 0;
  for (const candidate of text.matchAll(ENTROPY_CANDIDATE)) {
    if (entropy(candidate[0]) >= ENTROPY_THRESHOLD) return true;
  }
  return false;
}

function createFinding(
  path: string,
  rule: RepositorySecretFinding['rule'],
  severity: SecretFindingSeverity,
): RepositorySecretFinding {
  return Object.freeze({ path, rule, severity });
}

/** Detects high-confidence repository secrets without retaining or emitting a matched value. */
export class RepositorySecretPolicy {
  public scan(files: readonly RepositoryTextFile[]): readonly RepositorySecretFinding[] {
    const byPath = new Map<string, string>();
    for (const file of files) {
      if (!this.isSafeRepositoryPath(file.path) || file.text.length > MAXIMUM_TEXT_FILE_BYTES) {
        throw new Error('Repository secret policy violation: invalid repository text input');
      }
      if (byPath.has(file.path)) {
        throw new Error('Repository secret policy violation: invalid repository text input');
      }
      byPath.set(file.path, file.text);
    }

    const findings: RepositorySecretFinding[] = [];
    for (const file of files) {
      if (isGeneratedPath(file.path, byPath)) continue;
      if (GITHUB_TOKEN.test(file.text)) findings.push(createFinding(file.path, 'github-token', 'blocking'));
      if (OPENAI_API_KEY.test(file.text)) findings.push(createFinding(file.path, 'openai-api-key', 'blocking'));
      if (PRIVATE_KEY_BLOCK.test(file.text)) findings.push(createFinding(file.path, 'private-key', 'blocking'));
      if (containsHighEntropyCandidate(file.text)) findings.push(createFinding(file.path, 'entropy', 'advisory'));
    }
    return Object.freeze(
      findings.sort(
        (left, right) => left.path.localeCompare(right.path, 'en') || left.rule.localeCompare(right.rule, 'en'),
      ),
    );
  }

  public assertNoBlockingFindings(files: readonly RepositoryTextFile[]): readonly RepositorySecretFinding[] {
    const findings = this.scan(files);
    if (findings.some((finding) => finding.severity === 'blocking')) {
      throw new Error('Repository secret policy violation: high-confidence secret detected');
    }
    return findings;
  }

  private isSafeRepositoryPath(filePath: string): boolean {
    return (
      filePath.length > 0 &&
      !filePath.startsWith('/') &&
      !filePath.includes('\\') &&
      !filePath.split('/').some((segment) => segment === '.' || segment === '..' || segment.length === 0)
    );
  }
}
