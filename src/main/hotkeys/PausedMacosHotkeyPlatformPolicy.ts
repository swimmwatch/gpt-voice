import { UnsupportedHotkeyPlatformPolicy } from './UnsupportedHotkeyPlatformPolicy';

/** macOS support is deliberately paused without claiming an application binding. */
export class PausedMacosHotkeyPlatformPolicy extends UnsupportedHotkeyPlatformPolicy {}
