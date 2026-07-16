export interface KineticBackdropMotion {
  dashOffset: number;
  driftX: number;
  driftY: number;
  flowProgress: number;
  pulse: number;
}

/** Calculates a looping, deterministic background movement without touching product UI. */
export function getKineticBackdropMotion(frame: number, phase = 0): KineticBackdropMotion {
  const totalFrames = frame + phase;
  const cycle = (totalFrames * Math.PI * 2) / 180;

  return {
    dashOffset: -(totalFrames * 16) / 15,
    driftX: Math.sin(cycle) * 96,
    driftY: Math.cos(cycle) * 56,
    flowProgress: totalFrames / 180,
    pulse: 0.25 + Math.sin(cycle) * 0.12,
  };
}
