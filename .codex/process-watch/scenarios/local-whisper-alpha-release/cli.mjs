#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';

import { assertReleaseBundleDigest, releaseBundleDigest } from './bundle.mjs';
import { ReleaseCommandRunner } from './command-runner.mjs';
import { EXIT_CODES } from './constants.mjs';
import { ReleaseGitRepository } from './git-repository.mjs';
import { ReleaseGitHubClient } from './github-release-client.mjs';
import { LocalWhisperAlphaReleaseOrchestrator, ReleaseBlockedError } from './release-orchestrator.mjs';
import { ReleasePreparationWriter } from './release-preparation.mjs';
import { ReleaseStateStore } from './state-store.mjs';
import { VerifiedReleaseLifecycle } from './verified-release-lifecycle.mjs';
import {
  VersionScopedReleaseRecoveryPermitStore,
  WatchRuntimeStorage,
} from '../../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';

function parseArguments(arguments_) {
  const [command, ...options] = arguments_;
  if (!['bundle-digest', 'run', 'verify-final'].includes(command)) throw new Error('release-command-invalid');
  const values = new Map();
  for (let index = 0; index < options.length; index += 2) {
    const name = options[index];
    const value = options[index + 1];
    if (!name?.startsWith('--') || value === undefined || values.has(name)) throw new Error('release-option-invalid');
    values.set(name, value);
  }
  return Object.freeze({ command, values });
}

function required(values, name, pattern) {
  const value = values.get(name);
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('release-option-invalid');
  return value;
}

function reportSuccess(state) {
  process.stdout.write(`LOCAL_WHISPER_ALPHA_RELEASE_SUCCEEDED:${state.releaseTag}:${state.promotionRun.databaseId}\n`);
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.command === 'bundle-digest') {
    if (parsed.values.size !== 0) throw new Error('release-option-invalid');
    process.stdout.write(`${await releaseBundleDigest()}\n`);
    return;
  }
  const watchId = required(parsed.values, '--watch-id', /^[a-z][a-z0-9-]{2,63}$/u);
  const bundleSha256 = required(parsed.values, '--bundle-sha256', /^[a-f\d]{64}$/u);
  await assertReleaseBundleDigest(bundleSha256);
  const expectedOptionCount = parsed.command === 'run' ? 3 : 2;
  if (parsed.values.size !== expectedOptionCount) throw new Error('release-option-invalid');
  const workspaceRoot = path.resolve(process.cwd());
  const runner = new ReleaseCommandRunner({ cwd: workspaceRoot });
  const stateStore = new ReleaseStateStore({ watchId, workspaceRoot });
  const orchestrator = new LocalWhisperAlphaReleaseOrchestrator({
    git: new ReleaseGitRepository({ runner }),
    github: new ReleaseGitHubClient({ runner }),
    preparation: new ReleasePreparationWriter({ workspaceRoot }),
    stateStore,
  });
  if (parsed.command === 'verify-final') {
    const state = await orchestrator.verifyFinal();
    reportSuccess(state);
    return;
  }
  const timeoutSeconds = Number(required(parsed.values, '--timeout-seconds', /^[1-9]\d{0,5}$/u));
  if (!Number.isSafeInteger(timeoutSeconds) || timeoutSeconds < 3_600 || timeoutSeconds > 21_600) {
    throw new Error('release-timeout-invalid');
  }
  const recoveryPermit = await new VersionScopedReleaseRecoveryPermitStore({
    storage: new WatchRuntimeStorage({ watchId, workspaceRoot }),
  }).read();
  if (recoveryPermit !== null) await stateStore.renewForExplicitRecovery(recoveryPermit);
  const state = await new VerifiedReleaseLifecycle({ orchestrator }).execute({ timeoutSeconds, watchId });
  reportSuccess(state);
}

main().catch((error) => {
  const code =
    typeof (error?.code ?? error?.message) === 'string' && /^[a-z][a-z0-9-]{2,95}$/u.test(error.code ?? error.message)
      ? (error.code ?? error.message)
      : 'release-process-failed';
  process.stderr.write(`LOCAL_WHISPER_ALPHA_RELEASE_${error instanceof ReleaseBlockedError ? 'BLOCKED' : 'FAILED'}:${code}\n`);
  process.exitCode = error instanceof ReleaseBlockedError ? EXIT_CODES.blocked : EXIT_CODES.failed;
});
