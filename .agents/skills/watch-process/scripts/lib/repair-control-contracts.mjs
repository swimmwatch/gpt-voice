import { freezeArray } from './runtime-core-support.mjs';

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
