import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveProviderHotkeyPresentation,
  type ProviderHotkeyEligibilityInput,
  type ProviderHotkeyLockReason,
} from '@renderer/providerHotkeyEligibility';
import type { ProviderHomeAction } from '@shared/providerHomeAction';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

function createInput(overrides: Partial<ProviderHotkeyEligibilityInput> = {}): ProviderHotkeyEligibilityInput {
  return {
    activeTextAction: null,
    activeTextActionCancellable: false,
    mainInteractionLocked: false,
    prettifyEnabled: true,
    prettifyModelActionActive: false,
    providerTransitionActive: false,
    recordingState: 'idle',
    snapshots: {
      hotkeys: {
        prettify: true,
        translation: true,
        voice: true,
      },
      mainInteractionLock: true,
      prettifyModelAction: true,
      providerTransition: true,
      recordingLifecycle: true,
      textActionActivity: true,
      textActionCancellability: true,
      textActionEnablement: true,
      textActionOwner: true,
      voiceProvider: true,
    },
    textActionActivityActive: false,
    translationEnabled: true,
    voiceProviderAvailable: true,
    ...overrides,
  };
}

function reasonsFor(input: ProviderHotkeyEligibilityInput, action: ProviderHomeAction): readonly string[] {
  return deriveProviderHotkeyPresentation(input).eligibility[action].reasons;
}

describe('deriveProviderHotkeyPresentation', () => {
  it('keeps every provider key eligible while idle with complete eligible snapshots', () => {
    const presentation = deriveProviderHotkeyPresentation(createInput());

    assert.equal(presentation.ownership, 'none');
    assert.equal(presentation.activeOwner, null);
    assert.deepEqual(presentation.contextualActions, []);
    assert.deepEqual(
      Object.values(presentation.eligibility).map((eligibility) => eligibility.locked),
      [false, false, false],
    );
  });

  it('keeps Voice eligible for Pause or Resume while all text actions are locked', () => {
    const recording = deriveProviderHotkeyPresentation(createInput({ recordingState: 'recording' }));
    const paused = deriveProviderHotkeyPresentation(createInput({ recordingState: 'paused' }));

    assert.equal(recording.activeOwner, 'voice');
    assert.equal(recording.eligibility.voice.locked, false);
    assert.equal(recording.eligibility.prettify.locked, true);
    assert.equal(recording.eligibility.translation.locked, true);
    assert.deepEqual(
      recording.contextualActions.map(({ action }) => action),
      ['pause', 'stop', 'cancel'],
    );
    assert.equal(paused.eligibility.voice.locked, false);
    assert.deepEqual(
      paused.contextualActions.map(({ action }) => action),
      ['resume', 'stop', 'cancel'],
    );
  });

  it('locks Voice during the non-interactive active recording states while retaining its ownership', () => {
    const states: readonly RecordingLifecycleState[] = ['starting', 'stopping', 'transcribing', 'retrying'];

    for (const recordingState of states) {
      const presentation = deriveProviderHotkeyPresentation(createInput({ recordingState }));
      assert.equal(presentation.activeOwner, 'voice');
      assert.equal(presentation.ownership, 'known');
      assert.equal(presentation.eligibility.voice.locked, true);
      assert.equal(presentation.eligibility.prettify.locked, true);
      assert.equal(presentation.eligibility.translation.locked, true);
    }
  });

  it('derives the exact Voice contextual action matrix without changing recording cancellation behavior', () => {
    const expected: Readonly<Record<RecordingLifecycleState, readonly string[]>> = {
      idle: [],
      paused: ['resume', 'stop', 'cancel'],
      recording: ['pause', 'stop', 'cancel'],
      retrying: ['cancel'],
      starting: ['cancel'],
      stopping: [],
      transcribing: ['cancel'],
    };

    for (const [recordingState, actions] of Object.entries(expected) as [
      RecordingLifecycleState,
      readonly string[],
    ][]) {
      const presentation = deriveProviderHotkeyPresentation(createInput({ recordingState }));
      assert.deepEqual(
        presentation.contextualActions.map(({ action }) => action),
        actions,
        recordingState,
      );
      assert.ok(
        presentation.contextualActions.every(
          ({ available, busy, provider }) => available && !busy && provider === 'voice',
        ),
      );
    }
  });

  it('presses only the known active selected-text owner and offers its Cancel action when cancellable', () => {
    const presentation = deriveProviderHotkeyPresentation(
      createInput({
        activeTextAction: 'prettify',
        activeTextActionCancellable: true,
        textActionActivityActive: true,
      }),
    );

    assert.equal(presentation.activeOwner, 'prettify');
    assert.equal(presentation.eligibility.voice.locked, true);
    assert.equal(presentation.eligibility.prettify.locked, true);
    assert.equal(presentation.eligibility.translation.locked, true);
    assert.deepEqual(presentation.contextualActions, [
      { action: 'cancel', available: true, busy: false, provider: 'prettify' },
    ]);
  });

  it('offers Translation Cancel only to a known cancellable Translation owner', () => {
    const cancellable = deriveProviderHotkeyPresentation(
      createInput({
        activeTextAction: 'translation',
        activeTextActionCancellable: true,
        textActionActivityActive: true,
      }),
    );
    const settled = deriveProviderHotkeyPresentation(
      createInput({
        activeTextAction: 'translation',
        activeTextActionCancellable: false,
        textActionActivityActive: true,
      }),
    );

    assert.deepEqual(
      cancellable.contextualActions.map(({ provider, action }) => [provider, action]),
      [['translation', 'cancel']],
    );
    assert.deepEqual(settled.contextualActions, []);
  });

  it('fails closed without pressing a provider or rendering actions for unknown or contradictory text ownership', () => {
    const unknownOwner = deriveProviderHotkeyPresentation(createInput({ textActionActivityActive: true }));
    const contradictoryOwner = deriveProviderHotkeyPresentation(
      createInput({ activeTextAction: 'prettify', textActionActivityActive: false }),
    );
    const conflictingWork = deriveProviderHotkeyPresentation(
      createInput({
        activeTextAction: 'translation',
        recordingState: 'recording',
        textActionActivityActive: true,
      }),
    );

    for (const presentation of [unknownOwner, contradictoryOwner, conflictingWork]) {
      assert.equal(presentation.ownership, 'unknown');
      assert.equal(presentation.activeOwner, null);
      assert.deepEqual(presentation.contextualActions, []);
      assert.ok(Object.values(presentation.eligibility).every(({ locked }) => locked));
      assert.ok(
        Object.values(presentation.eligibility).every(({ reasons }) => reasons.includes('text-action-owner-unknown')),
      );
    }
  });

  it('locks only affected actions for unknown provider and enablement snapshots', () => {
    const voiceUnknown = createInput({
      snapshots: {
        ...createInput().snapshots,
        voiceProvider: false,
      },
    });
    const textEnablementUnknown = createInput({
      snapshots: {
        ...createInput().snapshots,
        textActionEnablement: false,
      },
    });

    assert.equal(deriveProviderHotkeyPresentation(voiceUnknown).eligibility.voice.locked, true);
    assert.equal(deriveProviderHotkeyPresentation(voiceUnknown).eligibility.prettify.locked, false);
    assert.equal(deriveProviderHotkeyPresentation(voiceUnknown).eligibility.translation.locked, false);
    assert.equal(deriveProviderHotkeyPresentation(textEnablementUnknown).eligibility.voice.locked, false);
    assert.equal(deriveProviderHotkeyPresentation(textEnablementUnknown).eligibility.prettify.locked, true);
    assert.equal(deriveProviderHotkeyPresentation(textEnablementUnknown).eligibility.translation.locked, true);
  });

  it('fails closed for each missing action hotkey and reconciles once a complete snapshot arrives', () => {
    const incomplete = createInput({
      snapshots: {
        ...createInput().snapshots,
        hotkeys: {
          ...createInput().snapshots.hotkeys,
          prettify: false,
        },
      },
    });

    assert.deepEqual(reasonsFor(incomplete, 'prettify'), ['snapshot-unknown']);
    assert.equal(deriveProviderHotkeyPresentation(incomplete).eligibility.voice.locked, false);
    assert.equal(deriveProviderHotkeyPresentation(incomplete).eligibility.translation.locked, false);
    assert.equal(deriveProviderHotkeyPresentation(createInput()).eligibility.prettify.locked, false);
  });

  it('locks every action for unknown global activity and transition snapshots', () => {
    const snapshots = createInput().snapshots;
    const unknownActivity = createInput({
      snapshots: {
        ...snapshots,
        textActionActivity: false,
      },
    });
    const unknownTransition = createInput({
      snapshots: {
        ...snapshots,
        providerTransition: false,
      },
    });

    for (const input of [unknownActivity, unknownTransition]) {
      const presentation = deriveProviderHotkeyPresentation(input);
      assert.equal(presentation.ownership, 'unknown');
      assert.ok(Object.values(presentation.eligibility).every(({ locked }) => locked));
      assert.deepEqual(presentation.contextualActions, []);
    }
  });

  it('locks every provider key for each authoritative global lock source', () => {
    const cases: readonly [string, Partial<ProviderHotkeyEligibilityInput>, ProviderHotkeyLockReason][] = [
      ['main interaction', { mainInteractionLocked: true }, 'main-interaction-locked'],
      ['provider transition', { providerTransitionActive: true }, 'provider-transition-active'],
      ['prettify model action', { prettifyModelActionActive: true }, 'prettify-model-action-active'],
    ];

    for (const [, override, reason] of cases) {
      const presentation = deriveProviderHotkeyPresentation(createInput(override));
      assert.ok(Object.values(presentation.eligibility).every(({ locked }) => locked));
      assert.ok(Object.values(presentation.eligibility).every(({ reasons }) => reasons.includes(reason)));
    }
  });

  it('keeps provider-specific unavailable reasons scoped to their own provider', () => {
    const voiceUnavailable = deriveProviderHotkeyPresentation(createInput({ voiceProviderAvailable: false }));
    const prettifyDisabled = deriveProviderHotkeyPresentation(createInput({ prettifyEnabled: false }));
    const translationDisabled = deriveProviderHotkeyPresentation(createInput({ translationEnabled: false }));

    assert.deepEqual(voiceUnavailable.eligibility.voice.reasons, ['voice-provider-unavailable']);
    assert.equal(voiceUnavailable.eligibility.prettify.locked, false);
    assert.equal(voiceUnavailable.eligibility.translation.locked, false);
    assert.deepEqual(prettifyDisabled.eligibility.prettify.reasons, ['prettify-disabled']);
    assert.equal(prettifyDisabled.eligibility.voice.locked, false);
    assert.equal(prettifyDisabled.eligibility.translation.locked, false);
    assert.deepEqual(translationDisabled.eligibility.translation.reasons, ['translation-disabled']);
    assert.equal(translationDisabled.eligibility.voice.locked, false);
    assert.equal(translationDisabled.eligibility.prettify.locked, false);
  });

  it('omits contextual actions while an otherwise known owner has an unavailable global cancel path', () => {
    const presentation = deriveProviderHotkeyPresentation(
      createInput({
        activeTextAction: 'prettify',
        activeTextActionCancellable: true,
        snapshots: {
          ...createInput().snapshots,
          textActionCancellability: false,
        },
        textActionActivityActive: true,
      }),
    );

    assert.equal(presentation.activeOwner, 'prettify');
    assert.deepEqual(presentation.contextualActions, []);
  });

  it('composes global and per-action locks without premature unlock', () => {
    const input = createInput({
      mainInteractionLocked: true,
      prettifyEnabled: false,
      providerTransitionActive: true,
    });
    const releasedTransition = { ...input, providerTransitionActive: false };
    const releasedMainLock = { ...releasedTransition, mainInteractionLocked: false };

    assert.deepEqual(reasonsFor(input, 'prettify'), [
      'main-interaction-locked',
      'provider-transition-active',
      'prettify-disabled',
    ]);
    assert.equal(deriveProviderHotkeyPresentation(releasedTransition).eligibility.prettify.locked, true);
    assert.deepEqual(reasonsFor(releasedMainLock, 'prettify'), ['prettify-disabled']);
    assert.equal(deriveProviderHotkeyPresentation(releasedMainLock).eligibility.prettify.locked, true);
  });

  it('does not use provider connection appearance as eligibility input', () => {
    const presentation = deriveProviderHotkeyPresentation(createInput());

    assert.equal(presentation.eligibility.voice.locked, false);
    assert.equal(presentation.eligibility.prettify.locked, false);
    assert.equal(presentation.eligibility.translation.locked, false);
  });
});
