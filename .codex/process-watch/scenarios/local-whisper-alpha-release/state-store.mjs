import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { VERSION_SCOPED_RELEASE_STATE_FILE_NAME } from '../../../../.agents/skills/watch-process/scripts/lib/version-scoped-release-source-binding.mjs';

import { RELEASE_CONTRACT, RELEASE_PHASES, RELEASE_STATE_SCHEMA_VERSION } from './constants.mjs';

const WATCH_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/u;
const SHA_PATTERN = /^[a-f\d]{40}$/u;
const DIGEST_PATTERN = /^[a-f\d]{64}$/u;
const FAILURE_CODE_PATTERN = /^[a-z][a-z0-9-]{2,95}$/u;

function validRun(run) {
  return (
    run === null ||
    (typeof run === 'object' &&
      Number.isSafeInteger(run.databaseId) &&
      run.databaseId > 0 &&
      SHA_PATTERN.test(run.headSha) &&
      run.status === 'completed' &&
      run.conclusion === 'success')
  );
}

function assertState(state, watchId) {
  if (
    state === null ||
    typeof state !== 'object' ||
    state.schemaVersion !== RELEASE_STATE_SCHEMA_VERSION ||
    state.watchId !== watchId ||
    state.releaseTag !== RELEASE_CONTRACT.releaseTag ||
    !RELEASE_PHASES.includes(state.phase) ||
    !Number.isSafeInteger(state.startedAtEpochMilliseconds) ||
    !Number.isSafeInteger(state.deadlineEpochMilliseconds) ||
    !Number.isSafeInteger(state.timeoutSeconds) ||
    state.timeoutSeconds < 3_600 ||
    state.timeoutSeconds > 21_600 ||
    state.startedAtEpochMilliseconds + state.timeoutSeconds * 1_000 !== state.deadlineEpochMilliseconds ||
    (state.sourceSha !== null && !SHA_PATTERN.test(state.sourceSha)) ||
    (state.failureCode !== null && !FAILURE_CODE_PATTERN.test(state.failureCode)) ||
    (state.completionDigest !== null && !DIGEST_PATTERN.test(state.completionDigest)) ||
    !validRun(state.task32Run) ||
    !validRun(state.candidateRun) ||
    !validRun(state.promotionRun)
  ) {
    throw new Error('release-state-invalid');
  }
  return state;
}

function normalizeRecoveryPermit(permit, watchId) {
  if (
    permit === null ||
    typeof permit !== 'object' ||
    permit.watchId !== watchId ||
    !SHA_PATTERN.test(permit.sourceSha) ||
    !Number.isSafeInteger(permit.deadlineEpochMilliseconds) ||
    !Number.isSafeInteger(permit.timeoutSeconds) ||
    permit.timeoutSeconds < 3_600 ||
    permit.timeoutSeconds > 21_600 ||
    permit.deadlineEpochMilliseconds < permit.timeoutSeconds * 1_000
  ) {
    throw new Error('release-recovery-permit-invalid');
  }
  return permit;
}

export class ReleaseStateStore {
  #directory;
  #file;
  #watchId;

  constructor({ watchId, workspaceRoot }) {
    if (!WATCH_ID_PATTERN.test(watchId)) throw new Error('release-watch-id-invalid');
    this.#watchId = watchId;
    this.#directory = path.join(workspaceRoot, '.codex', 'runtime', 'process-watch', watchId);
    this.#file = path.join(this.#directory, VERSION_SCOPED_RELEASE_STATE_FILE_NAME);
  }

  async read() {
    try {
      return assertState(JSON.parse(await readFile(this.#file, 'utf8')), this.#watchId);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async write(state) {
    assertState(state, this.#watchId);
    await mkdir(this.#directory, { mode: 0o700, recursive: true });
    const temporary = path.join(this.#directory, `state-${process.pid}.tmp`);
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.#file);
    return state;
  }

  /** Renews an expired release deadline only from the explicit recovery lease written by Watch resume. */
  async renewForExplicitRecovery(permit, { now = Date.now() } = {}) {
    const normalizedPermit = normalizeRecoveryPermit(permit, this.#watchId);
    if (!Number.isSafeInteger(now) || now < 0 || now >= normalizedPermit.deadlineEpochMilliseconds) {
      throw new Error('release-recovery-deadline-invalid');
    }
    const state = await this.read();
    if (state === null) return null;
    if (state.phase === 'succeeded') return state;
    if (
      state.deadlineEpochMilliseconds === normalizedPermit.deadlineEpochMilliseconds &&
      state.timeoutSeconds === normalizedPermit.timeoutSeconds
    ) {
      return state;
    }
    return await this.write({
      ...state,
      deadlineEpochMilliseconds: normalizedPermit.deadlineEpochMilliseconds,
      startedAtEpochMilliseconds: normalizedPermit.deadlineEpochMilliseconds - normalizedPermit.timeoutSeconds * 1_000,
      timeoutSeconds: normalizedPermit.timeoutSeconds,
    });
  }
}
