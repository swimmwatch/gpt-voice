export const TEXT_ACTION_STATUS_ACTIONS = ['translation', 'prettify'] as const;
export const TEXT_ACTION_STATUS_PHASES = ['working', 'completed', 'failed', 'cancelled', 'skipped'] as const;

export type TextActionStatusAction = (typeof TEXT_ACTION_STATUS_ACTIONS)[number];
export type TextActionStatusPhase = (typeof TEXT_ACTION_STATUS_PHASES)[number];

/** A finite, renderer-safe progress update for a selected-text action. */
export interface TextActionStatus {
  action: TextActionStatusAction;
  phase: TextActionStatusPhase;
}

function isTextActionStatusAction(value: unknown): value is TextActionStatusAction {
  return typeof value === 'string' && TEXT_ACTION_STATUS_ACTIONS.includes(value as TextActionStatusAction);
}

function isTextActionStatusPhase(value: unknown): value is TextActionStatusPhase {
  return typeof value === 'string' && TEXT_ACTION_STATUS_PHASES.includes(value as TextActionStatusPhase);
}

export function isTextActionStatus(value: unknown): value is TextActionStatus {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  return (
    keys.length === 2 &&
    keys.includes('action') &&
    keys.includes('phase') &&
    isTextActionStatusAction(candidate.action) &&
    isTextActionStatusPhase(candidate.phase)
  );
}

/** Converts an untrusted IPC payload to the only status shape the renderer may present. */
export function sanitizeTextActionStatus(value: unknown): TextActionStatus | null {
  return isTextActionStatus(value) ? value : null;
}
