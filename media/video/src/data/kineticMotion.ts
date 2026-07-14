import { interpolate } from 'remotion';

export interface KineticBackdropMotion {
  dashOffset: number;
  driftX: number;
  driftY: number;
  flowProgress: number;
  pulse: number;
}

/** Calculates a looping, deterministic background movement without touching product UI. */
export function getKineticBackdropMotion(frame: number, phase = 0): KineticBackdropMotion {
  const progress = ((frame + phase) % 180) / 180;

  return {
    dashOffset: interpolate(progress, [0, 1], [0, -180]),
    driftX: interpolate(progress, [0, 1], [-96, 96]),
    driftY: interpolate(progress, [0, 1], [56, -56]),
    flowProgress: progress,
    pulse: 0.25 + Math.sin(progress * Math.PI * 2) * 0.12,
  };
}
