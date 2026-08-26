import { createHash } from 'node:crypto';

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

export const TRACKED_TEXT_GIT_ARGUMENTS = Object.freeze(['grep', '-Il', '-z', '-e', '', '--', '.']);

const GENERATED_ROOT_MARKER = '.generated-root';
const GENERATED_ROOT_PREFIXES = ['build/generated/', 'dist/', 'release/', 'release-artifacts/'] as const;
const MAXIMUM_TEXT_FILE_BYTES = 1024 * 1024;
const PRIVATE_KEY_BLOCK = /-{5}BEGIN (?:[A-Z]+ )?PRIVATE KEY-{5}[\s\S]*?-{5}END (?:[A-Z]+ )?PRIVATE KEY-{5}/gu;
const GITHUB_TOKEN = /\bgh[pousr]_[A-Za-z\d]{36,255}\b/gu;
const OPENAI_API_KEY = /\bsk-(?:proj-)?[\w-]{20,255}\b/gu;
const ENTROPY_CANDIDATE = /\b[\w+/-]{40,255}\b/gu;
const ENTROPY_THRESHOLD = 3.6;

const APPROVED_SYNTHETIC_SECRET_DIGESTS = Object.freeze({
  'tests/main/diagnosticCaptureIntegration.test.ts': Object.freeze({
    'openai-api-key': Object.freeze(['b45a6fb1f008cc85df16d48345d4ca97cb57788ab272f3dec504add438f18de2']),
  }),
  'tests/main/diagnosticCaptureStorage.test.ts': Object.freeze({
    'openai-api-key': Object.freeze(['b45a6fb1f008cc85df16d48345d4ca97cb57788ab272f3dec504add438f18de2']),
  }),
  'tests/main/diagnosticsArchive.test.ts': Object.freeze({
    'openai-api-key': Object.freeze(['6c3c2a497028c099f67bf4786ff65aeb13dbbf1cb1e3741d76d3ce0877961bd0']),
  }),
  'tests/main/diagnosticTextRedactor.test.ts': Object.freeze({
    'openai-api-key': Object.freeze(['b45a6fb1f008cc85df16d48345d4ca97cb57788ab272f3dec504add438f18de2']),
    'private-key': Object.freeze(['15501cbfa9cbf1bd13dd9730fcd8b92023dbece064b628710e0df4d54d1fc10e']),
  }),
  'tests/main/providerAuditPrivacy.test.ts': Object.freeze({
    'openai-api-key': Object.freeze(['c504ff3127ef3b000be542df4d4f37bd221ee9f446af8395b55548ab009ea4a4']),
  }),
} as const);

type BlockingSecretRule = Exclude<RepositorySecretFinding['rule'], 'entropy'>;

function approvedSyntheticSecret(filePath: string, rule: BlockingSecretRule, value: string): boolean {
  const fileAllowlist = APPROVED_SYNTHETIC_SECRET_DIGESTS[filePath as keyof typeof APPROVED_SYNTHETIC_SECRET_DIGESTS];
  if (!fileAllowlist) return false;
  const digests = (fileAllowlist as Partial<Record<BlockingSecretRule, readonly string[]>>)[rule];
  if (!digests) return false;
  const digest = createHash('sha256').update(value, 'utf8').digest('hex');
  return digests.includes(digest);
}

function hasUnapprovedMatch(file: RepositoryTextFile, rule: BlockingSecretRule, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  for (const match of file.text.matchAll(pattern)) {
    if (!approvedSyntheticSecret(file.path, rule, match[0])) return true;
  }
  return false;
}

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
      if (hasUnapprovedMatch(file, 'github-token', GITHUB_TOKEN))
        findings.push(createFinding(file.path, 'github-token', 'blocking'));
      if (hasUnapprovedMatch(file, 'openai-api-key', OPENAI_API_KEY))
        findings.push(createFinding(file.path, 'openai-api-key', 'blocking'));
      if (hasUnapprovedMatch(file, 'private-key', PRIVATE_KEY_BLOCK))
        findings.push(createFinding(file.path, 'private-key', 'blocking'));
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
