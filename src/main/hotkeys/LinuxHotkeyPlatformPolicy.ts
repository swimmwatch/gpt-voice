import { HotkeyBindingAuthority } from '@shared/hotkeys';

import { HotkeyPlatformPolicy, type HotkeyPlatformPolicyResult } from './HotkeyPlatformPolicy';

/** Accepts normalized accelerators for a qualified Linux X11 Electron integration. */
export class LinuxHotkeyPlatformPolicy extends HotkeyPlatformPolicy {
  public validate(normalizedAccelerator: string): HotkeyPlatformPolicyResult {
    return Object.freeze({
      accepted: true,
      bindingAuthority: HotkeyBindingAuthority.Application,
      effectiveAccelerator: normalizedAccelerator,
    });
  }
}
