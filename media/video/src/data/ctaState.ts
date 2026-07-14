export interface CtaViewState {
  isStable: boolean;
  resolveOpacity: number;
}

/** Freezes the final poster hold from frame 3540 through the end of the composition. */
export function getCtaViewState(frame: number): CtaViewState {
  if (frame >= 120) return { isStable: true, resolveOpacity: 1 };

  return { isStable: false, resolveOpacity: Math.min(1, (frame + 1) / 18) };
}
