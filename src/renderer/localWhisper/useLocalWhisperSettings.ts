import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LocalWhisperArtifactAction,
  type LocalWhisperArtifactReference,
  type LocalWhisperRendererArtifact,
  type LocalWhisperRendererSafeFailure,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import type { ElectronAPI } from '@renderer/types';
import { LocalWhisperRendererService } from './LocalWhisperRendererService';
import { formatLocalWhisperFailureCode, formatLocalWhisperRecoveryAction } from './LocalWhisperPresentation';
import {
  createLocalWhisperDraft,
  validateLocalWhisperDraft,
  type LocalWhisperDraftValidation,
  type LocalWhisperSettingsDraft,
} from './LocalWhisperSettingsState';

export interface LocalWhisperSettingsController {
  readonly snapshot: LocalWhisperRendererSnapshot | null;
  readonly draft: LocalWhisperSettingsDraft | null;
  readonly validation: LocalWhisperDraftValidation | null;
  readonly dirty: boolean;
  readonly loading: boolean;
  readonly pendingAction: string | null;
  readonly actionError: string | null;
  readonly updateDraft: (updater: (draft: LocalWhisperSettingsDraft) => LocalWhisperSettingsDraft) => void;
  readonly save: () => Promise<boolean>;
  readonly reset: () => Promise<boolean>;
  readonly checkCompatibility: () => Promise<boolean>;
  readonly loadModel: () => Promise<boolean>;
  readonly unloadModel: () => Promise<boolean>;
  readonly performArtifactAction: (
    action: LocalWhisperArtifactAction,
    artifact: LocalWhisperRendererArtifact,
  ) => Promise<boolean>;
  readonly openStorageFolder: () => Promise<boolean>;
  readonly viewArtifactReference: (reference: LocalWhisperArtifactReference) => Promise<boolean>;
  readonly clearActionError: () => void;
}

interface ControllerState {
  readonly snapshot: LocalWhisperRendererSnapshot | null;
  readonly draft: LocalWhisperSettingsDraft | null;
  readonly dirty: boolean;
  readonly loading: boolean;
  readonly pendingAction: string | null;
  readonly actionError: string | null;
}

const INITIAL_STATE: ControllerState = Object.freeze({
  snapshot: null,
  draft: null,
  dirty: false,
  loading: true,
  pendingAction: null,
  actionError: null,
});

function safeActionError(result: { readonly error: LocalWhisperRendererSafeFailure }): string {
  return `${formatLocalWhisperFailureCode(result.error.code)}. Recovery: ${formatLocalWhisperRecoveryAction(
    result.error.recoveryAction,
  )}.`;
}

/** Owns one settings-window subscription, draft, and protected command lifecycle. */
export default function useLocalWhisperSettings(desktopApi: ElectronAPI): LocalWhisperSettingsController {
  const [service] = useState(() => new LocalWhisperRendererService(desktopApi, 'local-whisper'));
  const [state, setState] = useState<ControllerState>(INITIAL_STATE);
  const commandPendingRef = useRef(false);

  const acceptSnapshot = useCallback((snapshot: LocalWhisperRendererSnapshot, resetDraft: boolean) => {
    setState((current) => {
      const replaceDraft = resetDraft || !current.dirty || current.draft === null;
      return Object.freeze({
        ...current,
        snapshot,
        draft: replaceDraft ? createLocalWhisperDraft(snapshot) : current.draft,
        dirty: replaceDraft ? false : current.dirty,
        loading: false,
      });
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    const removeListener = service.subscribeSettings((nextSnapshot) => {
      if (disposed) return;
      acceptSnapshot(nextSnapshot, false);
    });
    void service.startSettings().catch(() => {
      if (!disposed) {
        setState((current) => ({
          ...current,
          loading: false,
          actionError: 'Local Whisper settings could not be loaded.',
        }));
      }
    });
    return () => {
      disposed = true;
      removeListener();
      void service.dispose();
    };
  }, [acceptSnapshot, service]);

  const validation = useMemo(
    () => (state.draft && state.snapshot ? validateLocalWhisperDraft(state.draft, state.snapshot) : null),
    [state.draft, state.snapshot],
  );

  const updateDraft = useCallback((updater: (draft: LocalWhisperSettingsDraft) => LocalWhisperSettingsDraft) => {
    setState((current) => {
      if (!current.draft) return current;
      return Object.freeze({ ...current, draft: updater(current.draft), dirty: true, actionError: null });
    });
  }, []);

  const run = useCallback(
    async (
      action: string,
      operation: () => Promise<
        | { readonly success: true; readonly snapshot: LocalWhisperRendererSnapshot }
        | {
            readonly success: false;
            readonly snapshot: LocalWhisperRendererSnapshot;
            readonly error: LocalWhisperRendererSafeFailure;
          }
      >,
      resetDraft: boolean,
    ): Promise<boolean> => {
      if (commandPendingRef.current) return false;
      commandPendingRef.current = true;
      setState((current) => ({ ...current, pendingAction: action, actionError: null }));
      try {
        const result = await operation();
        if (result.success) {
          acceptSnapshot(result.snapshot, resetDraft);
          return true;
        }
        setState((current) => ({ ...current, actionError: safeActionError(result) }));
        return false;
      } catch {
        setState((current) => ({ ...current, actionError: 'The Local Whisper action could not be completed.' }));
        return false;
      } finally {
        commandPendingRef.current = false;
        setState((current) => ({ ...current, pendingAction: null }));
      }
    },
    [acceptSnapshot],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!state.snapshot || !state.draft) return false;
    const currentValidation = validateLocalWhisperDraft(state.draft, state.snapshot);
    if (!currentValidation.candidate || !currentValidation.promptMutation) {
      setState((value) => ({ ...value, actionError: 'Fix the highlighted settings before saving.' }));
      return false;
    }
    return run('save', () => service.save(currentValidation.candidate!, currentValidation.promptMutation!), true);
  }, [run, service, state.draft, state.snapshot]);

  const reset = useCallback(() => run('reset', () => service.reset(), true), [run, service]);
  const checkCompatibility = useCallback(
    () => run('checkCompatibility', () => service.checkCompatibility(), false),
    [run, service],
  );
  const loadModel = useCallback(() => run('load', () => service.load(), false), [run, service]);
  const unloadModel = useCallback(() => run('unload', () => service.unload(), false), [run, service]);
  const openStorageFolder = useCallback(
    () => run('openStorageFolder', () => service.openManagedFolder(), false),
    [run, service],
  );

  const performArtifactAction = useCallback(
    (action: LocalWhisperArtifactAction, artifact: LocalWhisperRendererArtifact): Promise<boolean> => {
      const target = {
        artifactId: artifact.id,
        artifactKind: artifact.kind,
        artifactRevision: artifact.revision,
      } as const;
      switch (action) {
        case 'download':
          return run('download', () => service.download(target), false);
        case 'resume':
          return run('resume', () => service.resume(target), false);
        case 'retry':
          return run('retry', () => service.retry(target), false);
        case 'cancel': {
          const operationId = state.snapshot?.progress.find(
            (progress) => progress.artifactId === artifact.id,
          )?.operationId;
          if (!operationId) return Promise.resolve(false);
          return run('cancel', () => service.cancelArtifact(operationId), false);
        }
        case 'remove':
          return run('remove', () => service.remove(target, true), false);
      }
    },
    [run, service, state.snapshot],
  );

  const viewArtifactReference = useCallback(
    (reference: LocalWhisperArtifactReference) =>
      run('viewReference', () => service.viewArtifactReference(reference), false),
    [run, service],
  );

  const clearActionError = useCallback(() => setState((current) => ({ ...current, actionError: null })), []);

  return {
    ...state,
    validation,
    updateDraft,
    save,
    reset,
    checkCompatibility,
    loadModel,
    unloadModel,
    performArtifactAction,
    openStorageFolder,
    viewArtifactReference,
    clearActionError,
  };
}
