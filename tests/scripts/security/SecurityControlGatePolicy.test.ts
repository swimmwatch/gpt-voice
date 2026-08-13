import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BLOCKING_SECURITY_CONTROLS,
  SecurityControlGatePolicy,
  type BlockingSecurityControl,
} from '@scripts/security/securityControlGatePolicy';

function cleanControls(): Record<BlockingSecurityControl, 'clean'> {
  return Object.fromEntries(BLOCKING_SECURITY_CONTROLS.map((control) => [control, 'clean'])) as Record<
    BlockingSecurityControl,
    'clean'
  >;
}

describe('Security control aggregate gate policy', () => {
  for (const boundary of ['merge', 'freeze', 'qualification', 'release-candidate'] as const) {
    it(`accepts complete clean evidence at ${boundary}`, () => {
      assert.equal(
        new SecurityControlGatePolicy().verify({ boundary, controls: cleanControls(), scorecard: 'clean' }),
        'scorecard-clean',
      );
    });
  }

  for (const control of BLOCKING_SECURITY_CONTROLS) {
    for (const result of ['affected', 'malformed', 'unavailable'] as const) {
      it(`fails closed for ${control} ${result} evidence`, () => {
        assert.throws(
          () =>
            new SecurityControlGatePolicy().verify({
              boundary: 'merge',
              controls: { ...cleanControls(), [control]: result },
              scorecard: 'clean',
            }),
          (error: unknown) =>
            error instanceof Error &&
            error.message === `SECURITY_CONTROL_GATE_${control.toUpperCase().replace(/-/gu, '_')}_FAILED`,
        );
      });
    }
  }

  it('keeps affected, malformed, and unavailable Scorecard reports visibly advisory', () => {
    for (const scorecard of ['affected', 'malformed', 'unavailable'] as const) {
      assert.equal(
        new SecurityControlGatePolicy().verify({ boundary: 'merge', controls: cleanControls(), scorecard }),
        'scorecard-advisory',
      );
    }
  });
});
