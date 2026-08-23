import { freezeRecord, runtimeFail } from '../runtime-core-support.mjs';

import { isSuccessfulCommandResult } from './adapter-support.mjs';

/**
 * The scenario schema names required outputs but intentionally contains no
 * executable predicate language. This verifier accepts them only when at least
 * one declared command has independently succeeded; raw output is never parsed.
 */
export class DeclaredOutputVerifier {
  async preflight({ requiredOutputs, verificationCount } = {}) {
    if (!Array.isArray(requiredOutputs) || !Number.isSafeInteger(verificationCount) || verificationCount < 0) {
      runtimeFail('invalid-output-verifier-request');
    }
    return freezeRecord({ supported: requiredOutputs.length === 0 || verificationCount > 0 });
  }

  async verify({ requiredOutputs, verificationResults } = {}) {
    if (!Array.isArray(requiredOutputs) || !Array.isArray(verificationResults)) {
      runtimeFail('invalid-output-verifier-request');
    }
    const allSucceeded = verificationResults.every((result) => isSuccessfulCommandResult(result));
    const hasRequiredProof = requiredOutputs.length === 0 || verificationResults.length > 0;
    return freezeRecord({
      code: allSucceeded && hasRequiredProof ? 'output-verified' : 'output-verification-failed',
      succeeded: allSucceeded && hasRequiredProof,
    });
  }
}
