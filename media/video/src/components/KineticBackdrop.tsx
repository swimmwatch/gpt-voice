import type { JSX } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { getKineticBackdropMotion } from '../data/kineticMotion';

interface KineticBackdropProps {
  accent: string;
  phase?: number;
}

/** A low-contrast moving signal layer that keeps the surrounding picture active. */
export function KineticBackdrop({ accent, phase = 0 }: KineticBackdropProps): JSX.Element {
  const frame = useCurrentFrame();
  const motion = getKineticBackdropMotion(frame, phase);

  return (
    <AbsoluteFill aria-hidden style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          background: `radial-gradient(circle, ${accent}55 0%, transparent 68%)`,
          borderRadius: '50%',
          height: 680,
          left: 1160 + motion.driftX,
          opacity: motion.pulse,
          position: 'absolute',
          top: 84 + motion.driftY,
          width: 680,
        }}
      />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920">
        <path
          d="M-80 792 C400 552 700 1010 1120 700 S1650 330 2020 510"
          fill="none"
          stroke={accent}
          strokeDasharray="14 34"
          strokeDashoffset={motion.dashOffset}
          strokeOpacity="0.32"
          strokeWidth="3"
        />
        <circle cx={1580 + motion.driftX * 0.2} cy={236 + motion.driftY * 0.16} fill={accent} opacity="0.66" r="8" />
        <circle cx={1360 - motion.driftX * 0.16} cy={810 - motion.driftY * 0.24} fill={accent} opacity="0.42" r="5" />
      </svg>
    </AbsoluteFill>
  );
}
