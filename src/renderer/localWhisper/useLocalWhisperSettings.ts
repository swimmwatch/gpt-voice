import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES,
  type LocalWhisperArtifactAction,
  type LocalWhisperArtifactProgress,
  type LocalWhisperArtifactReference,
  type LocalWhisperRendererArtifact,
  type LocalWhisperRendererSafeFailure,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import type { ElectronAPI } from '@renderer/types';
import { LocalWhisperRendererService } from './LocalWhisperRendererService';
import {
  formatLocalWhisperFailureCode,
  formatLocalWhisperRecoveryAction,
  getLatestLocalWhisperArtifactProgress,
  isLocalWhisperArtifactProgressActive,
} from './LocalWhisperPresentation';
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

interface ArtifactOperationWaiter {
  readonly operationIds: ReadonlySet<string>;
  readonly resolve: (settled: boolean) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const INITIAL_STATE: ControllerState = Object.freeze({
  snapshot: null,
  draft: null,
  dirty: false,
  loading: true,
  pendingAction: null,
  actionError: null,
});

const MAX_CLOSE_CANCELLATION_OPERATIONS = 2;
const ARTIFACT_CANCELLATION_SETTLE_TIMEOUT_MS = 30_000;
const CANCELLABLE_ARTIFACT_PROGRESS_STATES: ReadonlySet<LocalWhisperArtifactProgress['state']> = new Set(
  LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES,
);

function safeActionError(result: { readonly error: LocalWhisperRendererSafeFailure }): string {
  return `${formatLocalWhisperFailureCode(result.error.code)}. Recovery: ${formatLocalWhisperRecoveryAction(
    result.error.recoveryAction,
  )}.`;
}

function areArtifactOperationsTerminal(
  snapshot: LocalWhisperRendererSnapshot,
  operationIds: ReadonlySet<string>,
): boolean {
  return !snapshot.progress.some(
    (progress) => operationIds.has(progress.operationId) && isLocalWhisperArtifactProgressActive(progress),
  );
}

/** Owns one settings-window subscription, draft, and protected command lifecycle. */
export default function useLocalWhisperSettings(desktopApi: ElectronAPI): LocalWhisperSettingsController {
  const [service] = useState(() => new LocalWhisperRendererService(desktopApi, 'local-whisper'));
  const [state, setState] = useState<ControllerState>(INITIAL_STATE);
  const commandPendingRef = useRef(false);
  const disposedRef = useRef(false);
  const operationWaitersRef = useRef(new Set<ArtifactOperationWaiter>());
  const snapshotRef = useRef<LocalWhisperRendererSnapshot | null>(null);

  const settleOperationWaiter = useCallback((waiter: ArtifactOperationWaiter, settled: boolean): void => {
    if (!operationWaitersRef.current.delete(waiter)) return;
    clearTimeout(waiter.timeout);
    waiter.resolve(settled);
  }, []);

  const resolveTerminalOperationWaiters = useCallback(
    (snapshot: LocalWhisperRendererSnapshot): void => {
      for (const waiter of operationWaitersRef.current) {
        if (areArtifactOperationsTerminal(snapshot, waiter.operationIds)) settleOperationWaiter(waiter, true);
      }
    },
    [settleOperationWaiter],
  );

  const acceptSnapshot = useCallback(
    (snapshot: LocalWhisperRendererSnapshot, resetDraft: boolean) => {
      snapshotRef.current = snapshot;
      resolveTerminalOperationWaiters(snapshot);
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
    [resolveTerminalOperationWaiters],
  );

  useEffect(() => {
    let disposed = false;
    const operationWaiters = operationWaitersRef.current;
    disposedRef.current = false;
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
      disposedRef.current = true;
      for (const waiter of operationWaiters) settleOperationWaiter(waiter, false);
      removeListener();
      void service.dispose();
    };
  }, [acceptSnapshot, service, settleOperationWaiter]);

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

  const waitForArtifactOperations = useCallback(
    (operationIds: ReadonlySet<string>): Promise<boolean> => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot || areArtifactOperationsTerminal(currentSnapshot, operationIds)) {
        return Promise.resolve(currentSnapshot !== null);
      }
      return new Promise((resolve) => {
        const waiter: ArtifactOperationWaiter = {
          operationIds,
          resolve,
          timeout: setTimeout(() => settleOperationWaiter(waiter, false), ARTIFACT_CANCELLATION_SETTLE_TIMEOUT_MS),
        };
        operationWaitersRef.current.add(waiter);
        const latestSnapshot = snapshotRef.current;
        if (latestSnapshot && areArtifactOperationsTerminal(latestSnapshot, operationIds)) {
          settleOperationWaiter(waiter, true);
        }
      });
    },
    [settleOperationWaiter],
  );

  const cancelArtifactOperations = useCallback(
    async (operationIds: readonly string[]): Promise<boolean> => {
      const uniqueOperationIds = [...new Set(operationIds)];
      if (commandPendingRef.current) return false;
      if (uniqueOperationIds.length > MAX_CLOSE_CANCELLATION_OPERATIONS) {
        setState((current) => ({
          ...current,
          actionError: 'Local Whisper artifact cancellation could not be completed.',
        }));
        return false;
      }

      commandPendingRef.current = true;
      setState((current) => ({ ...current, pendingAction: 'cancel', actionError: null }));
      try {
        for (const operationId of uniqueOperationIds) {
          const currentProgress = snapshotRef.current?.progress.find((entry) => entry.operationId === operationId);
          if (!currentProgress || !isLocalWhisperArtifactProgressActive(currentProgress)) continue;
          if (!CANCELLABLE_ARTIFACT_PROGRESS_STATES.has(currentProgress.state)) continue;

          const result = await service.cancelArtifact(operationId);
          acceptSnapshot(result.snapshot, false);
          if (!result.success) {
            const latestProgress = result.snapshot.progress.find((entry) => entry.operationId === operationId);
            if (!latestProgress || !isLocalWhisperArtifactProgressActive(latestProgress)) continue;
            setState((current) => ({ ...current, actionError: safeActionError(result) }));
            return false;
          }
        }
        const settled = await waitForArtifactOperations(new Set(uniqueOperationIds));
        if (!settled && !disposedRef.current) {
          setState((current) => ({
            ...current,
            actionError: 'Local Whisper artifact cancellation could not be completed.',
          }));
        }
        return settled;
      } catch {
        setState((current) => ({
          ...current,
          actionError: 'Local Whisper artifact cancellation could not be completed.',
        }));
        return false;
      } finally {
        commandPendingRef.current = false;
        if (!disposedRef.current) setState((current) => ({ ...current, pendingAction: null }));
      }
    },
    [acceptSnapshot, service, waitForArtifactOperations],
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
        case 'update':
          return run('update', () => service.update(target), false);
        case 'cancel': {
          const operationId = state.snapshot
            ? getLatestLocalWhisperArtifactProgress(state.snapshot.progress, artifact.id)?.operationId
            : undefined;
          if (!operationId) return Promise.resolve(false);
          return cancelArtifactOperations([operationId]);
        }
        case 'remove':
          return run('remove', () => service.remove(target, true), false);
      }
    },
    [cancelArtifactOperations, run, service, state.snapshot],
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
    cancelArtifactOperations,
    openStorageFolder,
    viewArtifactReference,
    clearActionError,
  };
}
