import { useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/cn';
import '@renderer/styles/hotkeyActionButton.css';

const KEYBOARD_ACTIVATION_KEYS = new Set(['Enter', ' ']);
const RELEASE_FEEDBACK_MS = 110;

interface HotkeyActionButtonProps {
  readonly actionLabel: string;
  readonly busy?: boolean;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly hotkey: string;
  readonly onActivate: () => void;
}

/** Presents one complete accelerator as a physically pressable action key. */
export default function HotkeyActionButton({
  actionLabel,
  busy = false,
  className,
  disabled = false,
  hotkey,
  onActivate,
}: HotkeyActionButtonProps): React.JSX.Element {
  const [keyboardPressed, setKeyboardPressed] = useState(false);
  const releaseTimerRef = useRef<number | null>(null);
  const unavailable = disabled || busy;

  const clearKeyboardRelease = (): void => {
    if (releaseTimerRef.current === null) return;
    window.clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = null;
  };

  useEffect(
    () => () => {
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    },
    [],
  );

  const releaseKeyboard = (): void => {
    clearKeyboardRelease();
    releaseTimerRef.current = window.setTimeout(() => {
      setKeyboardPressed(false);
      releaseTimerRef.current = null;
    }, RELEASE_FEEDBACK_MS);
  };

  return (
    <button
      aria-busy={busy || undefined}
      aria-label={`${actionLabel}: ${hotkey}`}
      className={cn('command-dock-hotkey-action', className)}
      data-keyboard-pressed={keyboardPressed || undefined}
      disabled={unavailable}
      onBlur={() => {
        clearKeyboardRelease();
        setKeyboardPressed(false);
      }}
      onClick={() => {
        if (!unavailable) onActivate();
      }}
      onKeyDown={(event) => {
        if (!unavailable && KEYBOARD_ACTIVATION_KEYS.has(event.key) && !event.repeat) setKeyboardPressed(true);
      }}
      onKeyUp={(event) => {
        if (KEYBOARD_ACTIVATION_KEYS.has(event.key)) releaseKeyboard();
      }}
      title={`${actionLabel}: ${hotkey}`}
      type="button"
    >
      <span aria-hidden="true" className="command-dock-hotkey-action__face">
        <span className="command-dock-hotkey-action__legend">{hotkey}</span>
      </span>
    </button>
  );
}
