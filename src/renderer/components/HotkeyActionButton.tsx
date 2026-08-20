import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { cn } from '@renderer/lib/cn';
import {
  formatHotkeyLegend,
  getHotkeyActionButtonRegistrationPresentation,
  getHotkeyActionButtonVisualTransition,
  getInitialHotkeyActionButtonVisualState,
  HOTKEY_ACTION_BUTTON_RELEASE_FEEDBACK_MS,
  isHotkeyActionButtonUnavailable,
  type HotkeyActionButtonSemanticState,
  type HotkeyActionButtonVisualState,
} from '@renderer/hotkeyActionButtonState';
import type { HotkeyRuntimeSnapshotEntry } from '@shared/hotkeys';
import '@renderer/styles/hotkeyActionButton.css';

const KEYBOARD_ACTIVATION_KEYS = new Set(['Enter', ' ']);

export interface HotkeyActionButtonProps {
  /** Keeps the pressed visual state while the caller owns this provider session. */
  readonly active?: boolean;
  readonly actionLabel: string;
  readonly accelerator: string | null;
  readonly busy?: boolean;
  readonly className?: string;
  readonly disabled?: boolean;
  /** Semantically disables the key while retaining its 110 ms visual lock grace. */
  readonly locked?: boolean;
  readonly onActivate: () => void;
  readonly registration: HotkeyRuntimeSnapshotEntry | null;
}

interface HotkeyActionButtonInputProps {
  readonly busy: boolean;
  readonly className?: string;
  readonly legend: string | null;
  readonly onActivate: () => void;
  readonly tooltip: string;
  readonly unavailable: boolean;
  readonly visualState: HotkeyActionButtonVisualState;
}

interface HotkeyActionButtonCopy {
  readonly legend: string | null;
  readonly tooltip: string;
}

/** Derives the visible assigned key while preserving registration state for nonvisual behavior. */
function getHotkeyActionButtonCopy(
  accelerator: string | null,
  actionLabel: string,
  registration: HotkeyRuntimeSnapshotEntry | null,
): HotkeyActionButtonCopy {
  const presentation = getHotkeyActionButtonRegistrationPresentation(accelerator, registration);
  const configured = presentation.configuredAccelerator;

  switch (presentation.state) {
    case 'application-enabled':
      return {
        legend: presentation.effectiveAccelerator ?? configured,
        tooltip: actionLabel,
      };
    case 'application-suppressed':
      return {
        legend: presentation.effectiveAccelerator ?? configured,
        tooltip: actionLabel,
      };
    case 'desktop-managed':
      return {
        legend: configured,
        tooltip: actionLabel,
      };
    case 'failed':
      return {
        legend: null,
        tooltip: actionLabel,
      };
    case 'unassigned':
      return {
        legend: null,
        tooltip: actionLabel,
      };
  }
}

/** Owns transient pointer and keyboard feedback for one semantic button instance. */
function HotkeyActionButtonInput({
  busy,
  className,
  legend,
  onActivate,
  tooltip,
  unavailable,
  visualState,
}: HotkeyActionButtonInputProps): React.JSX.Element {
  const [keyboardPressed, setKeyboardPressed] = useState(false);
  const [pointerPressed, setPointerPressed] = useState(false);
  const releaseTimerRef = useRef<number | null>(null);
  const legendTokens = formatHotkeyLegend(legend);

  const clearKeyboardRelease = (): void => {
    if (releaseTimerRef.current === null) return;
    window.clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = null;
  };

  const clearPressedState = (): void => {
    clearKeyboardRelease();
    setKeyboardPressed(false);
    setPointerPressed(false);
  };

  useEffect(
    () => () => {
      if (releaseTimerRef.current === null) return;
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    },
    [],
  );

  const releaseKeyboard = (): void => {
    clearKeyboardRelease();
    releaseTimerRef.current = window.setTimeout(() => {
      setKeyboardPressed(false);
      releaseTimerRef.current = null;
    }, HOTKEY_ACTION_BUTTON_RELEASE_FEEDBACK_MS);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="command-dock-hotkey-action-tooltip-trigger">
          <button
            aria-busy={busy || undefined}
            aria-label={tooltip}
            className={cn('command-dock-hotkey-action', className)}
            data-keyboard-pressed={keyboardPressed || undefined}
            data-pointer-pressed={pointerPressed || undefined}
            data-visual-state={visualState}
            disabled={unavailable}
            onBlur={clearPressedState}
            onClick={() => {
              if (!unavailable) onActivate();
            }}
            onKeyDown={(event) => {
              if (!unavailable && KEYBOARD_ACTIVATION_KEYS.has(event.key) && !event.repeat) setKeyboardPressed(true);
            }}
            onKeyUp={(event) => {
              if (KEYBOARD_ACTIVATION_KEYS.has(event.key)) releaseKeyboard();
            }}
            onLostPointerCapture={clearPressedState}
            onPointerCancel={clearPressedState}
            onPointerDown={(event) => {
              if (unavailable || event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setPointerPressed(true);
            }}
            onPointerUp={clearPressedState}
            type="button"
          >
            <span aria-hidden="true" className="command-dock-hotkey-action__shadow" />
            <span aria-hidden="true" className="command-dock-hotkey-action__bevel" />
            <span aria-hidden="true" className="command-dock-hotkey-action__face">
              <span className="command-dock-hotkey-action__content">
                <span className="command-dock-hotkey-action__legend">
                  {legendTokens.map((token) => (
                    <span className={`command-dock-hotkey-action__${token.kind}`} key={token.id}>
                      {token.text}
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Presents one complete accelerator as a physically pressable action key. */
export default function HotkeyActionButton({
  active = false,
  actionLabel,
  accelerator,
  busy = false,
  className,
  disabled = false,
  locked = false,
  onActivate,
  registration,
}: HotkeyActionButtonProps): React.JSX.Element {
  const semanticStateRef = useRef<HotkeyActionButtonSemanticState>({ active, busy, disabled, locked });
  const [visualState, setVisualState] = useState<HotkeyActionButtonVisualState>(() =>
    getInitialHotkeyActionButtonVisualState({ active, busy, disabled, locked }),
  );
  const unavailable = isHotkeyActionButtonUnavailable({ active, busy, disabled, locked });
  const copy = getHotkeyActionButtonCopy(accelerator, actionLabel, registration);

  // Reconcile Provider Lock ownership before paint so a physical press cannot
  // briefly rise between pointer release and its authoritative active state.
  useLayoutEffect(() => {
    const nextSemanticState: HotkeyActionButtonSemanticState = { active, busy, disabled, locked };
    const transition = getHotkeyActionButtonVisualTransition(semanticStateRef.current, nextSemanticState);
    semanticStateRef.current = nextSemanticState;
    setVisualState(transition.state);
    if (transition.delayMs === null) return;

    const lockTimer = window.setTimeout(() => {
      setVisualState(getInitialHotkeyActionButtonVisualState(semanticStateRef.current));
    }, transition.delayMs);
    return () => window.clearTimeout(lockTimer);
  }, [active, busy, disabled, locked]);

  return (
    <HotkeyActionButtonInput
      busy={busy}
      className={className}
      key={String(unavailable)}
      legend={copy.legend}
      onActivate={onActivate}
      tooltip={copy.tooltip}
      unavailable={unavailable}
      visualState={visualState}
    />
  );
}
