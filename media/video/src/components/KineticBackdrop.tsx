import type { JSX } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { getKineticBackdropMotion } from '../data/kineticMotion';
import { DirectedFlowPath } from './DirectedFlowPath';

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
      <DirectedFlowPath accent={accent} dashOffset={motion.dashOffset} progress={motion.flowProgress} />
    </AbsoluteFill>
  );
}
