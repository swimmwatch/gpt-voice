import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ProviderHomeActionDispatcher } from '@main/providerHomeActionDispatcher';
import { SelectedTextActionGate } from '@main/services/selectedTextActionState';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

interface Harness {
  readonly cancelCalls: string[];
  readonly dispatcher: ProviderHomeActionDispatcher;
  readonly focusCalls: { count: number };
  readonly gate: SelectedTextActionGate;
  readonly publications: unknown[];
  recordingState: RecordingLifecycleState;
  readonly settings: {
    prettifyEnabled: boolean;
    prettifyQuickEnabled: boolean;
    translateEnabled: boolean;
  };
}

function createHarness(): Harness {
  const gate = new SelectedTextActionGate();
  const publications: unknown[] = [];
  const cancelCalls: string[] = [];
  const focusCalls = { count: 0 };
  const settings = {
    prettifyEnabled: true,
    prettifyQuickEnabled: true,
    translateEnabled: true,
  };
  const harness: Harness = {
    cancelCalls,
    get dispatcher(): ProviderHomeActionDispatcher {
      return dispatcher;
    },
    focusCalls,
    gate,
    publications,
    recordingState: 'idle',
    settings,
  };
  const dispatcher = new ProviderHomeActionDispatcher({
    config: {
      getSnapshot: () => ({ prettifySettings: { providerId: 'ollama' } }),
      getTextActionSettings: () => settings,
    } as never,
    getRecordingLifecycleState: () => harness.recordingState,
    localization: { translate: (key: string) => key },
    logger: { info: () => {}, warn: () => {} },
    mainInteractionLock: { locked: false },
    notification: { show: () => {} },
    prettifyRuntime: { isProviderConnected: () => true },
    selectedTextActionGate: gate,
    selectedTextPrettifyService: {
      canCancel: () => gate.getActive() === 'prettify',
      cancel: () => {
        cancelCalls.push('prettify');
        return { cancelled: true, status: '', success: false };
      },
      chooseProfileForSelectedText: async () => {
        gate.tryBegin('prettify');
        return { status: '', success: true };
      },
      focusExistingChooser: () => {
        focusCalls.count += 1;
        return true;
      },
    },
    selectedTextTranslationService: {
      canCancel: () => gate.getActive() === 'translate',
      cancel: () => {
        cancelCalls.push('translation');
        return true;
      },
      translateSelectedTextToClipboard: async () => {
        gate.tryBegin('translate');
        return { status: '', success: true };
      },
    },
    trayController: { updateIcon: () => {} },
    windowManager: {
      getMainWindow: () => null,
      publishProviderHomeActionState: (state) => publications.push(state),
    },
  });
  return harness;
}

describe('ProviderHomeActionDispatcher', () => {
  it('allows only a global shortcut to refocus an active Prettify chooser', () => {
    const harness = createHarness();

    assert.deepEqual(harness.dispatcher.dispatch({ action: 'start', provider: 'prettify' }, 'global-shortcut'), {
      accepted: true,
    });
    assert.equal(harness.focusCalls.count, 1);

    assert.deepEqual(harness.dispatcher.dispatch({ action: 'start', provider: 'prettify' }, 'provider-home'), {
      accepted: true,
    });
    assert.equal(harness.focusCalls.count, 1);
  });

  it('rejects a homepage Prettify start while selected-text work already owns the gate without refocusing', () => {
    const harness = createHarness();
    harness.gate.tryBegin('prettify');

    assert.deepEqual(harness.dispatcher.dispatch({ action: 'start', provider: 'prettify' }, 'provider-home'), {
      accepted: false,
    });
    assert.equal(harness.focusCalls.count, 0);
  });

  it('cancels only the exact currently owned provider and publishes safe cancellability', () => {
    const harness = createHarness();
    harness.gate.tryBegin('translate');

    assert.deepEqual(harness.dispatcher.getState(), {
      activeAction: 'translation',
      activeActionCancellable: true,
      settings: harness.settings,
    });
    assert.deepEqual(harness.dispatcher.dispatch({ action: 'cancel', provider: 'prettify' }, 'provider-home'), {
      accepted: false,
    });
    assert.deepEqual(harness.dispatcher.dispatch({ action: 'cancel', provider: 'translation' }, 'escape'), {
      accepted: true,
    });
    assert.deepEqual(harness.cancelCalls, ['translation']);
    assert.ok(harness.publications.length > 0);
  });

  it('rejects starts during recording and honors the current main-owned text-action setting', () => {
    const harness = createHarness();
    harness.recordingState = 'recording';
    assert.equal(
      harness.dispatcher.dispatch({ action: 'start', provider: 'translation' }, 'provider-home').accepted,
      false,
    );

    harness.recordingState = 'idle';
    harness.settings.translateEnabled = false;
    assert.equal(
      harness.dispatcher.dispatch({ action: 'start', provider: 'translation' }, 'provider-home').accepted,
      false,
    );
  });

  it('rejects post-disposal commands without republishing renderer state', () => {
    const harness = createHarness();
    harness.dispatcher.dispose();

    assert.deepEqual(harness.dispatcher.dispatch({ action: 'start', provider: 'translation' }, 'provider-home'), {
      accepted: false,
    });
    assert.deepEqual(harness.publications, []);
  });
});
