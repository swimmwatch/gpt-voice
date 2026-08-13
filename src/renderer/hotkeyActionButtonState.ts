export const HOTKEY_ACTION_BUTTON_HEIGHT_PX = 32;
export const HOTKEY_ACTION_BUTTON_LOCK_GRACE_MS = 110;
export const HOTKEY_ACTION_BUTTON_MAX_LOCK_TRANSITION_MS = 200;
export const HOTKEY_ACTION_BUTTON_PRESS_TRAVEL_PX = 3;
export const HOTKEY_ACTION_BUTTON_RELEASE_FEEDBACK_MS = 110;
export const HOTKEY_ACTION_BUTTON_WIDTH_PX = 114;

export type HotkeyActionButtonVisualState = 'active' | 'busy' | 'disabled' | 'enabled' | 'locking';

export interface HotkeyActionButtonSemanticState {
  readonly active: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly locked: boolean;
}

export interface HotkeyActionButtonVisualTransition {
  readonly delayMs: number | null;
  readonly state: HotkeyActionButtonVisualState;
}

export interface HotkeyLegendToken {
  readonly id: string;
  readonly kind: 'key' | 'separator';
  readonly text: string;
}

/** Keeps Electron's raw accelerator untouched while formatting only its visible legend. */
export function formatHotkeyLegend(hotkey: string): readonly HotkeyLegendToken[] {
  const keys = hotkey
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean);
  if (keys.length <= 1) return Object.freeze([{ id: 'key-0', kind: 'key', text: hotkey.trim() }]);

  return Object.freeze(
    keys.flatMap((key, index) =>
      index === 0
        ? [{ id: `key-${index}`, kind: 'key' as const, text: key }]
        : [
            { id: `separator-${index}`, kind: 'separator' as const, text: ' + ' },
            { id: `key-${index}`, kind: 'key' as const, text: key },
          ],
    ),
  );
}

export function isHotkeyActionButtonUnavailable(state: HotkeyActionButtonSemanticState): boolean {
  return state.busy || state.disabled || state.locked;
}

/** Calculates the first trustworthy render without animating an unknown prior state. */
export function getInitialHotkeyActionButtonVisualState(
  state: HotkeyActionButtonSemanticState,
): HotkeyActionButtonVisualState {
  if (state.busy) return 'busy';
  if (state.active) return 'active';
  return isHotkeyActionButtonUnavailable(state) ? 'disabled' : 'enabled';
}

/**
 * Calculates the visual response to an authoritative state replacement.
 * The caller schedules only the returned grace window, so tests can use a fake clock.
 */
export function getHotkeyActionButtonVisualTransition(
  previous: HotkeyActionButtonSemanticState,
  next: HotkeyActionButtonSemanticState,
): HotkeyActionButtonVisualTransition {
  if (next.busy) return Object.freeze({ delayMs: null, state: 'busy' });
  if (next.active) return Object.freeze({ delayMs: null, state: 'active' });
  if (!isHotkeyActionButtonUnavailable(next)) return Object.freeze({ delayMs: null, state: 'enabled' });

  if (!isHotkeyActionButtonUnavailable(previous) && !previous.active) {
    return Object.freeze({ delayMs: HOTKEY_ACTION_BUTTON_LOCK_GRACE_MS, state: 'locking' });
  }
  return Object.freeze({ delayMs: null, state: 'disabled' });
}
