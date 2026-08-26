import {
  PROVIDER_HOME_ACTIONS,
  type ProviderContextualActionDescriptor,
  type ProviderHomeAction,
} from '@shared/providerHomeAction';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import type { TextActionStatusAction } from '@shared/textActionStatus';

export const PROVIDER_HOTKEY_LOCK_REASONS = [
  'snapshot-unknown',
  'main-interaction-locked',
  'provider-transition-active',
  'prettify-model-action-active',
  'voice-provider-unavailable',
  'recording-active',
  'text-action-active',
  'text-action-owner-unknown',
  'prettify-disabled',
  'translation-disabled',
] as const;

export type ProviderHotkeyLockReason = (typeof PROVIDER_HOTKEY_LOCK_REASONS)[number];
export type ProviderHotkeyOwnershipState = 'known' | 'none' | 'unknown';

export interface ProviderHotkeySnapshotState {
  readonly hotkeys: Readonly<Record<ProviderHomeAction, boolean>>;
  readonly mainInteractionLock: boolean;
  readonly prettifyModelAction: boolean;
  readonly providerTransition: boolean;
  readonly recordingLifecycle: boolean;
  readonly textActionActivity: boolean;
  readonly textActionCancellability: boolean;
  readonly textActionEnablement: boolean;
  readonly textActionOwner: boolean;
  readonly voiceProvider: boolean;
}

/** The renderer-safe facts required to derive provider key and contextual-action presentation. */
export interface ProviderHotkeyEligibilityInput {
  readonly activeTextAction: TextActionStatusAction | null;
  readonly activeTextActionCancellable: boolean;
  readonly mainInteractionLocked: boolean;
  readonly prettifyEnabled: boolean;
  readonly prettifyModelActionActive: boolean;
  readonly providerTransitionActive: boolean;
  readonly recordingState: RecordingLifecycleState;
  readonly snapshots: ProviderHotkeySnapshotState;
  readonly textActionActivityActive: boolean;
  readonly translationEnabled: boolean;
  readonly voiceProviderAvailable: boolean;
}

export interface ProviderHotkeyActionEligibility {
  readonly action: ProviderHomeAction;
  readonly locked: boolean;
  readonly reasons: readonly ProviderHotkeyLockReason[];
}

export interface ProviderHotkeyPresentation {
  readonly activeOwner: ProviderHomeAction | null;
  readonly contextualActions: readonly ProviderContextualActionDescriptor[];
  readonly eligibility: Readonly<Record<ProviderHomeAction, ProviderHotkeyActionEligibility>>;
  readonly ownership: ProviderHotkeyOwnershipState;
}

interface ProviderHotkeyOwnership {
  readonly owner: ProviderHomeAction | null;
  readonly state: ProviderHotkeyOwnershipState;
}

function hasUnknownGlobalSnapshot(input: ProviderHotkeyEligibilityInput): boolean {
  const { snapshots } = input;
  return (
    !snapshots.mainInteractionLock ||
    !snapshots.prettifyModelAction ||
    !snapshots.providerTransition ||
    !snapshots.recordingLifecycle ||
    !snapshots.textActionActivity ||
    !snapshots.textActionOwner
  );
}

function hasUnknownActionSnapshot(action: ProviderHomeAction, input: ProviderHotkeyEligibilityInput): boolean {
  const { snapshots } = input;
  if (hasUnknownGlobalSnapshot(input) || !snapshots.hotkeys[action]) return true;
  if (action === 'voice') return !snapshots.voiceProvider;
  return !snapshots.textActionEnablement;
}

function toProviderHomeAction(action: TextActionStatusAction): ProviderHomeAction {
  return action === 'prettify' ? 'prettify' : 'translation';
}

function deriveOwnership(input: ProviderHotkeyEligibilityInput): ProviderHotkeyOwnership {
  if (hasUnknownGlobalSnapshot(input)) {
    return { owner: null, state: 'unknown' };
  }

  const voiceActive = input.recordingState !== 'idle';
  if (!input.textActionActivityActive) {
    if (input.activeTextAction !== null) return { owner: null, state: 'unknown' };
    return voiceActive ? { owner: 'voice', state: 'known' } : { owner: null, state: 'none' };
  }

  if (input.activeTextAction === null || voiceActive) {
    return { owner: null, state: 'unknown' };
  }

  return { owner: toProviderHomeAction(input.activeTextAction), state: 'known' };
}

function addGlobalLockReasons(
  action: ProviderHomeAction,
  input: ProviderHotkeyEligibilityInput,
  ownership: ProviderHotkeyOwnership,
): ProviderHotkeyLockReason[] {
  const reasons: ProviderHotkeyLockReason[] = [];
  if (hasUnknownActionSnapshot(action, input)) reasons.push('snapshot-unknown');
  if (input.mainInteractionLocked) reasons.push('main-interaction-locked');
  if (input.providerTransitionActive) reasons.push('provider-transition-active');
  if (input.prettifyModelActionActive) reasons.push('prettify-model-action-active');
  if (ownership.state === 'unknown') reasons.push('text-action-owner-unknown');
  return reasons;
}

function deriveActionEligibility(
  action: ProviderHomeAction,
  input: ProviderHotkeyEligibilityInput,
  ownership: ProviderHotkeyOwnership,
): ProviderHotkeyActionEligibility {
  const reasons = addGlobalLockReasons(action, input, ownership);

  if (action === 'voice') {
    if (!input.voiceProviderAvailable) reasons.push('voice-provider-unavailable');
    if (input.textActionActivityActive) reasons.push('text-action-active');
    if (
      input.recordingState === 'starting' ||
      input.recordingState === 'stopping' ||
      input.recordingState === 'transcribing' ||
      input.recordingState === 'retrying'
    ) {
      reasons.push('recording-active');
    }
  } else {
    if (input.recordingState !== 'idle') reasons.push('recording-active');
    if (input.textActionActivityActive) reasons.push('text-action-active');
    if (action === 'prettify' && !input.prettifyEnabled) reasons.push('prettify-disabled');
    if (action === 'translation' && !input.translationEnabled) reasons.push('translation-disabled');
  }

  return Object.freeze({
    action,
    locked: reasons.length > 0,
    reasons: Object.freeze(reasons),
  });
}

function canRenderContextualActions(
  input: ProviderHotkeyEligibilityInput,
  ownership: ProviderHotkeyOwnership,
): boolean {
  const { snapshots } = input;
  return (
    ownership.state === 'known' &&
    ownership.owner !== null &&
    snapshots.mainInteractionLock &&
    snapshots.prettifyModelAction &&
    snapshots.providerTransition &&
    snapshots.recordingLifecycle &&
    !input.mainInteractionLocked &&
    !input.prettifyModelActionActive &&
    !input.providerTransitionActive
  );
}

function createContextualAction(
  provider: ProviderHomeAction,
  action: ProviderContextualActionDescriptor['action'],
): ProviderContextualActionDescriptor {
  return Object.freeze({
    action,
    available: true,
    busy: false,
    provider,
  });
}

function deriveVoiceContextualActions(
  recordingState: RecordingLifecycleState,
): readonly ProviderContextualActionDescriptor[] {
  switch (recordingState) {
    case 'starting':
    case 'transcribing':
    case 'retrying':
      return Object.freeze([createContextualAction('voice', 'cancel')]);
    case 'recording':
      return Object.freeze([
        createContextualAction('voice', 'pause'),
        createContextualAction('voice', 'stop'),
        createContextualAction('voice', 'cancel'),
      ]);
    case 'paused':
      return Object.freeze([
        createContextualAction('voice', 'resume'),
        createContextualAction('voice', 'stop'),
        createContextualAction('voice', 'cancel'),
      ]);
    case 'idle':
    case 'stopping':
      return Object.freeze([]);
  }
}

function deriveContextualActions(
  input: ProviderHotkeyEligibilityInput,
  ownership: ProviderHotkeyOwnership,
): readonly ProviderContextualActionDescriptor[] {
  if (!canRenderContextualActions(input, ownership) || ownership.owner === null) return Object.freeze([]);

  switch (ownership.owner) {
    case 'voice':
      return deriveVoiceContextualActions(input.recordingState);
    case 'prettify':
    case 'translation':
      if (!input.snapshots.textActionCancellability || !input.activeTextActionCancellable) {
        return Object.freeze([]);
      }
      return Object.freeze([createContextualAction(ownership.owner, 'cancel')]);
  }
}

/** Derives all provider-key locks, active ownership, and available contextual actions without side effects. */
export function deriveProviderHotkeyPresentation(input: ProviderHotkeyEligibilityInput): ProviderHotkeyPresentation {
  const ownership = deriveOwnership(input);
  const eligibility = PROVIDER_HOME_ACTIONS.reduce<
    Partial<Record<ProviderHomeAction, ProviderHotkeyActionEligibility>>
  >((result, action) => {
    result[action] = deriveActionEligibility(action, input, ownership);
    return result;
  }, {});

  return Object.freeze({
    activeOwner: ownership.owner,
    contextualActions: deriveContextualActions(input, ownership),
    eligibility: Object.freeze(eligibility as Record<ProviderHomeAction, ProviderHotkeyActionEligibility>),
    ownership: ownership.state,
  });
}
