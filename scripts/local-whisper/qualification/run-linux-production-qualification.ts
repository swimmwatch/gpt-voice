import { createLinuxProductionQualificationOrchestrator } from './LinuxProductionQualificationOrchestrator';

const REQUIRED_ARGUMENTS = Object.freeze([
  'advisory-evidence-dir',
  'cache-root',
  'candidate-semver',
  'candidate-worktree',
  'evidence-root',
  'freeze-timestamp-utc',
  'predecessor-appimage',
  'private-run-root',
  'source-commit',
  'workspace-root',
] as const);

function parseArguments(arguments_: readonly string[]): Readonly<Record<(typeof REQUIRED_ARGUMENTS)[number], string>> {
  const values = new Map<string, string>();
  for (const argument of arguments_) {
    const separator = argument.indexOf('=');
    if (!argument.startsWith('--') || separator < 3) throw new Error('Linux qualification argument invalid');
    const key = argument.slice(2, separator);
    const value = argument.slice(separator + 1);
    if (!REQUIRED_ARGUMENTS.includes(key as (typeof REQUIRED_ARGUMENTS)[number]) || value === '' || values.has(key)) {
      throw new Error('Linux qualification argument invalid');
    }
    values.set(key, value);
  }
  if (values.size !== REQUIRED_ARGUMENTS.length || REQUIRED_ARGUMENTS.some((key) => !values.has(key))) {
    throw new Error('Linux qualification arguments incomplete');
  }
  return Object.freeze(
    Object.fromEntries(REQUIRED_ARGUMENTS.map((key) => [key, values.get(key)])) as Record<
      (typeof REQUIRED_ARGUMENTS)[number],
      string
    >,
  );
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  const output = await createLinuxProductionQualificationOrchestrator().run({
    advisoryEvidenceDirectory: arguments_['advisory-evidence-dir'],
    cacheRoot: arguments_['cache-root'],
    candidateSemVer: arguments_['candidate-semver'],
    candidateWorktree: arguments_['candidate-worktree'],
    freezeTimestampUtc: arguments_['freeze-timestamp-utc'],
    predecessorAppImagePath: arguments_['predecessor-appimage'],
    privateRunRoot: arguments_['private-run-root'],
    qualificationRoot: arguments_['evidence-root'],
    sourceCommit: arguments_['source-commit'],
    workspaceRoot: arguments_['workspace-root'],
  });
  process.stdout.write(
    `Local Whisper Linux production qualification: Pass; candidateInputDigest=${output.state.candidateInputDigest}; resultDigest=${output.result.resultDigest}; evidenceIndexDigest=${output.result.evidenceIndexDigest}\n`,
  );
}

void main();
