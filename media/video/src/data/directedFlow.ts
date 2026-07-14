import { getLength, getPointAtLength } from '@remotion/paths';

export interface FlowPoint {
  x: number;
  y: number;
}

export const kineticSignalPath = 'M-80 792 C400 552 700 1010 1120 700 S1650 330 2020 510';

const kineticSignalLength = getLength(kineticSignalPath);

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}

/** Returns two bounded, deterministic points moving in the path's semantic direction. */
export function getDirectedFlowPoints(progress: number): readonly [FlowPoint, FlowPoint] {
  const leadingProgress = clampProgress(progress);
  const trailingProgress = clampProgress(progress - 0.2);

  return [
    getPointAtLength(kineticSignalPath, kineticSignalLength * leadingProgress),
    getPointAtLength(kineticSignalPath, kineticSignalLength * trailingProgress),
  ];
}
