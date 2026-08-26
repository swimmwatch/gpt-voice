import { normalizeProcessWatchInvocation } from './process-watch-invocation.mjs';
import { validateDigest, validateSafeId, validateWatchId } from './runtime-state-contracts.mjs';
import { freezeRecord, isRecord, runtimeFail } from './runtime-core-support.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

export const GENERATED_WATCHER_INVOCATION_FILE_NAME = 'invocation.json';

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function normalizeEnvelope(value, { scenario, scenarioDigest, watchId }) {
  const envelope = assertClosedRecord(
    value,
    new Set(['invocation', 'scenarioDigest', 'scenarioId', 'sessionId', 'watchId', 'workspaceId']),
    'invalid-generated-watcher-invocation',
  );
  for (const field of ['invocation', 'scenarioDigest', 'scenarioId', 'sessionId', 'watchId', 'workspaceId']) {
    if (!Object.hasOwn(envelope, field)) runtimeFail('invalid-generated-watcher-invocation');
  }
  const normalizedWatchId = validateWatchId(watchId, 'invalid-generated-watcher-invocation');
  if (
    validateWatchId(envelope.watchId, 'invalid-generated-watcher-invocation') !== normalizedWatchId ||
    validateWatchId(envelope.scenarioId, 'invalid-generated-watcher-invocation') !== scenario.id ||
    validateDigest(envelope.scenarioDigest, 'invalid-generated-watcher-invocation') !== scenarioDigest
  ) {
    runtimeFail('generated-watcher-invocation-mismatch');
  }
  return freezeRecord({
    invocation: normalizeProcessWatchInvocation(envelope.invocation, scenario),
    scenarioDigest,
    scenarioId: scenario.id,
    sessionId: validateSafeId(envelope.sessionId, 'invalid-generated-watcher-invocation'),
    watchId: normalizedWatchId,
    workspaceId: validateSafeId(envelope.workspaceId, 'invalid-generated-watcher-invocation'),
  });
}

/** Owns the private, bounded watcher input envelope; it contains no commands or evidence. */
export class GeneratedWatcherInvocationStore {
  #storage;

  constructor({ storage } = {}) {
    if (!(storage instanceof WatchRuntimeStorage)) runtimeFail('invalid-generated-watcher-invocation-store');
    this.#storage = storage;
  }

  get storage() {
    return this.#storage;
  }

  async write({ invocation, scenario, scenarioDigest, sessionId, workspaceId } = {}) {
    if (!isRecord(scenario) || typeof scenario.id !== 'string') runtimeFail('invalid-generated-watcher-invocation');
    const envelope = normalizeEnvelope(
      {
        invocation,
        scenarioDigest,
        scenarioId: scenario.id,
        sessionId,
        watchId: this.#storage.watchId,
        workspaceId,
      },
      {
        scenario,
        scenarioDigest: validateDigest(scenarioDigest, 'invalid-generated-watcher-invocation'),
        watchId: this.#storage.watchId,
      },
    );
    await this.#storage.writeJson(GENERATED_WATCHER_INVOCATION_FILE_NAME, envelope);
    return envelope;
  }

  async read({ scenario, scenarioDigest } = {}) {
    if (!isRecord(scenario) || typeof scenario.id !== 'string') runtimeFail('invalid-generated-watcher-invocation');
    const raw = await this.#storage.readJson(GENERATED_WATCHER_INVOCATION_FILE_NAME);
    if (raw === null) runtimeFail('generated-watcher-invocation-missing');
    return normalizeEnvelope(raw, {
      scenario,
      scenarioDigest: validateDigest(scenarioDigest, 'invalid-generated-watcher-invocation'),
      watchId: this.#storage.watchId,
    });
  }
}
