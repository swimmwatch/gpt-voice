import {
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  runtimeFail,
} from './runtime-core-support.mjs';
import { validateSafeId, validateWatchId } from './runtime-state-contracts.mjs';

export const REPAIR_CONTROL_SCHEMA_VERSION = 1;
export const REPAIR_OWNERSHIP_FILE_NAME = 'repair-ownership.json';
export const REPAIR_VERIFICATION_RECEIPTS_FILE_NAME = 'repair-verification-receipts.json';
export const REPAIR_DELIVERY_FILE_NAME = 'repair-delivery.json';
export const REPAIR_CANCELLATION_FILE_NAME = 'repair-cancellation.json';

/** Private artifacts whose lifecycle belongs to one repair controller. */
export const REPAIR_RUNTIME_FILE_NAMES = freezeArray([
  REPAIR_OWNERSHIP_FILE_NAME,
  REPAIR_VERIFICATION_RECEIPTS_FILE_NAME,
  REPAIR_DELIVERY_FILE_NAME,
  REPAIR_CANCELLATION_FILE_NAME,
]);

/** Validates the shared watcher/repair cancellation marker without accepting arbitrary text. */
export function normalizeProcessWatchCancellation(value, { sessionId, watchId }) {
  if (!isRecord(value) || Object.keys(value).length !== 4) runtimeFail('repair-cancellation-corrupt');
  if (
    value.schemaVersion !== REPAIR_CONTROL_SCHEMA_VERSION ||
    validateSafeId(value.sessionId, 'repair-cancellation-corrupt') !== sessionId ||
    validateWatchId(value.watchId, 'repair-cancellation-corrupt') !== watchId ||
    typeof value.requestedAtEpochMilliseconds !== 'number'
  ) {
    runtimeFail('repair-cancellation-corrupt');
  }
  requireNonNegativeInteger(value.requestedAtEpochMilliseconds, 'repair-cancellation-corrupt', Number.MAX_SAFE_INTEGER);
  return freezeRecord({
    requestedAtEpochMilliseconds: value.requestedAtEpochMilliseconds,
    schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION,
    sessionId,
    watchId,
  });
}
