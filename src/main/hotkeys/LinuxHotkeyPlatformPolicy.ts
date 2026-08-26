import { HotkeyBindingAuthority, LinuxSessionType } from '@shared/hotkeys';

import { HotkeyPlatformPolicy, type HotkeyPlatformPolicyResult } from './HotkeyPlatformPolicy';

/** Owns the normalized shortcut result contract for qualified Linux desktop sessions. */
export class LinuxHotkeyPlatformPolicy extends HotkeyPlatformPolicy {
  public constructor(private readonly session: LinuxSessionType.X11 | LinuxSessionType.Wayland) {
    super();
  }

  public validate(normalizedAccelerator: string): HotkeyPlatformPolicyResult {
    if (this.session === LinuxSessionType.Wayland) {
      return Object.freeze({
        accepted: true,
        bindingAuthority: HotkeyBindingAuthority.DesktopEnvironment,
        effectiveAccelerator: null,
      });
    }

    return Object.freeze({
      accepted: true,
      bindingAuthority: HotkeyBindingAuthority.Application,
      effectiveAccelerator: normalizedAccelerator,
    });
  }
}
