import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type LocalWhisperArtifactAction,
  type LocalWhisperArtifactReference,
  type LocalWhisperRendererArtifact,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import type { ElectronAPI } from '@renderer/types';
import { LocalWhisperRendererService } from './LocalWhisperRendererService';
import { LocalWhisperSettingsLifecycle } from './LocalWhisperSettingsLifecycle';
import { getLatestLocalWhisperArtifactProgress } from './LocalWhisperPresentation';
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
  readonly cancelArtifactOperations: (operationIds: readonly string[]) => Promise<boolean>;
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

/** Owns one settings-window subscription, draft, and protected command lifecycle. */
export default function useLocalWhisperSettings(desktopApi: ElectronAPI): LocalWhisperSettingsController {
  const [service] = useState(() => new LocalWhisperRendererService(desktopApi, 'local-whisper'));
  const [state, setState] = useState<ControllerState>(INITIAL_STATE);
  const [lifecycle] = useState(
    () =>
      new LocalWhisperSettingsLifecycle(service, {
        publishActionError: (actionError) => {
          setState((current) => ({ ...current, actionError }));
        },
        publishPendingAction: (pendingAction) => {
          setState((current) => ({
            ...current,
            pendingAction,
            actionError: pendingAction === null ? current.actionError : null,
          }));
        },
        publishSettingsLoadFailure: () => {
          setState((current) => ({
            ...current,
            loading: false,
            actionError: 'Local Whisper settings could not be loaded.',
          }));
        },
        publishSnapshot: (snapshot, resetDraft) => {
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
        },
      }),
  );

  useEffect(() => {
    lifecycle.start();
    return () => lifecycle.dispose();
  }, [lifecycle]);

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

  const save = useCallback(async (): Promise<boolean> => {
    if (!state.snapshot || !state.draft) return false;
    const currentValidation = validateLocalWhisperDraft(state.draft, state.snapshot);
    if (!currentValidation.candidate || !currentValidation.promptMutation) {
      setState((value) => ({ ...value, actionError: 'Fix the highlighted settings before saving.' }));
      return false;
    }
    return lifecycle.run(
      'save',
      () => service.save(currentValidation.candidate!, currentValidation.promptMutation!),
      true,
    );
  }, [lifecycle, service, state.draft, state.snapshot]);

  const reset = useCallback(() => lifecycle.run('reset', () => service.reset(), true), [lifecycle, service]);
  const checkCompatibility = useCallback(
    () => lifecycle.run('checkCompatibility', () => service.checkCompatibility(), false),
    [lifecycle, service],
  );
  const loadModel = useCallback(() => lifecycle.run('load', () => service.load(), false), [lifecycle, service]);
  const unloadModel = useCallback(() => lifecycle.run('unload', () => service.unload(), false), [lifecycle, service]);
  const openStorageFolder = useCallback(
    () => lifecycle.run('openStorageFolder', () => service.openManagedFolder(), false),
    [lifecycle, service],
  );

  const cancelArtifactOperations = useCallback(
    (operationIds: readonly string[]) => lifecycle.cancelArtifactOperations(operationIds),
    [lifecycle],
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
          return lifecycle.run('download', () => service.download(target), false);
        case 'resume':
          return lifecycle.run('resume', () => service.resume(target), false);
        case 'retry':
          return lifecycle.run('retry', () => service.retry(target), false);
        case 'update':
          return lifecycle.run('update', () => service.update(target), false);
        case 'cancel': {
          const operationId = state.snapshot
            ? getLatestLocalWhisperArtifactProgress(state.snapshot.progress, artifact.id)?.operationId
            : undefined;
          if (!operationId) return Promise.resolve(false);
          return cancelArtifactOperations([operationId]);
        }
        case 'remove':
          return lifecycle.run('remove', () => service.remove(target, true), false);
      }
    },
    [cancelArtifactOperations, lifecycle, service, state.snapshot],
  );

  const viewArtifactReference = useCallback(
    (reference: LocalWhisperArtifactReference) =>
      lifecycle.run('viewReference', () => service.viewArtifactReference(reference), false),
    [lifecycle, service],
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
    cancelArtifactOperations,
    openStorageFolder,
    viewArtifactReference,
    clearActionError,
  };
}
