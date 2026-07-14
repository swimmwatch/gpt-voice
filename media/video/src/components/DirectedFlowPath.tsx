import type { JSX } from 'react';
import { getDirectedFlowPoints, kineticSignalPath } from '../data/directedFlow';

interface DirectedFlowPathProps {
  accent: string;
  dashOffset: number;
  progress: number;
}

/** Keeps a directional workflow signal active without overlaying product UI or critical copy. */
export function DirectedFlowPath({ accent, dashOffset, progress }: DirectedFlowPathProps): JSX.Element {
  const dots = getDirectedFlowPoints(progress);

  return (
    <svg height="1080" viewBox="0 0 1920 1080" width="1920">
      <path
        d={kineticSignalPath}
        fill="none"
        stroke={accent}
        strokeDasharray="14 34"
        strokeDashoffset={dashOffset}
        strokeOpacity="0.32"
        strokeWidth="3"
      />
      {dots.map((dot, index) => (
        <circle
          cx={dot.x}
          cy={dot.y}
          fill={accent}
          key={index}
          opacity={index === 0 ? 0.66 : 0.42}
          r={index === 0 ? 8 : 5}
        />
      ))}
    </svg>
  );
}
