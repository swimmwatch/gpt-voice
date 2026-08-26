import { HotkeyBindingAuthority, HotkeyRegistrationFailureCode } from '@shared/hotkeys';

import { HotkeyPlatformPolicy, type HotkeyPlatformPolicyResult } from './HotkeyPlatformPolicy';

const ACCELERATOR_PART_SEPARATOR = '+';
const WINDOWS_RESERVED_PRIMARY_KEY = 'F12';
const WINDOWS_SUPER_MODIFIER = 'Super';
const NORMALIZED_MODIFIERS = new Set(['Alt', 'Command', 'CommandOrControl', 'Ctrl', 'Shift', 'Super']);

interface ParsedNormalizedAccelerator {
  readonly modifiers: ReadonlySet<string>;
  readonly primaryKey: string;
}

function parseNormalizedAccelerator(value: string): ParsedNormalizedAccelerator | null {
  const modifiers = new Set<string>();
  let primaryKey: string | null = null;

  for (const part of value.split(ACCELERATOR_PART_SEPARATOR)) {
    if (NORMALIZED_MODIFIERS.has(part)) {
      modifiers.add(part);
      continue;
    }
    if (primaryKey !== null || part.length === 0) return null;
    primaryKey = part;
  }

  return primaryKey === null ? null : Object.freeze({ modifiers, primaryKey });
}

/** Owns the bounded Windows reservation policy for already-normalized accelerators. */
export class WindowsHotkeyPlatformPolicy extends HotkeyPlatformPolicy {
  public validate(normalizedAccelerator: string): HotkeyPlatformPolicyResult {
    const accelerator = parseNormalizedAccelerator(normalizedAccelerator);
    if (accelerator === null) {
      return Object.freeze({ accepted: false, failureCode: HotkeyRegistrationFailureCode.InvalidAccelerator });
    }
    if (accelerator.primaryKey === WINDOWS_RESERVED_PRIMARY_KEY || accelerator.modifiers.has(WINDOWS_SUPER_MODIFIER)) {
      return Object.freeze({ accepted: false, failureCode: HotkeyRegistrationFailureCode.OsReserved });
    }
    return Object.freeze({
      accepted: true,
      bindingAuthority: HotkeyBindingAuthority.Application,
      effectiveAccelerator: normalizedAccelerator,
    });
  }
}
