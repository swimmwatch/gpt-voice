export const RELEASE_CONTRACT = Object.freeze({
  baseBranch: 'main',
  candidateLabel: 'task32-alpha1-watch',
  environment: 'local-whisper-production',
  featureBranch: 'feat/local-whisper-provider',
  releaseBranch: 'release/v2.4.0-alpha.1',
  releaseTag: 'v2.4.0-alpha.1',
  repository: 'swimmwatch/gpt-voice',
  version: '2.4.0-alpha.1',
  workflow: 'release-builds.yml',
});

export const RELEASE_PHASES = Object.freeze([
  'task32-candidate',
  'merge-feature',
  'prepare-release',
  'release-pr-checks',
  'release-candidate',
  'merge-release',
  'publish-release',
  'succeeded',
  'blocked',
]);

export const RELEASE_STATE_SCHEMA_VERSION = 1;
export const RELEASE_POLL_INTERVAL_MILLISECONDS = 20_000;
export const RELEASE_PULL_REQUEST_DISCOVERY_INTERVAL_MILLISECONDS = 5_000;
export const RELEASE_PULL_REQUEST_DISCOVERY_TIMEOUT_MILLISECONDS = 60_000;
export const RELEASE_COMMAND_TIMEOUT_MILLISECONDS = 120_000;
export const RELEASE_BUNDLE_FILES = Object.freeze([
  'bundle.mjs',
  'cli.mjs',
  'command-runner.mjs',
  'constants.mjs',
  'git-repository.mjs',
  'github-release-client.mjs',
  'release-orchestrator.mjs',
  'release-preparation.mjs',
  'state-store.mjs',
  'verified-release-lifecycle.mjs',
]);

export const RELEASE_REPAIRABLE_BRANCHES = Object.freeze([
  RELEASE_CONTRACT.featureBranch,
  RELEASE_CONTRACT.releaseBranch,
]);

export const EXIT_CODES = Object.freeze({ blocked: 78, failed: 1, succeeded: 0 });
