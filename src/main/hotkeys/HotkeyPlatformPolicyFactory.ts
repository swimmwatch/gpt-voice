import { DesktopPlatform, LinuxSessionType } from '@shared/hotkeys';

import { HotkeyPlatformPolicy } from './HotkeyPlatformPolicy';
import { PausedMacosHotkeyPlatformPolicy } from './PausedMacosHotkeyPlatformPolicy';
import { UnsupportedHotkeyPlatformPolicy } from './UnsupportedHotkeyPlatformPolicy';

export interface HotkeyPlatformPolicyFactoryDependencies {
  readonly createLinuxPolicy?: (session: LinuxSessionType.X11 | LinuxSessionType.Wayland) => HotkeyPlatformPolicy;
  readonly createWindowsPolicy?: () => HotkeyPlatformPolicy;
}

/** Selects only explicitly supplied qualified host policies; it has no Electron state or defaults. */
export class HotkeyPlatformPolicyFactory {
  public constructor(private readonly dependencies: HotkeyPlatformPolicyFactoryDependencies) {}

  public create(platform: DesktopPlatform, session: LinuxSessionType): HotkeyPlatformPolicy {
    if (platform === DesktopPlatform.Windows) {
      return this.createSupportedPolicy(this.dependencies.createWindowsPolicy);
    }
    if (
      platform === DesktopPlatform.Linux &&
      (session === LinuxSessionType.X11 || session === LinuxSessionType.Wayland)
    ) {
      const createLinuxPolicy = this.dependencies.createLinuxPolicy;
      return this.createSupportedPolicy(createLinuxPolicy ? () => createLinuxPolicy(session) : undefined);
    }
    if (platform === DesktopPlatform.Macos) return new PausedMacosHotkeyPlatformPolicy();
    return new UnsupportedHotkeyPlatformPolicy();
  }

  private createSupportedPolicy(createPolicy: (() => HotkeyPlatformPolicy) | undefined): HotkeyPlatformPolicy {
    try {
      return createPolicy?.() ?? new UnsupportedHotkeyPlatformPolicy();
    } catch {
      return new UnsupportedHotkeyPlatformPolicy();
    }
  }
}
