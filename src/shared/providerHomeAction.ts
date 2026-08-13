export const PROVIDER_HOME_ACTIONS = ['voice', 'prettify', 'translation'] as const;

export const PROVIDER_CONTEXTUAL_ACTIONS = ['pause', 'resume', 'stop', 'cancel'] as const;

export type ProviderHomeAction = (typeof PROVIDER_HOME_ACTIONS)[number];
export type ProviderContextualAction = (typeof PROVIDER_CONTEXTUAL_ACTIONS)[number];

/** A renderer-safe contextual action that is ready for presentation and guarded activation. */
export interface ProviderContextualActionDescriptor {
  readonly action: ProviderContextualAction;
  readonly available: true;
  readonly busy: boolean;
  readonly provider: ProviderHomeAction;
}

export function isProviderHomeAction(value: unknown): value is ProviderHomeAction {
  return typeof value === 'string' && PROVIDER_HOME_ACTIONS.includes(value as ProviderHomeAction);
}

export function isProviderContextualAction(value: unknown): value is ProviderContextualAction {
  return typeof value === 'string' && PROVIDER_CONTEXTUAL_ACTIONS.includes(value as ProviderContextualAction);
}
