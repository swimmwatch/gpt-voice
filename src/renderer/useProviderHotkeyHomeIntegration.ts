import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deriveProviderHotkeyPresentation, type ProviderHotkeyPresentation } from '@renderer/providerHotkeyEligibility';
import type { ElectronAPI } from '@renderer/types';
import type { HotkeyRuntimeState } from '@shared/hotkeyIpc';
import type { HotkeyRuntimeSnapshotEntry, HotkeyTarget } from '@shared/hotkeys';
import type {
  ProviderContextualActionDescriptor,
  ProviderHomeAction,
  ProviderHomeActionState,
  ProviderHomeTextAction,
} from '@shared/providerHomeAction';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import type { TextActionStatusAction } from '@shared/textActionStatus';

interface ProviderHotkeyHomeIntegrationOptions {
  readonly activeProviderId: string | null;
  readonly activeTextAction: TextActionStatusAction | null;
  readonly desktopApi: ElectronAPI;
  readonly isInitialVoiceProviderLoading: boolean;
  readonly isPrettifyModelActionRunning: boolean;
  readonly isPrettifyProviderSwitching: boolean;
  readonly isTextActionActivityActive: boolean | null;
  readonly isTranslationProviderSwitching: boolean;
  readonly isVoiceProviderReady: boolean;
  readonly isVoiceProviderSwitching: boolean;
  readonly onIdleRecordHotkey: (hotkey: string) => void;
  readonly onProviderActionRejected: (provider: ProviderHomeTextAction) => void;
  readonly onVoiceCancel: () => void;
  readonly onVoicePause: () => void;
  readonly onVoiceResume: () => void;
  readonly onVoiceStart: () => void;
  readonly onVoiceStop: () => void;
  readonly recordingState: RecordingLifecycleState;
  readonly translate: (key: string) => string;
}

export type ProviderContextualActionIcon = 'cancel' | 'pause' | 'resume' | 'stop';

export interface ProviderHotkeyContextualAction extends ProviderContextualActionDescriptor {
  readonly hotkey: string | null;
  readonly icon: ProviderContextualActionIcon;
  readonly label: string;
  readonly onActivate: () => void;
}

export interface ProviderHotkeyRegistrationEntries {
  readonly prettify: HotkeyRuntimeSnapshotEntry | null;
  readonly translation: HotkeyRuntimeSnapshotEntry | null;
  readonly voice: HotkeyRuntimeSnapshotEntry | null;
}

export interface ProviderHotkeyHomeIntegration {
  readonly activatePrettify: () => void;
  readonly activateTranslation: () => void;
  readonly activateVoice: () => void;
  readonly contextualActions: readonly ProviderHotkeyContextualAction[];
  readonly isMainInteractionLocked: boolean;
  readonly hotkeyEntries: ProviderHotkeyRegistrationEntries;
  readonly pendingProviderHomeAction: ProviderHomeTextAction | null;
  readonly presentation: ProviderHotkeyPresentation;
  readonly voiceActionLabel: string;
}

function getHotkeyRuntimeSnapshotEntry(
  runtimeState: HotkeyRuntimeState | null,
  target: HotkeyTarget,
): HotkeyRuntimeSnapshotEntry | null {
  return runtimeState?.snapshot.entries.find((entry) => entry.target === target) ?? null;
}

/** Reconciles authoritative renderer-safe snapshots into provider-key controls. */
export function useProviderHotkeyHomeIntegration({
  activeProviderId,
  activeTextAction,
  desktopApi,
  isInitialVoiceProviderLoading,
  isPrettifyModelActionRunning,
  isPrettifyProviderSwitching,
  isTextActionActivityActive,
  isTranslationProviderSwitching,
  isVoiceProviderReady,
  isVoiceProviderSwitching,
  onIdleRecordHotkey,
  onProviderActionRejected,
  onVoiceCancel,
  onVoicePause,
  onVoiceResume,
  onVoiceStart,
  onVoiceStop,
  recordingState,
  translate,
}: ProviderHotkeyHomeIntegrationOptions): ProviderHotkeyHomeIntegration {
  const [hasMainInteractionLockSnapshot, setHasMainInteractionLockSnapshot] = useState(false);
  const [hotkeyRuntimeState, setHotkeyRuntimeState] = useState<HotkeyRuntimeState | null>(null);
  const [isMainInteractionLocked, setIsMainInteractionLocked] = useState(false);
  const [pendingProviderHomeAction, setPendingProviderHomeAction] = useState<ProviderHomeTextAction | null>(null);
  const pendingProviderHomeActionRef = useRef<ProviderHomeTextAction | null>(null);
  const [providerHomeActionState, setProviderHomeActionState] = useState<ProviderHomeActionState | null>(null);

  useEffect(() => {
    let disposed = false;
    const acceptSnapshot = (locked: boolean): void => {
      if (disposed) return;
      setIsMainInteractionLocked(locked);
      setHasMainInteractionLockSnapshot(true);
    };
    const unsubscribe = desktopApi.onMainInteractionLockChanged(acceptSnapshot);

    void desktopApi
      .getMainInteractionLocked()
      .then(acceptSnapshot)
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [desktopApi]);

  useEffect(() => {
    let disposed = false;
    let eventVersion = 0;
    const acceptSnapshot = (nextState: ProviderHomeActionState): void => {
      if (!disposed) setProviderHomeActionState(nextState);
    };
    const unsubscribe = desktopApi.onProviderHomeActionStateChanged((nextState) => {
      eventVersion += 1;
      acceptSnapshot(nextState);
    });
    const queryEventVersion = eventVersion;

    void desktopApi
      .getProviderHomeActionState()
      .then((nextState) => {
        if (!disposed && eventVersion === queryEventVersion) acceptSnapshot(nextState);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [desktopApi]);

  useEffect(() => {
    let disposed = false;
    let latestRevision = -1;
    const acceptRuntimeState = (state: HotkeyRuntimeState): void => {
      if (disposed || state.revision < latestRevision) return;
      latestRevision = state.revision;
      setHotkeyRuntimeState(state);
      const recordEntry = getHotkeyRuntimeSnapshotEntry(state, 'record');
      const recordHotkey = recordEntry?.configuredAccelerator;
      if (recordHotkey) onIdleRecordHotkey(recordHotkey);
    };
    const unsubscribe = desktopApi.onHotkeyRuntimeStateChanged(acceptRuntimeState);

    void desktopApi
      .getHotkeyRuntimeState()
      .then(acceptRuntimeState)
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [desktopApi, onIdleRecordHotkey]);

  const hotkeyEntries = useMemo<ProviderHotkeyRegistrationEntries>(
    () =>
      Object.freeze({
        prettify: getHotkeyRuntimeSnapshotEntry(hotkeyRuntimeState, 'prettify'),
        translation: getHotkeyRuntimeSnapshotEntry(hotkeyRuntimeState, 'translate'),
        voice: getHotkeyRuntimeSnapshotEntry(hotkeyRuntimeState, 'record'),
      }),
    [hotkeyRuntimeState],
  );
  const stopHotkey = getHotkeyRuntimeSnapshotEntry(hotkeyRuntimeState, 'stop')?.configuredAccelerator ?? null;
  const cancelHotkey = getHotkeyRuntimeSnapshotEntry(hotkeyRuntimeState, 'cancel')?.configuredAccelerator ?? null;

  const presentation = useMemo(
    () =>
      deriveProviderHotkeyPresentation({
        activeTextAction: providerHomeActionState?.activeAction ?? activeTextAction,
        activeTextActionCancellable: providerHomeActionState?.activeActionCancellable ?? false,
        mainInteractionLocked: isMainInteractionLocked,
        prettifyEnabled: providerHomeActionState?.settings.prettifyEnabled ?? false,
        prettifyModelActionActive: isPrettifyModelActionRunning,
        providerTransitionActive:
          isVoiceProviderSwitching ||
          isPrettifyProviderSwitching ||
          isTranslationProviderSwitching ||
          pendingProviderHomeAction !== null,
        recordingState,
        snapshots: {
          hotkeys: {
            prettify: hotkeyRuntimeState !== null,
            translation: hotkeyRuntimeState !== null,
            voice: hotkeyRuntimeState !== null,
          },
          mainInteractionLock: hasMainInteractionLockSnapshot,
          prettifyModelAction: true,
          providerTransition: !isInitialVoiceProviderLoading,
          recordingLifecycle: true,
          textActionActivity: isTextActionActivityActive !== null,
          textActionCancellability: providerHomeActionState !== null,
          textActionEnablement: providerHomeActionState !== null,
          textActionOwner: providerHomeActionState !== null,
          voiceProvider: !isInitialVoiceProviderLoading,
        },
        textActionActivityActive: isTextActionActivityActive === true,
        translationEnabled: providerHomeActionState?.settings.translateEnabled ?? false,
        voiceProviderAvailable: activeProviderId !== null && isVoiceProviderReady,
      }),
    [
      activeProviderId,
      activeTextAction,
      hasMainInteractionLockSnapshot,
      hotkeyRuntimeState,
      isInitialVoiceProviderLoading,
      isMainInteractionLocked,
      isPrettifyModelActionRunning,
      isPrettifyProviderSwitching,
      isTextActionActivityActive,
      isTranslationProviderSwitching,
      isVoiceProviderReady,
      isVoiceProviderSwitching,
      pendingProviderHomeAction,
      providerHomeActionState,
      recordingState,
    ],
  );

  const activateVoice = useCallback((): void => {
    if (presentation.eligibility.voice.locked) return;

    switch (recordingState) {
      case 'idle':
        onVoiceStart();
        return;
      case 'recording':
        onVoicePause();
        return;
      case 'paused':
        onVoiceResume();
        return;
      case 'starting':
      case 'stopping':
      case 'transcribing':
      case 'retrying':
        return;
    }
  }, [onVoicePause, onVoiceResume, onVoiceStart, presentation.eligibility.voice.locked, recordingState]);

  const dispatchProviderHomeAction = useCallback(
    (action: 'cancel' | 'start', provider: ProviderHomeTextAction): void => {
      if (pendingProviderHomeActionRef.current !== null) return;

      pendingProviderHomeActionRef.current = provider;
      setPendingProviderHomeAction(provider);
      void desktopApi
        .runProviderHomeAction({ action, provider })
        .then((result) => {
          if (!result.accepted) onProviderActionRejected(provider);
        })
        .catch(() => onProviderActionRejected(provider))
        .finally(() => {
          pendingProviderHomeActionRef.current = null;
          setPendingProviderHomeAction(null);
        });
    },
    [desktopApi, onProviderActionRejected],
  );

  const activateProviderHomeAction = useCallback(
    (provider: ProviderHomeTextAction): void => {
      if (presentation.eligibility[provider].locked) return;
      dispatchProviderHomeAction('start', provider);
    },
    [dispatchProviderHomeAction, presentation.eligibility],
  );

  const activatePrettify = useCallback(() => activateProviderHomeAction('prettify'), [activateProviderHomeAction]);
  const activateTranslation = useCallback(
    () => activateProviderHomeAction('translation'),
    [activateProviderHomeAction],
  );
  const activateTextActionCancel = useCallback(
    (provider: ProviderHomeAction): void => {
      if (provider === 'voice') return;
      const isCancellableOwner = presentation.contextualActions.some(
        (action) => action.action === 'cancel' && action.provider === provider,
      );
      if (!isCancellableOwner) return;
      dispatchProviderHomeAction('cancel', provider);
    },
    [dispatchProviderHomeAction, presentation.contextualActions],
  );
  const voiceActionLabel = translate(
    recordingState === 'recording'
      ? 'recording.pause'
      : recordingState === 'paused'
        ? 'recording.resume'
        : 'recording.startCommand',
  );
  const contextualActions = useMemo<readonly ProviderHotkeyContextualAction[]>(
    () =>
      presentation.contextualActions.map((action) => {
        switch (action.action) {
          case 'pause':
            return {
              ...action,
              hotkey: hotkeyEntries.voice?.configuredAccelerator ?? null,
              icon: 'pause',
              label: translate('recording.pause'),
              onActivate: onVoicePause,
            };
          case 'resume':
            return {
              ...action,
              hotkey: hotkeyEntries.voice?.configuredAccelerator ?? null,
              icon: 'resume',
              label: translate('recording.resume'),
              onActivate: onVoiceResume,
            };
          case 'stop':
            return {
              ...action,
              hotkey: stopHotkey,
              icon: 'stop',
              label: translate('recording.stop'),
              onActivate: onVoiceStop,
            };
          case 'cancel':
            if (action.provider === 'voice') {
              return {
                ...action,
                hotkey: cancelHotkey,
                icon: 'cancel',
                label: translate('recording.cancel'),
                onActivate: onVoiceCancel,
              };
            }
            return {
              ...action,
              hotkey: cancelHotkey,
              icon: 'cancel',
              label: translate('prettify.chooser.cancel'),
              onActivate: () => activateTextActionCancel(action.provider),
            };
        }
      }),
    [
      activateTextActionCancel,
      cancelHotkey,
      hotkeyEntries.voice?.configuredAccelerator,
      onVoiceCancel,
      onVoicePause,
      onVoiceResume,
      onVoiceStop,
      presentation.contextualActions,
      stopHotkey,
      translate,
    ],
  );

  return {
    activatePrettify,
    activateTranslation,
    activateVoice,
    contextualActions,
    hotkeyEntries,
    isMainInteractionLocked,
    pendingProviderHomeAction,
    presentation,
    voiceActionLabel,
  };
}
