import { getLength, getPointAtLength } from '@remotion/paths';

export interface FlowPoint {
  x: number;
  y: number;
}

export const kineticSignalPath = 'M-80 792 C400 552 700 1010 1120 700 S1650 330 2020 510';

const kineticSignalLength = getLength(kineticSignalPath);

function wrapProgress(progress: number): number {
  return ((progress % 1) + 1) % 1;
}

/** Returns two deterministic points that wrap beyond the canvas edges in the path's semantic direction. */
export function getDirectedFlowPoints(progress: number): readonly [FlowPoint, FlowPoint] {
  const leadingProgress = wrapProgress(progress);
  const trailingProgress = wrapProgress(progress - 0.2);

  return [
    getPointAtLength(kineticSignalPath, kineticSignalLength * leadingProgress),
    getPointAtLength(kineticSignalPath, kineticSignalLength * trailingProgress),
  ];
}
