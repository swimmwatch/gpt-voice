import { LinuxSessionType } from '@shared/hotkeys';

/** Maps the one bounded session-type value read by the process root to an internal enum. */
export function classifyLinuxSessionType(platform: NodeJS.Platform, sessionType: string | undefined): LinuxSessionType {
  if (platform !== 'linux') return LinuxSessionType.NotApplicable;
  if (sessionType === LinuxSessionType.X11) return LinuxSessionType.X11;
  if (sessionType === LinuxSessionType.Wayland) return LinuxSessionType.Wayland;
  return LinuxSessionType.Unknown;
}
