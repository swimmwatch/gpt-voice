import { HotkeyRegistrationFailureCode } from '@shared/hotkeys';

import { HotkeyPlatformPolicy, type HotkeyPlatformPolicyResult } from './HotkeyPlatformPolicy';

/** Keeps hosts without an explicitly qualified integration fail-closed. */
export class UnsupportedHotkeyPlatformPolicy extends HotkeyPlatformPolicy {
  public validate(_normalizedAccelerator: string): HotkeyPlatformPolicyResult {
    return Object.freeze({ accepted: false, failureCode: HotkeyRegistrationFailureCode.UnsupportedPlatform });
  }
}
