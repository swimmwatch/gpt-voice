export const PROVIDER_HOME_ACTIONS = ['voice', 'prettify', 'translation'] as const;

export const PROVIDER_CONTEXTUAL_ACTIONS = ['pause', 'resume', 'stop', 'cancel'] as const;

export type ProviderHomeAction = (typeof PROVIDER_HOME_ACTIONS)[number];
export type ProviderContextualAction = (typeof PROVIDER_CONTEXTUAL_ACTIONS)[number];
export type ProviderHomeTextAction = Exclude<ProviderHomeAction, 'voice'>;

export const PROVIDER_HOME_ACTION_COMMANDS = ['start', 'cancel'] as const;
export const PROVIDER_HOME_ACTION_IPC_CHANNELS = Object.freeze({
  command: 'provider-home-action-command',
  snapshotChanged: 'provider-home-action-state-changed',
  snapshotQuery: 'get-provider-home-action-state',
});

export type ProviderHomeActionCommandName = (typeof PROVIDER_HOME_ACTION_COMMANDS)[number];

/** A bounded renderer request; main re-evaluates every gate before acting. */
export interface ProviderHomeActionCommand {
  readonly action: ProviderHomeActionCommandName;
  readonly provider: ProviderHomeTextAction;
}

/** Sanitized state required for text-provider key eligibility and Cancel tiles. */
export interface ProviderHomeActionState {
  readonly activeAction: ProviderHomeTextAction | null;
  readonly activeActionCancellable: boolean;
  readonly settings: TextActionSettings;
}

export interface ProviderHomeActionResult {
  readonly accepted: boolean;
}

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

export function isProviderHomeTextAction(value: unknown): value is ProviderHomeTextAction {
  return value === 'prettify' || value === 'translation';
}

export function isProviderHomeActionCommand(value: unknown): value is ProviderHomeActionCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 2 &&
    Object.prototype.hasOwnProperty.call(candidate, 'action') &&
    Object.prototype.hasOwnProperty.call(candidate, 'provider') &&
    typeof candidate.action === 'string' &&
    PROVIDER_HOME_ACTION_COMMANDS.includes(candidate.action as ProviderHomeActionCommandName) &&
    isProviderHomeTextAction(candidate.provider)
  );
}

export function isProviderHomeActionState(value: unknown): value is ProviderHomeActionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const settings = candidate.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  const settingsCandidate = settings as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 3 &&
    Object.prototype.hasOwnProperty.call(candidate, 'activeAction') &&
    Object.prototype.hasOwnProperty.call(candidate, 'activeActionCancellable') &&
    Object.prototype.hasOwnProperty.call(candidate, 'settings') &&
    (candidate.activeAction === null || isProviderHomeTextAction(candidate.activeAction)) &&
    typeof candidate.activeActionCancellable === 'boolean' &&
    Object.keys(settingsCandidate).length === 3 &&
    typeof settingsCandidate.prettifyEnabled === 'boolean' &&
    typeof settingsCandidate.prettifyQuickEnabled === 'boolean' &&
    typeof settingsCandidate.translateEnabled === 'boolean'
  );
}

export function isProviderHomeActionResult(value: unknown): value is ProviderHomeActionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).length === 1 && typeof (value as ProviderHomeActionResult).accepted === 'boolean';
}
import type { TextActionSettings } from './textActionSettings';
