import { HotkeyBindingAuthority, HotkeyRegistrationFailureCode } from '@shared/hotkeys';

export type HotkeyPlatformPolicyResult =
  | Readonly<{
      readonly accepted: true;
      readonly bindingAuthority: HotkeyBindingAuthority;
      readonly effectiveAccelerator: string | null;
    }>
  | Readonly<{ readonly accepted: false; readonly failureCode: HotkeyRegistrationFailureCode }>;

/** Validates one already-normalized accelerator for a platform integration. */
export abstract class HotkeyPlatformPolicy {
  public abstract validate(normalizedAccelerator: string): HotkeyPlatformPolicyResult;
}
