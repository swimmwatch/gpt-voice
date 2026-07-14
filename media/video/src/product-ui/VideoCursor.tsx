import type { JSX } from 'react';

interface VideoCursorProps {
  active?: boolean;
  opacity?: number;
  x: number;
  y: number;
}

/** A frame-positioned cursor for showing the paste destination without a live pointer. */
export function VideoCursor({ active = false, opacity = 1, x, y }: VideoCursorProps): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      data-slot="video-cursor"
      height="42"
      style={{ left: x, opacity, position: 'absolute', top: y, transform: active ? 'scale(0.9)' : undefined }}
      viewBox="0 0 28 42"
      width="28"
    >
      <path d="M3 2 24 24l-9 1 5 12-7 3-5-12-5 8Z" fill="#F8FAFC" stroke="#0F172A" strokeWidth="3" />
    </svg>
  );
}
